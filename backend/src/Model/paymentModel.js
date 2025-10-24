// payment model.js
const { pool } = require('../Config/db')

// Create payments table (ties to confirmed_bookings and users)
async function initPaymentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      payment_id SERIAL PRIMARY KEY,
      booking_id INTEGER NOT NULL REFERENCES confirmed_bookings(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(10,2) NOT NULL,
      amount_paid NUMERIC(10,2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      proof_image_url TEXT,
      reference_no VARCHAR(100),
      payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','completed','failed','refunded')),
      notes TEXT,
      verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  // Backfill columns for older databases
  await pool
    .query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_image_url TEXT`)
    .catch(() => {})
  await pool
    .query(
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP`
    )
    .catch(() => {})
  await pool
    .query(
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
    )
    .catch(() => {})
}

//create payment function
// Create a payment record
async function createPayment({
  booking_id,
  user_id,
  amount,
  amount_paid,
  payment_method,
  qr_image_url = null,
  proof_image_url = null,
  reference_no = null,
  payment_status = 'pending',
  notes = null,
  verified_at = null,
}) {
  // Primary attempt including all columns
  try {
    const result = await pool.query(
      `
        INSERT INTO payments (
          booking_id,
          user_id,
          amount,
          amount_paid,
          payment_method,
          qr_image_url,
          proof_image_url,
          reference_no,
          payment_status,
          notes,
          verified_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `,
      [
        booking_id,
        user_id,
        amount,
        amount_paid,
        payment_method,
        qr_image_url,
        proof_image_url,
        reference_no,
        payment_status,
        notes,
        verified_at,
      ]
    )
    return result.rows[0]
  } catch (err) {
    // Fallbacks for older schemas missing some columns; try progressively smaller inserts
    const isUndefinedColumn = err && err.code === '42703'
    if (!isUndefinedColumn) throw err
  }

  // Fallback 1: without qr_image_url
  try {
    const result = await pool.query(
      `
        INSERT INTO payments (
          booking_id,
          user_id,
          amount,
          amount_paid,
          payment_method,
          proof_image_url,
          reference_no,
          payment_status,
          notes,
          verified_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
      `,
      [
        booking_id,
        user_id,
        amount,
        amount_paid,
        payment_method,
        proof_image_url,
        reference_no,
        payment_status,
        notes,
        verified_at,
      ]
    )
    return result.rows[0]
  } catch (err) {
    const isUndefinedColumn = err && err.code === '42703'
    if (!isUndefinedColumn) throw err
  }

  // Fallback 2: without qr_image_url and without verified_at
  const result = await pool.query(
    `
      INSERT INTO payments (
        booking_id,
        user_id,
        amount,
        amount_paid,
        payment_method,
        proof_image_url,
        reference_no,
        payment_status,
        notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `,
    [
      booking_id,
      user_id,
      amount,
      amount_paid,
      payment_method,
      proof_image_url,
      reference_no,
      payment_status,
      notes,
    ]
  )
  return result.rows[0]
}
// Find a payment by id
async function findPaymentById(payment_id) {
  const result = await pool.query(
    `SELECT * FROM payments WHERE payment_id = $1`,
    [payment_id]
  )
  return result.rows[0]
}

// List payments (optionally by booking_id or user_id)
async function listPayments({ booking_id = null, user_id = null } = {}) {
  const clauses = []
  const values = []
  let idx = 1
  if (booking_id != null) {
    clauses.push(`p.booking_id = $${idx++}`)
    values.push(booking_id)
  }
  if (user_id != null) {
    clauses.push(`p.user_id = $${idx++}`)
    values.push(user_id)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const query = `
    SELECT 
      p.*, 
      cb.payment_status AS booking_payment_status
    FROM payments p
    LEFT JOIN confirmed_bookings cb ON cb.id = p.booking_id
    ${where}
    ORDER BY p.created_at DESC
  `
  const result = await pool.query(query, values)
  return result.rows
}

// Update a payment (whitelist fields)
async function updatePayment(payment_id, updates) {
  if (!updates || typeof updates !== 'object') return null

  const allowed = {
    amount: true,
    amount_paid: true,
    payment_method: true,
    qr_image_url: true,
    proof_image_url: true,
    reference_no: true,
    payment_status: true,
    notes: true,
    verified_at: true,
    // booking_id and user_id are intentionally not updatable by default
  }

  const fields = []
  const values = []
  let idx = 1
  for (const [k, v] of Object.entries(updates)) {
    if (!(k in allowed)) continue
    fields.push(`${k} = $${idx}`)
    values.push(v)
    idx++
  }
  if (!fields.length) return null
  fields.push(`last_updated = CURRENT_TIMESTAMP`)

  const query = `
    UPDATE payments
    SET ${fields.join(', ')}
    WHERE payment_id = $${idx}
    RETURNING *
  `
  values.push(payment_id)
  const result = await pool.query(query, values)
  return result.rows[0]
}

module.exports = {
  initPaymentsTable,
  createPayment,
  findPaymentById,
  listPayments,
  updatePayment,
}
