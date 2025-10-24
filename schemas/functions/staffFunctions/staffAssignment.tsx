'use client'

export type StaffUser = {
  id: number
  firstname: string
  lastname: string
  email: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}

function authHeaders(): HeadersInit | undefined {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

// List all verified employees for selection in Assign Staff dialog
export async function listEmployees(): Promise<StaffUser[]> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/list?role=employee`, {
      headers: authHeaders(),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json().catch(() => ({}))
    const users = Array.isArray(data?.users) ? data.users : []
    return users.map((u: any) => ({
      id: Number(u.id),
      firstname: String(u.firstname || ''),
      lastname: String(u.lastname || ''),
      email: String(u.email || ''),
    }))
  } catch {
    return []
  }
}

// Resolve confirmed booking id from a request id
export async function getConfirmedBookingIdByRequest(
  requestid: number
): Promise<number | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/admin/confirmed-bookings/by-request/${requestid}`,
      {
        headers: authHeaders(),
        cache: 'no-store',
      }
    )
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    const id = data?.booking?.id
    return typeof id === 'number' ? id : null
  } catch {
    return null
  }
}

// List staff currently assigned to a confirmed booking
export async function listAssignedStaff(
  confirmedId: number
): Promise<StaffUser[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/admin/confirmed-bookings/${confirmedId}/staff`,
      { headers: authHeaders(), cache: 'no-store' }
    )
    if (!res.ok) return []
    const d = await res.json().catch(() => ({}))
    const rows = Array.isArray(d?.staff) ? d.staff : []
    return rows.map((r: any) => ({
      id: Number(r.id),
      firstname: String(r.firstname || ''),
      lastname: String(r.lastname || ''),
      email: String(r.username || ''),
    }))
  } catch {
    return []
  }
}

// Assign up to two staff users to a confirmed booking
export async function assignStaffToBooking(
  confirmedId: number,
  staffUserIds: number[]
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/admin/confirmed-bookings/${confirmedId}/assign-staff`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeaders() || {}),
      },
      body: JSON.stringify({ staffUserIds }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || 'Failed to assign staff')
  }
}

// Replace assigned staff for a booking (up to two)
export async function replaceAssignedStaff(
  confirmedId: number,
  staffUserIds: number[]
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/admin/confirmed-bookings/${confirmedId}/staff`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeaders() || {}),
      },
      body: JSON.stringify({ staffUserIds }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || 'Failed to replace staff')
  }
}
