// API helpers for approving/rejecting a booking request (Admin)
'use client'

const API_ROOT =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/admin/bookingRequest'

function getToken(explicit?: string | null) {
  if (explicit) return explicit
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}

export type EvaluateResult = {
  message?: string
  booking?: any
}

export async function approveBookingRequest(
  requestid: number,
  token?: string | null
): Promise<EvaluateResult> {
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')
  const res = await fetch(`${API_ROOT}/${requestid}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tkn}`,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || 'Failed to approve booking')
  return data
}

export async function rejectBookingRequest(
  requestid: number,
  token?: string | null
): Promise<EvaluateResult> {
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')
  const res = await fetch(`${API_ROOT}/${requestid}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tkn}`,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || 'Failed to reject booking')
  return data
}
