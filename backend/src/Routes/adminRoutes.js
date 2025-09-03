const express = require('express')
const adminController = require('../Controller/adminController')
const authMiddleware = require('../Middleware/authMiddleware')
const roleMiddleware = require('../Middleware/roleMiddleware')

const router = express.Router()

// router.get(
//   '/dashboard',
//   authMiddleware,
//   roleMiddleware('admin'),
//   adminController.getDashboard
// )
// router.post(
//   '/manage-users',
//   authMiddleware,
//   roleMiddleware('admin'),
//   adminController.manageUsers
// )

// List users by role (?role=customer|employee|admin)
router.get(
  '/list',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listUsers
)

// blocks the user
router.patch(
  '/user/:id/block',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.blockUser
)

//unblocks the user
router.patch(
  '/user/:id/unblock',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.unblockUser
)

module.exports = router
