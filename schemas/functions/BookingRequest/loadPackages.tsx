'use client'

export type PackageDto = {
  id: number
  package_name: string
  description: string | null
  price: number
  duration_hours?: number | null
  status: boolean
  display: boolean
  image_url: string | null
  created_at?: string
  last_updated?: string
}

type LoadPackagesOptions = {
  endpoint?: string // override API URL if needed
  token?: string // optional if your endpoint is protected
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:5000'

// Returns only public (display=true) packages
export async function loadPackages(
  opts: LoadPackagesOptions = {}
): Promise<PackageDto[]> {
  const url = opts.endpoint ?? `${API_BASE}/api/auth/packages` // changed

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token =
    opts.token ??
    (typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? undefined
      : undefined)
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(txt || 'Failed to load packages')
  }
  const data = (await res.json()) as PackageDto[]
  return Array.isArray(data) ? data : []
}
