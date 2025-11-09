'use client'

import type { BookingForm } from '../../schema/requestvalidation'

// Create-and-confirm a booking directly as admin.
// Backend endpoint: POST /api/admin/confirmed-bookings

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:5000'

export type AdminCreateConfirmPayload = {
  userid?: number
  email?: string // if userid is not provided
  packageid: number
  event_date: string // YYYY-MM-DD
  event_time: string // HH:mm:ss
  event_end_time?: string | null
  extension_duration?: number | null
  event_address: string
  grid?: string | null
  grid_ids?: number[]
  contact_info?: string | null
  contact_person?: string | null
  contact_person_number?: string | null
  notes?: string | null
  event_name?: string | null
  strongest_signal?: string | null
  booth_placement?: string | null
}

export async function adminCreateAndConfirm(
  payload: AdminCreateConfirmPayload,
  token?: string | null
) {
  const tkn =
    token ??
    (typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? undefined
      : undefined)
  if (!tkn) throw new Error('Not authenticated')

  const res = await fetch(`${API_BASE}/api/admin/confirmed-bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tkn}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.message || 'Failed to create and confirm booking')
  }
  return data
}

// Helpers to build payload from BookingForm
const fmtDate = (d: Date) => {
  const dd = new Date(d)
  const y = dd.getFullYear()
  const m = String(dd.getMonth() + 1).padStart(2, '0')
  const day = String(dd.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const toTimeWithSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t)

export type PackageIdResolver = (name: string) => number | undefined

export function buildAdminCreatePayload(
  form: BookingForm,
  resolvePackageId: PackageIdResolver,
  opts?: { userid?: number; email?: string }
): AdminCreateConfirmPayload {
  const packageid = resolvePackageId(form.package)
  if (!packageid) throw new Error('Package ID could not be resolved')
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
    userid: opts?.userid,
    email: opts?.email,
    packageid,
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
    contact_info: form.contactNumber || null,
    contact_person: (form as any).contactPersonName || null,
    contact_person_number: (form as any).contactPersonNumber || null,
    notes: null,
    event_name: form.eventName || null,
    strongest_signal: form.signal || null,
    booth_placement: (form as any).boothPlacement || null,
  }
}
