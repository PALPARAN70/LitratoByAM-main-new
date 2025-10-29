const {
  initConfirmedBookingStaffTable,
  listAssignedConfirmedBookings,
} = require('../Model/confirmedBookingStaffModel')
const {
  updateBookingStatus,
  getPaymentSummary,
} = require('../Model/confirmedBookingRequestModel')
const { pool } = require('../Config/db')
// NEW: reuse package/inventory models for staff-safe package items list
const packageModel = require('../Model/packageModel')
const packageInventoryItemModel = require('../Model/packageInventoryItemModel')
const inventoryModel = require('../Model/inventoryModel')
const {
  initEventStaffLogsTable,
  getLogsForBooking: getStaffLogsForBooking,
  updateMyLog: updateMyStaffLog,
} = require('../Model/eventStaffLogsModel')

// Ensure the staff assignment table exists on load (best-effort)
initConfirmedBookingStaffTable().catch((e) =>
  console.warn(
    'Init confirmed_booking_staff table (employee) failed:',
    e?.message
  )
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
      `SELECT 1 FROM confirmed_booking_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
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
      `SELECT 1 FROM confirmed_booking_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
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

// NEW: Allow employees to update inventory condition/status (limited fields)
exports.updateInventoryItemLimited = async (req, res) => {
  try {
    const { inventoryID } = req.params
    const id = Number(inventoryID)
    if (!Number.isFinite(id))
      return res.status(400).json({ message: 'Invalid inventory id' })

    const body = req.body || {}
    const updates = {}
    if (Object.prototype.hasOwnProperty.call(body, 'condition')) {
      const c = String(body.condition || '').trim()
      if (c) updates.condition = c
    }
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      updates.status = Boolean(body.status)
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
      .json({ message: 'Error updating inventory (employee)' })
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
      `SELECT 1 FROM confirmed_booking_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
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
      `SELECT 1 FROM confirmed_booking_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
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
