'use client'

import type { BookingForm } from '../../schema/requestvalidation'

const API_ROOT =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/admin/bookingRequest'

function getToken(explicit?: string | null) {
  if (explicit) return explicit
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
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
}>

// Reuse mapping logic similar to customer update
export function buildAdminUpdatePayload(
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

  // Only primary contact number in contact_info (string)
  const contact_info = form.contactNumber ? `${form.contactNumber}` : null

  // Map selected grid names to IDs via local cache (best-effort)
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
  }
}

export async function adminUpdateBookingRequest(params: {
  id: number
  updates: UpdateBookingFields
  token?: string | null
}): Promise<{ message: string; booking: any }> {
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
  return { message: data.message || 'Booking updated', booking: data.booking }
}

export async function submitAdminUpdate(params: {
  requestid: number
  form: BookingForm
  selectedPackageId: number | null
  token?: string | null
}) {
  const { requestid, form, selectedPackageId, token } = params
  const updates = buildAdminUpdatePayload(form, selectedPackageId)
  return adminUpdateBookingRequest({ id: requestid, updates, token })
}
