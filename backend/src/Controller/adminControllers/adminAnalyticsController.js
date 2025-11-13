const { pool } = require('../../Config/db')

const MONTH_LABELS = [
  null,
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function parseIntOr(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clampMonth(value) {
  return Math.min(12, Math.max(1, value))
}

function monthLabel(value) {
  return MONTH_LABELS[value] || `Month ${value}`
}

function sanitizeRange(query) {
  const now = new Date()
  const year = parseIntOr(query.year, now.getFullYear())
  let startMonth = clampMonth(parseIntOr(query.startMonth, 1))
  let endMonth = clampMonth(parseIntOr(query.endMonth, 12))
  if (startMonth > endMonth) {
    const swap = startMonth
    startMonth = endMonth
    endMonth = swap
  }
  return { year, startMonth, endMonth }
}

async function getBookingAnalytics(req, res) {
  try {
    const { year, startMonth, endMonth } = sanitizeRange(req.query || {})

    const query = `
      WITH month_params AS (
        SELECT $1::int AS year, $2::int AS start_month, $3::int AS end_month
      ),
      month_list AS (
        SELECT generate_series(mp.start_month, mp.end_month) AS month
        FROM month_params mp
      ),
      booking_data AS (
        SELECT
          EXTRACT(MONTH FROM br.event_date)::int AS month,
          CASE
            WHEN cb.booking_status = 'cancelled' THEN 'cancelled'
            WHEN br.status = 'cancelled' THEN 'cancelled'
            WHEN br.status = 'rejected' THEN 'declined'
            WHEN cb.booking_status IN ('completed', 'in_progress', 'scheduled') THEN 'successful'
            WHEN br.status = 'accepted' THEN 'successful'
            ELSE 'other'
          END AS bucket
        FROM booking_requests br
        LEFT JOIN confirmed_bookings cb ON cb.requestid = br.requestid
        WHERE br.event_date IS NOT NULL
          AND EXTRACT(YEAR FROM br.event_date) = $1
          AND EXTRACT(MONTH FROM br.event_date) BETWEEN $2 AND $3
      )
      SELECT
        ml.month,
        COALESCE(SUM(CASE WHEN bd.bucket = 'successful' THEN 1 ELSE 0 END), 0) AS successful,
        COALESCE(SUM(CASE WHEN bd.bucket = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
        COALESCE(SUM(CASE WHEN bd.bucket = 'declined' THEN 1 ELSE 0 END), 0) AS declined
      FROM month_list ml
      LEFT JOIN booking_data bd ON bd.month = ml.month
      GROUP BY ml.month
      ORDER BY ml.month
    `

    const { rows } = await pool.query(query, [year, startMonth, endMonth])

    const data = rows.map((row) => {
      const monthValue = Number(row.month)
      return {
        year,
        month: monthLabel(monthValue),
        monthValue,
        successful: Number(row.successful || 0),
        cancelled: Number(row.cancelled || 0),
        declined: Number(row.declined || 0),
      }
    })

    return res.json({
      year,
      range: { startMonth, endMonth },
      data,
    })
  } catch (error) {
    console.error('admin analytics bookings error:', error)
    return res.status(500).json({ error: 'Failed to load booking analytics' })
  }
}

async function getRevenueAnalytics(req, res) {
  try {
    const { year, startMonth, endMonth } = sanitizeRange(req.query || {})

    const monthlyQuery = `
      WITH month_params AS (
        SELECT $1::int AS year, $2::int AS start_month, $3::int AS end_month
      ),
      month_list AS (
        SELECT generate_series(mp.start_month, mp.end_month) AS month
        FROM month_params mp
      ),
      payment_data AS (
        SELECT
          EXTRACT(MONTH FROM p.created_at)::int AS month,
          SUM(
            CASE
              WHEN p.verified_at IS NOT NULL AND LOWER(p.payment_status) <> 'failed'
                THEN COALESCE(p.amount_paid, 0)
              ELSE 0
            END
          ) AS revenue
        FROM payments p
        WHERE p.created_at IS NOT NULL
          AND EXTRACT(YEAR FROM p.created_at) = $1
          AND EXTRACT(MONTH FROM p.created_at) BETWEEN $2 AND $3
        GROUP BY EXTRACT(MONTH FROM p.created_at)
      ),
      refund_data AS (
        SELECT
          EXTRACT(MONTH FROM r.created_at)::int AS month,
          SUM(r.amount) AS refunds
        FROM payment_refunds r
        JOIN payments p ON p.payment_id = r.payment_id
        WHERE r.created_at IS NOT NULL
          AND p.verified_at IS NOT NULL
          AND EXTRACT(YEAR FROM r.created_at) = $1
          AND EXTRACT(MONTH FROM r.created_at) BETWEEN $2 AND $3
        GROUP BY EXTRACT(MONTH FROM r.created_at)
      )
      SELECT
        ml.month,
        COALESCE(pd.revenue, 0) AS revenue,
        COALESCE(rd.refunds, 0) AS refunds,
        COALESCE(pd.revenue, 0) - COALESCE(rd.refunds, 0) AS net
      FROM month_list ml
      LEFT JOIN payment_data pd ON pd.month = ml.month
      LEFT JOIN refund_data rd ON rd.month = ml.month
      ORDER BY ml.month
    `

    const [monthlyResult, packageRevenueResult, packageRefundResult] =
      await Promise.all([
        pool.query(monthlyQuery, [year, startMonth, endMonth]),
        pool.query(
          `
            SELECT
              pkg.id AS package_id,
              pkg.package_name,
              SUM(COALESCE(p.amount_paid, 0)) AS revenue
            FROM payments p
            JOIN confirmed_bookings cb ON cb.id = p.booking_id
            JOIN booking_requests br ON br.requestid = cb.requestid
            JOIN packages pkg ON pkg.id = br.packageid
            WHERE p.verified_at IS NOT NULL
              AND LOWER(p.payment_status) <> 'failed'
              AND p.created_at IS NOT NULL
              AND EXTRACT(YEAR FROM p.created_at) = $1
              AND EXTRACT(MONTH FROM p.created_at) BETWEEN $2 AND $3
            GROUP BY pkg.id, pkg.package_name
          `,
          [year, startMonth, endMonth]
        ),
        pool.query(
          `
            SELECT
              pkg.id AS package_id,
              pkg.package_name,
              SUM(COALESCE(r.amount, 0)) AS refunds
            FROM payment_refunds r
            JOIN payments p ON p.payment_id = r.payment_id
            JOIN confirmed_bookings cb ON cb.id = p.booking_id
            JOIN booking_requests br ON br.requestid = cb.requestid
            JOIN packages pkg ON pkg.id = br.packageid
            WHERE p.verified_at IS NOT NULL
              AND r.created_at IS NOT NULL
              AND EXTRACT(YEAR FROM r.created_at) = $1
              AND EXTRACT(MONTH FROM r.created_at) BETWEEN $2 AND $3
            GROUP BY pkg.id, pkg.package_name
          `,
          [year, startMonth, endMonth]
        ),
      ])

    const data = monthlyResult.rows.map((row) => {
      const monthValue = Number(row.month)
      const revenue = Number(row.revenue || 0)
      const refunds = Number(row.refunds || 0)
      const net = Number(row.net || revenue - refunds)
      return {
        year,
        month: monthLabel(monthValue),
        monthValue,
        revenue,
        refunds,
        net,
      }
    })

    const refundsByPackage = new Map()
    for (const row of packageRefundResult.rows) {
      const packageId = Number(row.package_id)
      refundsByPackage.set(packageId, Number(row.refunds || 0))
    }

    const breakdown = packageRevenueResult.rows.map((row) => {
      const packageId = Number(row.package_id)
      const revenue = Number(row.revenue || 0)
      const refunds = refundsByPackage.get(packageId) || 0
      const net = revenue - refunds
      return {
        packageId,
        packageName: row.package_name,
        revenue,
        refunds,
        net,
      }
    })

    for (const row of packageRefundResult.rows) {
      const packageId = Number(row.package_id)
      if (breakdown.some((item) => item.packageId === packageId)) continue
      const refunds = Number(row.refunds || 0)
      breakdown.push({
        packageId,
        packageName: row.package_name,
        revenue: 0,
        refunds,
        net: -refunds,
      })
    }

    breakdown.sort((a, b) => b.net - a.net)

    return res.json({
      year,
      range: { startMonth, endMonth },
      data,
      breakdown,
    })
  } catch (error) {
    console.error('admin analytics revenue error:', error)
    return res.status(500).json({ error: 'Failed to load revenue analytics' })
  }
}

module.exports = {
  getBookingAnalytics,
  getRevenueAnalytics,
}
