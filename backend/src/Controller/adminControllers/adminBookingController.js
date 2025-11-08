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
              AND bx.packageid = br.packageid
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
              AND bx.packageid = $3
            LIMIT 1`,
          [existing.event_date, existing.event_time, existing.packageid]
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

    // Auto-reject other pending requests with the same date, time, and package
    try {
      const reason =
        'Automatically rejected: another booking for this package and schedule was accepted.'
      const { rows: affected } = await pool.query(
        `UPDATE booking_requests br
           SET status = 'rejected',
               notes = CASE
                         WHEN br.notes IS NULL OR br.notes = '' THEN $5
                         ELSE br.notes || E'\n' || $5
                       END,
               last_updated = CURRENT_TIMESTAMP
         FROM users u
         WHERE br.userid = u.id
           AND br.status = 'pending'
           AND br.event_date = $1
           AND br.event_time = $2
           AND br.packageid = $3
           AND br.requestid <> $4
         RETURNING br.requestid, u.username, u.firstname, u.lastname`,
        [
          existing.event_date,
          existing.event_time,
          existing.packageid,
          requestid,
          reason,
        ]
      )
      if (Array.isArray(affected) && affected.length) {
        for (const row of affected) {
          const to = row.username
          if (!to) continue
          const name = [row.firstname, row.lastname]
            .filter(Boolean)
            .join(' ')
            .trim()
          const html = `<p>Hi ${name || 'Customer'},</p>
            <p>Your pending booking request at the same date and time for this package has been <b>rejected</b> because another request was accepted.</p>
            <p>You may submit a new request for a different time slot or package.</p>
            <p>— Litrato Team</p>`
          try {
            await safeEmail(
              to,
              'Booking request rejected (schedule conflict)',
              html
            )
          } catch (e) {
            // best-effort
          }
        }
      }
    } catch (e) {
      console.warn('auto-reject pendings failed:', e?.message)
    }

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
        booth_placement,
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
        booth_placement: true,
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
        booth_placement,
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

      // Fetch the updated row (includes joined package + aggregated grid names)
      const updated = await getBookingRequestById(requestid)

      // Build and send a change notification email when notable fields are updated
      try {
        const to = existing.username
        if (to) {
          const diffLines = []
          const label = (k) =>
            ({
              contact_person: 'Contact person',
              contact_person_number: 'Contact person number',
              event_name: 'Event name',
              event_address: 'Event location',
              extension_duration: 'Extension hours',
              strongest_signal: 'Strongest signal',
              packageid: 'Package',
              grid: 'Grids',
              event_date: 'Event date',
              event_time: 'Start time',
              event_end_time: 'End time',
              booth_placement: 'Booth placement',
            }[k] || k)

          // Helper to push old -> new lines (strings)
          const pushChange = (key, oldVal, newVal) => {
            const o = oldVal ?? ''
            const n = newVal ?? ''
            if (String(o) === String(n)) return
            diffLines.push(
              `<li>${label(key)}: <b>${o || '—'}</b> → <b>${n || '—'}</b></li>`
            )
          }

          // Package (show names)
          if (typeof packageid !== 'undefined') {
            const oldPkg = existing.package_name || existing.packageid
            const newPkg = updated?.package_name || packageid
            pushChange('packageid', oldPkg, newPkg)
          }

          // Date/Times
          if (typeof event_date !== 'undefined')
            pushChange('event_date', existing.event_date, updated?.event_date)
          if (typeof event_time !== 'undefined')
            pushChange('event_time', existing.event_time, updated?.event_time)
          if (typeof event_end_time !== 'undefined')
            pushChange(
              'event_end_time',
              existing.event_end_time,
              updated?.event_end_time
            )

          // Contact
          if (typeof contact_person !== 'undefined')
            pushChange(
              'contact_person',
              existing.contact_person,
              updated?.contact_person
            )
          if (typeof contact_person_number !== 'undefined')
            pushChange(
              'contact_person_number',
              existing.contact_person_number,
              updated?.contact_person_number
            )

          // Event details
          if (typeof event_name !== 'undefined')
            pushChange('event_name', existing.event_name, updated?.event_name)
          if (typeof event_address !== 'undefined')
            pushChange(
              'event_address',
              existing.event_address,
              updated?.event_address
            )
          if (typeof extension_duration !== 'undefined')
            pushChange(
              'extension_duration',
              existing.extension_duration,
              updated?.extension_duration
            )
          if (typeof strongest_signal !== 'undefined')
            pushChange(
              'strongest_signal',
              existing.strongest_signal,
              updated?.strongest_signal
            )
          if (typeof booth_placement !== 'undefined')
            pushChange(
              'booth_placement',
              existing.booth_placement,
              updated?.booth_placement
            )

          // Grids (compare names)
          if (
            (Array.isArray(grid_ids) && grid_ids.length >= 0) ||
            typeof grid !== 'undefined'
          ) {
            const toNames = (x) =>
              Array.isArray(x)
                ? x
                : typeof x === 'string' && x.trim().startsWith('[')
                ? JSON.parse(x)
                : typeof x === 'string' && x.trim()
                ? x
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : []
            const oldNames = toNames(existing.grid_names || existing.grid)
            const newNames = toNames(updated?.grid_names || updated?.grid)
            if (oldNames.join('|') !== newNames.join('|')) {
              diffLines.push(
                `<li>${label('grid')}: <b>${
                  oldNames.length ? oldNames.join(', ') : '—'
                }</b> → <b>${
                  newNames.length ? newNames.join(', ') : '—'
                }</b></li>`
              )
            }
          }

          if (diffLines.length) {
            const name =
              [existing.firstname, existing.lastname]
                .filter(Boolean)
                .join(' ')
                .trim() || 'Customer'
            const when = [updated?.event_date, updated?.event_time]
              .filter(Boolean)
              .join(' ')
            const title = updated?.event_name || 'your booking'
            const html = `
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
                <p>Hi ${name},</p>
                <p>We updated some details for ${title} on <b>${
              when || 'your scheduled date'
            }</b>.</p>
                <p>Here’s a summary of the changes:</p>
                <ul style="margin:0;padding-left:20px">${diffLines.join(
                  ''
                )}</ul>
                <p>If anything looks off, please reply to this email.</p>
                <p>— Litrato Team</p>
              </div>
            `
            await safeEmail(to, 'Your booking details were updated', html)
          }
        }
      } catch (e) {
        console.warn('admin updateBookingRequest email failed:', e?.message)
      }

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
