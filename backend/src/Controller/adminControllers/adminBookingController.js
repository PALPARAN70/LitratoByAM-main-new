// <-------------------------Booking Requests functions------------------------------------->

// Admin booking request actions: accept/reject
const { pool } = require('../../Config/db')
const {
  getBookingRequestById,
  getAllBookingRequests,
} = require('../../Model/bookingRequestModel')
const {
  initConfirmedBookingTable,
  createConfirmedBooking,
  getConfirmedBookingByRequestId,
} = require('../../Model/confirmedBookingRequestModel')
const { sendEmail } = require('../../Util/sendEmail')

// Helper: send best-effort email; ignore failures
async function safeEmail(to, subject, html) {
  try {
    if (!to) return
    await sendEmail(to, subject, html)
  } catch (e) {
    console.warn('Email send failed:', e?.message)
  }
}

/**
 * Accept a pending booking request.
 * - Validates request exists and is pending
 * - Ensures no other accepted booking at the same date+time
 * - Atomically updates status to 'accepted'
 * - Creates a confirmed_bookings row
 */
async function acceptBookingRequest(req, res) {
  try {
    const requestid = parseInt(req.params.id, 10)
    if (Number.isNaN(requestid)) {
      return res.status(400).json({ message: 'Invalid request id' })
    }

    // Load request details first
    const existing = await getBookingRequestById(requestid)
    if (!existing) {
      return res.status(404).json({ message: 'Booking request not found' })
    }
    if (existing.status !== 'pending') {
      return res.status(400).json({
        message: `Only pending requests can be accepted (current: ${existing.status})`,
      })
    }

    // Atomic status update: only if currently pending AND no accepted booking exists for same timeslot
    const { rows: updatedRows } = await pool.query(
      `UPDATE booking_requests br
					 SET status = 'accepted', last_updated = CURRENT_TIMESTAMP 
				 WHERE br.requestid = $1 
					 AND br.status = 'pending'
					 AND NOT EXISTS (
						 SELECT 1 FROM booking_requests bx
							WHERE bx.event_date = br.event_date 
								AND bx.event_time = br.event_time 
								AND bx.status = 'accepted'
					 )
				 RETURNING *`,
      [requestid]
    )
    if (!updatedRows[0]) {
      // Determine why the atomic update failed and return a clearer message
      try {
        // Check if the timeslot is already accepted by another request
        const conflictCheck = await pool.query(
          `SELECT 1
             FROM booking_requests bx
            WHERE bx.event_date = $1
              AND bx.event_time = $2
              AND bx.status = 'accepted'
            LIMIT 1`,
          [existing.event_date, existing.event_time]
        )
        if (conflictCheck?.rowCount > 0) {
          return res.status(409).json({
            message:
              'Cannot accept: another booking for this date and time is already accepted.',
          })
        }

        // Otherwise, re-check the current status of this request
        const latest = await getBookingRequestById(requestid)
        if (!latest) {
          return res.status(404).json({ message: 'Booking request not found' })
        }
        if (latest.status !== 'pending') {
          return res.status(409).json({
            message: `Request is no longer pending (current: ${latest.status}).`,
          })
        }
      } catch (diagErr) {
        console.warn('acceptBookingRequest diagnostic check failed:', diagErr)
      }

      // Fallback generic message
      return res
        .status(409)
        .json({ message: 'Request status changed; cannot accept' })
    }

    // Ensure confirmed_bookings table exists and create a record
    await initConfirmedBookingTable()
    const confirmed = await createConfirmedBooking(requestid)

    // Notify customer (assumes username is an email address)
    await safeEmail(
      existing.username,
      'Your booking request was accepted',
      `<p>Hi ${existing.firstname || ''},</p>
			 <p>Your booking request for <strong>${existing.event_date} ${
        existing.event_time
      }</strong> has been <strong>accepted</strong>.</p>
			 <p>Package: ${existing.package_name || existing.packageid}</p>
			 <p>We will follow up with more details soon.</p>`
    )

    return res.json({
      message: 'Booking request accepted',
      request: updatedRows[0],
      confirmed,
    })
  } catch (err) {
    console.error('acceptBookingRequest error:', err)
    return res.status(500).json({ message: 'Server error accepting request' })
  }
}

/**
 * Reject a pending booking request.
 * - Validates request exists and is pending
 * - Ensures it is not already accepted/confirmed
 * - Updates status to 'rejected'
 * - Optionally stores an admin reason into notes
 */
async function rejectBookingRequest(req, res) {
  try {
    const requestid = parseInt(req.params.id, 10)
    if (Number.isNaN(requestid)) {
      return res.status(400).json({ message: 'Invalid request id' })
    }
    const { reason = null } = req.body || {}

    const existing = await getBookingRequestById(requestid)
    if (!existing) {
      return res.status(404).json({ message: 'Booking request not found' })
    }
    if (existing.status !== 'pending') {
      return res.status(400).json({
        message: `Only pending requests can be rejected (current: ${existing.status})`,
      })
    }

    const alreadyConfirmed = await getConfirmedBookingByRequestId(requestid)
    if (alreadyConfirmed) {
      return res
        .status(400)
        .json({ message: 'Cannot reject: request is already confirmed' })
    }

    // Update status and (optionally) notes in one atomic update
    const { rows: updatedRows } = await pool.query(
      `UPDATE booking_requests 
				 SET status = 'rejected', 
						 notes = COALESCE($2, notes), 
						 last_updated = CURRENT_TIMESTAMP 
			 WHERE requestid = $1 AND status = 'pending' 
			 RETURNING *`,
      [requestid, reason]
    )
    if (!updatedRows[0]) {
      return res
        .status(409)
        .json({ message: 'Request status changed; cannot reject' })
    }

    // Notify customer (assumes username is an email address)
    await safeEmail(
      existing.username,
      'Your booking request was rejected',
      `<p>Hi ${existing.firstname || ''},</p>
			 <p>We’re sorry, but your booking request for <strong>${existing.event_date} ${
        existing.event_time
      }</strong> was <strong>rejected</strong>.</p>
			 ${reason ? `<p>Reason: ${reason}</p>` : ''}`
    )

    return res.json({
      message: 'Booking request rejected',
      request: updatedRows[0],
    })
  } catch (err) {
    console.error('rejectBookingRequest error:', err)
    return res.status(500).json({ message: 'Server error rejecting request' })
  }
}

module.exports = {
  // List all booking requests (admin)
  async listBookingRequests(_req, res) {
    try {
      const rows = await getAllBookingRequests()
      return res.json({ bookings: rows })
    } catch (err) {
      console.error('listBookingRequests error:', err)
      return res
        .status(500)
        .json({ message: 'Server error listing booking requests' })
    }
  },
  acceptBookingRequest,
  rejectBookingRequest,
}

// <-------------------------End Booking Requests functions------------------------------------->
