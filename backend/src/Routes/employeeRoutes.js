const express = require('express')
const employeeController = require('../Controller/employeeController')
const authMiddleware = require('../Middleware/authMiddleware')
const roleMiddleware = require('../Middleware/roleMiddleware')

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
