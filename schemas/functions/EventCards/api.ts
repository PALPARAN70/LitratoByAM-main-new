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
