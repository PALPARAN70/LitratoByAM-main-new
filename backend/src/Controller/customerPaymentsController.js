const {
  createPayment,
  listPayments,
  findPaymentById,
} = require('../Model/paymentModel')
const {
  getConfirmedBookingById,
  getConfirmedBookingByRequestId,
  getPaymentSummary,
} = require('../Model/confirmedBookingRequestModel')

// Customer creates a payment for their confirmed booking
async function createPaymentHandler(req, res) {
  try {
    const userId = req.user && req.user.id
    const {
      booking_id,
      amount_paid,
      reference_no,
      payment_method = 'gcash',
      proof_image_url = null,
      notes = null,
    } = req.body || {}

    if (!booking_id || !amount_paid || !reference_no) {
      return res.status(400).json({
        error: 'booking_id, amount_paid and reference_no are required',
      })
    }

    // Ensure confirmed booking exists and belongs to current user
    const booking = await getConfirmedBookingById(Number(booking_id))
    if (!booking || Number(booking.userid) !== Number(userId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Prevent overpayment using current balance
    try {
      const sum = await getPaymentSummary(Number(booking_id))
      const remaining = Math.max(
        0,
        Number(sum.amountDue || 0) - Number(sum.paidTotal || 0)
      )
      if (Number(amount_paid) > remaining) {
        return res.status(400).json({
          error: `Payment exceeds remaining balance (${remaining.toFixed(2)})`,
        })
      }
    } catch (e) {
      // If summary fails, proceed without the guard
      console.warn('balance check failed; proceeding', e?.message)
    }

    const payment = await createPayment({
      booking_id: Number(booking_id),
      user_id: Number(userId),
      amount: Number(booking.total_booking_price || 0),
      amount_paid: Number(amount_paid),
      payment_method,
      proof_image_url,
      reference_no,
      payment_status: 'Pending',
      notes,
      verified_at: null,
    })

    res.status(201).json({ payment })
  } catch (err) {
    console.error('customer createPayment error:', err)
    res.status(500).json({ error: 'Failed to create payment' })
  }
}

// List payments for current user
async function listMyPayments(req, res) {
  try {
    const userId = req.user && req.user.id
    const rows = await listPayments({ user_id: Number(userId) })
    res.json({ payments: rows })
  } catch (err) {
    console.error('customer listMyPayments error:', err)
    res.status(500).json({ error: 'Failed to load payments' })
  }
}

// Get single payment for current user
async function getMyPayment(req, res) {
  try {
    const userId = req.user && req.user.id
    const id = Number(req.params.id)
    const row = await findPaymentById(id)
    if (!row || Number(row.user_id) !== Number(userId)) {
      return res.status(404).json({ error: 'Payment not found' })
    }
    res.json({ payment: row })
  } catch (err) {
    console.error('customer getMyPayment error:', err)
    res.status(500).json({ error: 'Failed to load payment' })
  }
}

module.exports = {
  createPayment: createPaymentHandler,
  listMyPayments,
  getMyPayment,
  // Map a requestid to a confirmed booking if owned by current user
  async getConfirmedByRequestOwned(req, res) {
    try {
      const userId = req.user && req.user.id
      const requestid = Number(req.params.requestid)
      if (!Number.isFinite(requestid)) {
        return res.status(400).json({ error: 'Invalid request id' })
      }
      const row = await getConfirmedBookingByRequestId(requestid)
      if (!row) return res.status(404).json({ error: 'Not found' })
      if (Number(row.userid) !== Number(userId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      return res.json({ booking: row })
    } catch (err) {
      console.error('customer getConfirmedByRequestOwned error:', err)
      res.status(500).json({ error: 'Failed to load booking' })
    }
  },
  // New: get balance for a confirmed booking owned by the current user
  async getMyBookingBalance(req, res) {
    try {
      const userId = req.user && req.user.id
      const id = Number(req.params.id)
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid booking id' })
      }
      const booking = await getConfirmedBookingById(id)
      if (!booking) return res.status(404).json({ error: 'Not found' })
      if (Number(booking.userid) !== Number(userId)) {
        return res.status(403).json({ error: 'Forbidden' })
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
      console.error('customer getMyBookingBalance error:', e)
      res.status(500).json({ error: 'Failed to compute balance' })
    }
  },
}
