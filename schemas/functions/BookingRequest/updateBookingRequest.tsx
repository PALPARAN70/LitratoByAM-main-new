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
  // Both legacy camelCase and new snake_case may appear from API
  eventdate?: string
  eventtime?: string
  eventaddress?: string
  event_date?: string
  event_time?: string
  event_address?: string
  event_name?: string | null
  strongest_signal?: string | null
  contact_info: string | null
  contact_person?: string | null
  contact_person_number?: string | null
  grid?: string | null
  grid_ids?: number[] | null
  grid_names?: string[] | null
  notes: string | null
  status: BookingStatus
  last_updated?: string
  package_name?: string // make sure backend returns this (join with packages)
  // Optional user fields from JOIN
  username?: string | null
  firstname?: string | null
  lastname?: string | null
  contact?: string | null
}

export type UpdateBookingFields = Partial<{
  packageid: number
  event_date: string
  event_time: string
  event_end_time?: string | null
  extension_duration?: number | null
  event_address: string
  grid?: string | null
  grid_ids?: number[]
  event_name?: string | null
  strongest_signal?: string | null
  contact_info?: string | null
  contact_person?: string | null
  contact_person_number?: string | null
  notes?: string | null
  booth_placement?: string | null
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
  const toTimeWithSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t)
  const fmtDate = (d: Date) => {
    const dt = new Date(d)
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Keep contact_info consistent with creation
  const contact_info = form.contactNumber ? `${form.contactNumber}` : null

  // Map selected grid names to IDs via a cached list if present
  let gridIds: number[] | undefined
  try {
    const cached = localStorage.getItem('public_grids_cache')
    if (cached) {
      const list: Array<{ id: number; grid_name: string }> = JSON.parse(cached)
      const picked = (form.selectedGrids || []) as string[]
      gridIds = picked
        .map((name) => list.find((g) => g.grid_name === name)?.id)
        .filter((v): v is number => typeof v === 'number')
        .slice(0, 2)
    }
  } catch {}

  return {
    packageid: selectedPackageId ?? undefined,
    event_date: fmtDate(form.eventDate),
    event_time: toTimeWithSeconds(form.eventTime),
    event_end_time: toTimeWithSeconds(form.eventEndTime),
    extension_duration:
      typeof form.extensionHours === 'number'
        ? form.extensionHours
        : Number(form.extensionHours) || 0,
    event_address: form.eventLocation,
    grid:
      Array.isArray(form.selectedGrids) && form.selectedGrids.length
        ? form.selectedGrids.join(',')
        : null,
    grid_ids: gridIds && gridIds.length ? gridIds : undefined,
    event_name: form.eventName || null,
    strongest_signal: form.signal || null,
    contact_info,
    contact_person: form.contactPersonName || null,
    contact_person_number: form.contactPersonNumber || null,
    notes: null,
    booth_placement: form.boothPlacement || null,
  }
}

