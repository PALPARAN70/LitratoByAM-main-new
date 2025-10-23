require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')
const app = express()

const authRoute = require('./src/Routes/authRoutes')
const adminRoute = require('./src/Routes/adminRoutes')
const employeeRoute = require('./src/Routes/employeeRoutes')
const customerRoute = require('./src/Routes/customerRoutes')

const cors = require('cors')
const { initUserTable } = require('./src/Model/userModel')
const { initBookingRequestTable } = require('./src/Model/bookingRequestModel')
const { initBookingGridsTable } = require('./src/Model/bookingGridsModel')
const { initGridsTable } = require('./src/Model/gridModel')
const {
  initConfirmedBookingTable,
} = require('./src/Model/confirmedBookingRequestModel')
const { initPaymentsTable } = require('./src/Model/paymentModel')
const { initPaymentLogsTable } = require('./src/Model/paymentLogsModel')

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

// Routes
app.use('/api/auth', authRoute)
app.use('/api/admin', adminRoute)
app.use('/api/employee', employeeRoute)
app.use('/api/customer', customerRoute)

// Optional: health check
app.get('/health', (_req, res) => res.json({ ok: true }))

// Error handling
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

const PORT = process.env.PORT || 5000
// Initialize essential tables (users + bookings) before starting server
initUserTable()
  .then(() => initGridsTable())
  .then(() => initBookingRequestTable())
  .then(() => initBookingGridsTable())
  .then(() => initConfirmedBookingTable())
  .then(() => initPaymentsTable())
  .then(() => initPaymentLogsTable())
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err)
    process.exit(1)
  })
