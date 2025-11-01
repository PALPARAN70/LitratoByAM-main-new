const path = require('path')
const {
  getConfirmedBookingById,
  getConfirmedBookingByRequestId,
} = require('../Model/confirmedBookingRequestModel')
const {
  getContractByBookingId,
  attachSignedContract,
} = require('../Model/contractModel')

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
])

async function getMyContract(req, res) {
  try {
    const userId = req.user && req.user.id
    const raw = Number(req.params.id)
    let booking = await getConfirmedBookingById(raw)
    let bookingId = raw
    if (!booking) {
      const byReq = await getConfirmedBookingByRequestId(raw)
      if (byReq) {
        booking = byReq
        bookingId = Number(byReq.id)
      }
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    if (Number(booking.userid) !== Number(userId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const row = await getContractByBookingId(bookingId)
    return res.json({ contract: row || null })
  } catch (e) {
    console.error('customer getMyContract error:', e)
    res.status(500).json({ error: 'Failed to load contract' })
  }
}

async function uploadSigned(req, res) {
  try {
    const userId = req.user && req.user.id
    const raw = Number(req.params.id)
    let booking = await getConfirmedBookingById(raw)
    let bookingId = raw
    if (!booking) {
      const byReq = await getConfirmedBookingByRequestId(raw)
      if (byReq) {
        booking = byReq
        bookingId = Number(byReq.id)
      }
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    if (Number(booking.userid) !== Number(userId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    if (!ALLOWED_MIME.has(req.file.mimetype)) {
      return res.status(400).json({ error: 'Unsupported file type' })
    }
    const url = `${req.protocol}://${req.get(
      'host'
    )}/assets/Contracts/Signed/${path.basename(req.file.path)}`
    const row = await attachSignedContract({
      booking_id: bookingId,
      user_id: Number(userId),
      url,
      mime: req.file.mimetype,
    })
    return res.status(201).json({ contract: row })
  } catch (e) {
    console.error('customer uploadSigned error:', e)
    res.status(500).json({ error: 'Failed to upload signed contract' })
  }
}

module.exports = {
  getMyContract,
  uploadSigned,
}
