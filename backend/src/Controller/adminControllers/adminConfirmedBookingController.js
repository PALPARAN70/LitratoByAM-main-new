const {
  initConfirmedBookingTable,
  listConfirmedBookings,
  createConfirmedBooking,
  getConfirmedBookingById,
  getConfirmedBookingByRequestId,
  setContractSigned,
  updatePaymentStatus,
  updateBookingStatus,
  updateTotalPrice,
} = require('../../Model/confirmedBookingRequestModel')
const { sendEmail } = require('../../Util/sendEmail')
const {
  assignStaff: assignStaffToModel,
  getStaffForBooking,
  initConfirmedBookingStaffTable,
} = require('../../Model/confirmedBookingStaffModel')
const {
  createBookingRequest,
  updateBookingRequestStatus,
  checkBookingConflicts,
} = require('../../Model/bookingRequestModel')
const { findUserById, findUserByUsername } = require('../../Model/userModel')

// Ensure table exists once when the controller is loaded (best-effort)
initConfirmedBookingTable().catch((e) =>
  console.warn('Init confirmed_bookings table failed:', e?.message)
)
// Ensure staff assignment junction table exists
initConfirmedBookingStaffTable().catch((e) =>
  console.warn('Init confirmed_booking_staff table failed:', e?.message)
)

async function list(req, res) {
  try {
    const rows = await listConfirmedBookings()
    return res.json({ bookings: rows })
  } catch (err) {
    console.error('confirmed.list error:', err)
    return res.status(500).json({ message: 'Error listing confirmed bookings' })
  }
}

async function getById(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    const row = await getConfirmedBookingById(id)
    if (!row) return res.status(404).json({ message: 'Not found' })
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.getById error:', err)
    return res.status(500).json({ message: 'Error loading confirmed booking' })
  }
}

async function getByRequestId(req, res) {
  try {
    const requestid = parseInt(req.params.requestid, 10)
    if (Number.isNaN(requestid))
      return res.status(400).json({ message: 'Invalid request id' })
    const row = await getConfirmedBookingByRequestId(requestid)
    if (!row) return res.status(404).json({ message: 'Not found' })
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.getByRequestId error:', err)
    return res.status(500).json({ message: 'Error loading confirmed booking' })
  }
}

async function markContractSigned(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    const { signed = true } = req.body || {}
    const row = await setContractSigned(id, !!signed)
    if (!row) return res.status(404).json({ message: 'Not found' })
    // Notify user about contract status change (best-effort)
    try {
      const full = await getConfirmedBookingById(id)
      await notifyBookingUpdate(full, { contract_signed: !!signed })
    } catch (e) {
      console.warn('email notify (contract) failed:', e?.message)
    }
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.markContractSigned error:', err)
    return res.status(500).json({ message: 'Error updating contract status' })
  }
}

async function setPaymentStatus(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    const { status } = req.body || {}
    if (!status) return res.status(400).json({ message: 'status required' })
    const row = await updatePaymentStatus(id, status)
    if (!row) return res.status(404).json({ message: 'Not found' })
    // Notify user about payment status change (best-effort)
    try {
      const full = await getConfirmedBookingById(id)
      await notifyBookingUpdate(full, { payment_status: status })
    } catch (e) {
      console.warn('email notify (payment) failed:', e?.message)
    }
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.setPaymentStatus error:', err)
    return res
      .status(400)
      .json({ message: err?.message || 'Error updating payment status' })
  }
}

async function setBookingStatus(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    const { status } = req.body || {}
    if (!status) return res.status(400).json({ message: 'status required' })
    const row = await updateBookingStatus(id, status)
    if (!row) return res.status(404).json({ message: 'Not found' })
    // Notify user about booking status change (best-effort)
    try {
      const full = await getConfirmedBookingById(id)
      await notifyBookingUpdate(full, { booking_status: status })
    } catch (e) {
      console.warn('email notify (booking status) failed:', e?.message)
    }
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.setBookingStatus error:', err)
    return res
      .status(400)
      .json({ message: err?.message || 'Error updating booking status' })
  }
}

async function setTotalPrice(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    const { total } = req.body || {}
    if (typeof total === 'undefined')
      return res.status(400).json({ message: 'total required' })
    const parsed = Number(total)
    if (!Number.isFinite(parsed) || parsed < 0)
      return res
        .status(400)
        .json({ message: 'total must be a non-negative number' })
    const row = await updateTotalPrice(id, parsed)
    if (!row) return res.status(404).json({ message: 'Not found' })
    // Notify user about total price change (best-effort)
    try {
      const full = await getConfirmedBookingById(id)
      await notifyBookingUpdate(full, { total_booking_price: parsed })
    } catch (e) {
      console.warn('email notify (total) failed:', e?.message)
    }
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.setTotalPrice error:', err)
    return res.status(500).json({ message: 'Error updating total price' })
  }
}

