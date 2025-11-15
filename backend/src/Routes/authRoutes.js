const express = require('express')
const router = express.Router()
const authController = require('../Controller/authController')
const authMiddleware = require('../Middleware/authMiddleware')
const { getAllPackages } = require('../Model/packageModel') // <-- add
const { getAllGrids } = require('../Model/gridModel')
const {
  getDailyConfirmedCounts,
} = require('../Model/confirmedBookingRequestModel')
const { getDailyAvailabilitySummary } = require('../Model/bookingRequestModel')

router.post('/register', authController.register)
router.post('/login', authController.login)
router.post('/resendVerification', authController.resendVerificationEmail)
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

// Public: aggregate confirmed bookings per date for availability calendars
router.get('/availability/summary', async (_req, res) => {
  try {
    const rows = await getDailyConfirmedCounts()
    const counts = {}
    for (const row of rows) {
      const key = String(row?.event_date || '').trim()
      const value = Number(row?.count || 0)
      if (!key || !Number.isFinite(value) || value <= 0) continue
      counts[key] = value
    }
    res.json({ counts })
  } catch (e) {
    console.error('availability summary error:', e)
    res.status(500).json({ message: 'Failed to load availability summary' })
  }
})

router.get('/availability/day', async (req, res) => {
  const dateParam = req.query?.date
  const dateValue = Array.isArray(dateParam) ? dateParam[0] : dateParam
  if (!dateValue || !String(dateValue).trim()) {
    return res
      .status(400)
      .json({ message: 'Query parameter "date" (YYYY-MM-DD) is required' })
  }
  try {
    const summary = await getDailyAvailabilitySummary(String(dateValue).trim())
    res.json(summary)
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase()
    if (msg.includes('invalid date')) {
      return res.status(400).json({ message: 'Invalid date supplied' })
    }
    console.error('availability day error:', e)
    res.status(500).json({ message: 'Failed to load availability details' })
  }
})

module.exports = router
