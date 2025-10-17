const { pool } = require('../Config/db')

// Create the booking_requests table if it doesn't exist
async function initBookingRequestTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_requests (
      requestid SERIAL PRIMARY KEY,
      packageid INTEGER NOT NULL,
      userid INTEGER NOT NULL,
      event_date DATE NOT NULL,
      event_time TIME NOT NULL,
      event_end_time TIME,
      extension_duration INTEGER,
      event_address TEXT NOT NULL,
      grid TEXT,
      event_name TEXT,
      strongest_signal TEXT,
      contact_info TEXT,
  contact_person TEXT,
  contact_person_number TEXT,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rejected', 'accepted', 'cancelled')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (packageid) REFERENCES packages(id) ON DELETE CASCADE,
      FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Best-effort migrations for older column names and new attributes
  // Rename legacy columns if present (ignore errors if already renamed)
  try {
    await pool.query(
      'ALTER TABLE booking_requests RENAME COLUMN eventdate TO event_date'
    )
  } catch {}
  try {
    await pool.query(
      'ALTER TABLE booking_requests RENAME COLUMN eventtime TO event_time'
    )
  } catch {}
  try {
    await pool.query(
      'ALTER TABLE booking_requests RENAME COLUMN eventaddress TO event_address'
    )
  } catch {}
  // Add new columns if they don't exist
  await pool
    .query(
      'ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS event_name TEXT'
    )
    .catch(() => {})
  await pool
    .query(
      'ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS strongest_signal TEXT'
    )
    .catch(() => {})
  await pool
    .query(
      'ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS event_end_time TIME'
    )
    .catch(() => {})
  await pool
    .query(
      'ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS extension_duration INTEGER'
    )
    .catch(() => {})
  await pool
    .query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS grid TEXT')
    .catch(() => {})
  await pool
    .query(
      'ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS contact_person TEXT'
    )
    .catch(() => {})
  await pool
    .query(
      'ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS contact_person_number TEXT'
    )
    .catch(() => {})
}

// Create a new booking request
async function createBookingRequest(
  packageid,
  userid,
  eventdate,
  eventtime,
  event_end_time,
  extension_duration,
  eventaddress,
  notes = null,
  event_name = null,
  strongest_signal = null,
  grid = null,
  contact_person = null,
  contact_person_number = null
) {
  const query = `
    INSERT INTO booking_requests (packageid, userid, event_date, event_time, event_end_time, extension_duration, event_address, notes, event_name, strongest_signal, grid, contact_person, contact_person_number)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `
  const values = [
    packageid,
    userid,
    eventdate,
    eventtime,
    event_end_time,
    extension_duration,
    eventaddress,
    notes,
    event_name,
    strongest_signal,
    grid,
    contact_person,
    contact_person_number,
  ]
  const { rows } = await pool.query(query, values)
  return rows[0]
}

// Get booking request by ID
async function getBookingRequestById(requestid) {
  const query = `
    SELECT 
      br.*,
      TO_CHAR(br.event_date, 'YYYY-MM-DD') AS event_date,
      TO_CHAR(br.event_time, 'HH24:MI') AS event_time,
      TO_CHAR(br.event_end_time, 'HH24:MI') AS event_end_time,
      p.package_name,
      p.description as package_description,
      p.price,
      u.username,
      u.firstname,
      u.lastname,
      u.contact
    FROM booking_requests br
    JOIN packages p ON br.packageid = p.id
    JOIN users u ON br.userid = u.id
    WHERE br.requestid = $1
  `
  const result = await pool.query(query, [requestid])
  return result.rows[0]
}

// Get all booking requests
async function getAllBookingRequests() {
  const query = `
    SELECT 
      br.*,
      TO_CHAR(br.event_date, 'YYYY-MM-DD') AS event_date,
      TO_CHAR(br.event_time, 'HH24:MI') AS event_time,
      TO_CHAR(br.event_end_time, 'HH24:MI') AS event_end_time,
      p.package_name,
      p.price,
      u.username,
      u.firstname,
      u.lastname,
      u.contact
    FROM booking_requests br
    JOIN packages p ON br.packageid = p.id
    JOIN users u ON br.userid = u.id
    ORDER BY br.created_at DESC
  `
  const result = await pool.query(query)
  return result.rows
}

