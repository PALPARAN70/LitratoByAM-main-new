// Shared date/time formatting helpers for UI

export function parseDateLike(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function formatDisplayDate(
  value: unknown,
  opts?: { long?: boolean }
): string {
  const d = parseDateLike(value)
  if (!d) return typeof value === 'string' ? value : '—'
  return new Intl.DateTimeFormat('en-PH', {
    month: opts?.long ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export function formatDisplayTime(value: unknown): string {
  if (typeof value === 'string') {
    const m = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    if (m) {
      let hh = Math.max(0, Math.min(23, parseInt(m[1], 10)))
      const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)))
      const ampm = hh >= 12 ? 'PM' : 'AM'
      hh = hh % 12
      if (hh === 0) hh = 12
      return `${hh}:${mm.toString().padStart(2, '0')} ${ampm}`
    }
  }
  const d = parseDateLike(value)
  if (!d) return typeof value === 'string' ? value : '—'
  return new Intl.DateTimeFormat('en-PH', { timeStyle: 'short' }).format(d)
}

export function formatDisplayDateTime(
  value: unknown,
  opts?: { long?: boolean }
): string {
  const d = parseDateLike(value)
  if (!d) return typeof value === 'string' ? value : '—'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: opts?.long ? 'long' : 'medium',
    timeStyle: 'short',
  }).format(d)
}
