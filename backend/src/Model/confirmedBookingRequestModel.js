const { pool } = require('../Config/db')

// Create confirmed_bookings table (one per accepted booking_request)
async function initConfirmedBookingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS confirmed_bookings (
      id SERIAL PRIMARY KEY,
      requestid INTEGER NOT NULL UNIQUE REFERENCES booking_requests(requestid) ON DELETE CASCADE,
      userid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contract_signed BOOLEAN DEFAULT FALSE,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','refunded','failed')),
      booking_status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (booking_status IN ('scheduled','in_progress','completed','cancelled')),
      total_booking_price NUMERIC(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Ensure optional columns for forward-compat (some designs store these on request only)
  await pool
    .query(
      'ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS event_end_time TIME'
    )
    .catch(() => {})
  await pool
    .query(
      'ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS extension_duration INTEGER'
    )
    .catch(() => {})
  await pool
    .query('ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS grid TEXT')
    .catch(() => {})

  // Ensure CHECK constraint allows 'failed' as a payment_status for existing DBs
  try {
    const q = `
      SELECT c.conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'confirmed_bookings' AND c.contype = 'c'
    `
    const { rows } = await pool.query(q)
    const target = rows.find(
      (r) =>
        typeof r.def === 'string' &&
        r.def.toLowerCase().includes('payment_status')
    )
    if (target && !target.def.includes("'failed'")) {
      const name = target.conname
      await pool.query(
        `ALTER TABLE confirmed_bookings DROP CONSTRAINT "${name}"`
      )
      await pool.query(
        `ALTER TABLE confirmed_bookings ADD CONSTRAINT "${name}" CHECK (payment_status IN ('unpaid','partial','paid','refunded','failed'))`
      )
    }
  } catch (e) {
    console.warn(
      'confirmed_bookings: ensure payment_status check includes failed - skipped:',
      e?.message
    )
  }
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
  SELECT br.requestid, br.userid, br.status, br.event_end_time, br.extension_duration, br.grid, p.price
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
      (requestid, userid, contract_signed, payment_status, booking_status, total_booking_price, event_end_time, extension_duration, grid)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      requestid,
      reqRow.userid,
      contractSigned,
      paymentStatus,
      bookingStatus,
      total,
      reqRow.event_end_time || null,
      reqRow.extension_duration || null,
      reqRow.grid || null,
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
      TO_CHAR(br.event_date, 'YYYY-MM-DD') AS event_date,
      TO_CHAR(br.event_time, 'HH24:MI') AS event_time,
      COALESCE(cb.event_end_time, br.event_end_time) AS event_end_time,
      COALESCE(cb.extension_duration, br.extension_duration) AS extension_duration,
      COALESCE(cb.grid, br.grid) AS grid,
      br.event_address,
      br.contact_info,
      br.event_name,
      br.strongest_signal,
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
      TO_CHAR(br.event_date, 'YYYY-MM-DD') AS event_date,
      TO_CHAR(br.event_time, 'HH24:MI') AS event_time,
      COALESCE(cb.event_end_time, br.event_end_time) AS event_end_time,
      COALESCE(cb.extension_duration, br.extension_duration) AS extension_duration,
      COALESCE(cb.grid, br.grid) AS grid,
      br.event_address,
      br.contact_info,
      br.event_name,
      br.strongest_signal,
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
  const allowed = new Set(['unpaid', 'partial', 'paid', 'refunded', 'failed'])
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
  // Compute payment summary and status based on total price + extensions and VERIFIED successful payments
  async getPaymentSummary(bookingid) {
    const id = Number(bookingid)
    if (!Number.isFinite(id)) throw new Error('Invalid booking id')

    // Fetch base total and extension hours (prefer value stored on confirmed, fallback to request)
    const q = `
      SELECT 
        cb.id,
        COALESCE(cb.total_booking_price, 0)::numeric AS base_total,
        COALESCE(cb.extension_duration, br.extension_duration, 0)::int AS ext_hours
      FROM confirmed_bookings cb
      JOIN booking_requests br ON br.requestid = cb.requestid
      WHERE cb.id = $1
    `
    const { rows } = await pool.query(q, [id])
    const row = rows[0]
    if (!row) throw new Error('Booking not found')

    const EXT_RATE = 2000
    const baseTotal = Number(row.base_total || 0)
    const extHours = Math.max(0, Number(row.ext_hours || 0))
    const extCharge = extHours * EXT_RATE
    const amountDue = Math.max(0, baseTotal + extCharge)

    // Sum only VERIFIED successful payments
    const payQ = `
      SELECT COALESCE(SUM(amount_paid), 0)::numeric AS paid_total
      FROM payments
      WHERE booking_id = $1
        AND LOWER(payment_status) IN ('completed','paid','succeeded')
        AND verified_at IS NOT NULL
    `
    let paidTotal = 0
    try {
      const r = await pool.query(payQ, [id])
      paidTotal = Number(r.rows?.[0]?.paid_total || 0)
    } catch {
      paidTotal = 0
    }

    let computedStatus = 'unpaid'
    if (paidTotal >= amountDue && amountDue > 0) computedStatus = 'paid'
    else if (paidTotal > 0 && paidTotal < amountDue) computedStatus = 'partial'

    return {
      baseTotal,
      extHours,
      extCharge,
      amountDue,
      paidTotal,
      computedStatus,
    }
  },

  // Recalculate and persist payment_status on confirmed_bookings
  async recalcAndPersistPaymentStatus(bookingid) {
    const sum = await this.getPaymentSummary(bookingid)
    await pool.query(
      `UPDATE confirmed_bookings SET payment_status = $2, last_updated = CURRENT_TIMESTAMP WHERE id = $1`,
      [bookingid, sum.computedStatus]
    )
    return sum
  },

  // Update extension_duration on confirmed_bookings and recalc payment_status
  async updateExtensionDuration(bookingid, hours) {
    const ext = Math.max(0, Number(hours) || 0)
    await pool.query(
      `UPDATE confirmed_bookings SET extension_duration = $2, last_updated = CURRENT_TIMESTAMP WHERE id = $1`,
      [bookingid, ext]
    )
    return this.recalcAndPersistPaymentStatus(bookingid)
  },
}