// Combined updater: accepts any subset of { contractSigned, paymentStatus, bookingStatus, total }
async function updateConfirmedCombined(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })

    const { contractSigned, paymentStatus, bookingStatus, total } =
      req.body || {}

    let last = null
    const changes = {}

    if (typeof contractSigned === 'boolean') {
      last = await setContractSigned(id, !!contractSigned)
      changes.contract_signed = !!contractSigned
    }

    if (typeof paymentStatus === 'string') {
      try {
        last = await updatePaymentStatus(id, paymentStatus)
        changes.payment_status = paymentStatus
      } catch (e) {
        return res
          .status(400)
          .json({ message: e?.message || 'Invalid payment status' })
      }
    }

    if (typeof bookingStatus === 'string') {
      try {
        last = await updateBookingStatus(id, bookingStatus)
        changes.booking_status = bookingStatus
      } catch (e) {
        return res
          .status(400)
          .json({ message: e?.message || 'Invalid booking status' })
      }
    }

    if (typeof total !== 'undefined') {
      const parsed = Number(total)
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res
          .status(400)
          .json({ message: 'total must be a non-negative number' })
      }
      last = await updateTotalPrice(id, parsed)
      changes.total_booking_price = parsed
    }

    if (!last) {
      last = await getConfirmedBookingById(id)
      if (!last) return res.status(404).json({ message: 'Not found' })
    }

    try {
      if (Object.keys(changes).length > 0) {
        const full = await getConfirmedBookingById(id)
        await notifyBookingUpdate(full, changes)
      }
    } catch (e) {
      console.warn('email notify (combined) failed:', e?.message)
    }

    return res.json({ booking: last })
  } catch (err) {
    console.error('confirmed.updateConfirmedCombined error:', err)
    return res.status(500).json({ message: 'Error updating confirmed booking' })
  }
}

// Cancel a confirmed booking (sets booking_status = 'cancelled')
async function cancelConfirmed(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    // Optional cancellation reason from body; not persisted currently
    const { reason } = req.body || {}
    if (reason) {
      // Consider persisting to a future audit table; for now, log best-effort
      console.log('Cancellation reason:', reason)
    }
    const row = await updateBookingStatus(id, 'cancelled')
    if (!row) return res.status(404).json({ message: 'Not found' })
    // Notify user about cancellation (best-effort)
    try {
      const full = await getConfirmedBookingById(id)
      await notifyBookingUpdate(full, { booking_status: 'cancelled' }, reason)
    } catch (e) {
      console.warn('email notify (cancel) failed:', e?.message)
    }
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.cancelConfirmed error:', err)
    return res
      .status(500)
      .json({ message: 'Error cancelling confirmed booking' })
  }
}

// ----- Email notification helpers -----
function currency(n) {
  const num = Number(n ?? 0)
  return `₱${num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

async function notifyBookingUpdate(booking, changes = {}, reason) {
  if (!booking) return
  const to = booking.username
  if (!to) return // no email available
  const name =
    [booking.firstname, booking.lastname].filter(Boolean).join(' ') ||
    'Customer'
  const when = [booking.event_date, booking.event_time]
    .filter(Boolean)
    .join(' ')
  const title = booking.event_name || 'your booking'

  const lines = []
  if (Object.prototype.hasOwnProperty.call(changes, 'booking_status')) {
    const v = changes.booking_status
    lines.push(`<li>Booking status: <b>${v}</b></li>`)
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'payment_status')) {
    const v = changes.payment_status
    lines.push(`<li>Payment status: <b>${v}</b></li>`)
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'contract_signed')) {
    const v = changes.contract_signed
    lines.push(`<li>Contract: <b>${v ? 'Signed' : 'Not signed'}</b></li>`)
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'total_booking_price')) {
    const v = changes.total_booking_price
    lines.push(`<li>Total price: <b>${currency(v)}</b></li>`)
  }
  if (reason) {
    lines.push(`<li>Reason: <i>${String(reason)}</i></li>`)
  }

  const changesHtml = lines.length
    ? `<ul style="margin:0;padding-left:20px">${lines.join('')}</ul>`
    : '<p>No specific field changes provided.</p>'

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
      <p>Hi ${name},</p>
      <p>This is a quick update about ${title} on <b>${
    when || 'your scheduled date'
  }</b>.</p>
      <p>Here are the latest changes:</p>
      ${changesHtml}
      <p>If you have any questions, just reply to this email.</p>
      <p>— Litrato Team</p>
    </div>
  `

  const subject =
    Object.prototype.hasOwnProperty.call(changes, 'booking_status') &&
    changes.booking_status === 'cancelled'
      ? 'Your booking has been cancelled'
      : 'Your booking has been updated'

  await sendEmail(to, subject, html)
}

