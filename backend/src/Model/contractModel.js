const { pool } = require('../Config/db')

// Initialize booking_contracts table
async function initContractsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_contracts (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER NOT NULL UNIQUE REFERENCES confirmed_bookings(id) ON DELETE CASCADE,
      original_url TEXT,
      original_mime TEXT,
      original_uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      original_uploaded_at TIMESTAMP,
      signed_url TEXT,
      signed_mime TEXT,
      signed_uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      signed_uploaded_at TIMESTAMP,
      status VARCHAR(32) NOT NULL DEFAULT 'Pending Signature' CHECK (status IN ('Pending Signature','Signed','Under Review','Verified')),
      verified_at TIMESTAMP,
      verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

async function getContractByBookingId(bookingId) {
  const { rows } = await pool.query(
    `SELECT * FROM booking_contracts WHERE booking_id = $1 LIMIT 1`,
    [Number(bookingId)]
  )
  return rows[0] || null
}

async function upsertOriginalContract({ booking_id, user_id, url, mime }) {
  const existing = await getContractByBookingId(booking_id)
  if (existing) {
    const { rows } = await pool.query(
      `UPDATE booking_contracts
       SET original_url = $2,
           original_mime = $3,
           original_uploaded_by = $4,
           original_uploaded_at = NOW(),
           status = 'Pending Signature',
           updated_at = NOW()
       WHERE booking_id = $1
       RETURNING *`,
      [booking_id, url, mime, user_id]
    )
    return rows[0]
  } else {
    const { rows } = await pool.query(
      `INSERT INTO booking_contracts (
          booking_id, original_url, original_mime, original_uploaded_by, original_uploaded_at, status
        ) VALUES ($1,$2,$3,$4,NOW(),'Pending Signature') RETURNING *`,
      [booking_id, url, mime, user_id]
    )
    return rows[0]
  }
}

async function attachSignedContract({ booking_id, user_id, url, mime }) {
  const existing = await getContractByBookingId(booking_id)
  if (!existing) {
    // If no original, still create a row so admin can see
    const { rows } = await pool.query(
      `INSERT INTO booking_contracts (
          booking_id, signed_url, signed_mime, signed_uploaded_by, signed_uploaded_at, status
        ) VALUES ($1,$2,$3,$4,NOW(),'Under Review') RETURNING *`,
      [booking_id, url, mime, user_id]
    )
    return rows[0]
  }
  const { rows } = await pool.query(
    `UPDATE booking_contracts
     SET signed_url = $2,
         signed_mime = $3,
         signed_uploaded_by = $4,
         signed_uploaded_at = NOW(),
         status = 'Under Review',
         updated_at = NOW()
     WHERE booking_id = $1
     RETURNING *`,
    [booking_id, url, mime, user_id]
  )
  return rows[0]
}

async function verifyContract({ booking_id, user_id }) {
  const { rows } = await pool.query(
    `UPDATE booking_contracts
     SET status = 'Verified', verified_at = NOW(), verified_by = $2, updated_at = NOW()
     WHERE booking_id = $1
     RETURNING *`,
    [booking_id, user_id]
  )
  return rows[0] || null
}

module.exports = {
  initContractsTable,
  getContractByBookingId,
  upsertOriginalContract,
  attachSignedContract,
  verifyContract,
}
