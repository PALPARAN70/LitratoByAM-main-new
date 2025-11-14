const {
  initConfirmedBookingStaffTable,
  listAssignedConfirmedBookings,
} = require('../Model/confirmedBookingStaffModel')
const {
  updateBookingStatus,
  getPaymentSummary,
  getConfirmedBookingById,
  recalcAndPersistPaymentStatus,
} = require('../Model/confirmedBookingRequestModel')
const { pool } = require('../Config/db')
// NEW: reuse package/inventory models for staff-safe package items list
const packageModel = require('../Model/packageModel')
const packageInventoryItemModel = require('../Model/packageInventoryItemModel')
const inventoryModel = require('../Model/inventoryModel')
// NEW: reuse payment models/logs
const paymentModel = require('../Model/paymentModel')
const paymentLogsModel = require('../Model/paymentLogsModel')
const {
  initEventStaffLogsTable,
  getLogsForBooking: getStaffLogsForBooking,
  updateMyLog: updateMyStaffLog,
} = require('../Model/eventStaffLogsModel')

// Ensure the staff assignment table exists on load (best-effort)
initConfirmedBookingStaffTable().catch((e) =>
  console.warn('Init assigned_staff table (employee) failed:', e?.message)
)
// Ensure staff logs table exists on load
initEventStaffLogsTable().catch((e) =>
  console.warn('Init event_staff_logs table (employee) failed:', e?.message)
)

exports.getDashboard = (req, res) => {
  res.json({ message: 'Employee Dashboard', user: req.user })
}

exports.handleOrders = (req, res) => {
  res.json({ message: 'Handle Orders - Employee Only' })
}

// List confirmed bookings assigned to the authenticated employee
exports.listAssignedConfirmedBookings = async (req, res) => {
  try {
    const uid = req?.user?.id
    if (!uid) return res.status(401).json({ message: 'Unauthorized' })
    const rows = await listAssignedConfirmedBookings(uid)
    return res.json({ bookings: rows })
  } catch (err) {
    console.error('employee.listAssignedConfirmedBookings error:', err)
    return res
      .status(500)
      .json({ message: 'Error loading assigned confirmed bookings' })
  }
}

// Allow an employee to update the booking_status of a confirmed booking they are assigned to
// Allowed statuses for staff: scheduled | in_progress | completed
exports.setAssignedBookingStatus = async (req, res) => {
  try {
    const uid = req?.user?.id
    if (!uid) return res.status(401).json({ message: 'Unauthorized' })

    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: 'Invalid booking id' })

    const { status } = req.body || {}
    const allowed = new Set(['scheduled', 'in_progress', 'completed'])
    if (typeof status !== 'string' || !allowed.has(status)) {
      return res.status(400).json({ message: 'Invalid or disallowed status' })
    }

    // Ensure the booking is assigned to this staff user
    const { rows } = await pool.query(
      `SELECT 1 FROM assigned_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
      [id, uid]
    )
    if (!rows[0]) {
      return res
        .status(403)
        .json({ message: 'You are not assigned to this booking' })
    }

    const updated = await updateBookingStatus(id, status)
    if (!updated) return res.status(404).json({ message: 'Not found' })
    return res.json({ booking: updated })
  } catch (err) {
    console.error('employee.setAssignedBookingStatus error:', err)
    return res.status(500).json({ message: 'Error updating booking status' })
  }
}

// Get payment summary for an assigned confirmed booking (employee-only)
exports.getAssignedBookingPaymentSummary = async (req, res) => {
  try {
    const uid = req?.user?.id
    if (!uid) return res.status(401).json({ message: 'Unauthorized' })

    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: 'Invalid booking id' })

    // Ensure the booking is assigned to this staff user
    const { rows } = await pool.query(
      `SELECT 1 FROM assigned_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
      [id, uid]
    )
    if (!rows[0]) {
      return res
        .status(403)
        .json({ message: 'You are not assigned to this booking' })
    }

    const summary = await getPaymentSummary(id)
    return res.json({ bookingid: id, ...summary })
  } catch (err) {
    console.error('employee.getAssignedBookingPaymentSummary error:', err)
    return res
      .status(500)
      .json({ message: 'Error loading payment summary for booking' })
  }
}

