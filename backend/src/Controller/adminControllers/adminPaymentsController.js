const {
  listPayments: modelListPayments,
  findPaymentById,
  updatePayment,
  createPayment,
} = require('../../Model/paymentModel')
const {
  createPaymentLog,
  listPaymentLogsByPayment,
  listAllPaymentLogs,
  updatePaymentLog,
} = require('../../Model/paymentLogsModel')
const {
  getConfirmedBookingById,
  updatePaymentStatus: updateBookingPaymentStatus,
  recalcAndPersistPaymentStatus,
  listConfirmedBookings,
  getPaymentSummary,
} = require('../../Model/confirmedBookingRequestModel')
const {
  createRefund,
  getTotalRefundedForPayment,
  getRefundTotalsForPayments,
} = require('../../Model/paymentRefundModel')

// List payments with optional filters: status, user_id, booking_id
async function listPaymentsHandler(req, res) {
  try {
    const { status, user_id, booking_id } = req.query
    const rows = await modelListPayments({
      user_id: user_id ? Number(user_id) : null,
      booking_id: booking_id ? Number(booking_id) : null,
    })
    const filtered = status
      ? rows.filter((r) => r.payment_status === status)
      : rows
    res.json({ payments: filtered })
  } catch (err) {
    console.error('admin listPayments error:', err)
    res.status(500).json({ error: 'Failed to load payments' })
  }
}

async function getPaymentHandler(req, res) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid payment id' })
    }
    const row = await findPaymentById(id)
    if (!row) return res.status(404).json({ error: 'Payment not found' })
    res.json({ payment: row })
  } catch (err) {
    console.error('admin getPayment error:', err)
    res.status(500).json({ error: 'Failed to load payment' })
  }
}

// Update payment; log changes; propagate to booking payment_status
async function updatePaymentHandler(req, res) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid payment id' })
    }
    const prev = await findPaymentById(id)
    if (!prev) return res.status(404).json({ error: 'Payment not found' })

    const {
      payment_status,
      notes,
      verified_at,
      proof_image_url,
      reference_no,
      amount_paid,
      payment_method,
    } = req.body || {}

    // Normalize incoming status to match payments table constraint
    const normalizeStatus = (s) => {
      const v = String(s || '').toLowerCase()
      if (['completed', 'paid', 'succeeded', 'success'].includes(v))
        return 'Fully Paid'
      if (['partial', 'partially paid', 'partially_paid'].includes(v))
        return 'Partially Paid'
      if (v === 'refunded') return 'Refunded'
      if (['failed', 'failure'].includes(v)) return 'Failed'
      if (v === 'pending') return 'Pending'
      return s
    }

    const updates = {}
    if (payment_status != null)
      updates.payment_status = normalizeStatus(payment_status)
    if (typeof notes !== 'undefined') updates.notes = notes
    if (typeof verified_at !== 'undefined') updates.verified_at = verified_at
    if (typeof proof_image_url !== 'undefined')
      updates.proof_image_url = proof_image_url
    if (typeof reference_no !== 'undefined') updates.reference_no = reference_no
    if (typeof amount_paid !== 'undefined') updates.amount_paid = amount_paid
    if (typeof payment_method !== 'undefined')
      updates.payment_method = payment_method

    const next = await updatePayment(id, updates)

    // Log status change
    if (payment_status && payment_status !== prev.payment_status) {
      try {
        await createPaymentLog({
          payment_id: id,
          previous_status: String(prev.payment_status || ''),
          new_status: String(payment_status),
          performed_by: 'admin',
          user_id: req.user.id,
          action: 'status-update',
        })
      } catch (e) {
        console.error('payment status log failed:', e)
      }
    }

    // Log note update (only when provided)
    if (typeof notes !== 'undefined') {
      try {
        await createPaymentLog({
          payment_id: id,
          previous_status: String(next.payment_status || ''),
          new_status: String(next.payment_status || ''),
          performed_by: 'admin',
          user_id: req.user.id,
          additional_notes: notes || null,
          action: 'note-update',
        })
      } catch (e) {
        console.error('payment note log failed:', e)
      }
    }

    // Propagate to booking payment_status
    try {
      await recalcBookingPaymentStatus(next.booking_id)
    } catch (e) {
      console.warn('recalc booking payment status (update) failed:', e?.message)
    }

    res.json({ payment: next })
  } catch (err) {
    console.error('admin updatePayment error:', err)
    res.status(500).json({ error: 'Failed to update payment' })
  }
}

