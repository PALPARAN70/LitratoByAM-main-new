const { pool } = require('../Config/db')

// Create the booking_requests table if it doesn't exist
async function initBookingRequestTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_requests (
      requestid SERIAL PRIMARY KEY,
      packageid INTEGER NOT NULL,
      userid INTEGER NOT NULL,
      eventdate DATE NOT NULL,
      eventtime TIME NOT NULL,
      eventaddress TEXT NOT NULL,
      contact_info TEXT,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rejected', 'accepted', 'cancelled')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (packageid) REFERENCES packages(id) ON DELETE CASCADE,
      FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
}

// Create a new booking request
async function createBookingRequest(
  packageid,
  userid,
  eventdate,
  eventtime,
  eventaddress,
  notes = null
) {
  const query = `
    INSERT INTO booking_requests (packageid, userid, eventdate, eventtime, eventaddress, notes)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `
  const values = [packageid, userid, eventdate, eventtime, eventaddress, notes]
  const { rows } = await pool.query(query, values)
  return rows[0]
}

// Get booking request by ID
async function getBookingRequestById(requestid) {
  const query = `
    SELECT 
      br.*,
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
    SET eventdate = $1, eventtime = $2, eventaddress = $3, notes = $4, last_updated = CURRENT_TIMESTAMP
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
    WHERE br.eventdate BETWEEN $1 AND $2
    ORDER BY br.eventdate ASC, br.eventtime ASC
  `
  const result = await pool.query(query, [startDate, endDate])
  return result.rows
}

// Check for conflicting bookings (same date and overlapping time)
async function checkBookingConflicts(
  eventdate,
  eventtime,
  excludeRequestId = null
) {
  let query = `
    SELECT 
      br.*,
      p.package_name,
      u.username
    FROM booking_requests br
    JOIN packages p ON br.packageid = p.id
    JOIN users u ON br.userid = u.id
    WHERE br.eventdate = $1 
    AND br.eventtime = $2
    AND br.status IN ('pending', 'accepted')
  `
  const values = [eventdate, eventtime]

  if (excludeRequestId) {
    query += ' AND br.requestid != $3'
    values.push(excludeRequestId)
  }

  const result = await pool.query(query, values)
  return result.rows
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
