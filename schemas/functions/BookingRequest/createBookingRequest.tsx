'use client'

import type { BookingForm } from '../../schema/requestvalidation'

type CreateBookingInput = {
  form: BookingForm
  token?: string
  packageid?: number // optional if you pass a packageName that maps below
  packageName?: string // e.g., "The Hanz"
  endpoint?: string // override if your route differs
}

type CreateBookingPayload = {
  packageid: number
  event_date: string // YYYY-MM-DD
  event_time: string // HH:mm:ss
  event_end_time?: string | null // HH:mm:ss
  extension_duration?: number | null
  event_address: string
  grid?: string | null
  contact_info?: string | null
  notes?: string | null
  event_name?: string | null
  strongest_signal?: string | null
}

type CreateBookingResponse = {
  message: string
  booking?: any
  conflicts?: number[]
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:5000'

// TODO: Replace with your real package IDs or fetch from backend.
const PACKAGE_NAME_TO_ID: Record<string, number> = {
  'The Hanz': 1,
  'The Corrupt': 2,
  'The AI': 3,
  'The OG': 4,
}

const fmtDate = (d: Date) => {
  try {
    return new Date(d).toISOString().substring(0, 10)
  } catch {
    return ''
  }
}

const toTimeWithSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t)

const buildContactInfo = (form: BookingForm) => {
  const parts = []
  if (form.contactNumber) parts.push(`Primary: ${form.contactNumber}`)
  if (form.contactPersonAndNumber)
    parts.push(`Contact Person: ${form.contactPersonAndNumber}`)
  return parts.length ? parts.join(' | ') : null
}

const buildNotes = (form: BookingForm) => {
  const lines = [
    form.eventName ? `Event: ${form.eventName}` : '',
    form.package ? `Package: ${form.package}` : '',
    form.extensionHours ? `Extension Hours: ${form.extensionHours}` : '',
    form.boothPlacement ? `Placement: ${form.boothPlacement}` : '',
    form.signal ? `Signal: ${form.signal}` : '',
    form.selectedGrids?.length ? `Grids: ${form.selectedGrids.join(', ')}` : '',
    form.facebook ? `Facebook: ${form.facebook}` : '',
    form.completeName ? `Complete Name: ${form.completeName}` : '',
    form.email ? `Email: ${form.email}` : '',
  ].filter(Boolean)
  return lines.length ? lines.join('\n') : null
}

export async function createBookingRequest({
  form,
  token,
  packageid,
  packageName,
  endpoint,
}: CreateBookingInput): Promise<CreateBookingResponse> {
  const authToken =
    token ??
    (typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? undefined
      : undefined)

  if (!authToken) {
    throw new Error('Not authenticated. Please login again.')
  }

  const resolvedPackageId =
    packageid ?? (packageName ? PACKAGE_NAME_TO_ID[packageName] : undefined)

  if (!resolvedPackageId) {
    throw new Error('Package ID is required (mapping missing or invalid).')
  }

  const payload: CreateBookingPayload = {
    packageid: resolvedPackageId,
    event_date: fmtDate(form.eventDate),
    event_time: toTimeWithSeconds(form.eventTime),
    event_end_time: toTimeWithSeconds(form.eventEndTime),
    extension_duration:
      typeof form.extensionHours === 'number'
        ? form.extensionHours
        : Number.isFinite(Number(form.extensionHours))
        ? Number(form.extensionHours)
        : 0,
    event_address: form.eventLocation,
    grid:
      Array.isArray(form.selectedGrids) && form.selectedGrids.length
        ? form.selectedGrids.join(',')
        : null,
    contact_info: buildContactInfo(form),
    notes: buildNotes(form),
    event_name: form.eventName || null,
    strongest_signal: form.signal || null,
  }

  // Match backend route: backend/src/Routes/customerRoutes.js => POST /api/customer/booking
  const url = endpoint ?? `${API_BASE}/api/customer/bookingRequest`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  })

  if (res.status === 401) {
    throw new Error('Unauthorized. Please login again.')
  }
  if (res.status === 409) {
    const data = (await res.json()) as CreateBookingResponse
    const detail = data?.message || 'Selected date/time is no longer available.'
    const ids = data?.conflicts?.length
      ? ` Conflicts: ${data.conflicts.join(', ')}`
      : ''
    throw new Error(`${detail}${ids}`)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Failed to create booking.')
  }

  const data = (await res.json()) as CreateBookingResponse
  return data
}