// List logs (optionally by payment_id)
async function listPaymentLogsHandler(req, res) {
  try {
    const { payment_id } = req.query
    if (payment_id) {
      const rows = await listPaymentLogsByPayment(Number(payment_id))
      return res.json({ logs: rows })
    }
    const rows = await listAllPaymentLogs()
    res.json({ logs: rows })
  } catch (err) {
    console.error('admin listPaymentLogs error:', err)
    res.status(500).json({ error: 'Failed to load payment logs' })
  }
}

// Update a specific payment log (e.g., additional_notes)
async function updatePaymentLogHandler(req, res) {
  try {
    const logId = Number(req.params.log_id)
    if (!logId) return res.status(400).json({ error: 'Invalid log id' })
    const { additional_notes } = req.body || {}
    const updated = await updatePaymentLog(logId, { additional_notes })
    if (!updated)
      return res.status(404).json({ error: 'Log not found or no changes' })
    res.json({ log: updated })
  } catch (err) {
    console.error('admin updatePaymentLog error:', err)
    res.status(500).json({ error: 'Failed to update payment log' })
  }
}

// Generate a simple sales report PDF. Supports date range filters via query:
//   range=today|week|month|quarter|year  OR custom start=YYYY-MM-DD&end=YYYY-MM-DD
// The filter applies to payments.created_at
async function generateSalesReportHandler(req, res) {
  try {
    // Lazy require to avoid crashing server if pdfkit is not installed
    let PDFDocument
    try {
      PDFDocument = require('pdfkit')
    } catch (e) {
      return res.status(501).json({
        error:
          'PDF generation requires pdfkit. Please install it in backend: npm install pdfkit',
      })
    }

    const rows = await modelListPayments({})

    // Optional date filtering on created_at
    const { range, start, end } = req.query || {}
    let startDate = null
    let endDate = null
    const now = new Date()
    const atMidnight = (d) => {
      const x = new Date(d)
      x.setHours(0, 0, 0, 0)
      return x
    }
    const endOfDay = (d) => {
      const x = new Date(d)
      x.setHours(23, 59, 59, 999)
      return x
    }
    const toDate = (s) => (s ? new Date(String(s)) : null)

    const r = typeof range === 'string' ? range.toLowerCase() : ''
    if (r === 'today') {
      startDate = atMidnight(now)
      endDate = endOfDay(now)
    } else if (r === 'week' || r === 'weekly') {
      const day = now.getDay() // 0=Sun
      const diffToMon = (day + 6) % 7 // days since Monday
      const monday = new Date(now)
      monday.setDate(now.getDate() - diffToMon)
      startDate = atMidnight(monday)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      endDate = endOfDay(sunday)
    } else if (r === 'month' || r === 'monthly') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      startDate = atMidnight(first)
      endDate = endOfDay(last)
    } else if (r === 'quarter' || r === 'quarterly') {
      const q = Math.floor(now.getMonth() / 3) // 0..3
      const first = new Date(now.getFullYear(), q * 3, 1)
      const last = new Date(now.getFullYear(), q * 3 + 3, 0)
      startDate = atMidnight(first)
      endDate = endOfDay(last)
    } else if (r === 'year' || r === 'yearly') {
      const first = new Date(now.getFullYear(), 0, 1)
      const last = new Date(now.getFullYear(), 11, 31)
      startDate = atMidnight(first)
      endDate = endOfDay(last)
    } else if (start || end) {
      const sD = toDate(start)
      const eD = toDate(end)
      if (sD) startDate = atMidnight(sD)
      if (eD) endDate = endOfDay(eD)
    }

    const filteredRows = rows.filter((p) => {
      if (!startDate && !endDate) return true
      const created = new Date(p.created_at)
      if (startDate && created < startDate) return false
      if (endDate && created > endDate) return false
      return true
    })

    // Only include verified payments in the report
    const reportRows = filteredRows.filter((p) => Boolean(p.verified_at))
    const refundTotalsMap = await getRefundTotalsForPayments(
      reportRows
        .map((p) => Number(p.payment_id))
        .filter((id) => Number.isFinite(id))
    )
    const reportRowsWithRefunds = reportRows.map((p) => {
      const pid = Number(p.payment_id)
      let refunded = 0
      if (
        refundTotalsMap &&
        Object.prototype.hasOwnProperty.call(refundTotalsMap, pid)
      ) {
        refunded = Number(refundTotalsMap[pid])
      }
      if (!Number.isFinite(refunded)) refunded = 0
      return { ...p, refunded_amount: refunded }
    })

    // Fetch confirmed bookings to compute total due for the selected period
    const confirmedBookings = await listConfirmedBookings()
    const parseDateOnly = (value) => {
      if (!value) return null
      if (value instanceof Date) return value
      if (typeof value === 'string') {
        const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (isoMatch) {
          const [, y, m, d] = isoMatch
          return new Date(Number(y), Number(m) - 1, Number(d))
        }
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) return parsed
      }
      return null
    }
    const bookingsInRange = confirmedBookings.filter((booking) => {
      if (!startDate && !endDate) return true
      const eventDateRaw =
        booking.event_date ||
        booking.eventDate ||
        booking.eventdate ||
        booking.event_date_time ||
        booking.eventDateTime
      const eventDate = parseDateOnly(eventDateRaw)
      if (!eventDate) return false
      if (startDate && eventDate < startDate) return false
      if (endDate && eventDate > endDate) return false
      return true
    })

    const dueResults = await Promise.allSettled(
      bookingsInRange.map(async (booking) => {
        const bookingId = Number(booking.id)
        if (!Number.isFinite(bookingId)) return 0
        try {
          const summary = await getPaymentSummary(bookingId)
          const amt = Number(summary?.amountDue)
          if (Number.isFinite(amt)) return amt
        } catch (err) {
          // ignore and fall back to derived amount
        }
        const base = Number(
          booking.total_booking_price ?? booking.package_price ?? 0
        )
        const extHours = Number(booking.extension_duration ?? 0)
        const hourlyRate = 2000
        const fallback =
          (Number.isFinite(base) ? base : 0) +
          (Number.isFinite(extHours) ? extHours : 0) * hourlyRate
        return fallback
      })
    )
    const bookingsTotalDue = dueResults.reduce((sum, result) => {
      if (result.status === 'fulfilled') {
        const val = Number(result.value)
        if (Number.isFinite(val)) return sum + val
      }
      return sum
    }, 0)

    const fs = require('fs')
    const path = require('path')
    const doc = new PDFDocument({ size: 'A4', margin: 36 })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="sales-report.pdf"')

    doc.pipe(res)

    const formatDate = (value) => {
      const d = value ? new Date(value) : null
      if (!d || Number.isNaN(d.getTime())) return ''
      try {
        return new Intl.DateTimeFormat('en-PH', {
          dateStyle: 'medium',
        }).format(d)
      } catch {
        return d.toISOString().slice(0, 10)
      }
    }

    const formatDateTime = (value) => {
      const d = value ? new Date(value) : null
      if (!d || Number.isNaN(d.getTime())) return ''
      try {
        return new Intl.DateTimeFormat('en-PH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(d)
      } catch {
        return d.toISOString().replace('T', ' ').slice(0, 16)
      }
    }

    // Attempt to use a font that supports the Peso sign. If not found, fall back to built-in Helvetica and "PHP" prefix.
    let usePesoSymbol = false
    let bodyFont = 'Helvetica'
    let bodyBold = 'Helvetica-Bold'
    try {
      const fontsDir = path.resolve(__dirname, '..', '..', 'Assets', 'Fonts')
      const candidates = [
        'NotoSans-Regular.ttf',
        'DejaVuSans.ttf',
        'Inter-Regular.ttf',
        'ArialUnicodeMS.ttf',
      ]
      for (const f of candidates) {
        const p = path.join(fontsDir, f)
        if (fs.existsSync(p)) {
          doc.registerFont('ReportSans', p)
          bodyFont = 'ReportSans'
          // Try bold if available next to it
          const bolds = [
            f.replace('Regular', 'Bold'),
            f.replace('.ttf', '-Bold.ttf'),
          ]
          for (const b of bolds) {
            const bp = path.join(fontsDir, b)
            if (fs.existsSync(bp)) {
              doc.registerFont('ReportSans-Bold', bp)
              bodyBold = 'ReportSans-Bold'
              break
            }
          }
          usePesoSymbol = true // chosen fonts above support U+20B1
          break
        }
      }
    } catch {}

    // Title
    doc.fontSize(16).font(bodyBold).text('Sales Report', {
      align: 'center',
    })
    doc.moveDown(0.5)
    doc
      .fontSize(10)
      .font(bodyFont)
      .text(`Generated at: ${formatDate(new Date())}`)
    doc.moveDown(0.5)

    // Helpers
    const fmtMoney = (n) =>
      `${Number(n || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    const getName = (r) => {
      const f = (r.user_firstname || '').toString().trim()
      const l = (r.user_lastname || '').toString().trim()
      if (f || l) return `${f} ${l}`.trim()
      const email = (r.user_username || '').toString()
      return email ? email.split('@')[0] : String(r.user_id)
    }

    const startX = doc.page.margins.left
    const usableWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right
    // Columns per spec: Event Name, User Name, Due Amount, Paid, Refunded, Created
    // Adjust widths to keep amounts on one line and fit within page margins.
    const MIN_COL_WIDTH = 70
    const baseColumns = [
      { key: 'event', label: 'Event Name', baseWidth: 140 },
      { key: 'user', label: 'User Name', baseWidth: 110 },
      { key: 'amount', label: 'Due Amount', baseWidth: 110 },
      { key: 'paid', label: 'Paid', baseWidth: 110 },
      { key: 'refunded', label: 'Refunded', baseWidth: 110 },
      { key: 'created', label: 'Date', baseWidth: 120 },
    ]
    const baseTotal = baseColumns.reduce((sum, c) => sum + c.baseWidth, 0)
    const scale = baseTotal > usableWidth ? usableWidth / baseTotal : 1
    const columns = baseColumns.map((c) => {
      const scaled = Math.floor(c.baseWidth * scale)
      return {
        key: c.key,
        label: c.label,
        align: 'left',
        width: Math.max(MIN_COL_WIDTH, scaled),
      }
    })
    let totalWidth = columns.reduce((sum, c) => sum + c.width, 0)
    let overflow = totalWidth - usableWidth
    if (overflow > 0) {
      for (let i = columns.length - 1; i >= 0 && overflow > 0; i -= 1) {
        const col = columns[i]
        const spare = col.width - MIN_COL_WIDTH
        if (spare <= 0) continue
        const reduceBy = Math.min(spare, overflow)
        col.width -= reduceBy
        overflow -= reduceBy
      }
      totalWidth = columns.reduce((sum, c) => sum + c.width, 0)
    }

    let y = doc.y + 4
    const rowH = 16
    const drawHeader = () => {
      doc.font(bodyBold).fontSize(10)
      let x = startX
      columns.forEach((c) => {
        doc.text(c.label, x, y, {
          width: c.width,
          align: 'left',
          lineBreak: false,
        })
        x += c.width
      })
      y += rowH
      doc
        .moveTo(startX, y - 4)
        .lineTo(startX + totalWidth, y - 4)
        .lineWidth(0.5)
        .strokeColor('#cccccc')
        .stroke()
      doc.font(bodyFont)
    }

    const maybeNewPage = () => {
      if (y > doc.page.height - doc.page.margins.bottom - rowH) {
        doc.addPage()
        y = doc.page.margins.top
        drawHeader()
      }
    }

    drawHeader()

    reportRowsWithRefunds.forEach((p, idx) => {
      // Body rows slightly smaller to avoid wrapping in amount columns
      doc.font(bodyFont).fontSize(9)
      maybeNewPage()
      // Use non-breaking space after PHP to keep the amount on the same line
      const currencyPrefix = usePesoSymbol ? '₱' : 'PHP\u00A0'
      const vals = [
        String(p.booking_event_name || ''),
        getName(p),
        `${currencyPrefix}${fmtMoney(p.booking_amount_due ?? p.amount)}`,
        `${currencyPrefix}${fmtMoney(p.amount_paid)}`,
        `${currencyPrefix}${fmtMoney(p.refunded_amount || 0)}`,
        formatDate(p.created_at),
      ]
      let x = startX
      // Optional zebra striping
      if (idx % 2 === 1) {
        doc
          .rect(startX, y - 2, totalWidth, rowH)
          .fillOpacity(0.04)
          .fill('#000000')
          .fillOpacity(1)
      }
      columns.forEach((c, i) => {
        doc.text(vals[i], x, y, {
          width: c.width,
          align: c.align,
          lineBreak: false,
        })
        x += c.width
      })
      y += rowH
    })

    // Summary
    const totalPaidGross = reportRowsWithRefunds.reduce(
      (sum, r) => sum + Number(r.amount_paid || 0),
      0
    )
    const totalRefunded = reportRowsWithRefunds.reduce(
      (sum, r) => sum + Number(r.refunded_amount || 0),
      0
    )
    const totalPaid = Math.max(0, totalPaidGross - totalRefunded)
    const totalDue = bookingsTotalDue
    // Period label
    const periodLabel = (() => {
      if (!startDate && !endDate) return 'All Time'
      if (startDate && endDate)
        return `${formatDate(startDate)} - ${formatDate(endDate)}`
      if (startDate) return `From ${formatDate(startDate)}`
      return `Until ${formatDate(endDate)}`
    })()
    y += 6
    maybeNewPage()
    doc
      .moveTo(startX, y - 2)
      .lineTo(startX + totalWidth, y - 2)
      .lineWidth(0.5)
      .strokeColor('#cccccc')
      .stroke()
    doc
      .font(bodyFont)
      .fontSize(9)
      .text(`Period: ${periodLabel}`, startX, y + 6)
    doc
      .font(bodyBold)
      .fontSize(10)
      .text(
        `Total Paid (Verified): ${usePesoSymbol ? '₱' : 'PHP'} ${fmtMoney(
          totalPaid
        )}`,
        startX,
        y + 6,
        { width: totalWidth, align: 'right' }
      )

    doc.moveDown(0.2)
    doc
      .font(bodyFont)
      .fontSize(9)
      .text(
        `Total Refunded: ${usePesoSymbol ? '₱' : 'PHP'} ${fmtMoney(
          totalRefunded
        )}`,
        startX,
        doc.y,
        { width: totalWidth, align: 'right' }
      )

    doc.moveDown(0.4)
    doc
      .font(bodyFont)
      .fontSize(9)
      .text(
        `Bookings Total Due: ${usePesoSymbol ? '₱' : 'PHP'} ${fmtMoney(
          totalDue
        )}`,
        startX,
        doc.y,
        { width: totalWidth, align: 'right' }
      )

    doc.end()
  } catch (err) {
    console.error('admin generateSalesReport error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
}

// Helper: determine booking payment_status from all payments
async function recalcBookingPaymentStatus(bookingId) {
  // Use centralized summary that includes extension charges
  await recalcAndPersistPaymentStatus(Number(bookingId))
}

// Admin creates a payment entry (e.g., cash during event)
async function createPaymentHandler(req, res) {
  try {
    const {
      booking_id,
      amount_paid,
      payment_method = 'cash',
      reference_no = null,
      notes = null,
      payment_status = null,
      verified = true,
      proof_image_url = null,
    } = req.body || {}

    const bId = Number(booking_id)
    const paid = Number(amount_paid)
    if (!Number.isInteger(bId) || bId <= 0) {
      return res.status(400).json({ error: 'booking_id is required' })
    }
    if (!Number.isFinite(paid) || paid <= 0) {
      return res.status(400).json({ error: 'amount_paid must be > 0' })
    }

    const booking = await getConfirmedBookingById(bId)
    if (!booking) return res.status(404).json({ error: 'Booking not found' })

    const userId = Number(booking.userid)
    // Use computed amount due (base + extension)
    let amount = Number(booking.total_booking_price || 0)
    try {
      const sum = await getPaymentSummary(bId)
      amount = Number(sum.amountDue || amount)
    } catch {}

    // Prevent overpayment: compute remaining balance before creating
    let remaining = null
    try {
      const sum = await getPaymentSummary(bId)
      remaining = Math.max(
        0,
        Number(sum.amountDue || 0) - Number(sum.paidTotal || 0)
      )
    } catch {}
    if (remaining != null && paid > remaining) {
      return res.status(400).json({
        error: `Payment exceeds remaining balance (${remaining.toFixed(2)})`,
      })
    }

    // Decide row-level payment status to comply with payments table
    let rowStatus = 'Partially Paid'
    if (remaining != null) {
      rowStatus = paid >= remaining ? 'Fully Paid' : 'Partially Paid'
    }
    // If caller explicitly provided a table-compliant status, honor it
    if (
      typeof payment_status === 'string' &&
      [
        'Pending',
        'Partially Paid',
        'Failed',
        'Refunded',
        'Fully Paid',
      ].includes(payment_status)
    ) {
      rowStatus = payment_status
    }

    const row = await createPayment({
      booking_id: bId,
      user_id: userId,
      amount,
      amount_paid: paid,
      payment_method: String(payment_method || 'cash'),
      proof_image_url: proof_image_url ? String(proof_image_url) : null,
      reference_no: reference_no ? String(reference_no) : null,
      payment_status: String(rowStatus),
      notes: notes == null ? null : String(notes),
      verified_at: verified ? new Date() : null,
    })

    try {
      await createPaymentLog({
        payment_id: row.payment_id,
        previous_status: 'n/a',
        new_status: row.payment_status,
        performed_by: 'admin',
        user_id: req.user?.id,
        additional_notes: row.notes || null,
        action: 'admin-create',
      })
    } catch (e) {
      console.error('admin create payment log failed:', e)
    }

    try {
      await recalcBookingPaymentStatus(row.booking_id)
    } catch (e) {
      console.warn('recalc booking payment status (create) failed:', e?.message)
    }

    res.status(201).json({ payment: row })
  } catch (err) {
    console.error('admin createPayment error:', err)
    res.status(500).json({ error: 'Failed to create payment' })
  }
}

module.exports = {
  listPayments: listPaymentsHandler,
  getPayment: getPaymentHandler,
  updatePayment: updatePaymentHandler,
  listPaymentLogs: listPaymentLogsHandler,
  updatePaymentLog: updatePaymentLogHandler,
  generateSalesReport: generateSalesReportHandler,
  createPayment: createPaymentHandler,
  // Added dynamically below
}

// --- New: Admin booking balance endpoint ---
async function getBookingBalanceHandler(req, res) {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid booking id' })
    }
    const sum = await getPaymentSummary(id)
    const balance = Math.max(
      0,
      Number(sum.amountDue || 0) - Number(sum.paidTotal || 0)
    )
    return res.json({
      booking_id: id,
      amount_due: Number(sum.amountDue || 0),
      total_paid: Number(sum.paidTotal || 0),
      balance,
      computed_booking_payment_status: sum.computedStatus,
    })
  } catch (e) {
    console.error('admin getBookingBalance error:', e)
    res.status(500).json({ error: 'Failed to compute balance' })
  }
}

module.exports.getBookingBalance = getBookingBalanceHandler

// --- New: Admin create refund for a payment ---
async function createRefundHandler(req, res) {
  try {
    const paymentId = Number(req.params.id)
    const { amount, reason = null } = req.body || {}
    if (!Number.isFinite(paymentId) || paymentId <= 0)
      return res.status(400).json({ error: 'Invalid payment id' })
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0)
      return res.status(400).json({ error: 'amount must be > 0' })

    const p = await findPaymentById(paymentId)
    if (!p) return res.status(404).json({ error: 'Payment not found' })
    if (!p.verified_at) {
      return res
        .status(400)
        .json({ error: 'Only verified payments can be refunded' })
    }
    // Only refund payments considered successful
    const okStatus =
      String(p.payment_status).toLowerCase() === 'completed' ||
      ['Partially Paid', 'Fully Paid'].includes(String(p.payment_status))
    if (!okStatus) {
      return res
        .status(400)
        .json({ error: 'Only successful payments can be refunded' })
    }

    const alreadyRefunded = await getTotalRefundedForPayment(paymentId)
    const refundable = Math.max(0, Number(p.amount_paid || 0) - alreadyRefunded)
    if (amt > refundable) {
      return res.status(400).json({
        error: `Refund exceeds refundable amount (${refundable.toFixed(2)})`,
      })
    }

    const refund = await createRefund({
      payment_id: paymentId,
      amount: amt,
      reason: reason ? String(reason) : null,
      created_by: Number(req.user?.id),
    })

    // If fully refunded, optionally mark payment as Refunded
    const newRefundedTotal = alreadyRefunded + amt
    if (newRefundedTotal >= Number(p.amount_paid || 0)) {
      try {
        const updated = await updatePayment(paymentId, {
          payment_status: 'Refunded',
        })
        await createPaymentLog({
          payment_id: paymentId,
          previous_status: String(p.payment_status || ''),
          new_status: 'Refunded',
          performed_by: 'admin',
          user_id: req.user.id,
          additional_notes: reason || null,
          action: 'refund-full',
        })
        // Recalc booking status after refund
        await recalcBookingPaymentStatus(updated.booking_id)
      } catch (e) {
        console.warn('update payment after full refund failed:', e?.message)
      }
    } else {
      // Log partial refund
      try {
        await createPaymentLog({
          payment_id: paymentId,
          previous_status: String(p.payment_status || ''),
          new_status: String(p.payment_status || ''),
          performed_by: 'admin',
          user_id: req.user.id,
          additional_notes: reason || null,
          action: 'refund-partial',
        })
        await recalcBookingPaymentStatus(p.booking_id)
      } catch (e) {
        console.warn('log/refcalc after partial refund failed:', e?.message)
      }
    }

    return res.status(201).json({ refund })
  } catch (err) {
    console.error('admin createRefund error:', err)
    res.status(500).json({ error: 'Failed to create refund' })
  }
}

module.exports.createRefund = createRefundHandler
