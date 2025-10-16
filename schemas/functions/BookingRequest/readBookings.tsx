'use client'

// Admin: load all booking requests (pending, accepted, rejected, cancelled)
// and confirmed bookings. Returns a unified list suitable for the ManageBooking table.

export type BookingRequestRow = {
  kind: 'request' | 'confirmed'
  // request fields
  requestid?: number
  status?: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  event_date?: string
  event_time?: string
  event_end_time?: string | null
  extension_duration?: number | null
  event_address?: string
  contact_info?: string | null
  contact_person?: string | null
  contact_person_number?: string | null
  event_name?: string | null
  strongest_signal?: string | null
  package_name?: string
  price?: number
  grid?: string | null
  // user info
  username?: string | null
  firstname?: string | null
  lastname?: string | null
  contact?: string | null
  // confirmed fields
  confirmed_id?: number
  booking_status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  payment_status?: 'unpaid' | 'partial' | 'paid' | 'refunded'
  total_booking_price?: number
  created_at?: string
  last_updated?: string
}

type LoadBookingsOptions = {
  token?: string | null
  endpointRequests?: string
  endpointConfirmed?: string
}

const API_ROOT =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:5000'

function getToken(explicit?: string | null) {
  if (explicit) return explicit
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}

export async function readBookings(
  opts: LoadBookingsOptions = {}
): Promise<BookingRequestRow[]> {
  const token = getToken(opts.token)
  if (!token) throw new Error('Not authenticated')

  const urlReq = opts.endpointRequests ?? `${API_ROOT}/api/admin/bookingRequest`
  const urlConf =
    opts.endpointConfirmed ?? `${API_ROOT}/api/admin/confirmed-bookings`

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const [resReq, resConf] = await Promise.all([
    fetch(urlReq, { headers, cache: 'no-store' }),
    fetch(urlConf, { headers, cache: 'no-store' }),
  ])

  const dataReq = await resReq.json().catch(() => ({}))
  const dataConf = await resConf.json().catch(() => ({}))
  if (!resReq.ok)
    throw new Error(dataReq?.message || 'Failed to load booking requests')
  if (!resConf.ok)
    throw new Error(dataConf?.message || 'Failed to load confirmed bookings')

  const requests = Array.isArray(dataReq?.bookings) ? dataReq.bookings : []
  const confirmed = Array.isArray(dataConf?.bookings) ? dataConf.bookings : []

  const reqRows: BookingRequestRow[] = requests.map((r: any) => ({
    kind: 'request',
    requestid: r.requestid,
    status: r.status,
    event_date: r.event_date ?? r.eventdate,
    event_time: r.event_time ?? r.eventtime,
    event_end_time: r.event_end_time ?? null,
    extension_duration:
      typeof r.extension_duration === 'number'
        ? r.extension_duration
        : r.extension_duration != null
        ? Number(r.extension_duration)
        : null,
    event_address: r.event_address ?? r.eventaddress,
    contact_info: r.contact_info ?? null,
    contact_person: r.contact_person ?? null,
    contact_person_number: r.contact_person_number ?? null,
    event_name: r.event_name ?? null,
    strongest_signal: r.strongest_signal ?? null,
    package_name: r.package_name,
    price: typeof r.price === 'number' ? r.price : Number(r.price ?? 0),
    grid: r.grid ?? null,
    username: r.username ?? null,
    firstname: r.firstname ?? null,
    lastname: r.lastname ?? null,
    contact: r.contact ?? null,
    created_at: r.created_at,
    last_updated: r.last_updated,
  }))

  const confRows: BookingRequestRow[] = confirmed.map((c: any) => ({
    kind: 'confirmed',
    confirmed_id: c.id,
    requestid: c.requestid,
    // Derive a pseudo request status for table display
    status: 'accepted',
    event_date: c.event_date,
    event_time: c.event_time,
    event_end_time: c.event_end_time ?? null,
    extension_duration:
      typeof c.extension_duration === 'number'
        ? c.extension_duration
        : c.extension_duration != null
        ? Number(c.extension_duration)
        : null,
    event_address: c.event_address,
    contact_info: c.contact_info ?? null,
    contact_person: c.contact_person ?? null,
    contact_person_number: c.contact_person_number ?? null,
    event_name: c.event_name ?? null,
    strongest_signal: c.strongest_signal ?? null,
    package_name: c.package_name,
    price:
      typeof c.package_price === 'number'
        ? c.package_price
        : Number(c.package_price ?? 0),
    grid: c.grid ?? null,
    username: c.username ?? null,
    firstname: c.firstname ?? null,
    lastname: c.lastname ?? null,
    booking_status: c.booking_status,
    payment_status: c.payment_status,
    total_booking_price:
      typeof c.total_booking_price === 'number'
        ? c.total_booking_price
        : Number(c.total_booking_price ?? 0),
    created_at: c.created_at,
    last_updated: c.last_updated,
  }))

  // Merge and de-duplicate by requestid, preferring confirmed over request
  const map = new Map<string | number, BookingRequestRow>()
  const keyOf = (r: BookingRequestRow) =>
    r.requestid ?? `${r.event_date}|${r.event_time}|${r.event_address}`
  // First add requests
  for (const r of reqRows) {
    const k = keyOf(r)
    map.set(k, r)
  }
  // Then overwrite with confirmed if present (preferred)
  for (const c of confRows) {
    const k = keyOf(c)
    map.set(k, c)
  }
  const merged = Array.from(map.values())
  // Sort by created_at desc when available else by event_date desc
  merged.sort((a, b) => {
    const ta = Date.parse(a.created_at || a.event_date || '') || 0
    const tb = Date.parse(b.created_at || b.event_date || '') || 0
    return tb - ta
  })

  return merged
}
