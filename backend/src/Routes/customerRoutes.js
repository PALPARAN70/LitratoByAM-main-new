const express = require('express')
const authMiddleware = require('../Middleware/authMiddleware')
const roleMiddleware = require('../Middleware/roleMiddleware')
const customerController = require('../Controller/customerController')

const router = express.Router()

// Booking request routes (customer side)
router.post(
  '/booking',
  authMiddleware,
  roleMiddleware('customer'),
  customerController.createBooking
)

router.patch(
  '/booking/:id',
  authMiddleware,
  roleMiddleware('customer'),
  customerController.editBooking
)
router.put(
  '/booking/:id',
  authMiddleware,
  roleMiddleware('customer'),
  customerController.editBooking
)

router.delete(
  '/booking/:id',
  authMiddleware,
  roleMiddleware('customer'),
  customerController.cancelBooking
)

module.exports = router
