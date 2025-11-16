export type StaffBookingStatus = 'scheduled' | 'in_progress' | 'completed'

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

export async function fetchAssignedConfirmedBookings(): Promise<any[]> {
  const url = `${apiBase()}/api/employee/assigned-confirmed-bookings`
  const res = await fetch(url, {
    headers: { ...authHeaders() },
    cache: 'no-store',
  })
  if (!res.ok)
    throw new Error(`Failed to load assigned bookings: ${res.status}`)
  const data = await res.json().catch(() => ({}))
  return Array.isArray(data?.bookings) ? data.bookings : []
}

export async function updateAssignedBookingStatus(
  bookingId: number | string,
  status: StaffBookingStatus
): Promise<any> {
  const url = `${apiBase()}/api/employee/assigned-confirmed-bookings/${encodeURIComponent(
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

export async function setAssignedExtensionDuration(
  bookingId: number | string,
  extensionHours: number,
  bufferHours = 2
): Promise<{ booking: any; paymentSummary?: any }> {
  const parsed = Number(extensionHours) || 0
  const bounded = Math.max(0, Math.min(2, parsed))
  const sanitizedHours = Math.round(bounded)
  const url = `${apiBase()}/api/employee/assigned-confirmed-bookings/${encodeURIComponent(
    String(bookingId)
  )}/extension?bufferHours=${encodeURIComponent(String(bufferHours))}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ extension_duration: sanitizedHours }),
  })
  const text = await res.text()
  if (!res.ok) {
    let message = 'Failed to update extension duration'
    const trimmed = text.trim()
    try {
      const parsedBody = JSON.parse(trimmed || '{}')
      if (parsedBody && typeof parsedBody.message === 'string') {
        message = parsedBody.message
      } else if (typeof parsedBody === 'string' && parsedBody.trim()) {
        message = parsedBody.trim()
      }
    } catch (_) {
      if (trimmed) message = trimmed
    }
    throw new Error(message)
  }
  const data = text ? JSON.parse(text) : {}
  return {
    booking: data?.booking ?? null,
    paymentSummary: data?.paymentSummary,
  }
}