// Get booking requests by user ID
async function getBookingRequestsByUserId(userid) {
  const query = `
    SELECT 
      br.*,
      TO_CHAR(br.event_date, 'YYYY-MM-DD') AS event_date,
      TO_CHAR(br.event_time, 'HH24:MI') AS event_time,
      TO_CHAR(br.event_end_time, 'HH24:MI') AS event_end_time,
      p.package_name,
      p.description as package_description,
      p.price,
      p.image_url
    FROM booking_requests br
    JOIN packages p ON br.packageid = p.id
    WHERE br.userid = $1
    ORDER BY br.created_at DESC
  `
  const result = await pool.query(query, [userid])
  return result.rows
}

// Get booking requests by status
async function getBookingRequestsByStatus(status) {
  const query = `
    SELECT 
      br.*,
      TO_CHAR(br.event_date, 'YYYY-MM-DD') AS event_date,
      TO_CHAR(br.event_time, 'HH24:MI') AS event_time,
      TO_CHAR(br.event_end_time, 'HH24:MI') AS event_end_time,
      p.package_name,
      p.price,
      u.username,
      u.firstname,
      u.lastname,
      u.contact
    FROM booking_requests br
    JOIN packages p ON br.packageid = p.id
    JOIN users u ON br.userid = u.id
    WHERE br.status = $1
    ORDER BY br.created_at DESC
  `
  const result = await pool.query(query, [status])
  return result.rows
}

// Update booking request status
async function updateBookingRequestStatus(requestid, status) {
  const query = `
    UPDATE booking_requests 
    SET status = $1, last_updated = CURRENT_TIMESTAMP
    WHERE requestid = $2
    RETURNING *
  `
  const values = [status, requestid]
  const { rows } = await pool.query(query, values)
  return rows[0]
}

// Update booking request details
async function updateBookingRequest(
  requestid,
  eventdate,
  eventtime,
  eventaddress,
  notes
) {
  const query = `
    UPDATE booking_requests 
    SET event_date = $1, event_time = $2, event_address = $3, notes = $4, last_updated = CURRENT_TIMESTAMP
    WHERE requestid = $5
    RETURNING *
  `
  const values = [eventdate, eventtime, eventaddress, notes, requestid]
  const { rows } = await pool.query(query, values)
  return rows[0]
}

// Cancel booking request (soft delete by changing status)
async function cancelBookingRequest(requestid) {
  return await updateBookingRequestStatus(requestid, 'cancelled')
}

// Accept booking request
async function acceptBookingRequest(requestid) {
  return await updateBookingRequestStatus(requestid, 'accepted')
}

// Reject booking request
async function rejectBookingRequest(requestid) {
  return await updateBookingRequestStatus(requestid, 'rejected')
}

// Get booking requests by date range
async function getBookingRequestsByDateRange(startDate, endDate) {
  const query = `
    SELECT 
      br.*,
      p.package_name,
      p.price,
      u.username,
      u.firstname,
      u.lastname,
      u.contact
    FROM booking_requests br
    JOIN packages p ON br.packageid = p.id
    JOIN users u ON br.userid = u.id
    WHERE br.event_date BETWEEN $1 AND $2
    ORDER BY br.event_date ASC, br.event_time ASC
  `
  const result = await pool.query(query, [startDate, endDate])
  return result.rows
}

// Check if a date/time slot is already taken (accepted only)
async function checkBookingConflicts(params) {
  const event_date =
    params.event_date ?? params.eventdate ?? params.eventDate ?? null
  const event_time =
    params.event_time ?? params.eventtime ?? params.eventTime ?? null
  const q = `
    SELECT requestid
    FROM booking_requests
    WHERE event_date = $1
      AND event_time = $2
      AND status IN ('accepted')
    LIMIT 1
  `
  const { rows } = await pool.query(q, [event_date, event_time])
  return rows // empty = no conflict
}

module.exports = {
  initBookingRequestTable,
  createBookingRequest,
  getBookingRequestById,
  getAllBookingRequests,
  getBookingRequestsByUserId,
  getBookingRequestsByStatus,
  updateBookingRequestStatus,
  updateBookingRequest,
  cancelBookingRequest,
  acceptBookingRequest,
  rejectBookingRequest,
  getBookingRequestsByDateRange,
  checkBookingConflicts,
}
