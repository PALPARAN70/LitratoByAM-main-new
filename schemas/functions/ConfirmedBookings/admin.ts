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

export async function preflightAdminExtensionConflicts(
  bookingId: number | string,
  params:
    | { extension_duration: number; add_hours?: never; bufferHours?: number }
    | { add_hours: number; extension_duration?: never; bufferHours?: number }
): Promise<{
  conflicts: Array<{
    requestid: number
    event_date: string
    event_time: string
  }>
}> {
  const qs = new URLSearchParams()
  if ('extension_duration' in params)
    qs.set('extension_duration', String(params.extension_duration))
  if ('add_hours' in params) qs.set('add_hours', String(params.add_hours))
  if (params.bufferHours != null)
    qs.set('bufferHours', String(params.bufferHours))
  const url = `${apiBase()}/api/admin/confirmed-bookings/${encodeURIComponent(
    String(bookingId)
  )}/extension-conflicts?${qs.toString()}`
  const res = await fetch(url, {
    headers: { ...authHeaders() },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Preflight failed: ${res.status}`)
  const data = await res.json().catch(() => ({}))
  return { conflicts: Array.isArray(data?.conflicts) ? data.conflicts : [] }
}

export async function setAdminExtensionDuration(
  bookingId: number | string,
  body:
    | { extension_duration: number; force?: boolean }
    | { add_hours: number; force?: boolean },
  bufferHours?: number
): Promise<{ booking: any; paymentSummary?: any }> {
  const url = `${apiBase()}/api/admin/confirmed-bookings/${encodeURIComponent(
    String(bookingId)
  )}/extension${
    bufferHours != null
      ? `?bufferHours=${encodeURIComponent(String(bufferHours))}`
      : ''
  }`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Update extension failed: ${res.status} ${text}`)
  }
  const data = await res.json().catch(() => ({}))
  return { booking: data?.booking, paymentSummary: data?.paymentSummary }
}
