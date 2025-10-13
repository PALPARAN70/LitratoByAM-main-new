const express = require('express')
const authMiddleware = require('../Middleware/authMiddleware')
const roleMiddleware = require('../Middleware/roleMiddleware')
const customerController = require('../Controller/customerController')

const router = express.Router()

// Booking request routes (customer side)
router.post(
  '/bookingRequest',
  authMiddleware,
  roleMiddleware('customer'),
  customerController.createBooking
)

router.patch(
  '/bookingRequest/:id',
  authMiddleware,
  roleMiddleware('customer'),
  customerController.editBookingRequest
)
router.put(
  '/bookingRequest/:id',
  authMiddleware,
  roleMiddleware('customer'),
  customerController.editBookingRequest
)

router.delete(
  '/bookingRequest/:id',
  authMiddleware,
  roleMiddleware('customer'),
  customerController.cancelBookingRequest
)

// GET list for current user
router.get(
  '/bookingRequest',
  authMiddleware,
  roleMiddleware('customer'),
  customerController.getMyBookingRequests
)

// GET single by requestid
router.get(
  '/bookingRequest/:id',
  authMiddleware,
  roleMiddleware('customer'),
  customerController.getBookingRequest
)

module.exports = router
