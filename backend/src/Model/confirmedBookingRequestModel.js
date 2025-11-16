const { pool } = require('../Config/db')

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

// Create confirmed_bookings table (one per accepted booking_request)
async function initConfirmedBookingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS confirmed_bookings (
      id SERIAL PRIMARY KEY,
      requestid INTEGER NOT NULL UNIQUE REFERENCES booking_requests(requestid) ON DELETE CASCADE,
      userid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contract_signed BOOLEAN DEFAULT FALSE,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','refunded','failed')),
      booking_status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (booking_status IN ('scheduled','in_progress','completed','cancelled')),
      total_booking_price NUMERIC(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Ensure optional columns for forward-compat (some designs store these on request only)
  await pool
    .query(
      'ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS event_end_time TIME'
    )
    .catch(() => {})
  await pool
    .query(
      'ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS extension_duration INTEGER'
    )
    .catch(() => {})
  await pool
    .query('ALTER TABLE confirmed_bookings DROP COLUMN IF EXISTS grid')
    .catch(() => {})

  // Ensure CHECK constraint allows 'failed' as a payment_status for existing DBs
  try {
    const q = `
      SELECT c.conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'confirmed_bookings' AND c.contype = 'c'
    `
    const { rows } = await pool.query(q)
    const target = rows.find(
      (r) =>
        typeof r.def === 'string' &&
        r.def.toLowerCase().includes('payment_status')
    )
    if (target && !target.def.includes("'failed'")) {
      const name = target.conname
      await pool.query(
        `ALTER TABLE confirmed_bookings DROP CONSTRAINT "${name}"`
      )
      await pool.query(
        `ALTER TABLE confirmed_bookings ADD CONSTRAINT "${name}" CHECK (payment_status IN ('unpaid','partial','paid','refunded','failed'))`
      )
    }
  } catch (e) {
    console.warn(
      'confirmed_bookings: ensure payment_status check includes failed - skipped:',
      e?.message
    )
  }
}

/**
 * Create a confirmed booking from an accepted request.
 * - Validates booking_requests.status = 'accepted'
 * - Defaults total_booking_price to the package price if not provided
 */
async function createConfirmedBooking(requestid, options = {}) {
  const {
    totalBookingPrice = null,
    contractSigned = false,
    paymentStatus = 'unpaid', // 'unpaid' | 'partial' | 'paid' | 'refunded'
    bookingStatus = 'scheduled', // 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  } = options

  // Fetch request + package price
  const rq = await pool.query(
    `
  SELECT br.requestid, br.userid, br.status, br.event_end_time, br.extension_duration, br.grid, p.price
    FROM booking_requests br
    JOIN packages p ON p.id = br.packageid
    WHERE br.requestid = $1
    `,
    [requestid]
  )
  const reqRow = rq.rows[0]
  if (!reqRow) throw new Error('Booking request not found')
  if (reqRow.status !== 'accepted') {
    throw new Error('Booking request must be accepted before confirming')
  }

  // Ensure not already confirmed
  const existing = await pool.query(
    `SELECT id FROM confirmed_bookings WHERE requestid = $1`,
    [requestid]
  )
  if (existing.rows[0]) throw new Error('Request already confirmed')

  const total = totalBookingPrice ?? Number(reqRow.price ?? 0)

  const ins = await pool.query(
    `
    INSERT INTO confirmed_bookings
      (requestid, userid, contract_signed, payment_status, booking_status, total_booking_price, event_end_time, extension_duration)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      requestid,
      reqRow.userid,
      contractSigned,
      paymentStatus,
      bookingStatus,
      total,
      reqRow.event_end_time || null,
      reqRow.extension_duration || null,
    ]
  )
  return ins.rows[0]
}

// Get a confirmed booking with request + package + user details
async function getConfirmedBookingById(bookingid) {
  const { rows } = await pool.query(
    `
    SELECT 
      cb.*,
      TO_CHAR(br.event_date, 'YYYY-MM-DD') AS event_date,
      TO_CHAR(br.event_time, 'HH24:MI') AS event_time,
      COALESCE(cb.event_end_time, br.event_end_time) AS event_end_time,
      COALESCE(cb.extension_duration, br.extension_duration) AS extension_duration,
      br.grid,
      br.event_address,
      br.contact_person,
      br.contact_person_number,
      br.contact_info,
      br.event_name,
      br.strongest_signal,
      br.booth_placement,
  p.package_name,
  p.id AS package_id,
      p.price AS package_price,
      u.username,
      u.firstname,
      u.lastname
    FROM confirmed_bookings cb
    JOIN booking_requests br ON br.requestid = cb.requestid
    JOIN packages p ON p.id = br.packageid
    JOIN users u ON u.id = cb.userid
    WHERE cb.id = $1
    `,
    [bookingid]
  )
  return rows[0] || null
}

async function getConfirmedBookingByRequestId(requestid) {
  const { rows } = await pool.query(
    `SELECT * FROM confirmed_bookings WHERE requestid = $1`,
    [requestid]
  )
  return rows[0] || null
}

async function listConfirmedBookings() {
  const { rows } = await pool.query(
    `
    SELECT 
      cb.*,
      TO_CHAR(br.event_date, 'YYYY-MM-DD') AS event_date,
      TO_CHAR(br.event_time, 'HH24:MI') AS event_time,
      COALESCE(cb.event_end_time, br.event_end_time) AS event_end_time,
      COALESCE(cb.extension_duration, br.extension_duration) AS extension_duration,
      br.grid,
      br.event_address,
      br.contact_person,
      br.contact_person_number,
      br.contact_info,
      br.event_name,
      br.strongest_signal,
      br.booth_placement,
  p.package_name,
  p.id AS package_id,
      p.price AS package_price,
      u.username,
      u.firstname,
      u.lastname
    FROM confirmed_bookings cb
    JOIN booking_requests br ON br.requestid = cb.requestid
    JOIN packages p ON p.id = br.packageid
    JOIN users u ON u.id = cb.userid
    ORDER BY cb.created_at DESC
    `
  )
  return rows
}

// Public-facing aggregate: count non-cancelled confirmed bookings per event date
async function getDailyConfirmedCounts() {
  const q = `
    SELECT 
      TO_CHAR(br.event_date, 'YYYY-MM-DD') AS event_date,
      COUNT(*)::int AS count
    FROM confirmed_bookings cb
    JOIN booking_requests br ON br.requestid = cb.requestid
    WHERE br.event_date IS NOT NULL
      AND COALESCE(cb.booking_status, 'scheduled') <> 'cancelled'
    GROUP BY br.event_date
  `
  const { rows } = await pool.query(q)
  return rows
}

// Mutations
async function setContractSigned(bookingid, signed = true) {
  const { rows } = await pool.query(
    `
    UPDATE confirmed_bookings
    SET contract_signed = $1, last_updated = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
    `,
    [signed, bookingid]
  )
  return rows[0]
}

async function updatePaymentStatus(bookingid, status) {
  const allowed = new Set(['unpaid', 'partial', 'paid', 'refunded', 'failed'])
  if (!allowed.has(status)) throw new Error('Invalid payment status')
  const { rows } = await pool.query(
    `
    UPDATE confirmed_bookings
    SET payment_status = $1, last_updated = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
    `,
    [status, bookingid]
  )
  return rows[0]
}

async function updateBookingStatus(bookingid, status) {
  const allowed = new Set([
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
  ])
  if (!allowed.has(status)) throw new Error('Invalid booking status')
  const { rows } = await pool.query(
    `
    UPDATE confirmed_bookings
    SET booking_status = $1, last_updated = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
    `,
    [status, bookingid]
  )
  return rows[0]
}

async function reactivateConfirmedBookingByRequestId(
  requestid,
  {
    bookingStatus = 'scheduled',
    eventEndTime = null,
    extensionDuration = null,
  } = {}
) {
  const allowed = new Set([
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
  ])
  if (!allowed.has(bookingStatus)) {
    throw new Error('Invalid booking status')
  }
  const { rows } = await pool.query(
    `
    UPDATE confirmed_bookings
    SET booking_status = $2,
        event_end_time = $3,
        extension_duration = $4,
        last_updated = CURRENT_TIMESTAMP
    WHERE requestid = $1
    RETURNING *
    `,
    [requestid, bookingStatus, eventEndTime, extensionDuration]
  )
  return rows[0] || null
}

async function updateTotalPrice(bookingid, total) {
  const { rows } = await pool.query(
    `
    UPDATE confirmed_bookings
    SET total_booking_price = $1, last_updated = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
    `,
    [total, bookingid]
  )
  return rows[0]
}

// Compute payment summary and status based on total price + extensions and VERIFIED successful payments
async function getPaymentSummary(bookingid) {
  const id = Number(bookingid)
  if (!Number.isFinite(id)) throw new Error('Invalid booking id')

  // Fetch base total and extension hours (prefer value stored on confirmed, fallback to request)
  const q = `
      SELECT 
        cb.id,
        COALESCE(cb.total_booking_price, 0)::numeric AS base_total,
        COALESCE(cb.extension_duration, br.extension_duration, 0)::int AS ext_hours
      FROM confirmed_bookings cb
      JOIN booking_requests br ON br.requestid = cb.requestid
      WHERE cb.id = $1
    `
  const { rows } = await pool.query(q, [id])
  const row = rows[0]
  if (!row) throw new Error('Booking not found')

  const EXT_RATE = 2000
  const baseTotal = Number(row.base_total || 0)
  const extHours = Math.max(0, Number(row.ext_hours || 0))
  const extCharge = extHours * EXT_RATE
  const amountDue = Math.max(0, baseTotal + extCharge)

  // Sum only VERIFIED successful payments
  const payQ = `
      SELECT COALESCE(SUM(amount_paid), 0)::numeric AS paid_total
      FROM payments
      WHERE booking_id = $1
        AND verified_at IS NOT NULL
        AND (
          LOWER(payment_status) IN ('completed','paid','succeeded')
          OR payment_status IN ('Partially Paid','Fully Paid')
        )
    `
  let paidTotal = 0
  try {
    const r = await pool.query(payQ, [id])
    paidTotal = Number(r.rows?.[0]?.paid_total || 0)
  } catch {
    paidTotal = 0
  }

  // Subtract refunds for payments that are counted above
  const refundQ = `
      SELECT COALESCE(SUM(r.amount),0)::numeric AS refunded
      FROM payment_refunds r
      JOIN payments p ON p.payment_id = r.payment_id
      WHERE p.booking_id = $1
        AND p.verified_at IS NOT NULL
        AND (
          LOWER(p.payment_status) IN ('completed','paid','succeeded')
          OR p.payment_status IN ('Partially Paid','Fully Paid')
        )
    `
  let refundedTotal = 0
  try {
    const rr = await pool.query(refundQ, [id])
    refundedTotal = Number(rr.rows?.[0]?.refunded || 0)
  } catch {
    refundedTotal = 0
  }

  const netPaid = Math.max(0, paidTotal - refundedTotal)

  let computedStatus = 'unpaid'
  if (netPaid >= amountDue && amountDue > 0) computedStatus = 'paid'
  else if (netPaid > 0 && netPaid < amountDue) computedStatus = 'partial'

  return {
    baseTotal,
    extHours,
    extCharge,
    amountDue,
    paidTotal: netPaid,
    computedStatus,
  }
}

// Recalculate and persist payment_status on confirmed_bookings
async function recalcAndPersistPaymentStatus(bookingid) {
  const sum = await getPaymentSummary(bookingid)
  await pool.query(
    `UPDATE confirmed_bookings SET payment_status = $2, last_updated = CURRENT_TIMESTAMP WHERE id = $1`,
    [bookingid, sum.computedStatus]
  )
  return sum
}

function parseDbTimeToMinutes(value) {
  if (!value && value !== 0) return null
  const str = String(value)
  const parts = str.split(':')
  if (parts.length < 2) return null
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * MINUTES_PER_HOUR + minutes
}

function minutesToDbTime(value) {
  if (!Number.isFinite(value)) return null
  const normalized =
    ((Math.round(value) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hours = Math.floor(normalized / MINUTES_PER_HOUR)
  const minutes = normalized % MINUTES_PER_HOUR
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0'
  )}:00`
}

function derivePackageDurationMinutes(rawDurationHours) {
  const hours = Number(rawDurationHours)
  if (Number.isFinite(hours) && hours > 0) {
    return Math.max(30, Math.round(hours * MINUTES_PER_HOUR))
  }
  return 2 * MINUTES_PER_HOUR
}

function computeExtendedEndTime(
  { event_time, event_end_time, extension_duration, duration_hours },
  nextExtensionHours
) {
  const startMinutes = parseDbTimeToMinutes(event_time)
  if (startMinutes == null) return null

  const currentRequestEnd = parseDbTimeToMinutes(event_end_time)
  const prevExtensionMinutes =
    Math.max(0, Number(extension_duration) || 0) * MINUTES_PER_HOUR
  let baseDurationMinutes = derivePackageDurationMinutes(duration_hours)

  if (currentRequestEnd != null) {
    let diff = currentRequestEnd - startMinutes
    if (diff <= 0) diff += MINUTES_PER_DAY
    const candidate = diff - prevExtensionMinutes
    if (candidate > 0) {
      baseDurationMinutes = candidate
    }
  }

  const nextExtensionMinutes =
    Math.max(0, Number(nextExtensionHours) || 0) * MINUTES_PER_HOUR
  const totalMinutes = startMinutes + baseDurationMinutes + nextExtensionMinutes
  return minutesToDbTime(totalMinutes)
}

// Update extension_duration on confirmed_bookings and recalc payment_status
async function updateExtensionDuration(bookingid, hours) {
  const ext = Math.max(0, Math.round(Number(hours) || 0))
  const { rows } = await pool.query(
    `UPDATE confirmed_bookings
     SET extension_duration = $2, last_updated = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING requestid`,
    [bookingid, ext]
  )
  const requestid = rows?.[0]?.requestid
  let computedEndTime = null

  if (requestid) {
    const metaResult = await pool.query(
      `SELECT br.event_time, br.event_end_time, br.extension_duration, p.duration_hours
       FROM booking_requests br
       JOIN packages p ON p.id = br.packageid
       WHERE br.requestid = $1`,
      [requestid]
    )
    const meta = metaResult.rows?.[0]
    if (meta) {
      computedEndTime = computeExtendedEndTime(meta, ext)
    }

    if (computedEndTime) {
      await pool.query(
        `UPDATE booking_requests
         SET extension_duration = $2, event_end_time = $3, last_updated = CURRENT_TIMESTAMP
         WHERE requestid = $1`,
        [requestid, ext, computedEndTime]
      )
    } else {
      await pool.query(
        `UPDATE booking_requests
         SET extension_duration = $2, last_updated = CURRENT_TIMESTAMP
         WHERE requestid = $1`,
        [requestid, ext]
      )
    }
  }

  if (computedEndTime) {
    await pool.query(
      `UPDATE confirmed_bookings
       SET event_end_time = $2, last_updated = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [bookingid, computedEndTime]
    )
  }

  return recalcAndPersistPaymentStatus(bookingid)
}

module.exports = {
  initConfirmedBookingTable,
  createConfirmedBooking,
  getConfirmedBookingById,
  getConfirmedBookingByRequestId,
  listConfirmedBookings,
  setContractSigned,
  updatePaymentStatus,
  updateBookingStatus,
  updateTotalPrice,
  getPaymentSummary,
  recalcAndPersistPaymentStatus,
  updateExtensionDuration,
  reactivateConfirmedBookingByRequestId,
  getDailyConfirmedCounts,
}
