import type { GridRow } from './createGrid'

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
const API_BASE = `${API_ORIGIN}/api/admin`

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  return (
    document.cookie
      .split('; ')
      .find((r) => r.startsWith(name + '='))
      ?.split('=')[1] || ''
  )
}

function getAuthHeaderString() {
  const raw =
    (typeof window !== 'undefined' && localStorage.getItem('access_token')) ||
    getCookie('access_token')
  if (!raw) return ''
  return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`
}

function getAuthHeaders(): Record<string, string> {
  const auth = getAuthHeaderString()
  return auth ? { Authorization: auth } : {}
}

// Archive (display=false)
export async function archiveGrid(id: number): Promise<GridRow> {
  const res = await fetch(`${API_BASE}/grid/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ display: false }),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data?.grid ?? data
}

// Unarchive (display=true)
export async function unarchiveGrid(id: number): Promise<GridRow> {
  const res = await fetch(`${API_BASE}/grid/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ display: true }),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data?.grid ?? data
}

export default archiveGrid
