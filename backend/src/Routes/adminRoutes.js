const express = require('express')
const adminController = require('../Controller/adminControllers/adminController')
const adminGridController = require('../Controller/adminControllers/adminGridController')
const adminBookingController = require('../Controller/adminControllers/adminBookingController')
const adminConfirmedBookingController = require('../Controller/adminControllers/adminConfirmedBookingController')
const authMiddleware = require('../Middleware/authMiddleware')
const roleMiddleware = require('../Middleware/roleMiddleware')
const path = require('path')
const fs = require('fs')
const multer = require('multer')

const router = express.Router()

const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'Assets')
const PKG_DIR = path.join(ASSETS_DIR, 'Packages')
const GRIDS_DIR = path.join(ASSETS_DIR, 'Grids')
const PAYMENTS_QR_DIR = path.join(ASSETS_DIR, 'Payments', 'QR')
fs.mkdirSync(PKG_DIR, { recursive: true })
fs.mkdirSync(GRIDS_DIR, { recursive: true })
fs.mkdirSync(PAYMENTS_QR_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PKG_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    cb(null, `${Date.now()}_${safe}`)
  },
})
const upload = multer({ storage })

// separate storage for Grids images
const storageGrids = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, GRIDS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    cb(null, `${Date.now()}_${safe}`)
  },
})
const uploadGrids = multer({ storage: storageGrids })

// storage for Payment QR images
const storagePaymentQR = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PAYMENTS_QR_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    cb(null, `${Date.now()}_${safe}`)
  },
})
const uploadPaymentQR = multer({ storage: storagePaymentQR })
// -------- user management routes -------- //
// List users by role (?role=customer|employee|admin)
router.get(
  '/list',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listUsers
)

// ---- Payments (admin) ----
const adminPaymentsController = require('../Controller/adminControllers/adminPaymentsController')

// Upload QR image for payments (e.g., GCash QR)
router.post(
  '/payment-qr-image',
  authMiddleware,
  roleMiddleware('admin'),
  uploadPaymentQR.single('image'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const url = `${req.protocol}://${req.get(
      'host'
    )}/assets/Payments/QR/${path.basename(req.file.path)}`
    res.json({ url })
  }
)

// List payments (filterable)
router.get(
  '/payments',
  authMiddleware,
  roleMiddleware('admin'),
  adminPaymentsController.listPayments
)

// Create a payment (admin)
router.post(
  '/payments',
  authMiddleware,
  roleMiddleware('admin'),
  adminPaymentsController.createPayment
)

// Sales report PDF (placed before dynamic :id routes to avoid collision)
router.get(
  '/payments/report',
  authMiddleware,
  roleMiddleware('admin'),
  adminPaymentsController.generateSalesReport
)

// Payment logs
router.get(
  '/payment-logs',
  authMiddleware,
  roleMiddleware('admin'),
  adminPaymentsController.listPaymentLogs
)

// Update a specific payment log (e.g., additional_notes)
router.patch(
  '/payment-logs/:log_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminPaymentsController.updatePaymentLog
)

// Get single payment
router.get(
  '/payments/:id',
  authMiddleware,
  roleMiddleware('admin'),
  adminPaymentsController.getPayment
)

// Update payment (status, notes, verified_at, qr_image_url, proof_image_url, reference_no)
router.patch(
  '/payments/:id',
  authMiddleware,
  roleMiddleware('admin'),
  adminPaymentsController.updatePayment
)

// Admin-only: create user (role limited to customer or employee)
router.post(
  '/user',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.createUser
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

// change user role
router.patch(
  '/user/:id/role',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.updateUserRole
)

// fetch a user by email (username) for admin auto-fill
router.get(
  '/user/by-email',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.fetchUserByEmail
)

// -------- inventory management routes -------- //
//create inventory item
router.post(
  '/inventory',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.createInventoryItem
)
//get all inventory items
router.get(
  '/inventory',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listInventory
)

// support both PATCH and PUT
router.patch(
  '/inventory/:inventoryID',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.updateInventoryItem
)
router.put(
  '/inventory/:inventoryID',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.updateInventoryItem
)

router.delete(
  '/inventory/:inventoryID',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.deleteInventoryItem
)

// -------- package management routes -------- //
//create package
router.post(
  '/package',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.createPackage
)

//get all packages
router.get(
  '/package',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listPackages
)
// get archived packages
router.get(
  '/package/archived',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listArchivedPackages
)

// support both PATCH and PUT
router.patch(
  '/package/:package_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.updatePackage
)
router.put(
  '/package/:package_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.updatePackage
)

router.delete(
  '/package/:package_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.deletePackage
)

// -----package inventory item routes ----- //
//add inventory item to package
router.post(
  '/package-inventory-item',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.createPackageInventoryItem
)
//get all package inventory items
router.get(
  '/package-inventory-item',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listPackageInventoryItems
)
// support both PATCH and PUT
router.patch(
  '/package-inventory-item/:package_inventory_item_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.updatePackageInventoryItem
)
router.put(
  '/package-inventory-item/:package_inventory_item_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.updatePackageInventoryItem
)
router.delete(
  '/package-inventory-item/:package_inventory_item_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.deletePackageInventoryItem
)

router.post(
  '/package-image',
  authMiddleware,
  roleMiddleware('admin'),
  upload.single('image'), // field name must be 'image'
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    console.log('Saved package image:', req.file.path)
    const url = `${req.protocol}://${req.get(
      'host'
    )}/assets/Packages/${path.basename(req.file.path)}`
    res.json({ url })
  }
)

