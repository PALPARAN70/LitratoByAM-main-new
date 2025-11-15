require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')
const app = express()

const cors = require('cors')
const { initUserTable } = require('./src/Model/userModel')
const { initBookingRequestTable } = require('./src/Model/bookingRequestModel')
const { initBookingGridsTable } = require('./src/Model/bookingGridsModel')
const { initGridsTable } = require('./src/Model/gridModel')
const {
  initConfirmedBookingTable,
} = require('./src/Model/confirmedBookingRequestModel')
const {
  initConfirmedBookingStaffTable,
} = require('./src/Model/confirmedBookingStaffModel')
const { initPaymentsTable } = require('./src/Model/paymentModel')
const { initPaymentLogsTable } = require('./src/Model/paymentLogsModel')
const { initPaymentRefundsTable } = require('./src/Model/paymentRefundModel')
const { initContractsTable } = require('./src/Model/contractModel')
const { initInventoryTable } = require('./src/Model/inventoryModel')
const { initPackagesTable } = require('./src/Model/packageModel')
const {
  initPackageInventoryItemsTable,
} = require('./src/Model/packageInventoryItemModel')
const {
  initInventoryStatusLogTable,
} = require('./src/Model/inventoryStatusLogModel')
const { initEventStaffLogsTable } = require('./src/Model/eventStaffLogsModel')
const { initMaterialTypesTable } = require('./src/Model/materialTypesModel')

const ROOT = path.resolve(__dirname, '..') // points to backend/
const UPLOAD_ROOT = path.join(ROOT, 'Assets')
const PACKAGE_DIR = path.join(UPLOAD_ROOT, 'packages')
fs.mkdirSync(PACKAGE_DIR, { recursive: true })

const ASSETS_DIR = path.resolve(__dirname, 'Assets')
fs.mkdirSync(ASSETS_DIR, { recursive: true })
app.use('/assets', express.static(ASSETS_DIR))

// Middleware
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
)

// REMOVE this (invalid in Express 5):
// app.options('*', cors()) // handle preflight globally

// Express 5-safe wildcard for preflight (optional; cors middleware usually suffices)
//app.options('/:path(*)', cors())

app.use(bodyParser.json())
app.use('/Assets', express.static(UPLOAD_ROOT))

const PORT = process.env.PORT || 5000

// Optional: health check (registered ahead of scheme bootstrap)
app.get('/health', (_req, res) => res.json({ ok: true }))

async function startServer() {
  try {
    await initUserTable()
    // Inventory primitives (no external dependencies beyond users)
    await initMaterialTypesTable()
    await initInventoryTable()
    await initInventoryStatusLogTable()
    // Core catalog data used by bookings
    await initPackagesTable()
    await initGridsTable()
    await initPackageInventoryItemsTable()
    // Booking pipeline (requires packages/users before requests; requests before confirmations)
    await initBookingRequestTable()
    await initBookingGridsTable()
    await initConfirmedBookingTable()
    await initConfirmedBookingStaffTable()
    await initEventStaffLogsTable()
    // Payment + contract layers depend on confirmed bookings
    await initPaymentsTable()
    await initPaymentLogsTable()
    await initPaymentRefundsTable()
    await initContractsTable()

    const authRoute = require('./src/Routes/authRoutes')
    const adminRoute = require('./src/Routes/adminRoutes')
    const employeeRoute = require('./src/Routes/employeeRoutes')
    const customerRoute = require('./src/Routes/customerRoutes')

    // Routes
    app.use('/api/auth', authRoute)
    app.use('/api/admin', adminRoute)
    app.use('/api/employee', employeeRoute)
    app.use('/api/customer', customerRoute)

    // Error handling (keep last)
    app.use((req, res) => {
      res.status(404).json({ message: 'Route not found' })
    })

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  } catch (err) {
    console.error('Failed to initialize database:', err)
    process.exit(1)
  }
}

startServer()
