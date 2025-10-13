const { pool } = require('../Config/db')

// Create confirmed_bookings table (one per accepted booking_request)
async function initConfirmedBookingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS confirmed_bookings (
      id SERIAL PRIMARY KEY,
      requestid INTEGER NOT NULL UNIQUE REFERENCES booking_requests(requestid) ON DELETE CASCADE,
      userid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contract_signed BOOLEAN DEFAULT FALSE,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
      booking_status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (booking_status IN ('scheduled','in_progress','completed','cancelled')),
      total_booking_price NUMERIC(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

/**
 * Create a confirmed booking from an accepted request.
 * - Validates booking_requests.status = 'accepted'
 * - Defaults total_booking_price to the package price if not provided
 */
async function createConfirmedBooking(requestid, options = {}) {
  const {
    totalBookingPrice = null,
    contractSigned = false,
    paymentStatus = 'unpaid', // 'unpaid' | 'partial' | 'paid' | 'refunded'
    bookingStatus = 'scheduled', // 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  } = options

  // Fetch request + package price
  const rq = await pool.query(
    `
    SELECT br.requestid, br.userid, br.status, p.price
    FROM booking_requests br
    JOIN packages p ON p.id = br.packageid
    WHERE br.requestid = $1
    `,
    [requestid]
  )
  const reqRow = rq.rows[0]
  if (!reqRow) throw new Error('Booking request not found')
  if (reqRow.status !== 'accepted') {
    throw new Error('Booking request must be accepted before confirming')
  }

  // Ensure not already confirmed
  const existing = await pool.query(
    `SELECT id FROM confirmed_bookings WHERE requestid = $1`,
    [requestid]
  )
  if (existing.rows[0]) throw new Error('Request already confirmed')

  const total = totalBookingPrice ?? Number(reqRow.price ?? 0)

  const ins = await pool.query(
    `
    INSERT INTO confirmed_bookings
      (requestid, userid, contract_signed, payment_status, booking_status, total_booking_price)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      requestid,
      reqRow.userid,
      contractSigned,
      paymentStatus,
      bookingStatus,
      total,
    ]
  )
  return ins.rows[0]
}

// Get a confirmed booking with request + package + user details
async function getConfirmedBookingById(bookingid) {
  const { rows } = await pool.query(
    `
    SELECT 
      cb.*,
      br.eventdate,
      br.eventtime,
      br.eventaddress,
      p.package_name,
      p.price AS package_price,
      u.username,
      u.firstname,
      u.lastname
    FROM confirmed_bookings cb
    JOIN booking_requests br ON br.requestid = cb.requestid
    JOIN packages p ON p.id = br.packageid
    JOIN users u ON u.id = cb.userid
    WHERE cb.id = $1
    `,
    [bookingid]
  )
  return rows[0] || null
}

async function getConfirmedBookingByRequestId(requestid) {
  const { rows } = await pool.query(
    `SELECT * FROM confirmed_bookings WHERE requestid = $1`,
    [requestid]
  )
  return rows[0] || null
}

async function listConfirmedBookings() {
  const { rows } = await pool.query(
    `
    SELECT 
      cb.*,
      br.eventdate,
      br.eventtime,
      br.eventaddress,
      p.package_name,
      p.price AS package_price,
      u.username,
      u.firstname,
      u.lastname
    FROM confirmed_bookings cb
    JOIN booking_requests br ON br.requestid = cb.requestid
    JOIN packages p ON p.id = br.packageid
    JOIN users u ON u.id = cb.userid
    ORDER BY cb.created_at DESC
    `
  )
  return rows
}

// Mutations
async function setContractSigned(bookingid, signed = true) {
  const { rows } = await pool.query(
    `
    UPDATE confirmed_bookings
    SET contract_signed = $1, last_updated = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
    `,
    [signed, bookingid]
  )
  return rows[0]
}

async function updatePaymentStatus(bookingid, status) {
  const allowed = new Set(['unpaid', 'partial', 'paid', 'refunded'])
  if (!allowed.has(status)) throw new Error('Invalid payment status')
  const { rows } = await pool.query(
    `
    UPDATE confirmed_bookings
    SET payment_status = $1, last_updated = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
    `,
    [status, bookingid]
  )
  return rows[0]
}

async function updateBookingStatus(bookingid, status) {
  const allowed = new Set([
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
  ])
  if (!allowed.has(status)) throw new Error('Invalid booking status')
  const { rows } = await pool.query(
    `
    UPDATE confirmed_bookings
    SET booking_status = $1, last_updated = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
    `,
    [status, bookingid]
  )
  return rows[0]
}

async function updateTotalPrice(bookingid, total) {
  const { rows } = await pool.query(
    `
    UPDATE confirmed_bookings
    SET total_booking_price = $1, last_updated = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
    `,
    [total, bookingid]
  )
  return rows[0]
}

module.exports = {
  initConfirmedBookingTable,
  createConfirmedBooking,
  getConfirmedBookingById,
  getConfirmedBookingByRequestId,
  listConfirmedBookings,
  setContractSigned,
  updatePaymentStatus,
  updateBookingStatus,
  updateTotalPrice,
}
