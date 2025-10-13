'use client'

export async function cancelBookingRequest(requestid: number, token?: string) {
  const API_ROOT =
    (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
      'http://localhost:5000') + '/api/customer/bookingRequest'

  const authToken =
    token ??
    (typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? undefined
      : undefined)
  if (!authToken) throw new Error('Not authenticated')

  const res = await fetch(`${API_ROOT}/${requestid}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || 'Failed to cancel booking')
  return data
}
