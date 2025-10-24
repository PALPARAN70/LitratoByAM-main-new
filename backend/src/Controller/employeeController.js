const {
  initConfirmedBookingStaffTable,
  listAssignedConfirmedBookings,
} = require('../Model/confirmedBookingStaffModel')
const {
  updateBookingStatus,
  getPaymentSummary,
} = require('../Model/confirmedBookingRequestModel')
const { pool } = require('../Config/db')

// Ensure the staff assignment table exists on load (best-effort)
initConfirmedBookingStaffTable().catch((e) =>
  console.warn(
    'Init confirmed_booking_staff table (employee) failed:',
    e?.message
  )
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
