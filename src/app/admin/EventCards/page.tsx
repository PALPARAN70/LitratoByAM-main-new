'use client'
import { useMemo, useState, useEffect } from 'react'
import EventCard from '../../../../Litratocomponents/EventCard'
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Keep types aligned with staff dashboard
type Status = 'ongoing' | 'standby' | 'finished'
type Payment = 'unpaid' | 'partially-paid' | 'paid'
type Item = { name: string; qty?: number }

type AdminEvent = {
  title: string
  dateTime: string
  location: string
  status: Status
  payment: Payment
  imageUrl?: string
  damagedItems?: Item[]
  missingItems?: Item[]
}

function pageWindow(current: number, total: number, size = 3): number[] {
  if (total <= 0) return []
  const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1
  const end = Math.min(total, start + size - 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default function AdminEventCardsPage() {
  // Derived from backend confirmed bookings
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const API_BASE =
    (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
      'http://localhost:5000') + '/api/admin/confirmed-bookings'

  // helpers to map backend -> UI
  const mapBookingStatus = (s?: string): Status => {
    switch ((s || '').toLowerCase()) {
      case 'in_progress':
        return 'ongoing'
      case 'completed':
      case 'cancelled':
        return 'finished'
      case 'scheduled':
      default:
        return 'standby'
    }
  }
  const mapPaymentStatus = (s?: string): Payment => {
    switch ((s || '').toLowerCase()) {
      case 'paid':
        return 'paid'
      case 'partial':
        return 'partially-paid'
      case 'unpaid':
      case 'refunded':
      case 'failed':
      default:
        return 'unpaid'
    }
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token = localStorage.getItem('access_token')
        const res = await fetch(API_BASE, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error(`Failed: ${res.status}`)
        const data = await res.json()
        const bookings = Array.isArray(data?.bookings) ? data.bookings : []
        // Only include scheduled, in_progress, completed
        const allowed = new Set(['scheduled', 'in_progress', 'completed'])
        const mapped: AdminEvent[] = bookings
          .filter((b: any) =>
            allowed.has(String(b?.booking_status || '').toLowerCase())
          )
          .map((b: any) => {
            const title = b.event_name || b.package_name || 'Event'
            const date = b.event_date || ''
            const time = b.event_time || ''
            const dateTime = [date, time].filter(Boolean).join(' - ')
            const location = b.event_address || ''
            return {
              title,
              dateTime,
              location,
              status: mapBookingStatus(b.booking_status),
              payment: mapPaymentStatus(b.payment_status),
              imageUrl: undefined,
              damagedItems: [],
              missingItems: [],
            }
          })
        if (mounted) setEvents(mapped)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load events')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  // Filters + search
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [itemsFilter, setItemsFilter] = useState<'all' | 'with' | 'without'>(
    'all'
  )
  const [paymentFilter, setPaymentFilter] = useState<Payment | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setPage(1)
  }, [statusFilter, itemsFilter, paymentFilter, search])

  const filteredEvents = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return events.filter((e) => {
      const statusOk = statusFilter === 'all' ? true : e.status === statusFilter
      const issues =
        (e.damagedItems?.length || 0) + (e.missingItems?.length || 0)
      const itemsOk =
        itemsFilter === 'all'
          ? true
          : itemsFilter === 'with'
          ? issues > 0
          : issues === 0
      const paymentOk =
        paymentFilter === 'all' ? true : e.payment === paymentFilter
      const hay = `${e.title} ${e.location} ${e.dateTime}`.toLowerCase()
      const searchOk = tokens.length
        ? tokens.every((t) => hay.includes(t))
        : true
      return statusOk && itemsOk && paymentOk && searchOk
    })
  }, [events, statusFilter, itemsFilter, paymentFilter, search])

  // Pagination
  const PER_PAGE = 5
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PER_PAGE))
  const windowPages = pageWindow(page, totalPages, 3)

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages, filteredEvents.length])

  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE
    return filteredEvents.slice(start, start + PER_PAGE)
  }, [filteredEvents, page])

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold">
            Event cards
          </h1>
          <div className="p-4 bg-white shadow rounded-xl gap-2 flex flex-col">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as Status | 'all')}
              >
                <SelectTrigger className="w-[180px] rounded h-9 focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0">
                  <SelectValue placeholder="Status: All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Statuses: All</SelectItem>
                  <SelectItem value="standby">Standby</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="finished">Finished</SelectItem>
                </SelectContent>
              </Select>

              {/* Items filter */}
              <Select
                value={itemsFilter}
                onValueChange={(v) =>
                  setItemsFilter((v as 'all' | 'with' | 'without') ?? 'all')
                }
              >
                <SelectTrigger className="w-[180px] rounded h-9 focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0">
                  <SelectValue placeholder="Items: All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Items: All</SelectItem>
                  <SelectItem value="with">With issues</SelectItem>
                  <SelectItem value="without">No issues</SelectItem>
                </SelectContent>
              </Select>

              {/* Payment filter */}
              <Select
                value={paymentFilter}
                onValueChange={(v) => setPaymentFilter(v as Payment | 'all')}
              >
                <SelectTrigger className="w-[200px] rounded h-9 focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0">
                  <SelectValue placeholder="Payment: All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Payments: All</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partially-paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>

              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events…"
                className="h-9 w-64 max-w-[60vw] px-3 rounded-full outline-none bg-gray-400 text-sm"
                aria-label="Search events"
              />
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {paginated.map((ev, idx) => (
                <EventCard
                  key={`${ev.title}-${idx}`}
                  title={ev.title}
                  dateTime={ev.dateTime}
                  location={ev.location}
                  status={ev.status}
                  imageUrl={ev.imageUrl}
                  damagedItems={ev.damagedItems}
                  missingItems={ev.missingItems}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-2">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      className="text-black no-underline hover:no-underline hover:text-black"
                      style={{ textDecoration: 'none' }}
                      onClick={(e) => {
                        e.preventDefault()
                        setPage((p) => Math.max(1, p - 1))
                      }}
                    />
                  </PaginationItem>

                  {windowPages.map((n) => (
                    <PaginationItem key={n}>
                      <PaginationLink
                        href="#"
                        isActive={n === page}
                        className="text-black no-underline hover:no-underline hover:text-black"
                        style={{ textDecoration: 'none' }}
                        onClick={(e) => {
                          e.preventDefault()
                          setPage(n)
                        }}
                      >
                        {n}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      className="text-black no-underline hover:no-underline hover:text-black"
                      style={{ textDecoration: 'none' }}
                      onClick={(e) => {
                        e.preventDefault()
                        setPage((p) => Math.min(totalPages, p + 1))
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
