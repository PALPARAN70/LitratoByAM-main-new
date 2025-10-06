// Customer-specific booking request controllers
const {
  createBookingRequest,
  getBookingRequestById,
  checkBookingConflicts,
  cancelBookingRequest,
} = require('../Model/bookingRequestModel')
const { pool } = require('../Config/db')

// Helper: build a sanitized update set for editable customer fields
function buildCustomerBookingUpdate(updates = {}) {
  const allowed = {
    packageid: true,
    eventaddress: true,
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
      eventdate,
      eventtime,
      eventaddress,
      contact_info = null,
      notes = null,
    } = req.body || {}

    if (!packageid || !eventdate || !eventtime || !eventaddress) {
      return res.status(400).json({
        message:
          'Missing required fields: packageid, eventdate, eventtime, eventaddress',
      })
    }

    // Conflict check (same date & time with pending/accepted)
    const conflicts = await checkBookingConflicts(eventdate, eventtime)
    if (conflicts.length) {
      return res.status(409).json({
        message: 'Selected date/time is no longer available',
        conflicts: conflicts.map((c) => c.requestid),
      })
    }

    // Use existing model create (doesn't include contact_info) then patch contact if provided
    let booking = await createBookingRequest(
      packageid,
      userid,
      eventdate,
      eventtime,
      eventaddress,
      notes
    )

    if (contact_info) {
      const upd = await pool.query(
        'UPDATE booking_requests SET contact_info = $1 WHERE requestid = $2 RETURNING *',
        [contact_info, booking.requestid]
      )
      booking = upd.rows[0]
    }

    // Return enriched booking details
    const full = await getBookingRequestById(booking.requestid)
    return res.status(201).json({ message: 'Booking created', booking: full })
  } catch (err) {
    console.error('createBooking error:', err)
    return res.status(500).json({ message: 'Server error creating booking' })
  }
}

// Edit booking details (only allowed fields: packageid, eventaddress, contact_info, notes)
async function editBooking(req, res) {
  try {
    const userid = req.user.id
    const requestid = parseInt(req.params.id, 10)
    if (Number.isNaN(requestid)) {
      return res.status(400).json({ message: 'Invalid booking id' })
    }
    const existing = await getBookingRequestById(requestid)
    if (!existing) return res.status(404).json({ message: 'Booking not found' })
    if (existing.userid !== userid)
      return res.status(403).json({ message: 'Not your booking' })
    if (!['pending'].includes(existing.status)) {
      return res.status(400).json({
        message: 'Only pending bookings can be edited',
      })
    }

    const { packageid, eventaddress, contact_info, notes } = req.body || {}
    const { sets, values } = buildCustomerBookingUpdate({
      packageid,
      eventaddress,
      contact_info,
      notes,
    })
    if (!sets.length) {
      return res.status(400).json({ message: 'No editable fields provided' })
    }

    // Perform update
    const query = `UPDATE booking_requests SET ${sets.join(
      ', '
    )}, last_updated = CURRENT_TIMESTAMP WHERE requestid = $$${
      values.length + 1
    } RETURNING *`
    // Because we used $$ concatenation for dynamic param index, adjust indexing properly
    // Simpler: rebuild with normal increment
    let paramIdx = 1
    const finalSets = []
    const finalValues = []
    for (const [k, v] of Object.entries({
      packageid,
      eventaddress,
      contact_info,
      notes,
    })) {
      if (typeof v === 'undefined' || v === null) continue
      finalSets.push(`${k} = $${paramIdx}`)
      finalValues.push(v)
      paramIdx++
    }
    finalSets.push(`last_updated = CURRENT_TIMESTAMP`)
    const finalQuery = `UPDATE booking_requests SET ${finalSets.join(
      ', '
    )} WHERE requestid = $${paramIdx} RETURNING *`
    finalValues.push(requestid)
    await pool.query(finalQuery, finalValues)

    const full = await getBookingRequestById(requestid)
    return res.json({ message: 'Booking updated', booking: full })
  } catch (err) {
    console.error('editBooking error:', err)
    return res.status(500).json({ message: 'Server error editing booking' })
  }
}

// Cancel booking (soft status change)
async function cancelBooking(req, res) {
  try {
    const userid = req.user.id
    const requestid = parseInt(req.params.id, 10)
    if (Number.isNaN(requestid)) {
      return res.status(400).json({ message: 'Invalid booking id' })
    }
    const existing = await getBookingRequestById(requestid)
    if (!existing) return res.status(404).json({ message: 'Booking not found' })
    if (existing.userid !== userid)
      return res.status(403).json({ message: 'Not your booking' })
    if (existing.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking already cancelled' })
    }
    if (['rejected'].includes(existing.status)) {
      return res
        .status(400)
        .json({ message: 'Cannot cancel a rejected booking' })
    }

    const cancelled = await cancelBookingRequest(requestid)
    const full = await getBookingRequestById(cancelled.requestid)
    return res.json({ message: 'Booking cancelled', booking: full })
  } catch (err) {
    console.error('cancelBooking error:', err)
    return res.status(500).json({ message: 'Server error cancelling booking' })
  }
}

module.exports = {
  createBooking,
  editBooking,
  cancelBooking,
}
