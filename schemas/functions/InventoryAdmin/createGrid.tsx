// Frontend helper: create a new Grid (optionally uploading an image to Assets/Grids)
// Returns the created grid row from the API.

export type GridRow = {
  id: number
  grid_name: string
  status: boolean
  display: boolean
  image_url?: string | null
  created_at?: string
  last_updated?: string
}

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

export async function uploadGridImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('image', file) // server expects field name 'image'
  const res = await fetch(`${API_BASE}/grid-image`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
    body: fd,
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return String(data.url || '')
}

export async function createGridAdmin(params: {
  grid_name: string
  status?: boolean
  display?: boolean
  imageFile?: File | null
}): Promise<GridRow> {
  const name = String(params.grid_name || '').trim()
  if (!name) throw new Error('grid_name is required')

  let image_url = ''
  if (params.imageFile) {
    image_url = await uploadGridImage(params.imageFile)
  }

  const body = {
    grid_name: name,
    status: params.status == null ? true : !!params.status,
    display: params.display == null ? true : !!params.display,
    image_url,
  }
  const res = await fetch(`${API_BASE}/grid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  const row: GridRow = data?.grid ?? data
  return row
}

export default createGridAdmin
