// API helpers for updating and loading a booking request (customer)

const API_ROOT =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/customer/bookingRequest'

// Include both rejected (DB) and declined (frontend) to avoid TS friction
export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'declined'
  | 'cancelled'

export interface BookingRequest {
  requestid: number
  packageid: number
  userid: number
  eventdate: string
  eventtime: string
  eventaddress: string
  contact_info: string | null
  notes: string | null
  status: BookingStatus
  last_updated?: string
  package_name?: string // make sure backend returns this (join with packages)
}

export type UpdateBookingFields = Partial<{
  packageid: number
  eventaddress: string
  contact_info: string
  notes: string
}>

// Add type-only import for the UI form shape
import type { BookingForm } from '../../schema/requestvalidation'

// Minimal package type for name lookup
type PackageLite = { id: number; package_name: string }

const KNOWN_PKG_NAMES = ['The Hanz', 'The Corrupt', 'The AI', 'The OG'] as const
type PkgName = (typeof KNOWN_PKG_NAMES)[number]
const isPkgName = (v: string): v is PkgName =>
  (KNOWN_PKG_NAMES as readonly string[]).includes(v as any)

function getToken(explicit?: string | null) {
  if (explicit) return explicit
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}

export async function getBookingRequestById(
  id: number,
  token?: string | null
): Promise<BookingRequest> {
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')
  const res = await fetch(`${API_ROOT}/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tkn}`,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || 'Failed to load booking')
  return (data.booking || data) as BookingRequest
}

// Build backend-allowed payload from the UI form
export function buildUpdatePayload(
  form: BookingForm,
  selectedPackageId: number | null
): UpdateBookingFields {
  const contact_info =
    [form.contactPersonAndNumber, form.contactNumber]
      .filter(Boolean)
      .join(' | ') || undefined
  const notes =
    [form.facebook && `FB: ${form.facebook}`, form.eventName]
      .filter(Boolean)
      .join(' | ') || undefined
  return {
    packageid: selectedPackageId ?? undefined,
    eventaddress: form.eventLocation || undefined,
    contact_info,
    notes,
  }
}

// Compute a BookingForm patch from a BookingRequest (prefill)
export function computePrefillPatch(params: {
  booking: BookingRequest
  packages: { id: number; package_name: string }[]
  prevForm: BookingForm
}): { patch: Partial<BookingForm>; selectedPackageId: number } {
  const { booking, packages, prevForm } = params

  const resolvedName =
    booking.package_name ||
    packages.find((p) => p.id === booking.packageid)?.package_name ||
    prevForm.package

  const [contactPersonMaybe, contactNumMaybe] = (booking.contact_info || '')
    .split('|')
    .map((s) => s.trim())

  const patch: Partial<BookingForm> = {
    eventLocation: booking.eventaddress || prevForm.eventLocation,
    eventDate: new Date(booking.eventdate),
    eventTime: booking.eventtime || prevForm.eventTime,
    contactPersonAndNumber:
      contactPersonMaybe || prevForm.contactPersonAndNumber,
    contactNumber: contactNumMaybe || prevForm.contactNumber,
    package: resolvedName as unknown as BookingForm['package'],
  }

  return { patch, selectedPackageId: booking.packageid }
}

// Fetch booking + return prefill patch
export async function loadAndPrefill(params: {
  requestid: number
  packages: PackageLite[]
  token?: string | null
  prevForm: BookingForm
}): Promise<{
  booking: BookingRequest
  patch: Partial<BookingForm>
  selectedPackageId: number
}> {
  const { requestid, packages, token, prevForm } = params
  const booking = await getBookingRequestById(requestid, token)
  const { patch, selectedPackageId } = computePrefillPatch({
    booking,
    packages,
    prevForm,
  })
  return { booking, patch, selectedPackageId }
}

// Submit update using form -> payload mapping
export async function updateBookingRequest(params: {
  id: number
  updates: UpdateBookingFields
  token?: string | null
}): Promise<{ message: string; booking: BookingRequest }> {
  const { id, updates, token } = params
  const tkn = getToken(token)
  if (!tkn) throw new Error('Not authenticated')
  const res = await fetch(`${API_ROOT}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tkn}`,
    },
    body: JSON.stringify(updates),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || 'Failed to update booking')
  return {
    message: data.message || 'Booking updated',
    booking: data.booking as BookingRequest,
  }
}

export async function submitUpdate(params: {
  requestid: number
  form: BookingForm
  selectedPackageId: number | null
  token?: string | null
}) {
  const { requestid, form, selectedPackageId, token } = params
  const updates = buildUpdatePayload(form, selectedPackageId)
  return updateBookingRequest({ id: requestid, updates, token })
}
