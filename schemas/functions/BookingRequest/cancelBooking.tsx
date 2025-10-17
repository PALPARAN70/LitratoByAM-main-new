'use client'

// Admin-side API helper to cancel an approved confirmed booking

const ADMIN_CONF_API_ROOT =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/admin/confirmed-bookings'

function getToken(explicit?: string | null) {
  if (explicit) return explicit
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}

type BookingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

type ConfirmedBooking = {
  id: number
  requestid: number
  booking_status: BookingStatus
}

async function asJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

export async function cancelConfirmedBooking(params: {
  bookingId?: number
  requestid?: number
  reason?: string
  token?: string | null
}): Promise<ConfirmedBooking> {
  const { bookingId, requestid, token, reason } = params
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')

  // If only requestid is provided, find booking by request first
  let id = bookingId
  if (!id && typeof requestid === 'number') {
    const resLookup = await fetch(
      `${ADMIN_CONF_API_ROOT}/by-request/${requestid}`,
      { method: 'GET', headers: authHeaders(tkn), cache: 'no-store' }
    )
    const dataLookup = await asJson(resLookup)
    if (!resLookup.ok) {
      throw new Error(dataLookup?.message || 'Confirmed booking not found')
    }
    id = (dataLookup.booking?.id ?? dataLookup.id) as number
  }
  if (!id) throw new Error('bookingId or requestid is required')

  // Call explicit cancel controller endpoint (server handles the status change and any side-effects)
  const res = await fetch(`${ADMIN_CONF_API_ROOT}/${id}/cancel`, {
    method: 'POST',
    headers: authHeaders(tkn),
    body: JSON.stringify({ reason }),
  })
  const data = await asJson(res)
  if (!res.ok)
    throw new Error(data?.message || 'Failed to cancel confirmed booking')
  return (data.booking || data) as ConfirmedBooking
}
