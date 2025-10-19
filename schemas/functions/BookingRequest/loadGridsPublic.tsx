'use client'

export type PublicGrid = {
  id: number
  grid_name: string
  status?: boolean
  display?: boolean
  image_url?: string | null
}

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/auth/grids'

export async function loadGridsPublic(): Promise<PublicGrid[]> {
  const res = await fetch(API_BASE, { cache: 'no-store' })
  if (!res.ok) {
    try {
      const text = await res.text()
      throw new Error(text || `Failed to load grids (${res.status})`)
    } catch {
      throw new Error(`Failed to load grids (${res.status})`)
    }
  }
  const data = await res.json()
  // Expect rows from backend gridModel.getAllGrids()
  return Array.isArray(data) ? data : []
}

export default loadGridsPublic