// Admin creates a booking and immediately confirms it
async function createAndConfirm(req, res) {
  try {
    const {
      userid = null,
      email = null,
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
      grid_ids = null,
    } = req.body || {}
    // Resolve user and ensure verified
    let userRecord = null
    if (userid) {
      userRecord = await findUserById(userid)
      if (!userRecord)
        return res.status(404).json({ message: 'User not found' })
    } else {
      if (!email)
        return res.status(400).json({ message: 'userid or email is required' })
      userRecord = await findUserByUsername(email)
      if (!userRecord)
        return res
          .status(404)
          .json({ message: 'User not found for provided email' })
    }
    if (!userRecord.is_verified) {
      return res.status(400).json({
        message: 'User email is not verified. Please verify the account first.',
      })
    }
    if (!packageid || !event_date || !event_time || !event_address) {
      return res.status(400).json({
        message:
          'packageid, event_date, event_time and event_address are required',
      })
    }

    // uid resolved from verified user
    const uid = userRecord.id

    // Prevent conflicts with already accepted bookings
    const conflicts = await checkBookingConflicts({ event_date, event_time })
    if (Array.isArray(conflicts) && conflicts.length) {
      return res.status(409).json({ message: 'Timeslot not available' })
    }

    // Create booking request row
    const booking = await createBookingRequest(
      packageid,
      uid,
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

    // Patch contact_info if provided
    if (contact_info) {
      const { pool } = require('../../Config/db')
      await pool.query(
        `UPDATE booking_requests SET contact_info = $1, last_updated = CURRENT_TIMESTAMP WHERE requestid = $2`,
        [contact_info, booking.requestid]
      )
    }

    // Handle grid junction links (prefer provided ids; fallback to parsing names)
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
        await setBookingGrids(booking.requestid, visible.slice(0, 2))
      }
    } catch (e) {
      console.warn('confirmed booking: grid links skipped:', e?.message)
    }

    // Mark as accepted
    await updateBookingRequestStatus(booking.requestid, 'accepted')

    // Create confirmed booking
    await initConfirmedBookingTable()
    const confirmed = await createConfirmedBooking(booking.requestid)

    // Notify customer (send to verified email)
    try {
      const subj = 'Your booking has been confirmed'
      const html = `<p>Hi ${userRecord?.firstname || ''},</p>
        <p>Your booking for <strong>${event_date} ${event_time}</strong> has been <strong>confirmed</strong>.</p>
        <p>We look forward to your event.</p>`
      if (userRecord?.username) await sendEmail(userRecord.username, subj, html)
    } catch (e) {
      console.warn('email notify (createAndConfirm) failed:', e?.message)
    }

    return res.status(201).json({
      message: 'Booking created and confirmed',
      request: booking,
      confirmed,
    })
  } catch (err) {
    console.error('confirmed.createAndConfirm error:', err)
    return res.status(500).json({ message: 'Error creating confirmed booking' })
  }
}

module.exports = {
  list,
  getById,
  getByRequestId,
  markContractSigned,
  setPaymentStatus,
  setBookingStatus,
  setTotalPrice,
  updateConfirmedCombined,
  cancelConfirmed,
  createAndConfirm,
  // staff assignment
  async listStaffForBooking(req, res) {
    try {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id))
        return res.status(400).json({ message: 'Invalid id' })
      const staff = await getStaffForBooking(id)
      return res.json({ staff })
    } catch (err) {
      console.error('confirmed.listStaffForBooking error:', err)
      return res
        .status(500)
        .json({ message: 'Error loading assigned staff for booking' })
    }
  },
  async assignStaff(req, res) {
    try {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id))
        return res.status(400).json({ message: 'Invalid id' })
      const { staffUserIds } = req.body || {}
      if (!Array.isArray(staffUserIds) || staffUserIds.length === 0)
        return res
          .status(400)
          .json({ message: 'staffUserIds array is required' })
      // model enforces max 2 including existing assignments
      const staff = await assignStaffToModel(id, staffUserIds)
      return res.json({ staff })
    } catch (err) {
      console.error('confirmed.assignStaff error:', err)
      return res
        .status(400)
        .json({ message: err?.message || 'Error assigning staff' })
    }
  },
}
