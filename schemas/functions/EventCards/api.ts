// Client-side API helpers for Event Cards
// Centralizes fetch calls so UI components stay lean

export type PackageItem = {
  id?: number
  package_id?: number
  inventory_id?: number
  material_name?: string
  quantity?: number
  condition?: string
  status?: boolean
}

export type InventoryItem = {
  id: number
  material_name?: string
  condition?: string
  status?: boolean
}

function getApiBase(): string {
  const base =
    typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_API_BASE
      ? String((process as any).env.NEXT_PUBLIC_API_BASE)
      : 'http://localhost:5000'
  return base.replace(/\/$/, '')
}

function getAuthHeader(): HeadersInit {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  return token
    ? ({ Authorization: `Bearer ${token}` } as Record<string, string>)
    : ({} as Record<string, string>)
}

// List items associated to a specific package (visible only)
export async function listPackageItemsForPackage(
  packageId: number
): Promise<PackageItem[]> {
  const base = getApiBase()
  const res = await fetch(
    `${base}/api/admin/package/${encodeURIComponent(String(packageId))}/items`,
    {
      headers: getAuthHeader(),
      cache: 'no-store',
    }
  )
  if (!res.ok) throw new Error(`Failed to fetch package items: ${res.status}`)
  const data = await res.json().catch(() => ({} as any))
  return Array.isArray(data?.items) ? (data.items as PackageItem[]) : []
}

// Employee variant: list items in a package (read-only)
export async function listPackageItemsForPackageEmployee(
  packageId: number
): Promise<PackageItem[]> {
  const base = getApiBase()
  const res = await fetch(
    `${base}/api/employee/package/${encodeURIComponent(
      String(packageId)
    )}/items`,
    {
      headers: getAuthHeader(),
      cache: 'no-store',
    }
  )
  if (!res.ok) throw new Error(`Failed to fetch package items: ${res.status}`)
  const data = await res.json().catch(() => ({} as any))
  return Array.isArray(data?.items) ? (data.items as PackageItem[]) : []
}

// Employee: patch limited inventory fields (condition/status)
export async function patchInventoryEmployee(
  inventoryId: number,
  updates: Record<string, unknown>
): Promise<void> {
  const base = getApiBase()
  const res = await fetch(
    `${base}/api/employee/inventory/${encodeURIComponent(String(inventoryId))}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(updates),
    }
  )
  if (!res.ok)
    throw new Error(
      `Failed to patch inventory (employee) ${inventoryId}: ${res.status}`
    )
}

// Patch a single inventory item (condition/status, etc.)
export async function patchInventory(
  inventoryId: number,
  updates: Record<string, unknown>
): Promise<void> {
  const base = getApiBase()
  const res = await fetch(
    `${base}/api/admin/inventory/${encodeURIComponent(String(inventoryId))}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(updates),
    }
  )
  if (!res.ok)
    throw new Error(`Failed to patch inventory ${inventoryId}: ${res.status}`)
}

