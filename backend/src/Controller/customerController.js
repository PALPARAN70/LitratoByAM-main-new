// Customer-specific booking request controllers
const {
  createBookingRequest: createBookingRequestModel,
  getBookingRequestById: getBookingRequestByIdModel,
  getBookingRequestsByUserId,
  checkBookingConflicts: checkBookingConflictsModel,
  cancelBookingRequest: cancelBookingRequestModel,
} = require('../Model/bookingRequestModel')

// ADD THIS if you call pool.query(...) in this file
const { pool } = require('../Config/db')

// Helper: build a sanitized update set for editable customer fields
function buildCustomerBookingUpdate(updates = {}) {
  const allowed = {
    packageid: true,
    // core schedule fields
    event_date: true,
    event_time: true,
    event_end_time: true,
    extension_duration: true,
    // location/details
    event_address: true,
    grid: true,
    event_name: true,
    strongest_signal: true,
    // contacts
    contact_info: true,
    contact_person: true,
    contact_person_number: true,
    // misc
    notes: true,
  }
  const sets = []
  const values = []
  let idx = 1
  for (const [k, v] of Object.entries(updates)) {
    if (!allowed[k] || typeof v === 'undefined') continue
    sets.push(`${k} = $${idx}`)
    values.push(v)
    idx++
  }
  return { sets, values }
}

// Create a new booking (customer)
async function createBooking(req, res) {
  try {
    const userid = req.user.id
    const {
      packageid,
      event_date,
      event_time,
      event_end_time = null,
      extension_duration = null,
      event_address,
      contact_info = null,
      contact_person = null,
      contact_person_number = null,
      notes = null,
      event_name = null,
      strongest_signal = null,
      grid = null,
      grid_ids = null, // preferred moving forward
    } = req.body || {}

    if (!packageid || !event_date || !event_time || !event_address) {
      return res.status(400).json({
        message:
          'packageid, event_date, event_time and event_address are required',
      })
    }

    // Conflict check (same date & time with accepted only)
    const conflicts = await checkBookingConflictsModel({
      event_date,
      event_time,
    })
    if (conflicts.length) {
      return res.status(409).json({ message: 'Timeslot not available' })
    }

    // Create booking
    const booking = await createBookingRequestModel(
      packageid,
      userid,
      event_date,
      event_time,
      event_end_time,
      extension_duration,
      event_address,
      notes,
      event_name,
      strongest_signal,
      grid,
      contact_person,
      contact_person_number
    )

    // Patch contact info if provided
    if (contact_info) {
      await pool.query(
        `UPDATE booking_requests 
         SET contact_info = $1, last_updated = CURRENT_TIMESTAMP 
         WHERE requestid = $2`,
        [contact_info, booking.requestid]
      )
    }

    // Handle grid junction links (prefer provided ids; fallback to parsing names)
    try {
      const {
        setBookingGrids,
        filterVisibleGridIds,
      } = require('../Model/bookingGridsModel')
      const { pool } = require('../Config/db')
      let ids = Array.isArray(grid_ids)
        ? grid_ids.map((n) => Number(n)).filter(Number.isFinite)
        : []
      if (!ids.length && typeof grid === 'string' && grid.trim()) {
        // Map legacy comma-separated names -> ids
        const parts = grid
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        if (parts.length) {
          const q = `SELECT id FROM grids WHERE grid_name = ANY($1::text[])`
          const r = await pool.query(q, [parts])
          ids = r.rows.map((row) => row.id)
        }
      }
      // Enforce max 2 and visibility
      if (ids.length) {
        const visible = await filterVisibleGridIds(ids)
        await setBookingGrids(booking.requestid, visible.slice(0, 2))
      }
    } catch (e) {
      console.warn('booking grids link skipped:', e?.message)
    }

    // Return enriched booking details
    const full = await getBookingRequestByIdModel(booking.requestid)
    return res.status(201).json({ message: 'Booking created', booking: full })
  } catch (err) {
    console.error('createBooking error:', err)
    return res.status(500).json({ message: 'Server error creating booking' })
  }
}

