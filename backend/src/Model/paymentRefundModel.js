const { pool } = require('../Config/db')

// Initialize refunds table to track refunds against payments
async function initPaymentRefundsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_refunds (
      refund_id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
      amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
      reason TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool
    .query(
      `CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON payment_refunds(payment_id)`
    )
    .catch(() => {})
}

async function createRefund({ payment_id, amount, reason = null, created_by }) {
  const res = await pool.query(
    `INSERT INTO payment_refunds (payment_id, amount, reason, created_by)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [payment_id, amount, reason, created_by]
  )
  return res.rows[0]
}

async function listRefundsByPayment(payment_id) {
  const res = await pool.query(
    `SELECT * FROM payment_refunds WHERE payment_id = $1 ORDER BY created_at DESC`,
    [payment_id]
  )
  return res.rows
}

async function getTotalRefundedForPayment(payment_id) {
  const res = await pool.query(
    `SELECT COALESCE(SUM(amount),0)::numeric AS total FROM payment_refunds WHERE payment_id = $1`,
    [payment_id]
  )
  return Number(res.rows?.[0]?.total || 0)
}

async function getRefundTotalsForPayments(paymentIds = []) {
  if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
    return {}
  }
  const numbersOnly = paymentIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b)
  const distinctIds = numbersOnly.filter(
    (id, idx) => id !== numbersOnly[idx - 1]
  )
  if (!distinctIds.length) return {}
  const res = await pool.query(
    `SELECT payment_id, COALESCE(SUM(amount),0)::numeric AS total
       FROM payment_refunds
      WHERE payment_id = ANY($1::int[])
   GROUP BY payment_id`,
    [distinctIds]
  )
  const map = {}
  for (const row of res.rows || []) {
    const id = Number(row.payment_id)
    if (Number.isFinite(id)) {
      map[id] = Number(row.total || 0)
    }
  }
  return map
}

module.exports = {
  initPaymentRefundsTable,
  createRefund,
  listRefundsByPayment,
  getTotalRefundedForPayment,
  getRefundTotalsForPayments,
}
