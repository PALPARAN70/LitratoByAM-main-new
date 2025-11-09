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

// Replace all staff assignments for a booking with the provided list (max 2)
async function setStaff(bookingid, staffUserIds = []) {
  if (!Array.isArray(staffUserIds)) staffUserIds = []

  // ensure booking exists
  const b = await pool.query(
    `SELECT id FROM confirmed_bookings WHERE id = $1`,
    [bookingid]
  )
  if (!b.rows[0]) throw new Error('Confirmed booking not found')

  // normalize staff ids (unique, numeric)
  const uniqueIds = Array.from(
    new Set(staffUserIds.map((n) => Number(n)).filter(Boolean))
  )
  if (uniqueIds.length > 2) {
    throw new Error('You can assign at most 2 staff per booking')
  }

  // validate users are employees
  if (uniqueIds.length) {
    const { rows: validStaff } = await pool.query(
      `SELECT id FROM users WHERE id = ANY($1) AND role = 'employee'`,
      [uniqueIds]
    )
    const validIds = new Set(validStaff.map((r) => r.id))
    const invalid = uniqueIds.filter((id) => !validIds.has(id))
    if (invalid.length)
      throw new Error(`Invalid staff userId(s): ${invalid.join(', ')}`)
  }

  // transaction: clear existing and insert new
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `DELETE FROM confirmed_booking_staff WHERE bookingid = $1`,
      [bookingid]
    )
    for (const staffId of uniqueIds) {
      await client.query(
        `INSERT INTO confirmed_booking_staff (bookingid, staff_userid) VALUES ($1, $2)`,
        [bookingid, staffId]
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  return getStaffForBooking(bookingid)
}

module.exports = {
  initConfirmedBookingStaffTable,
  assignStaff,
  removeStaff,
  getStaffForBooking,
  setStaff,
  // List confirmed bookings assigned to a specific staff user, with details
  async listAssignedConfirmedBookings(staffUserId) {
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
        br.contact_person,
        br.contact_person_number,
        br.event_name,
        br.strongest_signal,
        p.package_name,
        p.id AS package_id,
        p.price AS package_price,
        u.username,
        u.firstname,
        u.lastname
      FROM confirmed_booking_staff cbs
      JOIN confirmed_bookings cb ON cb.id = cbs.bookingid
      JOIN booking_requests br ON br.requestid = cb.requestid
      JOIN packages p ON p.id = br.packageid
      JOIN users u ON u.id = cb.userid
      WHERE cbs.staff_userid = $1
      ORDER BY cb.created_at DESC
      `,
      [staffUserId]
    )
    return rows
  },
}