router.post(
  '/grid-image',
  authMiddleware,
  roleMiddleware('admin'),
  uploadGrids.single('image'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    console.log('Saved grid image:', req.file.path)
    const url = `${req.protocol}://${req.get(
      'host'
    )}/assets/Grids/${path.basename(req.file.path)}`
    res.json({ url })
  }
)

// -------- grid management routes -------- //
// create grid
router.post(
  '/grid',
  authMiddleware,
  roleMiddleware('admin'),
  adminGridController.createGrid
)
// list active grids
router.get(
  '/grid',
  authMiddleware,
  roleMiddleware('admin'),
  adminGridController.listGrids
)
// list archived grids
router.get(
  '/grid/archived',
  authMiddleware,
  roleMiddleware('admin'),
  adminGridController.listArchivedGrids
)
// update grid (PATCH or PUT)
router.patch(
  '/grid/:grid_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminGridController.updateGrid
)
router.put(
  '/grid/:grid_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminGridController.updateGrid
)
// soft delete
router.delete(
  '/grid/:grid_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminGridController.deleteGrid
)

// ----- inventory status log routes ----- //
router.post(
  '/inventory-status-log',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.createInventoryStatusLog
)

router.get(
  '/inventory-status-log',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listInventoryStatusLogs
)

router.get(
  '/inventory-status-log/by-entity',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listInventoryStatusLogsByEntity
)

router.patch(
  '/inventory-status-log/:log_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.updateInventoryStatusLog
)

router.delete(
  '/inventory-status-log/:log_id',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.deleteInventoryStatusLog
)

// -------- material types routes -------- //
router.get(
  '/material-types',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listMaterialTypes
)
router.post(
  '/material-types',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.createMaterialType
)

// NEW: package items management
router.get(
  '/package/:package_id/items',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.listPackageItemsForPackage
)
router.put(
  '/package/:package_id/items',
  authMiddleware,
  roleMiddleware('admin'),
  adminController.replacePackageItems
)

// ---- booking request admin actions ----
// list all booking requests
router.get(
  '/bookingRequest',
  authMiddleware,
  roleMiddleware('admin'),
  adminBookingController.listBookingRequests
)
// update a booking request (admin)
router.patch(
  '/bookingRequest/:id',
  authMiddleware,
  roleMiddleware('admin'),
  adminBookingController.updateBookingRequest
)
router.put(
  '/bookingRequest/:id',
  authMiddleware,
  roleMiddleware('admin'),
  adminBookingController.updateBookingRequest
)
router.post(
  '/bookingRequest/:id/accept',
  authMiddleware,
  roleMiddleware('admin'),
  adminBookingController.acceptBookingRequest
)
router.post(
  '/bookingRequest/:id/reject',
  authMiddleware,
  roleMiddleware('admin'),
  adminBookingController.rejectBookingRequest
)

// ---- confirmed bookings management ----
router.get(
  '/confirmed-bookings',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.list
)
router.get(
  '/confirmed-bookings/:id',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.getById
)
router.get(
  '/confirmed-bookings/by-request/:requestid',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.getByRequestId
)
router.patch(
  '/confirmed-bookings/:id/contract',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.markContractSigned
)
router.patch(
  '/confirmed-bookings/:id/payment-status',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.setPaymentStatus
)
router.patch(
  '/confirmed-bookings/:id/booking-status',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.setBookingStatus
)
router.patch(
  '/confirmed-bookings/:id/total',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.setTotalPrice
)

// Update extension duration (hours) for a confirmed booking
router.patch(
  '/confirmed-bookings/:id/extension',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.setExtensionDuration
)

// Preflight conflict check for proposed extension
router.get(
  '/confirmed-bookings/:id/extension-conflicts',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.checkExtensionConflicts
)

// Payment summary for a confirmed booking
router.get(
  '/confirmed-bookings/:id/payment-summary',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.getPaymentSummary
)

// Combined update (any subset of fields) and explicit cancel endpoints
router.patch(
  '/confirmed-bookings/:id',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.updateConfirmedCombined
)
router.post(
  '/confirmed-bookings/:id/cancel',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.cancelConfirmed
)

// Admin creates a booking and confirms immediately
router.post(
  '/confirmed-bookings',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.createAndConfirm
)

// ---- confirmed booking staff assignment ----
router.get(
  '/confirmed-bookings/:id/staff',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.listStaffForBooking
)
router.post(
  '/confirmed-bookings/:id/assign-staff',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.assignStaff
)

// Replace staff assignments for a confirmed booking
router.put(
  '/confirmed-bookings/:id/staff',
  authMiddleware,
  roleMiddleware('admin'),
  adminConfirmedBookingController.replaceStaff
)

module.exports = router

// keep module.exports at end
