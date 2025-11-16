const { pool } = require('../Config/db')
const { getAllPackages } = require('./packageModel')

const MINUTES_PER_HOUR = 60
const BEFORE_BUFFER_MINUTES = 2 * MINUTES_PER_HOUR
const AFTER_BUFFER_MINUTES = 2 * MINUTES_PER_HOUR
const MAX_POSSIBLE_EXTENSION_HOURS = 2 // assume customers may extend up to 2 hours
const DAY_TOTAL_MINUTES = 24 * MINUTES_PER_HOUR
const EARLIEST_ALLOWED_START_MINUTES = 8 * MINUTES_PER_HOUR // 8:00 AM
const LATEST_ALLOWED_START_MINUTES = 21 * MINUTES_PER_HOUR + 59 // 9:59 PM

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
  await pool
    .query(
      'ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS booth_placement TEXT'
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
  contact_person_number = null,
  booth_placement = null
) {
  const query = `
    INSERT INTO booking_requests (packageid, userid, event_date, event_time, event_end_time, extension_duration, event_address, notes, event_name, strongest_signal, grid, contact_person, contact_person_number, booth_placement)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
    booth_placement,
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
      (
        SELECT COALESCE(json_agg(g.id ORDER BY g.grid_name), '[]'::json)
        FROM booking_request_grids brg
        JOIN grids g ON g.id = brg.grid_id
        WHERE brg.requestid = br.requestid
      ) AS grid_ids,
      (
        SELECT COALESCE(json_agg(g.grid_name ORDER BY g.grid_name), '[]'::json)
        FROM booking_request_grids brg
        JOIN grids g ON g.id = brg.grid_id
        WHERE brg.requestid = br.requestid
      ) AS grid_names,
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
      (
        SELECT COALESCE(json_agg(g.id ORDER BY g.grid_name), '[]'::json)
        FROM booking_request_grids brg
        JOIN grids g ON g.id = brg.grid_id
        WHERE brg.requestid = br.requestid
      ) AS grid_ids,
      (
        SELECT COALESCE(json_agg(g.grid_name ORDER BY g.grid_name), '[]'::json)
        FROM booking_request_grids brg
        JOIN grids g ON g.id = brg.grid_id
        WHERE brg.requestid = br.requestid
      ) AS grid_names,
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
      (
        SELECT COALESCE(json_agg(g.id ORDER BY g.grid_name), '[]'::json)
        FROM booking_request_grids brg
        JOIN grids g ON g.id = brg.grid_id
        WHERE brg.requestid = br.requestid
      ) AS grid_ids,
      (
        SELECT COALESCE(json_agg(g.grid_name ORDER BY g.grid_name), '[]'::json)
        FROM booking_request_grids brg
        JOIN grids g ON g.id = brg.grid_id
        WHERE brg.requestid = br.requestid
      ) AS grid_names,
      p.package_name,
      p.description as package_description,
      p.price,
      p.image_url,
      cb.payment_status
    FROM booking_requests br
    JOIN packages p ON br.packageid = p.id
    LEFT JOIN confirmed_bookings cb ON cb.requestid = br.requestid
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
      (
        SELECT COALESCE(json_agg(g.id ORDER BY g.grid_name), '[]'::json)
        FROM booking_request_grids brg
        JOIN grids g ON g.id = brg.grid_id
        WHERE brg.requestid = br.requestid
      ) AS grid_ids,
      (
        SELECT COALESCE(json_agg(g.grid_name ORDER BY g.grid_name), '[]'::json)
        FROM booking_request_grids brg
        JOIN grids g ON g.id = brg.grid_id
        WHERE brg.requestid = br.requestid
      ) AS grid_names,
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

// Check if a date/time slot conflicts with accepted bookings, including setup/cleanup buffers
// Adds a -/+ buffer (hours) around both the new request and existing accepted bookings.
// Defaults to 2 hours before and 2 hours after.
// Note: If a package id is provided, conflicts are checked only against bookings with the SAME package (photobooth).
async function checkBookingConflicts(params) {
  const event_date =
    params.event_date ?? params.eventdate ?? params.eventDate ?? null
  const rawEventTime =
    params.event_time ?? params.eventtime ?? params.eventTime ?? null
  const rawEventEnd = params.event_end_time ?? params.eventEndTime ?? null
  const rawBufferHours = params.bufferHours ?? params.buffer_hours
  const rawBeforeBufferHours =
    params.beforeBufferHours ?? params.before_buffer_hours ?? null
  const rawAfterBufferHours =
    params.afterBufferHours ?? params.after_buffer_hours ?? null
  const extensionRaw =
    params.extension_duration ?? params.extensionDuration ?? null
  const excludeRaw =
    params.excludeRequestId ??
    params.exclude_requestid ??
    params.exclude_request_id ??
    null

  const normalizeHours = (value) => {
    const num = Number(value)
    return Number.isFinite(num) && num >= 0 ? num : null
  }

  let beforeBufferHours = normalizeHours(rawBeforeBufferHours)
  if (beforeBufferHours == null) {
    beforeBufferHours = normalizeHours(rawBufferHours)
  }
  if (beforeBufferHours == null) {
    beforeBufferHours = BEFORE_BUFFER_MINUTES / MINUTES_PER_HOUR
  }

  let afterBufferHours = normalizeHours(rawAfterBufferHours)
  if (afterBufferHours == null) {
    afterBufferHours = normalizeHours(rawBufferHours)
  }
  if (afterBufferHours == null) {
    afterBufferHours = AFTER_BUFFER_MINUTES / MINUTES_PER_HOUR
  }

  const beforeBufferMinutes = Math.max(
    0,
    Math.round(beforeBufferHours * MINUTES_PER_HOUR)
  )
  const afterBufferMinutes = Math.max(
    0,
    Math.round(afterBufferHours * MINUTES_PER_HOUR)
  )

  let newPackageId =
    params.packageid ?? params.packageId ?? params.package_id ?? null
  newPackageId = Number(newPackageId)
  if (!Number.isFinite(newPackageId) || newPackageId <= 0) newPackageId = null

  const excludeRequestId = Number(excludeRaw)
  const skipRequestId =
    Number.isFinite(excludeRequestId) && excludeRequestId > 0
      ? excludeRequestId
      : null

  let proposedExtensionHours = Number(extensionRaw)
  if (!Number.isFinite(proposedExtensionHours) || proposedExtensionHours < 0) {
    proposedExtensionHours = 0
  }
  proposedExtensionHours = Math.min(
    proposedExtensionHours,
    MAX_POSSIBLE_EXTENSION_HOURS
  )
  const proposedExtensionMinutes = Math.round(
    proposedExtensionHours * MINUTES_PER_HOUR
  )
  const proposedRemainingExtensionMinutes =
    Math.max(0, MAX_POSSIBLE_EXTENSION_HOURS - proposedExtensionHours) *
    MINUTES_PER_HOUR

  if (!event_date || !rawEventTime) return []

  const event_time = String(rawEventTime).trim()
  if (!event_time) return []

  const startMinutes = parseTimeToMinutes(event_time)
  if (startMinutes == null) return []

  // Determine fallback duration (in minutes) using package duration when available
  let fallbackDurationMinutes = 2 * MINUTES_PER_HOUR
  if (newPackageId) {
    try {
      const pkg = await pool.query(
        'SELECT duration_hours FROM packages WHERE id = $1 LIMIT 1',
        [newPackageId]
      )
      const rawDur = Number(pkg.rows?.[0]?.duration_hours)
      if (Number.isFinite(rawDur) && rawDur > 0) {
        fallbackDurationMinutes = Math.max(
          30,
          Math.round(rawDur * MINUTES_PER_HOUR)
        )
      }
    } catch (e) {
      console.warn(
        'checkBookingConflicts: package duration lookup failed:',
        e?.message
      )
    }
  }

  const endMinutes = rawEventEnd
    ? parseTimeToMinutes(String(rawEventEnd).trim())
    : null
  let proposedCoreEnd = endMinutes
  if (proposedCoreEnd == null || proposedCoreEnd <= startMinutes) {
    proposedCoreEnd =
      startMinutes + fallbackDurationMinutes + proposedExtensionMinutes
  }

  const newWindowStart = clampMinutes(startMinutes - beforeBufferMinutes)
  const newWindowEnd = clampMinutes(
    proposedCoreEnd + proposedRemainingExtensionMinutes + afterBufferMinutes
  )

  const { rows } = await pool.query(
    `
      SELECT 
        br.requestid,
        br.event_time,
        br.event_end_time,
        br.extension_duration,
        COALESCE(cb.event_end_time, NULL) AS confirmed_event_end_time,
        COALESCE(cb.extension_duration, NULL) AS confirmed_extension_duration,
        COALESCE(cb.booking_status, NULL) AS confirmed_status,
        br.status AS request_status,
        p.duration_hours
      FROM booking_requests br
      JOIN packages p ON p.id = br.packageid
      LEFT JOIN confirmed_bookings cb ON cb.requestid = br.requestid
      WHERE br.event_date = $1
        AND br.packageid = COALESCE($2::int, br.packageid)
        AND (
          br.status = 'accepted' OR
          (cb.booking_status IS NOT NULL AND cb.booking_status <> 'cancelled')
        )
    `,
    [event_date, newPackageId]
  )

  const conflicts = []
  for (const row of rows) {
    const existingId = Number(row.requestid)
    if (skipRequestId && existingId === skipRequestId) continue

    const existingStart = parseTimeToMinutes(row.event_time)
    if (existingStart == null) continue

    const rawDuration = Number(row.duration_hours)
    const durationMinutes = Math.max(
      30,
      Math.round(
        Number.isFinite(rawDuration) && rawDuration > 0
          ? rawDuration * MINUTES_PER_HOUR
          : fallbackDurationMinutes
      )
    )

    let bookedExtHours = Number(
      row.confirmed_extension_duration ?? row.extension_duration ?? 0
    )
    if (!Number.isFinite(bookedExtHours) || bookedExtHours < 0) {
      bookedExtHours = 0
    }
    bookedExtHours = Math.min(bookedExtHours, MAX_POSSIBLE_EXTENSION_HOURS)
    const bookedExtMinutes = Math.round(bookedExtHours * MINUTES_PER_HOUR)
    const remainingExtMinutes =
      Math.max(0, MAX_POSSIBLE_EXTENSION_HOURS - bookedExtHours) *
      MINUTES_PER_HOUR

    const confirmedEnd = parseTimeToMinutes(row.confirmed_event_end_time)
    const requestEnd = parseTimeToMinutes(row.event_end_time)
    let existingCoreEnd = confirmedEnd ?? requestEnd
    if (existingCoreEnd == null || existingCoreEnd <= existingStart) {
      existingCoreEnd = existingStart + durationMinutes + bookedExtMinutes
    }

    const existingWindowStart = clampMinutes(
      existingStart - beforeBufferMinutes
    )
    const existingWindowEnd = clampMinutes(
      existingCoreEnd + remainingExtMinutes + afterBufferMinutes
    )

    const noOverlap =
      existingWindowEnd <= newWindowStart || existingWindowStart >= newWindowEnd
    if (!noOverlap) {
      conflicts.push({ requestid: existingId })
      break
    }
  }

  return conflicts
}

// Check if extending a confirmed booking to a specific total extension hours would conflict
// Considers confirmed_bookings overrides and extension deltas, with ±bufferHours on both sides.
// Only compares against bookings using the SAME package id as the target confirmed booking.
async function checkExtensionConflictForConfirmedBooking(
  bookingId,
  nextExtensionHours,
  bufferHours = 2
) {
  const id = Number(bookingId)
  const nextExt = Math.max(0, Number(nextExtensionHours) || 0)
  const buf = Math.max(0, Number(bufferHours) || 0)
  if (!Number.isFinite(id)) return []

  const q = `
    WITH target AS (
      SELECT 
        cb.id AS booking_id,
        br.requestid,
        br.packageid,
        br.event_date,
        br.event_time,
        COALESCE(cb.event_end_time, br.event_end_time) AS base_end_time,
        COALESCE(cb.extension_duration, br.extension_duration, 0) AS curr_ext
      FROM confirmed_bookings cb
      JOIN booking_requests br ON br.requestid = cb.requestid
      WHERE cb.id = $1
    ),
    new_window AS (
      SELECT
        (t.event_date::timestamp + t.event_time) - make_interval(hours => $3) AS new_start,
        (
          (t.event_date::timestamp + COALESCE(t.base_end_time, (t.event_time + interval '2 hours')))
          + make_interval(hours => CASE WHEN t.base_end_time IS NOT NULL THEN GREATEST(0, $2::int - t.curr_ext) ELSE $2::int END)
        ) + make_interval(hours => $3) AS new_end,
  t.requestid AS target_requestid,
  t.packageid AS target_packageid
      FROM target t
    ),
    existing AS (
      SELECT
        br.requestid,
        (br.event_date::timestamp + br.event_time) - make_interval(hours => $3) AS ex_start,
        (
          (br.event_date::timestamp + COALESCE(COALESCE(cb.event_end_time, br.event_end_time), (br.event_time + interval '2 hours')))
          + make_interval(hours => CASE WHEN COALESCE(cb.event_end_time, br.event_end_time) IS NOT NULL THEN GREATEST(0, COALESCE(cb.extension_duration, br.extension_duration, 0) - COALESCE(br.extension_duration, 0)) ELSE COALESCE(cb.extension_duration, br.extension_duration, 0) END)
        ) + make_interval(hours => $3) AS ex_end,
        TO_CHAR(br.event_date, 'YYYY-MM-DD') AS event_date,
        TO_CHAR(br.event_time, 'HH24:MI') AS event_time
      FROM booking_requests br
      LEFT JOIN confirmed_bookings cb ON cb.requestid = br.requestid
      CROSS JOIN (SELECT packageid FROM target) t
      WHERE br.status = 'accepted' AND br.packageid = t.packageid
    )
    SELECT e.requestid, e.event_date, e.event_time
    FROM new_window nw
    JOIN existing e ON e.requestid <> nw.target_requestid
    WHERE NOT (e.ex_end <= nw.new_start OR e.ex_start >= nw.new_end)
    LIMIT 1
  `

  const { rows } = await pool.query(q, [id, nextExt, buf])
  return rows // empty = no conflict
}

function normalizeDateInput(input) {
  if (!input && input !== 0) return null
  const str = String(input).trim()
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return null
  }
  return str
}

function parseTimeToMinutes(value) {
  if (!value && value !== 0) return null
  const str = String(value)
  const parts = str.split(':')
  if (parts.length < 2) return null
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * MINUTES_PER_HOUR + minutes
}

function clampMinutes(value, min = 0, max = Number.POSITIVE_INFINITY) {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

function minutesToHHMM(value) {
  const minutes = clampMinutes(Math.round(value), 0)
  const normalized = minutes % DAY_TOTAL_MINUTES
  const hours = Math.floor(normalized / MINUTES_PER_HOUR)
  const mins = normalized % MINUTES_PER_HOUR
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function toDisplayStatusLabel(status) {
  if (!status) return 'reserved'
  const norm = String(status).toLowerCase()
  if (norm === 'accepted' || norm === 'approved') return 'accepted'
  if (norm === 'scheduled' || norm === 'in_progress' || norm === 'completed')
    return norm.replace('_', ' ')
  return norm
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .slice()
    .filter((it) => Number.isFinite(it.start) && Number.isFinite(it.end))
    .sort((a, b) => a.start - b.start)
  if (!sorted.length) return []
  const merged = [Object.assign({}, sorted[0])]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const current = sorted[i]
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push(Object.assign({}, current))
    }
  }
  return merged
}

function buildPackageAvailability(entry) {
  const rawDuration =
    entry.durationHours != null ? Number(entry.durationHours) : NaN
  const safeDurationHours =
    Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 2
  const eventDurationMinutes = Math.max(
    30,
    Math.round(safeDurationHours * MINUTES_PER_HOUR)
  )
  const potentialExtensionMinutes =
    MAX_POSSIBLE_EXTENSION_HOURS * MINUTES_PER_HOUR

  const rawBlocks = entry.bookings
    .map((booking) => ({
      start: booking.bufferStartMinutes,
      end: booking.bufferEndMinutes,
    }))
    .filter((block) => block.end > block.start)

  const mergedBlocks = mergeIntervals(rawBlocks)

  // Compute free intervals between merged blocks across the full day
  const freeIntervals = []
  let cursor = 0
  for (const block of mergedBlocks) {
    if (block.start > cursor) {
      freeIntervals.push({ start: cursor, end: block.start, endsAtDay: false })
    }
    cursor = Math.max(cursor, block.end)
  }
  if (cursor < DAY_TOTAL_MINUTES) {
    freeIntervals.push({
      start: cursor,
      end: DAY_TOTAL_MINUTES,
      endsAtDay: true,
    })
  }

  const requiredAfterStart =
    eventDurationMinutes + potentialExtensionMinutes + AFTER_BUFFER_MINUTES
  const startWindows = []
  for (const interval of freeIntervals) {
    let windowStart = interval.start + BEFORE_BUFFER_MINUTES
    const postGap = interval.endsAtDay
      ? AFTER_BUFFER_MINUTES
      : requiredAfterStart
    let windowEnd = interval.end - postGap
    windowStart = Math.max(windowStart, EARLIEST_ALLOWED_START_MINUTES)
    windowEnd = Math.min(windowEnd, LATEST_ALLOWED_START_MINUTES)
    if (windowStart <= windowEnd) {
      startWindows.push({ start: windowStart, end: windowEnd })
    }
  }

  const blockedWindows = mergedBlocks.map((block) => ({
    start: minutesToHHMM(block.start),
    end: minutesToHHMM(block.end),
  }))

  const existingBookings = entry.bookings
    .slice()
    .sort((a, b) => a.bufferStartMinutes - b.bufferStartMinutes)
    .map((booking) => ({
      requestId: booking.requestId,
      eventName: booking.eventName || null,
      status: toDisplayStatusLabel(booking.status),
      eventStart: minutesToHHMM(booking.eventStartMinutes),
      eventEnd: minutesToHHMM(booking.eventEndMinutes),
      bufferStart: minutesToHHMM(booking.bufferStartMinutes),
      bufferEnd: minutesToHHMM(booking.bufferEndMinutes),
    }))

  const startWindowsFormatted = startWindows.map((window) => ({
    start: minutesToHHMM(window.start),
    end: minutesToHHMM(window.end),
  }))

  let status = 'available'
  if (existingBookings.length && startWindows.length) {
    status = 'limited'
  } else if (existingBookings.length && !startWindows.length) {
    status = 'unavailable'
  }

  return {
    packageId: entry.packageId,
    packageName: entry.packageName,
    durationHours:
      entry.durationHours != null &&
      Number.isFinite(Number(entry.durationHours))
        ? Number(entry.durationHours)
        : safeDurationHours,
    status,
    existingBookings,
    blockedWindows,
    startWindows: startWindowsFormatted,
  }
}

async function getDailyAvailabilitySummary(dateInput) {
  const isoDate = normalizeDateInput(dateInput)
  if (!isoDate) throw new Error('Invalid date supplied')

  const packages = await getAllPackages()
  const pkgMap = new Map()
  for (const pkg of packages) {
    pkgMap.set(pkg.id, {
      packageId: pkg.id,
      packageName: pkg.package_name,
      durationHours:
        pkg.duration_hours != null ? Number(pkg.duration_hours) : 2,
      bookings: [],
    })
  }

  const query = `
    SELECT 
      br.requestid,
      br.packageid,
      br.event_time,
      br.event_end_time,
      br.event_name,
      br.status,
      COALESCE(cb.booking_status, NULL) AS confirmed_status,
      COALESCE(cb.event_end_time, br.event_end_time) AS confirmed_event_end_time,
      COALESCE(cb.extension_duration, br.extension_duration, 0) AS extension_duration,
      p.package_name,
      p.duration_hours
    FROM booking_requests br
    JOIN packages p ON p.id = br.packageid
    LEFT JOIN confirmed_bookings cb ON cb.requestid = br.requestid
    WHERE br.event_date = $1
      AND (
        br.status = 'accepted'
        OR (cb.booking_status IS NOT NULL AND cb.booking_status <> 'cancelled')
      )
  `

  const { rows } = await pool.query(query, [isoDate])

  for (const row of rows) {
    const pkgId = row.packageid
    if (!pkgMap.has(pkgId)) {
      pkgMap.set(pkgId, {
        packageId: pkgId,
        packageName: row.package_name || `Package ${pkgId}`,
        durationHours:
          row.duration_hours != null ? Number(row.duration_hours) : 2,
        bookings: [],
      })
    }
    const entry = pkgMap.get(pkgId)
    if (entry.durationHours == null || Number.isNaN(entry.durationHours)) {
      entry.durationHours =
        row.duration_hours != null ? Number(row.duration_hours) : 2
    }

    const baseStart = parseTimeToMinutes(row.event_time)
    if (baseStart == null) continue

    const confirmedEnd = parseTimeToMinutes(row.confirmed_event_end_time)
    const requestedEnd = parseTimeToMinutes(row.event_end_time)
    const bookedExtensionHours = Math.max(
      0,
      Math.min(
        MAX_POSSIBLE_EXTENSION_HOURS,
        Number(row.extension_duration || 0)
      )
    )
    const extensionMinutes = bookedExtensionHours * MINUTES_PER_HOUR
    const remainingExtensionMinutes =
      Math.max(0, MAX_POSSIBLE_EXTENSION_HOURS - bookedExtensionHours) *
      MINUTES_PER_HOUR
    const durationMinutes = Math.max(
      30,
      Math.round((entry.durationHours ?? 2) * MINUTES_PER_HOUR)
    )

    let coreEnd = confirmedEnd ?? requestedEnd
    if (coreEnd == null) {
      coreEnd = baseStart + durationMinutes + extensionMinutes
    }
    if (coreEnd < baseStart) {
      coreEnd = baseStart + durationMinutes + extensionMinutes
    }

    const bufferStartMinutes = clampMinutes(baseStart - BEFORE_BUFFER_MINUTES)
    const bufferEndMinutes = clampMinutes(
      coreEnd + remainingExtensionMinutes + AFTER_BUFFER_MINUTES
    )

    entry.bookings.push({
      requestId: row.requestid,
      eventName: row.event_name || null,
      status: row.confirmed_status || row.status,
      eventStartMinutes: baseStart,
      eventEndMinutes: coreEnd,
      bufferStartMinutes,
      bufferEndMinutes,
    })
  }

  const availability = Array.from(pkgMap.values())
    .sort((a, b) => {
      const nameA = String(a.packageName || '').toLowerCase()
      const nameB = String(b.packageName || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
    .map((entry) => buildPackageAvailability(entry))

  return {
    date: isoDate,
    generatedAt: new Date().toISOString(),
    constraints: {
      bufferHours: BEFORE_BUFFER_MINUTES / MINUTES_PER_HOUR,
      bufferHoursAfter: AFTER_BUFFER_MINUTES / MINUTES_PER_HOUR,
      potentialExtensionHours: MAX_POSSIBLE_EXTENSION_HOURS,
    },
    packages: availability,
  }
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
  checkExtensionConflictForConfirmedBooking,
  getDailyAvailabilitySummary,
}
