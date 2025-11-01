// Contracts API helpers

export type ContractStatus =
  | 'Pending Signature'
  | 'Signed'
  | 'Under Review'
  | 'Verified'

export type BookingContract = {
  id: number
  booking_id: number
  original_url?: string | null
  original_mime?: string | null
  original_uploaded_by?: number | null
  original_uploaded_at?: string | null
  signed_url?: string | null
  signed_mime?: string | null
  signed_uploaded_by?: number | null
  signed_uploaded_at?: string | null
  status: ContractStatus
  verified_at?: string | null
  verified_by?: number | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

function base() {
  const b =
    (typeof process !== 'undefined' &&
      (process as any).env?.NEXT_PUBLIC_API_ORIGIN) ||
    'http://localhost:5000'
  return String(b)
}

function headers(): HeadersInit {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getAdminContract(
  bookingId: number | string
): Promise<BookingContract | null> {
  const res = await fetch(
    `${base()}/api/admin/bookings/${encodeURIComponent(
      String(bookingId)
    )}/contract`,
    {
      headers: { 'Content-Type': 'application/json', ...headers() },
      cache: 'no-store',
    }
  )
  if (!res.ok) return null
  const data = await res.json().catch(() => ({} as any))
  return (data?.contract as BookingContract) || null
}

export async function uploadAdminContractOriginal(
  bookingId: number | string,
  file: File
): Promise<BookingContract | null> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(
    `${base()}/api/admin/bookings/${encodeURIComponent(
      String(bookingId)
    )}/contract`,
    {
      method: 'POST',
      headers: { ...headers() },
      body: fd,
    }
  )
  if (!res.ok) return null
  const data = await res.json().catch(() => ({} as any))
  return (data?.contract as BookingContract) || null
}

export async function verifyAdminContract(
  bookingId: number | string
): Promise<BookingContract | null> {
  const res = await fetch(
    `${base()}/api/admin/bookings/${encodeURIComponent(
      String(bookingId)
    )}/contract/verify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
    }
  )
  if (!res.ok) return null
  const data = await res.json().catch(() => ({} as any))
  return (data?.contract as BookingContract) || null
}

export async function getMyContract(
  bookingId: number | string
): Promise<BookingContract | null> {
  const res = await fetch(
    `${base()}/api/customer/bookings/${encodeURIComponent(
      String(bookingId)
    )}/contract`,
    {
      headers: { 'Content-Type': 'application/json', ...headers() },
      cache: 'no-store',
    }
  )
  if (!res.ok) return null
  const data = await res.json().catch(() => ({} as any))
  return (data?.contract as BookingContract) || null
}

export async function uploadSignedContract(
  bookingId: number | string,
  file: File
): Promise<BookingContract | null> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(
    `${base()}/api/customer/bookings/${encodeURIComponent(
      String(bookingId)
    )}/contract-signed`,
    {
      method: 'POST',
      headers: { ...headers() },
      body: fd,
    }
  )
  if (!res.ok) return null
  const data = await res.json().catch(() => ({} as any))
  return (data?.contract as BookingContract) || null
}
