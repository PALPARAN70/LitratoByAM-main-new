const express = require('express')
const employeeController = require('../Controller/employeeController')
const authMiddleware = require('../Middleware/authMiddleware')
const roleMiddleware = require('../Middleware/roleMiddleware')
const { pool } = require('../Config/db')
const path = require('path')
const fs = require('fs')
const multer = require('multer')

const router = express.Router()
router.get(
  '/dashboard',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.getDashboard
)
router.post(
  '/handle-orders',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.handleOrders
)

// List confirmed bookings assigned to the logged-in employee
router.get(
  '/assigned-confirmed-bookings',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.listAssignedConfirmedBookings
)

// Update booking status for an assigned confirmed booking (employee-only)
router.patch(
  '/assigned-confirmed-bookings/:id/booking-status',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.setAssignedBookingStatus
)

// Payment summary for an assigned confirmed booking (employee-only)
router.get(
  '/assigned-confirmed-bookings/:id/payment-summary',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.getAssignedBookingPaymentSummary
)

router.patch(
  '/assigned-confirmed-bookings/:id/extension',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.setAssignedExtensionDuration
)

module.exports = router

// NEW: staff can read package items list for viewing equipment in event cards
router.get(
  '/package/:package_id/items',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.listPackageItemsForPackage
)

// NEW: staff can update inventory condition/status for assigned tasks (limited fields)
router.patch(
  '/inventory/:inventoryID',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.updateInventoryItemLimited
)

// NEW: staff logs routes (employee)
router.get(
  '/assigned-confirmed-bookings/:id/staff-logs',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.getAssignedBookingStaffLogs
)
router.patch(
  '/assigned-confirmed-bookings/:id/staff-log',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.updateMyStaffLogForBooking
)

// --- Employee: upload payment proof image with assignment check ---
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'Assets')
const PAYMENTS_PROOFS_DIR = path.join(ASSETS_DIR, 'Payments', 'Proofs')
fs.mkdirSync(PAYMENTS_PROOFS_DIR, { recursive: true })

const storagePaymentProofEmp = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PAYMENTS_PROOFS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    cb(null, `${Date.now()}_${safe}`)
  },
})
const uploadPaymentProofEmp = multer({ storage: storagePaymentProofEmp })

router.post(
  '/assigned-confirmed-bookings/:id/payment-proof-image',
  authMiddleware,
  roleMiddleware('employee'),
  uploadPaymentProofEmp.single('image'),
  async (req, res) => {
    try {
      const uid = req?.user?.id
      const id = parseInt(req.params.id, 10)
      if (!uid) return res.status(401).json({ message: 'Unauthorized' })
      if (Number.isNaN(id) || id <= 0)
        return res.status(400).json({ message: 'Invalid booking id' })

      // ensure assignment
      const { rows } = await pool.query(
        `SELECT 1 FROM assigned_staff WHERE bookingid = $1 AND staff_userid = $2 LIMIT 1`,
        [id, uid]
      )
      if (!rows[0]) {
        // cleanup uploaded file when unauthorized
        if (req.file) {
          fs.unlink(req.file.path, () => {})
        }
        return res
          .status(403)
          .json({ message: 'You are not assigned to this booking' })
      }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
      const url = `${req.protocol}://${req.get(
        'host'
      )}/assets/Payments/Proofs/${path.basename(req.file.path)}`
      return res.json({ url })
    } catch (e) {
      console.error('employee upload payment proof failed:', e)
      return res.status(500).json({ error: 'Failed to upload proof image' })
    }
  }
)

// NEW: list payments for an assigned confirmed booking
router.get(
  '/assigned-confirmed-bookings/:id/payments',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.listAssignedBookingPayments
)

// NEW: create a payment for an assigned confirmed booking
router.post(
  '/assigned-confirmed-bookings/:id/payments',
  authMiddleware,
  roleMiddleware('employee'),
  employeeController.createAssignedBookingPayment
)
