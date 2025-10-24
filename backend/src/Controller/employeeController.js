const {
  initConfirmedBookingStaffTable,
  listAssignedConfirmedBookings,
} = require('../Model/confirmedBookingStaffModel')

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
