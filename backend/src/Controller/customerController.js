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
    event_address: true,
    contact_info: true,
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
      event_address,
      contact_info = null,
      notes = null,
      event_name = null,
      strongest_signal = null,
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
      event_address,
      notes,
      event_name,
      strongest_signal
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
    if (!['pending'].includes(existing.status)) {
      return res
        .status(400)
        .json({ message: 'Only pending bookings can be edited' })
    }

    const { packageid, event_address, contact_info, notes } = req.body || {}
    const { sets, values } = buildCustomerBookingUpdate({
      packageid,
      event_address,
      contact_info,
      notes,
    })
    if (!sets.length) {
      return res.status(400).json({ message: 'Nothing to update' })
    }

    sets.push(`last_updated = CURRENT_TIMESTAMP`)
    const q = `UPDATE booking_requests SET ${sets.join(
      ', '
    )} WHERE requestid = $${values.length + 1} RETURNING *`
    await pool.query(q, [...values, requestid])

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
