const path = require('path')
const {
  getConfirmedBookingById,
  getConfirmedBookingByRequestId,
} = require('../../Model/confirmedBookingRequestModel')
const {
  getContractByBookingId,
  upsertOriginalContract,
  verifyContract,
} = require('../../Model/contractModel')

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
])

async function uploadOriginal(req, res) {
  try {
    const adminId = req.user && req.user.id
    const raw = Number(req.params.id)
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    if (!ALLOWED_MIME.has(req.file.mimetype)) {
      return res.status(400).json({ error: 'Unsupported file type' })
    }
    let booking = await getConfirmedBookingById(raw)
    let bookingId = raw
    if (!booking) {
      // Fallback: treat provided id as booking request id
      const byReq = await getConfirmedBookingByRequestId(raw)
      if (byReq) {
        booking = byReq
        bookingId = Number(byReq.id)
      }
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    const url = `${req.protocol}://${req.get(
      'host'
    )}/assets/Contracts/Originals/${path.basename(req.file.path)}`
    const row = await upsertOriginalContract({
      booking_id: bookingId,
      user_id: Number(adminId),
      url,
      mime: req.file.mimetype,
    })
    return res.status(201).json({ contract: row })
  } catch (e) {
    console.error('admin uploadOriginal error:', e)
    res.status(500).json({ error: 'Failed to upload contract' })
  }
}

async function getContract(req, res) {
  try {
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
    const row = await getContractByBookingId(bookingId)
    return res.json({ contract: row || null })
  } catch (e) {
    console.error('admin getContract error:', e)
    res.status(500).json({ error: 'Failed to load contract' })
  }
}

async function verify(req, res) {
  try {
    const adminId = req.user && req.user.id
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
    const row = await verifyContract({
      booking_id: bookingId,
      user_id: Number(adminId),
    })
    return res.json({ contract: row })
  } catch (e) {
    console.error('admin verifyContract error:', e)
    res.status(500).json({ error: 'Failed to verify contract' })
  }
}

module.exports = {
  uploadOriginal,
  getContract,
  verify,
}