// List all visible inventory items (admin)
export async function listVisibleInventory(): Promise<InventoryItem[]> {
  const base = getApiBase()
  const res = await fetch(`${base}/api/admin/inventory`, {
    headers: getAuthHeader(),
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json().catch(() => ({} as any))
  const items = Array.isArray(data?.items) ? data.items : []
  return items as InventoryItem[]
}

// Payment summary for a confirmed booking (admin or employee)
export async function fetchPaymentSummaryForBooking(
  bookingId: number | string,
  role: 'admin' | 'employee'
): Promise<{
  paidTotal: number
  amountDue: number
  computedStatus: 'paid' | 'partial' | 'unpaid'
} | null> {
  const base = getApiBase()
  const path =
    role === 'employee'
      ? `/api/employee/assigned-confirmed-bookings/${encodeURIComponent(
          String(bookingId)
        )}/payment-summary`
      : `/api/admin/confirmed-bookings/${encodeURIComponent(
          String(bookingId)
        )}/payment-summary`
  const res = await fetch(`${base}${path}`, {
    headers: getAuthHeader(),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => ({}))
  const paid = Number(data?.paidTotal ?? 0)
  const due = Number(data?.amountDue ?? 0)
  const comp = String(data?.computedStatus || '').toLowerCase()
  const computedStatus =
    comp === 'paid' ? 'paid' : comp === 'partial' ? 'partial' : 'unpaid'
  return { paidTotal: paid, amountDue: due, computedStatus }
}

// --- Payments: list + create ---
export type PaymentRecord = {
  payment_id: number
  booking_id: number
  user_id: number
  amount: number
  amount_paid: number
  payment_method: string
  proof_image_url?: string | null
  reference_no?: string | null
  payment_status: string
  notes?: string | null
  verified_at?: string | null
  created_at?: string
}

// List payments tied to a booking
export async function listPaymentsForBooking(
  bookingId: number | string,
  role: 'admin' | 'employee'
): Promise<PaymentRecord[]> {
  const base = getApiBase()
  const url =
    role === 'employee'
      ? `${base}/api/employee/assigned-confirmed-bookings/${encodeURIComponent(
          String(bookingId)
        )}/payments`
      : `${base}/api/admin/payments?booking_id=${encodeURIComponent(
          String(bookingId)
        )}`
  const res = await fetch(url, { headers: getAuthHeader(), cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json().catch(() => ({} as any))
  return Array.isArray(data?.payments) ? (data.payments as PaymentRecord[]) : []
}

// Create a payment (admin currently). Intended for staff use during events (cash etc.).
export async function createPaymentForBooking(
  bookingId: number | string,
  payload: {
    amount_paid: number
    payment_method?: 'cash' | 'gcash'
    reference_no?: string | null
    notes?: string | null
    // advanced flags defaulted by server; exposed for future use
    payment_status?: string
    verified?: boolean
    proofImageUrl?: string | null
  },
  role: 'admin' | 'employee'
): Promise<PaymentRecord | null> {
  const base = getApiBase()
  const body =
    role === 'employee'
      ? {
          amount_paid: Number(payload.amount_paid),
          payment_method: payload.payment_method || 'cash',
          reference_no: payload.reference_no ?? null,
          notes: payload.notes ?? null,
          payment_status: payload.payment_status ?? 'completed',
          verified: payload.verified ?? true,
          proof_image_url: payload.proofImageUrl ?? null,
        }
      : {
          booking_id: Number(bookingId),
          amount_paid: Number(payload.amount_paid),
          payment_method: payload.payment_method || 'cash',
          reference_no: payload.reference_no ?? null,
          notes: payload.notes ?? null,
          payment_status: payload.payment_status ?? 'completed',
          verified: payload.verified ?? true,
          proof_image_url: payload.proofImageUrl ?? null,
        }
  const url =
    role === 'employee'
      ? `${base}/api/employee/assigned-confirmed-bookings/${encodeURIComponent(
          String(bookingId)
        )}/payments`
      : `${base}/api/admin/payments`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => ({} as any))
  return (data?.payment as PaymentRecord) || null
}

// Upload a payment proof image; returns a public URL
export async function uploadPaymentProofImage(
  file: File,
  role: 'admin' | 'employee',
  bookingId?: number | string
): Promise<string> {
  const base = getApiBase()
  const fd = new FormData()
  fd.append('image', file)
  const path =
    role === 'employee'
      ? `/api/employee/assigned-confirmed-bookings/${encodeURIComponent(
          String(bookingId ?? '')
        )}/payment-proof-image`
      : '/api/admin/payment-proof-image'
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: fd,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = await res.json().catch(() => ({} as any))
  if (!data?.url) throw new Error('No URL returned')
  return String(data.url)
}

// Staff logs types
export type StaffLog = {
  id?: number
  bookingid: number
  staff_userid: number
  firstname?: string
  lastname?: string
  username?: string
  is_me?: boolean
  arrived_at?: string | null
  setup_finished_at?: string | null
  started_at?: string | null
  ended_at?: string | null
  picked_up_at?: string | null
  created_at?: string
  updated_at?: string
}

// List staff logs for a booking (role-aware)
export async function listStaffLogsForBooking(
  bookingId: number | string,
  role: 'admin' | 'employee'
): Promise<StaffLog[]> {
  const base = getApiBase()
  const path =
    role === 'employee'
      ? `/api/employee/assigned-confirmed-bookings/${encodeURIComponent(
          String(bookingId)
        )}/staff-logs`
      : `/api/admin/confirmed-bookings/${encodeURIComponent(
          String(bookingId)
        )}/staff-logs`
  const res = await fetch(`${base}${path}`, {
    headers: getAuthHeader(),
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json().catch(() => ({} as any))
  return Array.isArray(data?.logs) ? (data.logs as StaffLog[]) : []
}

// Employee updates their own staff log for a booking
export async function patchMyStaffLog(
  bookingId: number | string,
  field:
    | 'arrived_at'
    | 'setup_finished_at'
    | 'started_at'
    | 'ended_at'
    | 'picked_up_at',
  value?: string | null
): Promise<StaffLog | null> {
  const base = getApiBase()
  const res = await fetch(
    `${base}/api/employee/assigned-confirmed-bookings/${encodeURIComponent(
      String(bookingId)
    )}/staff-log`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ field, value }),
    }
  )
  if (!res.ok) return null
  const data = await res.json().catch(() => ({} as any))
  return (data?.log as StaffLog) || null
}
