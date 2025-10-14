const {
  initConfirmedBookingTable,
  listConfirmedBookings,
  getConfirmedBookingById,
  getConfirmedBookingByRequestId,
  setContractSigned,
  updatePaymentStatus,
  updateBookingStatus,
  updateTotalPrice,
} = require('../../Model/confirmedBookingRequestModel')

// Ensure table exists once when the controller is loaded (best-effort)
initConfirmedBookingTable().catch((e) =>
  console.warn('Init confirmed_bookings table failed:', e?.message)
)

async function list(req, res) {
  try {
    const rows = await listConfirmedBookings()
    return res.json({ bookings: rows })
  } catch (err) {
    console.error('confirmed.list error:', err)
    return res.status(500).json({ message: 'Error listing confirmed bookings' })
  }
}

async function getById(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    const row = await getConfirmedBookingById(id)
    if (!row) return res.status(404).json({ message: 'Not found' })
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.getById error:', err)
    return res.status(500).json({ message: 'Error loading confirmed booking' })
  }
}

async function getByRequestId(req, res) {
  try {
    const requestid = parseInt(req.params.requestid, 10)
    if (Number.isNaN(requestid))
      return res.status(400).json({ message: 'Invalid request id' })
    const row = await getConfirmedBookingByRequestId(requestid)
    if (!row) return res.status(404).json({ message: 'Not found' })
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.getByRequestId error:', err)
    return res.status(500).json({ message: 'Error loading confirmed booking' })
  }
}

async function markContractSigned(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    const { signed = true } = req.body || {}
    const row = await setContractSigned(id, !!signed)
    if (!row) return res.status(404).json({ message: 'Not found' })
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.markContractSigned error:', err)
    return res.status(500).json({ message: 'Error updating contract status' })
  }
}

async function setPaymentStatus(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    const { status } = req.body || {}
    if (!status) return res.status(400).json({ message: 'status required' })
    const row = await updatePaymentStatus(id, status)
    if (!row) return res.status(404).json({ message: 'Not found' })
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.setPaymentStatus error:', err)
    return res
      .status(400)
      .json({ message: err?.message || 'Error updating payment status' })
  }
}

async function setBookingStatus(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    const { status } = req.body || {}
    if (!status) return res.status(400).json({ message: 'status required' })
    const row = await updateBookingStatus(id, status)
    if (!row) return res.status(404).json({ message: 'Not found' })
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.setBookingStatus error:', err)
    return res
      .status(400)
      .json({ message: err?.message || 'Error updating booking status' })
  }
}

async function setTotalPrice(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' })
    const { total } = req.body || {}
    if (typeof total === 'undefined')
      return res.status(400).json({ message: 'total required' })
    const parsed = Number(total)
    if (!Number.isFinite(parsed) || parsed < 0)
      return res
        .status(400)
        .json({ message: 'total must be a non-negative number' })
    const row = await updateTotalPrice(id, parsed)
    if (!row) return res.status(404).json({ message: 'Not found' })
    return res.json({ booking: row })
  } catch (err) {
    console.error('confirmed.setTotalPrice error:', err)
    return res.status(500).json({ message: 'Error updating total price' })
  }
}

module.exports = {
  list,
  getById,
  getByRequestId,
  markContractSigned,
  setPaymentStatus,
  setBookingStatus,
  setTotalPrice,
}