// Edit booking details (only allowed fields: packageid, eventaddress, contact_info, notes)
async function editBookingRequest(req, res) {
  try {
    const userid = req.user.id
    const requestid = parseInt(req.params.id, 10)
    if (Number.isNaN(requestid)) {
      return res.status(400).json({ message: 'Invalid request id' })
    }

    const existing = await getBookingRequestByIdModel(requestid)
    if (!existing) {
      return res.status(404).json({ message: 'Booking not found' })
    }
    if (existing.userid !== userid) {
      return res.status(403).json({ message: 'Not your booking' })
    }
    // Allow edits when status is pending or accepted
    if (!['pending', 'accepted'].includes(existing.status)) {
      return res
        .status(400)
        .json({ message: 'Only pending/approved bookings can be edited' })
    }

    const {
      packageid,
      event_date,
      event_time,
      event_end_time,
      extension_duration,
      event_address,
      grid,
      grid_ids = null,
      event_name,
      strongest_signal,
      contact_info,
      contact_person,
      contact_person_number,
      notes,
    } = req.body || {}
    const { sets, values } = buildCustomerBookingUpdate({
      packageid,
      event_date,
      event_time,
      event_end_time,
      extension_duration,
      event_address,
      grid,
      event_name,
      strongest_signal,
      contact_info,
      contact_person,
      contact_person_number,
      notes,
    })
    if (!sets.length) {
      return res.status(400).json({ message: 'Nothing to update' })
    }

    // If booking is already accepted and user is changing date/time, revert to pending for re-approval
    let revertToPending = false
    if (existing.status === 'accepted') {
      const currentDate = String(
        existing.event_date || existing.eventdate || ''
      )
      const currentTime = String(
        existing.event_time || existing.eventtime || ''
      )
      const currentEnd = String(existing.event_end_time || '')
      const normalizeTime = (t) => (typeof t === 'string' ? t.slice(0, 5) : '')
      const newDate = typeof event_date === 'string' ? event_date : undefined
      const newTime = typeof event_time === 'string' ? event_time : undefined
      const newEnd =
        typeof event_end_time === 'string' ? event_end_time : undefined

      const dateChanged = !!(newDate && newDate !== currentDate)
      const timeChanged = !!(
        newTime && normalizeTime(newTime) !== normalizeTime(currentTime)
      )
      const endChanged = !!(
        newEnd && normalizeTime(newEnd) !== normalizeTime(currentEnd)
      )
      if (dateChanged || timeChanged || endChanged) {
        revertToPending = true
        // Optional: conflict check against accepted bookings for proposed slot
        try {
          const proposedDate = newDate || currentDate
          const proposedTime = normalizeTime(newTime || currentTime)
          if (proposedDate && proposedTime) {
            const conflicts = await checkBookingConflictsModel({
              event_date: proposedDate,
              event_time: proposedTime,
            })
            if (conflicts.length) {
              return res.status(409).json({ message: 'Timeslot not available' })
            }
          }
        } catch (e) {
          // proceed without blocking if conflict check fails unexpectedly
        }
      }
    }

    sets.push(`last_updated = CURRENT_TIMESTAMP`)
    if (revertToPending) {
      sets.push(`status = 'pending'`)
    }
    const q = `UPDATE booking_requests SET ${sets.join(
      ', '
    )} WHERE requestid = $${values.length + 1} RETURNING *`
    await pool.query(q, [...values, requestid])

    // Update junction links for grids if provided
    if (
      (Array.isArray(grid_ids) && grid_ids.length) ||
      (typeof grid === 'string' && grid.trim())
    ) {
      try {
        const {
          setBookingGrids,
          filterVisibleGridIds,
        } = require('../Model/bookingGridsModel')
        const { pool } = require('../Config/db')
        let ids = Array.isArray(grid_ids)
          ? grid_ids.map((n) => Number(n)).filter(Number.isFinite)
          : []
        if (!ids.length && typeof grid === 'string' && grid.trim()) {
          const parts = grid
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          if (parts.length) {
            const q = `SELECT id FROM grids WHERE grid_name = ANY($1::text[])`
            const r = await pool.query(q, [parts])
            ids = r.rows.map((row) => row.id)
          }
        }
        if (ids.length) {
          const visible = await filterVisibleGridIds(ids)
          await setBookingGrids(requestid, visible.slice(0, 2))
        } else {
          // if explicitly empty array, clear links
          if (Array.isArray(grid_ids) && grid_ids.length === 0) {
            const { removeBookingGrids } = require('../Model/bookingGridsModel')
            await removeBookingGrids(requestid)
          }
        }
      } catch (e) {
        console.warn('edit booking: grid links skipped:', e?.message)
      }
    }

    // If we reverted to pending, optionally cancel any confirmed booking linked to this request
    if (revertToPending) {
      try {
        await pool.query(
          `UPDATE confirmed_bookings 
           SET booking_status = 'cancelled', last_updated = CURRENT_TIMESTAMP
           WHERE requestid = $1 AND booking_status <> 'cancelled'`,
          [requestid]
        )
      } catch (e) {
        // non-fatal
      }
    }

    const full = await getBookingRequestByIdModel(requestid)
    return res.json({ message: 'Booking updated', booking: full })
  } catch (err) {
    console.error('editBooking error:', err)
    return res.status(500).json({ message: 'Server error editing booking' })
  }
}

// Cancel booking (soft status change)
async function cancelBookingRequest(req, res) {
  try {
    const userid = req.user.id
    const requestid = parseInt(req.params.id, 10)
    if (Number.isNaN(requestid)) {
      return res.status(400).json({ message: 'Invalid request id' })
    }

    const existing = await getBookingRequestByIdModel(requestid)
    if (!existing) {
      return res.status(404).json({ message: 'Booking not found' })
    }
    if (existing.userid !== userid) {
      return res.status(403).json({ message: 'Not your booking' })
    }
    if (!['pending', 'accepted'].includes(existing.status)) {
      return res
        .status(400)
        .json({ message: 'Only pending/accepted bookings can be cancelled' })
    }

    const updated = await cancelBookingRequestModel(requestid)
    return res.json({ message: 'Booking cancelled', booking: updated })
  } catch (err) {
    console.error('cancelBooking error:', err)
    return res.status(500).json({ message: 'Server error cancelling booking' })
  }
}

// Get a single booking (customer-owned)
async function getBookingRequest(req, res) {
  try {
    const userid = req.user.id
    const requestid = parseInt(req.params.id, 10)
    if (Number.isNaN(requestid))
      return res.status(400).json({ message: 'Invalid request id' })
    const booking = await getBookingRequestByIdModel(requestid)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })
    if (booking.userid !== userid)
      return res.status(403).json({ message: 'Not your booking' })
    return res.json({ booking })
  } catch (err) {
    console.error('getBookingRequest error:', err)
    return res.status(500).json({ message: 'Server error loading booking' })
  }
}

// List all bookings for the logged-in customer
async function getMyBookingRequests(req, res) {
  try {
    const userid = req.user.id
    const rows = await getBookingRequestsByUserId(userid)
    return res.json({ bookings: rows })
  } catch (err) {
    console.error('getMyBookingRequests error:', err)
    return res.status(500).json({ message: 'Server error loading bookings' })
  }
}

module.exports = {
  createBooking,
  editBookingRequest,
  cancelBookingRequest,
  getBookingRequest,
  getMyBookingRequests,
}
