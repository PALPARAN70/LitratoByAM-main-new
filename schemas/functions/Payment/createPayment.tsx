'use client'

// Centralized client-side API helpers for customer payments.
// Move network calls out of the page component and import these instead.

export type Payment = {
  payment_id: number
  booking_id: number
  user_id: number
  amount: number
  amount_paid: number
  payment_method: string
  proof_image_url?: string | null
  reference_no?: string | null
  payment_status: string
  notes?: string | null
  verified_at?: string | null
  created_at: string
}

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
const API_BASE = `${API_ORIGIN}/api`

// --- Auth helpers (mirrors usage across the app) ---
const getCookie = (name: string) =>
  typeof document === 'undefined'
    ? ''
    : document.cookie
        .split('; ')
        .find((r) => r.startsWith(name + '='))
        ?.split('=')[1] || ''

export const getAuthHeaderString = () => {
  const raw =
    (typeof window !== 'undefined' && localStorage.getItem('access_token')) ||
    getCookie('access_token')
  if (!raw) return ''
  return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`
}

export const getAuthHeadersInit = (): HeadersInit => {
  const auth = getAuthHeaderString()
  const h: Record<string, string> = {}
  if (auth) h['Authorization'] = auth
  return h
}

// --- API: Customer upload proof image ---
export async function uploadPaymentProof(file: File): Promise<{ url: string }> {
  if (!file) throw new Error('No file provided')
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch(`${API_BASE}/customer/payment-proof`, {
    method: 'POST',
    headers: {
      ...getAuthHeadersInit(),
      // NOTE: do not set Content-Type for FormData; browser sets the boundary
    },
    body: fd,
  })
  if (!res.ok) throw new Error(await safeText(res, 'Failed to upload proof'))
  const data = await res.json().catch(() => ({}))
  return { url: String(data.url || '') }
}

// --- API: Get latest admin-provided QR image (public) ---
export async function getLatestPaymentQR(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/customer/payment-qr`)
  if (!res.ok) return null
  const data = await res.json().catch(() => ({}))
  return (data && data.url) || null
}

// --- API: Create a payment for a confirmed booking ---
export type CreatePaymentInput = {
  bookingId: number
  amountPaid: number
  referenceNo: string
  proofImageUrl?: string | null
  paymentMethod?: string // default 'gcash'
  notes?: string | null
}

export async function createCustomerPayment(
  input: CreatePaymentInput
): Promise<Payment> {
  const {
    bookingId,
    amountPaid,
    referenceNo,
    proofImageUrl = null,
    paymentMethod = 'gcash',
    notes = null,
  } = input

  if (!bookingId || !amountPaid || !referenceNo) {
    throw new Error('bookingId, amountPaid and referenceNo are required')
  }

  const res = await fetch(`${API_BASE}/customer/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeadersInit(),
    },
    body: JSON.stringify({
      booking_id: Number(bookingId),
      amount_paid: Number(amountPaid),
      reference_no: referenceNo,
      proof_image_url: proofImageUrl,
      payment_method: paymentMethod,
      notes,
    }),
  })
  if (!res.ok) throw new Error(await safeText(res, 'Failed to create payment'))
  const data = await res.json().catch(() => ({}))
  return data.payment as Payment
}

// --- small utility: safe text extraction ---
async function safeText(res: Response, fallback: string) {
  try {
    const t = await res.text()
    return t || fallback
  } catch {
    return fallback
  }
}

// Named bundle export for convenience
const PaymentAPI = {
  uploadPaymentProof,
  getLatestPaymentQR,
  createCustomerPayment,
  getAuthHeaderString,
  getAuthHeadersInit,
}

export default PaymentAPI