// NEW: Allow employees to view items in a package (read-only)
exports.listPackageItemsForPackage = async (req, res) => {
  try {
    const { package_id } = req.params
    const packageId = Number(package_id)
    if (!Number.isFinite(packageId)) {
      return res.status(400).json({ message: 'Invalid package ID' })
    }
    const pkg = await packageModel.getPackageByIdAny(packageId)
    if (!pkg) return res.status(404).json({ message: 'Package not found' })
    const items =
      await packageInventoryItemModel.getPackageInventoryItemsByPackage(
        packageId
      )
    return res.json({ items })
  } catch (err) {
    console.error('employee.listPackageItemsForPackage error:', err)
    return res
      .status(500)
      .json({ message: 'Error loading package items for employee' })
  }
}

// NEW: Allow employees to update equipment condition/status (limited fields)
exports.updateInventoryItemLimited = async (req, res) => {
  try {
    const { inventoryID } = req.params
    const id = Number(inventoryID)
    if (!Number.isFinite(id))
      return res.status(400).json({ message: 'Invalid equipment id' })

    const body = req.body || {}
    const updates = {}
    if (Object.prototype.hasOwnProperty.call(body, 'condition')) {
      const c = String(body.condition || '').trim()
      if (c) updates.condition = c
    }
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      updates.status = Boolean(body.status)
    }
    // Allow staff to attach notes describing damage/missing context
    if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
      const n = String(body.notes || '').trim()
      // Accept empty string to clear notes explicitly
      updates.notes = n.length ? n : ''
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No updatable fields provided' })
    }

    const current = await inventoryModel.findInventoryById(id)
    if (!current) return res.status(404).json({ message: 'Not found' })

    const updated = await inventoryModel.updateInventory(id, updates)
    return res.json({ item: updated })
  } catch (err) {
    console.error('employee.updateInventoryItemLimited error:', err)
    return res
      .status(500)
      .json({ message: 'Error updating equipment (employee)' })
  }
}

// NEW: List staff logs for a booking (only for staff assigned to this booking)
exports.getAssignedBookingStaffLogs = async (req, res) => {
  try {
    const uid = req?.user?.id
    if (!uid) return res.status(401).json({ message: 'Unauthorized' })
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: 'Invalid booking id' })

    const { rows } = await pool.query(
      `SELECT 1 FROM assigned_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
      [id, uid]
    )
    if (!rows[0]) {
      return res
        .status(403)
        .json({ message: 'You are not assigned to this booking' })
    }
    const raw = await getStaffLogsForBooking(id)
    const logs = raw.map((l) => ({
      ...l,
      is_me: Number(l.staff_userid) === Number(uid),
    }))
    return res.json({ logs })
  } catch (err) {
    console.error('employee.getAssignedBookingStaffLogs error:', err)
    return res
      .status(500)
      .json({ message: 'Error loading staff logs for booking' })
  }
}

// NEW: Update the authenticated staff user's log for a booking
// Body example: { field: 'arrived_at', value?: string|null } where value omitted = now
exports.updateMyStaffLogForBooking = async (req, res) => {
  try {
    const uid = req?.user?.id
    if (!uid) return res.status(401).json({ message: 'Unauthorized' })
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: 'Invalid booking id' })
    const { field, value } = req.body || {}
    const allowed = new Set([
      'arrived_at',
      'setup_finished_at',
      'started_at',
      'ended_at',
      'picked_up_at',
    ])
    if (typeof field !== 'string' || !allowed.has(field)) {
      return res.status(400).json({ message: 'Invalid field' })
    }
    // ensure assignment
    const { rows } = await pool.query(
      `SELECT 1 FROM assigned_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
      [id, uid]
    )
    if (!rows[0]) {
      return res
        .status(403)
        .json({ message: 'You are not assigned to this booking' })
    }
    const payload = { [field]: value === undefined ? 'now' : value }
    const updated = await updateMyStaffLog(id, uid, payload)
    return res.json({ log: updated })
  } catch (err) {
    console.error('employee.updateMyStaffLogForBooking error:', err)
    return res
      .status(500)
      .json({ message: 'Error updating staff log for booking' })
  }
}

