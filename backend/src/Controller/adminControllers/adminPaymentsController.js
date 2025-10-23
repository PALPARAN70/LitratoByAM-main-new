const {
  listPayments,
  findPaymentById,
  updatePayment,
} = require('../../Model/paymentModel')
const {
  createPaymentLog,
  listPaymentLogsByPayment,
  listAllPaymentLogs,
  updatePaymentLog,
} = require('../../Model/paymentLogsModel')

// List payments with optional filters: status, user_id, booking_id, date range
async function listPaymentsHandler(req, res) {
  try {
    const { status, user_id, booking_id } = req.query
    // For now, reuse model listPayments with user/booking filters; status filter in JS
    const rows = await listPayments({
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
    const row = await findPaymentById(id)
    if (!row) return res.status(404).json({ error: 'Payment not found' })
    res.json({ payment: row })
  } catch (err) {
    console.error('admin getPayment error:', err)
    res.status(500).json({ error: 'Failed to load payment' })
  }
}

// Update payment; if status changes, log it
async function updatePaymentHandler(req, res) {
  try {
    const id = Number(req.params.id)
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

    // Fetch all payments; add filters later if needed (e.g., from/to)
    const rows = await listPayments({})

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

module.exports = {
  listPayments: listPaymentsHandler,
  getPayment: getPaymentHandler,
  updatePayment: updatePaymentHandler,
  listPaymentLogs: listPaymentLogsHandler,
  updatePaymentLog: updatePaymentLogHandler,
  generateSalesReport: generateSalesReportHandler,
}
