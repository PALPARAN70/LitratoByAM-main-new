'use client'

// Admin-side API helpers for payments management

import { getAuthHeadersInit, Payment } from './createPayment'

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
const API_BASE = `${API_ORIGIN}/api`

export type AdminPaymentUpdate = Partial<
  Pick<
    Payment,
    | 'payment_status'
    | 'notes'
    | 'verified_at'
    | 'proof_image_url'
    | 'reference_no'
    | 'amount_paid'
    | 'payment_method'
  >
>

export async function listAdminPayments(query?: {
  status?: string
  user_id?: number
  booking_id?: number
}): Promise<Payment[]> {
  const qs = new URLSearchParams()
  if (query?.status) qs.set('status', query.status)
  if (query?.user_id) qs.set('user_id', String(query.user_id))
  if (query?.booking_id) qs.set('booking_id', String(query.booking_id))
  const url = `${API_BASE}/admin/payments${qs.toString() ? `?${qs}` : ''}`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeadersInit(),
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await safeText(res, 'Failed to load payments'))
  const data = await res.json().catch(() => ({}))
  return (data.payments ?? []) as Payment[]
}

export async function updateAdminPayment(
  id: number,
  body: AdminPaymentUpdate
): Promise<Payment> {
  const res = await fetch(`${API_BASE}/admin/payments/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeadersInit(),
    },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw new Error(await safeText(res, 'Failed to update payment'))
  const data = await res.json().catch(() => ({}))
  return data.payment as Payment
}

export async function createAdminRefund(
  paymentId: number,
  body: { amount: number; reason?: string | null }
): Promise<{
  refund_id: number
  payment_id: number
  amount: number
  reason?: string | null
  created_by: number
  created_at: string
}> {
  const res = await fetch(`${API_BASE}/admin/payments/${paymentId}/refunds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeadersInit(),
    },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw new Error(await safeText(res, 'Failed to create refund'))
  const data = await res.json().catch(() => ({}))
  return data.refund
}

export type AdminCreatePaymentInput = {
  booking_id: number
  amount_paid: number
  payment_method?: string // default 'cash'
  reference_no?: string | null
  notes?: string | null
  payment_status?:
    | 'Pending'
    | 'Partially Paid'
    | 'Failed'
    | 'Refunded'
    | 'Fully Paid'
  verified?: boolean // default true for cash
}

export async function createAdminPayment(
  body: AdminCreatePaymentInput
): Promise<Payment> {
  const res = await fetch(`${API_BASE}/admin/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeadersInit(),
    },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw new Error(await safeText(res, 'Failed to create payment'))
  const data = await res.json().catch(() => ({}))
  return data.payment as Payment
}

export async function uploadAdminPaymentQR(
  file: File
): Promise<{ url: string }> {
  if (!file) throw new Error('No file provided')
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch(`${API_BASE}/admin/payment-qr-image`, {
    method: 'POST',
    headers: {
      ...getAuthHeadersInit(),
    },
    body: fd,
  })
  if (!res.ok) throw new Error(await safeText(res, 'Failed to upload QR'))
  const data = await res.json().catch(() => ({}))
  return { url: String(data.url || '') }
}

export type BookingBalance = {
  booking_id: number
  amount_due: number
  total_paid: number
  balance: number
  computed_booking_payment_status?: string
}

export async function getAdminBookingBalance(
  bookingId: number
): Promise<BookingBalance> {
  const res = await fetch(`${API_BASE}/admin/bookings/${bookingId}/balance`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeadersInit(),
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await safeText(res, 'Failed to load balance'))
  const data = await res.json().catch(() => ({}))
  return {
    booking_id: Number(data.booking_id || bookingId),
    amount_due: Number(data.amount_due || 0),
    total_paid: Number(data.total_paid || 0),
    balance: Number(data.balance || 0),
    computed_booking_payment_status: String(
      data.computed_booking_payment_status || ''
    ),
  }
}

export type PaymentLog = {
  log_id: number
  payment_id: number
  previous_status: string
  new_status: string
  performed_by: string
  user_id: number
  action: string
  created_at: string
  additional_notes?: string | null
}

export async function listAdminPaymentLogs(
  payment_id?: number
): Promise<PaymentLog[]> {
  const qs = new URLSearchParams()
  if (payment_id) qs.set('payment_id', String(payment_id))
  const url = `${API_BASE}/admin/payment-logs${qs.toString() ? `?${qs}` : ''}`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeadersInit(),
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await safeText(res, 'Failed to load logs'))
  const data = await res.json().catch(() => ({}))
  return (data.logs ?? []) as PaymentLog[]
}

export async function updateAdminPaymentLog(
  log_id: number,
  body: { additional_notes?: string | null }
): Promise<PaymentLog> {
  const res = await fetch(`${API_BASE}/admin/payment-logs/${log_id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeadersInit(),
    },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw new Error(await safeText(res, 'Failed to update log'))
  const data = await res.json().catch(() => ({}))
  return data.log as PaymentLog
}

async function safeText(res: Response, fallback: string) {
  try {
    const t = await res.text()
    return t || fallback
  } catch {
    return fallback
  }
}
