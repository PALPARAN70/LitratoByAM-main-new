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

const ROOT = path.resolve(__dirname, '..') // points to backend/
const UPLOAD_ROOT = path.join(ROOT, 'Assets')
const PACKAGE_DIR = path.join(UPLOAD_ROOT, 'packages')
fs.mkdirSync(PACKAGE_DIR, { recursive: true })

const ASSETS_DIR = path.resolve(__dirname, 'Assets')
fs.mkdirSync(ASSETS_DIR, { recursive: true })
app.use('/assets', express.static(ASSETS_DIR))

// Middleware
app.use(cors())
app.use(bodyParser.json())
app.use('/Assets', express.static(UPLOAD_ROOT))

// Routes
app.use('/api/auth', authRoute)
app.use('/api/admin', adminRoute)
app.use('/api/employee', employeeRoute)
app.use('/api/customer', customerRoute)

// Error handling
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

const PORT = process.env.PORT || 5000
initUserTable()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err)
    process.exit(1)
  })
