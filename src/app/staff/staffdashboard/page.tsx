'use client'
import { useMemo, useState, useEffect } from 'react'
import EventCard from '../../../../Litratocomponents/EventCard'
import { formatDisplayDateTime } from '@/lib/datetime'
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
// REMOVE unused card imports and icon
// import { Card, CardHeader, CardContent } from "@/components/ui/card";
// import { HiOutlineExternalLink } from "react-icons/hi";
// ADD: select for filters
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Status = 'ongoing' | 'standby' | 'finished'
// CHANGED: include 'paid' for filter consistency
type Payment = 'unpaid' | 'partially-paid' | 'paid'
type Item = { name: string; qty?: number }
type StaffEvent = {
  id: string | number
  title: string
  dateTime: string
  dateDisplay?: string
  location: string
  status: Status
  payment: Payment
  // enrich details
  accountName?: string
  packageName?: string
  packageId?: number
  basePrice?: number
  extensionHours?: number
  totalPrice?: number
  strongestSignal?: string
  contactInfo?: string
  contactPerson?: string
  contactPersonNumber?: string
  grid?: string
  imageUrl?: string
  damagedItems?: Item[]
}

// shared 3-page window helper
function pageWindow(current: number, total: number, size = 3): number[] {
  if (total <= 0) return []
  const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1
  const end = Math.min(total, start + size - 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default function DashboardPage() {
  // Load only events assigned to the logged-in staff
  const [events, setEvents] = useState<StaffEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const API_BASE =
    (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
      'http://localhost:5000') + '/api/employee/assigned-confirmed-bookings'

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
        const data: unknown = await res.json()
        const bookings: unknown[] =
          data &&
          typeof data === 'object' &&
          Array.isArray((data as Record<string, unknown>).bookings)
            ? ((data as Record<string, unknown>).bookings as unknown[])
            : []
        // Only include scheduled, in_progress, completed
        const allowed = new Set(['scheduled', 'in_progress', 'completed'])
        const mapped: StaffEvent[] = bookings
          .filter((b) => {
            const r =
              b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
            return allowed.has(String(r.booking_status || '').toLowerCase())
          })
          .map((b) => {
            const r =
              b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
            const title = (r.event_name || r.package_name || 'Event') as string
            const date = String(r.event_date || '')
            const time = String(r.event_time || '')
            const normalizedTime = (() => {
              if (!time) return ''
              const match = time.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
              if (!match) return ''
              const hh = match[1].padStart(2, '0')
              const mm = match[2].padStart(2, '0')
              const ss = (match[3] ?? '00').padStart(2, '0')
              return `${hh}:${mm}:${ss}`
            })()
            const isoDateTime =
              date && normalizedTime ? `${date}T${normalizedTime}` : date || ''
            const dateTime = isoDateTime
            const location = String(r.event_address || '')
            const idRaw = (r.id as unknown) ?? (r.confirmed_id as unknown) ?? ''
            const id: string | number =
              typeof idRaw === 'number' || typeof idRaw === 'string'
                ? idRaw
                : String(idRaw ?? '')
            // pricing and extras: coerce strings/numbers to Number
            const baseCandidate =
              (r['total_booking_price'] as unknown) ??
              (r['package_price'] as unknown) ??
              (r['price'] as unknown) ??
              0
            const basePrice = Number(baseCandidate || 0)
            const extHoursNum = Number(
              (r['extension_duration'] as unknown) ?? 0
            )
            const extensionHours = Number.isFinite(extHoursNum)
              ? Math.max(0, extHoursNum)
              : 0
            const totalPrice = basePrice + extensionHours * 2000
            const accountName =
              [r['firstname'], r['lastname']]
                .filter(Boolean)
                .join(' ')
                .trim() || String(r['username'] || '')
            const packageId =
              typeof r['package_id'] === 'number'
                ? (r['package_id'] as number)
                : undefined
            return {
              id,
              title,
              dateTime,
              location,
              status: mapBookingStatus(String(r.booking_status || '')),
              payment: mapPaymentStatus(String(r.payment_status || '')),
              accountName,
              packageName: String(r['package_name'] || ''),
              packageId,
              basePrice,
              extensionHours,
              totalPrice,
              strongestSignal: String(r['strongest_signal'] || ''),
              contactInfo: String(r['contact_info'] || ''),
              contactPerson: String(r['contact_person'] || ''),
              contactPersonNumber: String(r['contact_person_number'] || ''),
              grid: String(r['grid'] || ''),
              // expose formatted date string for search convenience
              dateDisplay: isoDateTime
                ? formatDisplayDateTime(isoDateTime)
                : '',
              imageUrl: undefined,
              damagedItems: [],
            }
          })
        if (mounted) setEvents(mapped)
      } catch (e: unknown) {
        const message =
          typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message?: unknown }).message || '')
            : ''
        if (mounted) setError(message || 'Failed to load events')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [API_BASE])

  // REPLACED: standalone status-only filter with 3 filters + search
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [itemsFilter, setItemsFilter] = useState<'all' | 'with' | 'without'>(
    'all'
  )
  const [paymentFilter, setPaymentFilter] = useState<Payment | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setPage(1)
  }, [statusFilter, itemsFilter, paymentFilter, search])

  // CHANGED: combine all filters + search
  const filteredEvents = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return events.filter((e) => {
      const statusOk = statusFilter === 'all' ? true : e.status === statusFilter
      const issues = e.damagedItems?.length || 0
      const itemsOk =
        itemsFilter === 'all'
          ? true
          : itemsFilter === 'with'
          ? issues > 0
          : issues === 0
      const paymentOk =
        paymentFilter === 'all' ? true : e.payment === paymentFilter
      const hay = `${e.title} ${e.location} ${
        e.dateDisplay || e.dateTime
      }`.toLowerCase()
      const searchOk = tokens.length
        ? tokens.every((t) => hay.includes(t))
        : true
      return statusOk && itemsOk && paymentOk && searchOk
    })
  }, [events, statusFilter, itemsFilter, paymentFilter, search])

  // CHANGED: pagination uses filtered list
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
            Hello Staff
          </h1>
          {loading && (
            <div className="text-sm text-gray-500">Loading events…</div>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="p-4 bg-white shadow rounded-xl gap-2 flex flex-col">
            {/* NEW: Filters toolbar (replaces status cards) */}
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

            {/* cards grid (unchanged) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {paginated.map((ev, idx) => (
                <EventCard
                  key={`${ev.title}-${idx}`}
                  bookingId={ev.id}
                  summaryRole="employee"
                  accountName={ev.accountName}
                  title={ev.title}
                  packageName={ev.packageName}
                  packageId={ev.packageId}
                  dateTime={ev.dateTime}
                  location={ev.location}
                  status={ev.status}
                  payment={ev.payment}
                  basePrice={ev.basePrice}
                  extensionHours={ev.extensionHours}
                  totalPrice={ev.totalPrice}
                  imageUrl={ev.imageUrl}
                  damagedItems={ev.damagedItems}
                  strongestSignal={ev.strongestSignal}
                  contactInfo={ev.contactInfo}
                  contactPerson={ev.contactPerson}
                  contactPersonNumber={ev.contactPersonNumber}
                  grid={ev.grid}
                />
              ))}
            </div>

            {/* pagination (unchanged) */}
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
