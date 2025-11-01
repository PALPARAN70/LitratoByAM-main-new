'use client'
import { useEffect, useMemo, useState } from 'react'

type PaymentRow = {
  payment_id: number
  amount_paid: number
  payment_status?: string
  verified_at?: string | null
  created_at?: string
  booking_id?: number
}
type BookingRow = {
  id: number
  booking_status?: string
  payment_status?: string
  event_name?: string
}

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [displayName, setDisplayName] = useState<string>('Admin')
  const [isClient, setIsClient] = useState(false)

  const API_ROOT = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000')
    .toString()
    .replace(/\/$/, '')

  useEffect(() => {
    setIsClient(true)
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('access_token')
            : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const [pRes, bRes, profRes] = await Promise.all([
          fetch(`${API_ROOT}/api/admin/payments`, { headers }),
          fetch(`${API_ROOT}/api/admin/confirmed-bookings`, { headers }),
          fetch(`${API_ROOT}/api/auth/getProfile`, { headers }),
        ])
        if (!pRes.ok) throw new Error(`payments ${pRes.status}`)
        if (!bRes.ok) throw new Error(`bookings ${bRes.status}`)
        if (!profRes.ok) throw new Error(`profile ${profRes.status}`)
        const pData = await pRes.json()
        const bData = await bRes.json()
        const profData = await profRes.json().catch(() => ({}))
        if (!mounted) return
        setPayments(Array.isArray(pData?.payments) ? pData.payments : [])
        setBookings(Array.isArray(bData?.bookings) ? bData.bookings : [])
        // Compute friendly name
        const first = (profData?.firstname || '').toString().trim()
        const last = (profData?.lastname || '').toString().trim()
        const email = (profData?.email || profData?.username || '').toString()
        let name = [first, last].filter(Boolean).join(' ').trim()
        if (!name && email) name = email.split('@')[0]
        if (name) setDisplayName(name)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Failed to load analytics')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [API_ROOT])

  // Compute metrics
  const verifiedPaid = (row: PaymentRow) => {
    const s = String(row.payment_status || '').toLowerCase()
    const ok =
      !!row.verified_at &&
      (s === 'completed' || s === 'paid' || s === 'succeeded')
    const legacy =
      row.payment_status === 'Partially Paid' ||
      row.payment_status === 'Fully Paid'
    return ok || legacy
  }

  const totalRevenue = useMemo(
    () =>
      payments
        .filter(verifiedPaid)
        .reduce((s, r) => s + Number(r.amount_paid || 0), 0),
    [payments]
  )

  const todayRevenue = useMemo(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = today.getMonth()
    const dd = today.getDate()
    return payments
      .filter(verifiedPaid)
      .filter((r) => {
        const d = r.created_at ? new Date(r.created_at) : null
        return (
          d &&
          d.getFullYear() === yyyy &&
          d.getMonth() === mm &&
          d.getDate() === dd
        )
      })
      .reduce((s, r) => s + Number(r.amount_paid || 0), 0)
  }, [payments])

  const last7Days = useMemo(() => {
    if (!isClient) return [] as { label: string; total: number }[]
    const days: { label: string; total: number }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const label = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
      days.push({ label, total: 0 })
    }
    const start = new Date()
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    payments.filter(verifiedPaid).forEach((r) => {
      const d = r.created_at ? new Date(r.created_at) : null
      if (!d || d < start) return
      const label = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
      const bucket = days.find((x) => x.label === label)
      if (bucket) bucket.total += Number(r.amount_paid || 0)
    })
    return days
  }, [payments, isClient])

  const bookingCounts = useMemo(() => {
    const map: Record<string, number> = {
      scheduled: 0,
      in_progress: 0,
      completed: 0,
    }
    bookings.forEach((b) => {
      const s = String(b.booking_status || '').toLowerCase()
      if (s in map) map[s] += 1
    })
    return map
  }, [bookings])

  const recentPayments = useMemo(() => {
    return [...payments]
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      )
      .slice(0, 10)
  }, [payments])

  const bookingById = useMemo(() => {
    const map = new Map<number, BookingRow>()
    bookings.forEach((b) => map.set(Number(b.id), b))
    return map
  }, [bookings])

  const formatStatus = (s?: string) => {
    if (!s) return '—'
    if (s.length === 0) return '—'
    // Capitalize only the first character; preserve the rest to avoid breaking phrases like 'Partially Paid'
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  const currencyParts = (value: number) => {
    const fixed = Number(value || 0).toFixed(2)
    const [i, f] = fixed.split('.')
    // use locale formatting for integer part only
    const intPart = Number(i).toLocaleString('en-PH')
    const fracPart = f || '00'
    return { intPart, fracPart }
  }
  const userName = displayName

  return (
    <div className="p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Welcome, {userName}!</h1>
        <p className="text-sm text-gray-600">
          Key metrics for bookings and payments
        </p>
      </header>

      {loading && (
        <div className="text-sm text-gray-500">Loading analytics…</div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="grid gap-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              title="Total Revenue"
              value={`₱${totalRevenue.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            />
            <Kpi
              title="Revenue Today"
              value={`₱${todayRevenue.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            />
            <Kpi
              title="Scheduled"
              value={String(bookingCounts.scheduled || 0)}
            />
            <Kpi
              title="Ongoing"
              value={String(bookingCounts.in_progress || 0)}
            />
          </div>

          {/* Last 7 days revenue (mini bars) */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-lg font-semibold mb-2">
              Revenue (Last 7 Days)
            </h2>
            <div className="flex items-end gap-2 h-32">
              {last7Days.map((d, i) => {
                const max = Math.max(1, ...last7Days.map((x) => x.total))
                const h = Math.round((d.total / max) * 100)
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center justify-end gap-1"
                  >
                    <div
                      className="w-8 bg-litratoblack/80 rounded"
                      style={{ height: `${h}%` }}
                      title={`₱${d.total.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    />
                    <div className="text-[10px] text-gray-600">{d.label}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent payments */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Recent Payments</h2>
            <div className="overflow-auto">
              <table className="w-full text-left border border-gray-200 rounded-lg overflow-hidden table-fixed">
                <colgroup>
                  <col />
                  <col />
                  <col style={{ width: '9rem' }} />
                  <col />
                </colgroup>
                <thead className="bg-gray-100">
                  <tr>
                    <Th>Date</Th>
                    <Th>Event</Th>
                    <Th className="text-left">Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((p) => {
                    const booking = bookingById.get(Number(p.booking_id || 0))
                    const eventName = booking?.event_name || '—'
                    const { intPart, fracPart } = currencyParts(
                      Number(p.amount_paid || 0)
                    )
                    return (
                      <tr key={p.payment_id} className="border-t">
                        <Td>
                          {p.created_at && isClient
                            ? new Date(p.created_at).toLocaleString()
                            : '—'}
                        </Td>
                        <Td className="truncate whitespace-nowrap">
                          <span title={eventName}>{eventName}</span>
                        </Td>
                        <Td className="text-left">
                          <span className="inline-flex w-full justify-start items-baseline">
                            <span className="text-gray-700">₱</span>
                            <span className="ml-1 font-mono tabular-nums">
                              {intPart}
                            </span>
                            <span className="font-mono tabular-nums">
                              .{fracPart}
                            </span>
                          </span>
                        </Td>
                        <Td>{formatStatus(p.payment_status)}</Td>
                      </tr>
                    )
                  })}
                  {recentPayments.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-6 text-gray-500"
                      >
                        No payments yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th className={`px-3 py-2 text-sm font-semibold ${className}`}>
      {children}
    </th>
  )
}
function Td({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={`px-3 py-2 text-sm ${className}`}>{children}</td>
}