// NEW: List payments for an assigned confirmed booking (employee-only)
exports.listAssignedBookingPayments = async (req, res) => {
  try {
    const uid = req?.user?.id
    if (!uid) return res.status(401).json({ message: 'Unauthorized' })
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: 'Invalid booking id' })

    // ensure assignment
    const { rows } = await pool.query(
      `SELECT 1 FROM assigned_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
      [id, uid]
    )
    if (!rows[0]) {
      return res
        .status(403)
        .json({ message: 'You are not assigned to this booking' })
    }

    const payments = await paymentModel.listPayments({ booking_id: id })
    return res.json({ payments })
  } catch (err) {
    console.error('employee.listAssignedBookingPayments error:', err)
    return res
      .status(500)
      .json({ message: 'Error loading payments for booking' })
  }
}

// NEW: Create a payment for an assigned confirmed booking (employee-only)
exports.createAssignedBookingPayment = async (req, res) => {
  try {
    const uid = req?.user?.id
    if (!uid) return res.status(401).json({ message: 'Unauthorized' })
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: 'Invalid booking id' })

    // ensure assignment
    const { rows } = await pool.query(
      `SELECT 1 FROM assigned_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
      [id, uid]
    )
    if (!rows[0]) {
      return res
        .status(403)
        .json({ message: 'You are not assigned to this booking' })
    }

    const {
      amount_paid,
      payment_method = 'cash',
      reference_no = null,
      notes = null,
      payment_status = null,
      // 'verified' from client is ignored; we enforce rules below
      proof_image_url = null,
    } = req.body || {}

    const paid = Number(amount_paid)
    if (!Number.isFinite(paid) || paid <= 0) {
      return res.status(400).json({ error: 'amount_paid must be > 0' })
    }

    const booking = await getConfirmedBookingById(id)
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    const userId = Number(booking.userid)

    // Prevent overpayment using payment summary
    let remaining = null
    try {
      const sum = await getPaymentSummary(id)
      remaining = Math.max(
        0,
        Number(sum.amountDue || 0) - Number(sum.paidTotal || 0)
      )
    } catch {}
    if (remaining != null && paid > remaining) {
      return res.status(400).json({
        error: `Payment exceeds remaining balance (${remaining.toFixed(2)})`,
      })
    }

    // Compute current amount due (base + extension) for record-keeping
    let amount = Number(booking.total_booking_price || 0)
    try {
      const sum = await getPaymentSummary(id)
      amount = Number(sum.amountDue || amount)
    } catch {}

    // Choose table-compliant row status based on coverage of remaining balance
    let rowStatus = 'Partially Paid'
    if (remaining != null) {
      rowStatus = paid >= remaining ? 'Fully Paid' : 'Partially Paid'
    }
    if (
      typeof payment_status === 'string' &&
      [
        'Pending',
        'Partially Paid',
        'Failed',
        'Refunded',
        'Fully Paid',
      ].includes(payment_status)
    ) {
      rowStatus = payment_status
    }

    // Auto-verification rules for staff (event cards):
    // - Non-GCash methods (e.g., cash/bank) are auto-verified
    // - GCash is NOT auto-verified (admin must verify)
    const methodLc = String(payment_method || 'cash').toLowerCase()
    const autoVerified = methodLc !== 'gcash'

    const row = await paymentModel.createPayment({
      booking_id: id,
      user_id: userId,
      amount,
      amount_paid: paid,
      payment_method: String(payment_method || 'cash'),
      proof_image_url: proof_image_url ? String(proof_image_url) : null,
      reference_no: reference_no ? String(reference_no) : null,
      payment_status: String(rowStatus),
      notes: notes == null ? null : String(notes),
      verified_at: autoVerified ? new Date() : null,
    })

    // Logs: mark performer as employee and customer as method-aware
    try {
      const method = String(payment_method || '').toLowerCase()
      const customerAction =
        method === 'gcash' ? 'customer-gcash-payment' : 'customer-cash-payment'
      await paymentLogsModel.createPaymentLog({
        payment_id: row.payment_id,
        previous_status: 'n/a',
        new_status: row.payment_status,
        performed_by: 'employee',
        user_id: uid,
        notes: row.notes || null,
        action: 'employee-create',
      })
      await paymentLogsModel.createPaymentLog({
        payment_id: row.payment_id,
        previous_status: 'n/a',
        new_status: row.payment_status,
        performed_by: 'customer',
        user_id: userId,
        notes: row.notes || null,
        action: customerAction,
      })
    } catch (e) {
      console.error('employee create payment log failed:', e)
    }

    // Recalculate booking payment_status
    try {
      await recalcAndPersistPaymentStatus(row.booking_id)
    } catch (e) {
      console.warn(
        'recalc booking payment status (employee create) failed:',
        e?.message
      )
    }

    return res.status(201).json({ payment: row })
  } catch (err) {
    console.error('employee.createAssignedBookingPayment error:', err)
    return res.status(500).json({ error: 'Failed to create payment' })
  }
}
