const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const authMiddleware = require('../Middleware/authMiddleware')
const roleMiddleware = require('../Middleware/roleMiddleware')
const customerController = require('../Controller/customerController')
const customerPaymentsController = require('../Controller/customerPaymentsController')
const customerContractsController = require('../Controller/customerContractsController')

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

// ---- Payments (customer) ----

// Set up upload storage for payment proof images
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'Assets')
const PAYMENTS_DIR = path.join(ASSETS_DIR, 'Payments')
const PROOFS_DIR = path.join(PAYMENTS_DIR, 'Proofs')
const CONTRACTS_SIGNED_DIR = path.join(ASSETS_DIR, 'Contracts', 'Signed')
fs.mkdirSync(PROOFS_DIR, { recursive: true })
fs.mkdirSync(CONTRACTS_SIGNED_DIR, { recursive: true })

const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROOFS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    cb(null, `${Date.now()}_${safe}`)
  },
})
const uploadProof = multer({ storage: proofStorage })

// Contracts: signed upload storage
const signedStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CONTRACTS_SIGNED_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    cb(null, `${Date.now()}_${safe}`)
  },
})
function contractFileFilter(_req, file, cb) {
  const allowed = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
  ]
  if (allowed.includes(file.mimetype)) return cb(null, true)
  return cb(new Error('Unsupported file type'))
}
const uploadSignedContract = multer({
  storage: signedStorage,
  fileFilter: contractFileFilter,
})

// Upload proof image
router.post(
  '/payment-proof',
  authMiddleware,
  roleMiddleware('customer'),
  uploadProof.single('image'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const url = `${req.protocol}://${req.get(
      'host'
    )}/assets/Payments/Proofs/${path.basename(req.file.path)}`
    res.json({ url })
  }
)

// Get the latest admin-provided payment QR (e.g., GCash)
router.get('/payment-qr', async (req, res) => {
  try {
    const QR_DIR = path.join(PAYMENTS_DIR, 'QR')
    fs.mkdirSync(QR_DIR, { recursive: true })
    const files = fs.readdirSync(QR_DIR)
    if (!files.length) return res.status(404).json({ error: 'No QR available' })
    // pick latest by mtime
    const withStats = files
      .map((name) => ({
        name,
        full: path.join(QR_DIR, name),
        stat: fs.statSync(path.join(QR_DIR, name)),
      }))
      .filter((f) => f.stat.isFile())
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    const latest = withStats[0]
    const url = `${req.protocol}://${req.get('host')}/assets/Payments/QR/${
      latest.name
    }`
    res.json({ url })
  } catch (e) {
    console.error('payment-qr error:', e)
    res.status(500).json({ error: 'Failed to load QR' })
  }
})

// Get my booking balance
router.get(
  '/bookings/:id/balance',
  authMiddleware,
  roleMiddleware('customer'),
  customerPaymentsController.getMyBookingBalance
)

// Get confirmed booking by request id (owned by current user)
router.get(
  '/confirmed-bookings/by-request/:requestid',
  authMiddleware,
  roleMiddleware('customer'),
  customerPaymentsController.getConfirmedByRequestOwned
)

// Create a payment for a confirmed booking
router.post(
  '/payments',
  authMiddleware,
  roleMiddleware('customer'),
  customerPaymentsController.createPayment
)

// List my payments
router.get(
  '/payments',
  authMiddleware,
  roleMiddleware('customer'),
  customerPaymentsController.listMyPayments
)

// Get a single payment by id (must belong to current user)
router.get(
  '/payments/:id',
  authMiddleware,
  roleMiddleware('customer'),
  customerPaymentsController.getMyPayment
)

// ---- Contracts (customer) ----
router.get(
  '/bookings/:id/contract',
  authMiddleware,
  roleMiddleware('customer'),
  customerContractsController.getMyContract
)

router.post(
  '/bookings/:id/contract-signed',
  authMiddleware,
  roleMiddleware('customer'),
  uploadSignedContract.single('file'),
  customerContractsController.uploadSigned
)

module.exports = router
