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
  // Admin can update any booking request fields (subset)
  async updateBookingRequest(req, res) {
    try {
      const requestid = parseInt(req.params.id, 10)
      if (Number.isNaN(requestid)) {
        return res.status(400).json({ message: 'Invalid request id' })
      }

      const existing = await getBookingRequestById(requestid)
      if (!existing) {
        return res.status(404).json({ message: 'Booking request not found' })
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

      // Build SET clause allowing same fields as customer edit
      const allowed = {
        packageid: true,
        event_date: true,
        event_time: true,
        event_end_time: true,
        extension_duration: true,
        event_address: true,
        grid: true,
        event_name: true,
        strongest_signal: true,
        contact_info: true,
        contact_person: true,
        contact_person_number: true,
        notes: true,
      }
      const sets = []
      const values = []
      let idx = 1
      for (const [k, v] of Object.entries({
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
      })) {
        if (!allowed[k] || typeof v === 'undefined') continue
        sets.push(`${k} = $${idx}`)
        values.push(v)
        idx++
      }
      if (!sets.length) {
        return res.status(400).json({ message: 'Nothing to update' })
      }
      sets.push(`last_updated = CURRENT_TIMESTAMP`)
      await pool.query(
        `UPDATE booking_requests SET ${sets.join(', ')} WHERE requestid = $${
          values.length + 1
        }`,
        [...values, requestid]
      )

      // Update junction links for grids if provided
      if (
        (Array.isArray(grid_ids) && grid_ids.length) ||
        (typeof grid === 'string' && grid?.trim())
      ) {
        try {
          const {
            setBookingGrids,
            filterVisibleGridIds,
          } = require('../../Model/bookingGridsModel')
          const { pool } = require('../../Config/db')
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
            if (Array.isArray(grid_ids) && grid_ids.length === 0) {
              const {
                removeBookingGrids,
              } = require('../../Model/bookingGridsModel')
              await removeBookingGrids(requestid)
            }
          }
        } catch (e) {
          console.warn('admin update booking: grid links skipped:', e?.message)
        }
      }

      const updated = await getBookingRequestById(requestid)
      return res.json({ message: 'Booking updated', booking: updated })
    } catch (err) {
      console.error('admin updateBookingRequest error:', err)
      return res.status(500).json({ message: 'Server error updating booking' })
    }
  },
  acceptBookingRequest,
  rejectBookingRequest,
}

// <-------------------------End Booking Requests functions------------------------------------->
