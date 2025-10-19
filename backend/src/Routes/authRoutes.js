const express = require('express')
const router = express.Router()
const authController = require('../Controller/authController')
const authMiddleware = require('../Middleware/authMiddleware')
const { getAllPackages } = require('../Model/packageModel') // <-- add
const { getAllGrids } = require('../Model/gridModel')

router.post('/register', authController.register)
router.post('/login', authController.login)
router.post('/logout', authMiddleware, authController.logout)
// email verification
router.get('/verify', authController.verifyEmail)
router.get('/getProfile', authMiddleware, authController.getProfile)
router.put('/updateProfile', authMiddleware, authController.updateProfile)
router.put('/changePassword', authMiddleware, authController.changePassword)

//forgot password function
router.post('/forgotPassword', authController.forgotPassword)
router.post('/resetPassword', authController.resetPassword)

// Public: list visible packages (created by admin)
router.get('/packages', async (_req, res) => {
  try {
    const rows = await getAllPackages()
    res.json(rows)
  } catch (e) {
    console.error('list packages error:', e)
    res.status(500).json({ message: 'Failed to load packages' })
  }
})

// Public: list visible grids (created by admin)
router.get('/grids', async (_req, res) => {
  try {
    const rows = await getAllGrids()
    res.json(rows)
  } catch (e) {
    console.error('list grids error:', e)
    res.status(500).json({ message: 'Failed to load grids' })
  }
})

module.exports = router
