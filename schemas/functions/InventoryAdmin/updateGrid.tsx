import type { GridRow } from './createGrid'
import { uploadGridImage } from './createGrid'

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

export async function updateGridAdmin(
  id: number,
  changes: {
    grid_name?: string
    status?: boolean
    display?: boolean
    imageFile?: File | null
    image_url?: string | null
  }
): Promise<GridRow> {
  const body: Record<string, any> = {}
  if (changes.grid_name !== undefined)
    body.grid_name = String(changes.grid_name).trim()
  if (changes.status !== undefined) body.status = !!changes.status
  if (changes.display !== undefined) body.display = !!changes.display

  let finalImageUrl = changes.image_url ?? undefined
  if (changes.imageFile) {
    finalImageUrl = await uploadGridImage(changes.imageFile)
  }
  if (finalImageUrl !== undefined) body.image_url = finalImageUrl || ''

  if (Object.keys(body).length === 0) {
    throw new Error('No changes provided')
  }

  const res = await fetch(`${API_BASE}/grid/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data?.grid ?? data
}

export default updateGridAdmin
