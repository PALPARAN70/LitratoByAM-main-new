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
  getPaymentSummary,
} = require('../../Model/confirmedBookingRequestModel')

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

    const updates = {}
    if (payment_status != null) updates.payment_status = payment_status
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
          notes: null,
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
          notes: notes || null,
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
    const { additional_notes, notes } = req.body || {}
    const updated = await updatePaymentLog(logId, { additional_notes, notes })
    if (!updated)
      return res.status(404).json({ error: 'Log not found or no changes' })
    res.json({ log: updated })
  } catch (err) {
    console.error('admin updatePaymentLog error:', err)
    res.status(500).json({ error: 'Failed to update payment log' })
  }
}

// Generate a simple sales report PDF for a date range (created_at)
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

    const doc = new PDFDocument({ size: 'A4', margin: 36 })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="sales-report.pdf"')

    doc.pipe(res)

    doc.fontSize(16).text('Sales Report', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).text(`Generated at: ${new Date().toLocaleString()}`)
    doc.moveDown()

    // Table header
    doc.font('Helvetica-Bold')
    doc.text('ID', 36)
    doc.text('User', 80)
    doc.text('Booking', 150)
    doc.text('Amount', 230)
    doc.text('Paid', 300)
    doc.text('Status', 360)
    doc.text('Created', 430)
    doc.moveDown(0.5)
    doc.font('Helvetica')

    rows.forEach((p) => {
      doc.text(String(p.payment_id), 36)
      doc.text(String(p.user_id), 80)
      doc.text(String(p.booking_id), 150)
      doc.text(String(p.amount), 230)
      doc.text(String(p.amount_paid), 300)
      doc.text(String(p.payment_status), 360)
      doc.text(new Date(p.created_at).toLocaleDateString(), 430)
      doc.moveDown(0.2)
    })

    // Summary
    const totalPaid = rows.reduce(
      (sum, r) => sum + Number(r.amount_paid || 0),
      0
    )
    doc.moveDown()
    doc.font('Helvetica-Bold').text(`Total Paid: ${totalPaid.toFixed(2)}`)

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
      payment_status = 'completed',
      verified = true,
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

    const row = await createPayment({
      booking_id: bId,
      user_id: userId,
      amount,
      amount_paid: paid,
      payment_method: String(payment_method || 'cash'),
      proof_image_url: null,
      reference_no: reference_no ? String(reference_no) : null,
      payment_status: String(payment_status || 'completed'),
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
        notes: row.notes || null,
        action: 'admin-create',
      })
      await createPaymentLog({
        payment_id: row.payment_id,
        previous_status: 'n/a',
        new_status: row.payment_status,
        performed_by: 'customer',
        user_id: userId,
        notes: row.notes || null,
        action: 'customer-cash-payment',
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
}