// Compute a BookingForm patch from a BookingRequest (prefill)
export function computePrefillPatch(params: {
  booking: BookingRequest
  packages: { id: number; package_name: string }[]
  prevForm: BookingForm
}): { patch: Partial<BookingForm>; selectedPackageId: number } {
  const { booking, packages, prevForm } = params
  // Helper: pick first defined value from possible keys
  const pick = <T = any,>(...keys: (keyof BookingRequest | string)[]) => {
    for (const k of keys) {
      const v = (booking as any)[k]
      if (v !== undefined && v !== null && v !== '') return v as T
    }
    return undefined as unknown as T
  }
  // Normalize HH:mm from possible HH:mm:ss
  const toHHmm = (t?: string) =>
    t ? (t.length >= 5 ? t.slice(0, 5) : t) : undefined

  // Resolve package display name (fallback to previous form value)
  const resolvedName =
    booking.package_name ||
    packages.find((p) => p.id === booking.packageid)?.package_name ||
    prevForm.package

  // Contact info parsing per requirements:
  // - contactNumber: only the number after "Primary:"
  // - contactPersonAndNumber: the content after the first "|" (if any)
  const contactInfoRaw = (pick<string>('contact_info') || '').toString()
  const ciParts = contactInfoRaw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)

  let contactNumberFromDb: string | undefined
  let contactPersonAndNumberFromDb: string | undefined
  let contactPersonNameFromDb: string | undefined
  let contactPersonNumberFromDb: string | undefined

  if (ciParts.length) {
    const first = ciParts[0]
    const mPrimary = first.match(/^Primary\s*:\s*(.+)$/i)
    if (mPrimary) {
      const rawNum = mPrimary[1].trim()
      // Keep leading + and digits; strip spaces, dashes, parentheses
      const mNum = rawNum.match(/\+?\d[\d\s\-()]*/)
      contactNumberFromDb = mNum ? mNum[0].replace(/[\s\-()]/g, '') : rawNum
    } else {
      // Fallback: try to extract a number-like token
      const mNum = first.match(/\+?\d[\d\s\-()]*/)
      if (mNum) contactNumberFromDb = mNum[0].replace(/[\s\-()]/g, '')
    }
    if (ciParts.length > 1) {
      const tail = ciParts.slice(1).join(' | ').trim()
      // Remove any leading label to prevent duplication when rebuilding
      contactPersonAndNumberFromDb = tail
        .replace(/^Contact\s*Person\s*:\s*/i, '')
        .trim()
      // Attempt to split name and number if present in legacy combined value (e.g., "Name | +63917...")
      const parts = contactPersonAndNumberFromDb.split('|').map((s) => s.trim())
      if (parts.length >= 2) {
        contactPersonNameFromDb = parts[0]
        const mNum2 = parts[1].match(/\+?\d[\d\s\-()]*/)
        contactPersonNumberFromDb = mNum2
          ? mNum2[0].replace(/[\s\-()]/g, '')
          : parts[1]
      }
    }
  }

  // Prefer explicit contact person fields from DB if provided
  if (!contactPersonNameFromDb && (booking as any).contact_person) {
    contactPersonNameFromDb = String((booking as any).contact_person)
  }
  if (!contactPersonNumberFromDb && (booking as any).contact_person_number) {
    const raw = String((booking as any).contact_person_number)
    const m = raw.match(/\+?\d[\d\s\-()]*/)
    contactPersonNumberFromDb = m ? m[0].replace(/[\s\-()]/g, '') : raw
  }

  // Compose full name from DB if available
  const fullNameFromDb = [pick('firstname'), pick('lastname')]
    .filter(Boolean)
    .join(' ')
    .trim()

  // Email best-effort (username is often email in this app)
  const emailFromDb = pick('email', 'user_email', 'username') as
    | string
    | undefined

  const eventDateStr = pick<string>('eventdate', 'event_date')
  const eventTimeStr = pick<string>('eventtime', 'event_time')
  const addressStr = pick<string>('eventaddress', 'event_address')
  const eventNameStr = pick<string>('event_name', 'eventname')
  const signalStr = pick<string>('strongest_signal', 'signal')
  const gridNamesArr = (booking as any).grid_names as string[] | undefined
  const gridStr = pick<string>('grid')

  // Prefer normalized names array from backend; fallback to splitting legacy snapshot
  const selectedGridNames: string[] | undefined = Array.isArray(gridNamesArr)
    ? gridNamesArr.slice(0, 2)
    : typeof gridStr === 'string' && gridStr.trim().length
    ? gridStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 2)
    : undefined

  const patch: Partial<BookingForm> = {
    // Explicitly requested fields:
    email: emailFromDb || prevForm.email,
    completeName: fullNameFromDb || prevForm.completeName,
    // contact_info mapped per requirements
    contactNumber: contactNumberFromDb || prevForm.contactNumber,
    contactPersonAndNumber:
      contactPersonAndNumberFromDb || prevForm.contactPersonAndNumber,
    // New split fields when available
    contactPersonName: contactPersonNameFromDb || prevForm.contactPersonName,
    contactPersonNumber:
      contactPersonNumberFromDb || prevForm.contactPersonNumber,
    eventName: eventNameStr || prevForm.eventName,
    eventLocation: addressStr || prevForm.eventLocation,
    signal: signalStr || prevForm.signal,
    // Chosen package: keep enum-safe if possible
    package: (resolvedName || prevForm.package) as BookingForm['package'],
    eventDate: eventDateStr ? new Date(eventDateStr) : prevForm.eventDate,
    eventTime: toHHmm(eventTimeStr) || prevForm.eventTime,
    // Prefill selected grids by name (matches UI expectation)
    selectedGrids: selectedGridNames ?? prevForm.selectedGrids,
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
