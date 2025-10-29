const { pool } = require('../Config/db')

// Initialize table to store per-staff event timeline logs
async function initEventStaffLogsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_staff_logs (
      id SERIAL PRIMARY KEY,
      bookingid INTEGER NOT NULL REFERENCES confirmed_bookings(id) ON DELETE CASCADE,
      staff_userid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      arrived_at TIMESTAMP NULL,
      setup_finished_at TIMESTAMP NULL,
      started_at TIMESTAMP NULL,
      ended_at TIMESTAMP NULL,
      picked_up_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (bookingid, staff_userid)
    );
    CREATE INDEX IF NOT EXISTS idx_event_staff_logs_booking ON event_staff_logs(bookingid);
  `)
}

// Get all logs for a booking with staff basic info
async function getLogsForBooking(bookingid) {
  const { rows } = await pool.query(
    `
    SELECT l.*, u.firstname, u.lastname, u.username
    FROM event_staff_logs l
    JOIN users u ON u.id = l.staff_userid
    WHERE l.bookingid = $1
    ORDER BY COALESCE(l.updated_at, l.created_at) ASC
    `,
    [bookingid]
  )
  return rows
}

// Get or create a log row for staff_userid + bookingid
async function ensureLog(bookingid, staff_userid) {
  const { rows } = await pool.query(
    `SELECT * FROM event_staff_logs WHERE bookingid = $1 AND staff_userid = $2`,
    [bookingid, staff_userid]
  )
  if (rows[0]) return rows[0]
  const ins = await pool.query(
    `INSERT INTO event_staff_logs (bookingid, staff_userid) VALUES ($1, $2) RETURNING *`,
    [bookingid, staff_userid]
  )
  return ins.rows[0]
}

// Partial update for a staff user's log for a booking
// fields can be one or more of: arrived_at, setup_finished_at, started_at, ended_at, picked_up_at
// If a value is 'now' (string) or undefined, we set it to NOW(); if null, we clear it.
async function updateMyLog(bookingid, staff_userid, fields = {}) {
  const allowed = [
    'arrived_at',
    'setup_finished_at',
    'started_at',
    'ended_at',
    'picked_up_at',
  ]
  const updates = []
  const values = []
  let i = 1
  for (const k of allowed) {
    if (!Object.prototype.hasOwnProperty.call(fields, k)) continue
    const v = fields[k]
    if (v === null) {
      updates.push(`${k} = NULL`)
    } else if (v === 'now' || typeof v === 'undefined') {
      updates.push(`${k} = NOW()`) // set current timestamp
    } else {
      updates.push(`${k} = $${i++}`)
      values.push(new Date(v))
    }
  }
  await ensureLog(bookingid, staff_userid)
  if (!updates.length) {
    const { rows } = await pool.query(
      `SELECT * FROM event_staff_logs WHERE bookingid = $1 AND staff_userid = $2`,
      [bookingid, staff_userid]
    )
    return rows[0]
  }
  const sql = `
    UPDATE event_staff_logs
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE bookingid = $${i} AND staff_userid = $${i + 1}
    RETURNING *
  `
  values.push(bookingid, staff_userid)
  const { rows } = await pool.query(sql, values)
  return rows[0]
}

module.exports = {
  initEventStaffLogsTable,
  getLogsForBooking,
  updateMyLog,
  ensureLog,
}
