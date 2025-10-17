'use client'

// Admin-side API helpers for updating confirmed bookings

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

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'
export type BookingStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type ConfirmedBooking = {
  id: number
  requestid: number
  userid: number
  contract_signed: boolean
  payment_status: PaymentStatus
  booking_status: BookingStatus
  total_booking_price: number
  created_at?: string
  last_updated?: string
  // Optional joined fields from backend
  event_date?: string
  event_time?: string
  event_end_time?: string | null
  extension_duration?: number | null
  grid?: string | null
  event_address?: string
  contact_info?: string | null
  event_name?: string | null
  strongest_signal?: string | null
  package_name?: string
  package_price?: number
  username?: string | null
  firstname?: string | null
  lastname?: string | null
}

type Json = Record<string, any>

async function asJson(res: Response) {
  try {
    return (await res.json()) as Json
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

export async function getConfirmedBookingById(
  id: number,
  token?: string | null
): Promise<ConfirmedBooking> {
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')
  const res = await fetch(`${ADMIN_CONF_API_ROOT}/${id}`, {
    method: 'GET',
    headers: authHeaders(tkn),
    cache: 'no-store',
  })
  const data = await asJson(res)
  if (!res.ok) throw new Error(data?.message || 'Failed to load booking')
  return (data.booking || data) as ConfirmedBooking
}

export async function getConfirmedBookingByRequestId(
  requestid: number,
  token?: string | null
): Promise<ConfirmedBooking | null> {
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')
  const res = await fetch(`${ADMIN_CONF_API_ROOT}/by-request/${requestid}`, {
    method: 'GET',
    headers: authHeaders(tkn),
    cache: 'no-store',
  })
  const data = await asJson(res)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(data?.message || 'Failed to load booking')
  return (data.booking || data) as ConfirmedBooking
}

export async function setContractSigned(
  id: number,
  signed: boolean,
  token?: string | null
): Promise<ConfirmedBooking> {
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')
  const res = await fetch(`${ADMIN_CONF_API_ROOT}/${id}/contract`, {
    method: 'PATCH',
    headers: authHeaders(tkn),
    body: JSON.stringify({ signed }),
  })
  const data = await asJson(res)
  if (!res.ok)
    throw new Error(data?.message || 'Failed to update contract status')
  return (data.booking || data) as ConfirmedBooking
}

export async function setPaymentStatus(
  id: number,
  status: PaymentStatus,
  token?: string | null
): Promise<ConfirmedBooking> {
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')
  const res = await fetch(`${ADMIN_CONF_API_ROOT}/${id}/payment-status`, {
    method: 'PATCH',
    headers: authHeaders(tkn),
    body: JSON.stringify({ status }),
  })
  const data = await asJson(res)
  if (!res.ok)
    throw new Error(data?.message || 'Failed to update payment status')
  return (data.booking || data) as ConfirmedBooking
}

export async function setBookingStatus(
  id: number,
  status: BookingStatus,
  token?: string | null
): Promise<ConfirmedBooking> {
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')
  const res = await fetch(`${ADMIN_CONF_API_ROOT}/${id}/booking-status`, {
    method: 'PATCH',
    headers: authHeaders(tkn),
    body: JSON.stringify({ status }),
  })
  const data = await asJson(res)
  if (!res.ok)
    throw new Error(data?.message || 'Failed to update booking status')
  return (data.booking || data) as ConfirmedBooking
}

export async function setTotalPrice(
  id: number,
  total: number,
  token?: string | null
): Promise<ConfirmedBooking> {
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')
  const res = await fetch(`${ADMIN_CONF_API_ROOT}/${id}/total`, {
    method: 'PATCH',
    headers: authHeaders(tkn),
    body: JSON.stringify({ total }),
  })
  const data = await asJson(res)
  if (!res.ok) throw new Error(data?.message || 'Failed to update total')
  return (data.booking || data) as ConfirmedBooking
}

export async function updateConfirmedBooking(params: {
  bookingId?: number
  requestid?: number
  updates: Partial<{
    contractSigned: boolean
    paymentStatus: PaymentStatus
    bookingStatus: BookingStatus
    total: number
  }>
  token?: string | null
}): Promise<ConfirmedBooking> {
  const { bookingId, requestid, updates, token } = params
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')

  let id = bookingId
  if (!id && typeof requestid === 'number') {
    const byReq = await getConfirmedBookingByRequestId(requestid, tkn)
    if (!byReq) throw new Error('Confirmed booking not found for request')
    id = byReq.id
  }
  if (!id) throw new Error('bookingId or requestid is required')
  // Call the combined backend controller endpoint once
  const res = await fetch(`${ADMIN_CONF_API_ROOT}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(tkn),
    body: JSON.stringify(updates ?? {}),
  })
  const data = await asJson(res)
  if (!res.ok)
    throw new Error(data?.message || 'Failed to update confirmed booking')
  return (data.booking || data) as ConfirmedBooking
}
