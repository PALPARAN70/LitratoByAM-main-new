const express = require('express')
const router = express.Router()
const authController = require('../Controller/authController')
const authMiddleware = require('../Middleware/authMiddleware')

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

module.exports = router
