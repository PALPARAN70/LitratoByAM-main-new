const express = require('express')
const adminController = require('../Controller/adminController')
const authMiddleware = require('../Middleware/authMiddleware')
const roleMiddleware = require('../Middleware/roleMiddleware')
const path = require('path')
const fs = require('fs')
const multer = require('multer')

const router = express.Router()

const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'Assets')
const PKG_DIR = path.join(ASSETS_DIR, 'Packages')
fs.mkdirSync(PKG_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PKG_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    cb(null, `${Date.now()}_${safe}`)
  },
})
const upload = multer({ storage })

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

module.exports = router
