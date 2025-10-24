export type AdminBookingStatus = 'scheduled' | 'in_progress' | 'completed'

function apiBase() {
  return (
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE
      ? String(process.env.NEXT_PUBLIC_API_BASE)
      : 'http://localhost:5000'
  ).replace(/\/$/, '')
}

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchAdminConfirmedBookings(): Promise<any[]> {
  const url = `${apiBase()}/api/admin/confirmed-bookings`
  const res = await fetch(url, {
    headers: { ...authHeaders() },
    cache: 'no-store',
  })
  if (!res.ok)
    throw new Error(`Failed to load confirmed bookings: ${res.status}`)
  const data = await res.json().catch(() => ({}))
  return Array.isArray(data?.bookings) ? data.bookings : []
}

export async function updateAdminBookingStatus(
  bookingId: number | string,
  status: AdminBookingStatus
): Promise<any> {
  const url = `${apiBase()}/api/admin/confirmed-bookings/${encodeURIComponent(
    String(bookingId)
  )}/booking-status`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`Failed to update booking status: ${res.status}`)
  const data = await res.json().catch(() => ({}))
  return data?.booking ?? null
}
