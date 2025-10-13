const { pool } = require('../Config/db')

// Create staff assignment table (1..2 employees per confirmed booking)
async function initConfirmedBookingStaffTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS confirmed_booking_staff (
      id SERIAL PRIMARY KEY,
      bookingid INTEGER NOT NULL REFERENCES confirmed_bookings(id) ON DELETE CASCADE,
      staff_userid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (bookingid, staff_userid)
    )
  `)
}

// Assign staff to a confirmed booking (max 2 employees total)
async function assignStaff(bookingid, staffUserIds = []) {
  if (!Array.isArray(staffUserIds) || staffUserIds.length === 0) return []

  // ensure booking exists
  const b = await pool.query(
    `SELECT id FROM confirmed_bookings WHERE id = $1`,
    [bookingid]
  )
  if (!b.rows[0]) throw new Error('Confirmed booking not found')

  // normalize staff ids (unique)
  const uniqueIds = Array.from(
    new Set(staffUserIds.map((n) => Number(n)).filter(Boolean))
  )

  // current count
  const { rows: cntRows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM confirmed_booking_staff WHERE bookingid = $1`,
    [bookingid]
  )
  const currentCount = cntRows[0]?.c ?? 0
  if (currentCount + uniqueIds.length > 2) {
    throw new Error('You can assign at most 2 staff per booking')
  }

  // validate users are employees
  const { rows: validStaff } = await pool.query(
    `SELECT id FROM users WHERE id = ANY($1) AND role = 'employee'`,
    [uniqueIds]
  )
  const validIds = new Set(validStaff.map((r) => r.id))
  const invalid = uniqueIds.filter((id) => !validIds.has(id))
  if (invalid.length)
    throw new Error(`Invalid staff userId(s): ${invalid.join(', ')}`)

  // insert, ignore duplicates
  for (const staffId of uniqueIds) {
    await pool.query(
      `
      INSERT INTO confirmed_booking_staff (bookingid, staff_userid)
      VALUES ($1, $2)
      ON CONFLICT (bookingid, staff_userid) DO NOTHING
      `,
      [bookingid, staffId]
    )
  }
  return getStaffForBooking(bookingid)
}

// Remove a staff from a booking
async function removeStaff(bookingid, staffUserId) {
  await pool.query(
    `DELETE FROM confirmed_booking_staff WHERE bookingid = $1 AND staff_userid = $2`,
    [bookingid, staffUserId]
  )
  return getStaffForBooking(bookingid)
}

// List staff assigned to a booking
async function getStaffForBooking(bookingid) {
  const { rows } = await pool.query(
    `
    SELECT u.id, u.username, u.firstname, u.lastname, u.contact
    FROM confirmed_booking_staff cbs
    JOIN users u ON u.id = cbs.staff_userid
    WHERE cbs.bookingid = $1
    ORDER BY cbs.assigned_at ASC
    `,
    [bookingid]
  )
  return rows
}

module.exports = {
  initConfirmedBookingStaffTable,
  assignStaff,
  removeStaff,
  getStaffForBooking,
}
