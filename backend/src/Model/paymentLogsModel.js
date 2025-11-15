// logs for payment activities
const { pool } = require('../Config/db')

// Create payment_logs table (references payments and users)
async function initPaymentLogsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_logs (
      log_id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
      previous_status VARCHAR(50) NOT NULL,
      new_status VARCHAR(50) NOT NULL,
      performed_by VARCHAR(50) NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  // ensure additional_notes column exists for admin-added context
  await pool.query(
    `ALTER TABLE payment_logs ADD COLUMN IF NOT EXISTS additional_notes TEXT`
  )
  // remove deprecated notes column if it still exists
  await pool.query(`ALTER TABLE payment_logs DROP COLUMN IF EXISTS notes`)
}

// Create a payment log entry
async function createPaymentLog({
  payment_id,
  previous_status,
  new_status,
  performed_by,
  user_id,
  action,
  additional_notes = null,
}) {
  const result = await pool.query(
    `
      INSERT INTO payment_logs (
        payment_id,
        previous_status,
        new_status,
        performed_by,
        user_id,
        action,
        additional_notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `,
    [
      payment_id,
      previous_status,
      new_status,
      performed_by,
      user_id,
      action,
      additional_notes,
    ]
  )
  return result.rows[0]
}

// List logs by payment
async function listPaymentLogsByPayment(payment_id) {
  const result = await pool.query(
    `SELECT * FROM payment_logs WHERE payment_id = $1 ORDER BY created_at DESC`,
    [payment_id]
  )
  return result.rows
}

// List all logs (optional helper)
async function listAllPaymentLogs() {
  const result = await pool.query(
    `SELECT * FROM payment_logs ORDER BY created_at DESC`
  )
  return result.rows
}

// Update log to add or modify admin-provided additional notes
async function updatePaymentLog(log_id, { additional_notes } = {}) {
  if (typeof additional_notes === 'undefined') return null
  const q = `
    UPDATE payment_logs
    SET additional_notes = $1
    WHERE log_id = $2
    RETURNING *
  `
  const result = await pool.query(q, [additional_notes, log_id])
  return result.rows[0] || null
}

module.exports = {
  initPaymentLogsTable,
  createPaymentLog,
  listPaymentLogsByPayment,
  listAllPaymentLogs,
  updatePaymentLog,
}
