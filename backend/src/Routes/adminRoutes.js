const express = require('express')
const adminController = require('../Controller/adminController')
const authMiddleware = require('../Middleware/authMiddleware')
const roleMiddleware = require('../Middleware/roleMiddleware')

const router = express.Router()

router.get(
  '/dashboard',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.getDashboard
)
router.post(
  '/manage-users',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.manageUsers
)

// List users by role (?role=customer|employee|admin)
router.get(
  '/list',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listUsers
)

module.exports = router
