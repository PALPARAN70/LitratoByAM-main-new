'use client'
import { useMemo, useState, useEffect } from 'react'
import { formatDisplayDate, formatDisplayTime } from '@/lib/datetime'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  listPackageItemsForPackageEmployee,
  type PackageItem,
} from '../../../../schemas/functions/EventCards/api'
import { Ellipsis } from 'lucide-react'
import {
  fetchAssignedConfirmedBookings,
  updateAssignedBookingStatus,
} from '../../../../schemas/functions/ConfirmedBookings/staff'
import type { StaffBookingStatus } from '../../../../schemas/functions/ConfirmedBookings/staff'

type EventStatus = 'ongoing' | 'standby' | 'finished'
type PaymentStatus = 'paid' | 'unpaid' | 'partially-paid'

type ItemSummary = { name: string; qty: number }
type ItemsBreakdown = { good: ItemSummary[]; damaged: ItemSummary[] }

type EventLogRow = {
  id: string
  eventName: string
  clientName: string
  location: string
  date?: string
  startTime?: string
  endTime?: string
  packageName?: string
  contactPerson?: string
  contactNumber?: string
  notes?: string
  status: EventStatus
  payment: PaymentStatus
  packageId?: number
  items: ItemsBreakdown
}

// simple pagination window like in ManageBooking master list
function pageWindow(current: number, total: number, size = 3): number[] {
  if (total <= 0) return []
  const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1
  const end = Math.min(total, start + size - 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

const summarizePackageItems = (items: PackageItem[]): ItemsBreakdown => {
  const good = new Map<string, number>()
  const damaged = new Map<string, number>()
  items.forEach((item) => {
    const label = String(item.material_name || '').trim() || 'Equipment'
    const qty = Math.max(1, Number(item.quantity) || 1)
    const condition = String(item.condition || '').toLowerCase()
    const flaggedAsDamaged =
      item.status === false ||
      condition === 'damaged' ||
      condition === 'missing' ||
      condition === 'lost'
    const bucket = flaggedAsDamaged ? damaged : good
    bucket.set(label, (bucket.get(label) || 0) + qty)
  })
  const mapToList = (m: Map<string, number>): ItemSummary[] =>
    Array.from(m.entries()).map(([name, qty]) => ({ name, qty }))
  return { good: mapToList(good), damaged: mapToList(damaged) }
}

// badge helpers (match customer dashboard look)
const statusLabel = (s: EventStatus) =>
  s === 'standby' ? 'Standby' : s === 'ongoing' ? 'Ongoing' : 'Finished'
const paymentLabel = (p: PaymentStatus) =>
  p === 'paid' ? 'Paid' : p === 'unpaid' ? 'Unpaid' : 'Partially Paid'
const statusBadgeClass = (s: EventStatus) => {
  if (s === 'ongoing') return 'bg-yellow-700 text-white'
  if (s === 'finished') return 'bg-green-700 text-white'
  return 'bg-gray-700 text-white' // standby
}
const paymentBadgeClass = (p: PaymentStatus) => {
  if (p === 'paid') return 'bg-green-700 text-white'
  if (p === 'partially-paid') return 'bg-yellow-700 text-white'
  return 'bg-red-700 text-white' // unpaid
}

export default function StaffEventLogsPage() {
  // Live data from backend: events assigned to the logged-in staff
  const [rows, setRows] = useState<EventLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mapBookingStatus = (s?: string): EventStatus => {
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
  const toBackendStatus = (s: EventStatus): StaffBookingStatus => {
    switch (s) {
      case 'ongoing':
        return 'in_progress'
      case 'finished':
        return 'completed'
      case 'standby':
      default:
        return 'scheduled'
    }
  }
  const mapPaymentStatus = (s?: string): PaymentStatus => {
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
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const bookingsRaw: unknown = await fetchAssignedConfirmedBookings()
        const bookings: unknown[] = Array.isArray(bookingsRaw)
          ? bookingsRaw
          : []
        // Exclude cancelled from logs view
        const allowed = new Set(['scheduled', 'in_progress', 'completed'])
        const mapped: EventLogRow[] = bookings
          .filter((b) => {
            const r =
              b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
            return allowed.has(String(r.booking_status || '').toLowerCase())
          })
          .map((b) => {
            const r =
              b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
            // Derive client name from firstname/lastname fallback to username
            const clientName =
              [r.firstname, r.lastname]
                .map((v) => (v == null ? '' : String(v)))
                .filter(Boolean)
                .join(' ')
                .trim() || String(r.username || '')
            // Extract phone-like number from contact_info if available
            const contactInfo = String(r.contact_info || '')
            const phoneMatch = contactInfo.match(/(\+?\d[\d\s-]{6,}\d)/)
            const contactNumber = (phoneMatch?.[1] || '').trim()
            return {
              id: String(r.id ?? r.confirmed_id ?? Math.random()),
              eventName: String(r.event_name ?? r.package_name ?? 'Event'),
              clientName,
              location: String(r.event_address || ''),
              date: String(r.event_date || ''),
              startTime: String(r.event_time || ''),
              endTime: r?.event_end_time
                ? String(r.event_end_time as unknown as string).slice(0, 5)
                : undefined,
              packageName: String(r.package_name || ''),
              packageId:
                typeof r.package_id === 'number'
                  ? (r.package_id as number)
                  : undefined,
              contactPerson: clientName,
              contactNumber: contactNumber || undefined,
              notes: '',
              status: mapBookingStatus(String(r.booking_status || '')),
              payment: mapPaymentStatus(String(r.payment_status || '')),
              items: { good: [], damaged: [] },
            }
          })
        if (active) setRows(mapped)
      } catch (e: unknown) {
        const message =
          typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message?: unknown }).message || '')
            : ''
        if (active) setError(message || 'Failed to load event logs')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  // Change status handler (staff endpoint)
  const changeStatus = async (row: EventLogRow, next: EventStatus) => {
    try {
      await updateAssignedBookingStatus(row.id, toBackendStatus(next))
      updateRow(row.id, { status: next })
    } catch (e) {
      console.error('Change status failed:', e)
      // Optional: toast error UI could be added here
    }
  }

  // Filters
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>('all')
  const [itemsFilter, setItemsFilter] = useState<'all' | 'with' | 'without'>(
    'all'
  )
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>(
    'all'
  )
  // NEW: search text
  const [search, setSearch] = useState('')

  // Pagination derived from filtered rows
  const [page, setPage] = useState(1)
  const pageSize = 5

  const filteredRows = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return rows.filter((r) => {
      const statusOk = statusFilter === 'all' ? true : r.status === statusFilter
      const itemsCount =
        r.items?.damaged?.reduce((sum, item) => {
          return sum + (typeof item.qty === 'number' ? item.qty : 1)
        }, 0) ?? 0
      const itemsOk =
        itemsFilter === 'all'
          ? true
          : itemsFilter === 'with'
          ? itemsCount > 0
          : itemsCount === 0
      const paymentOk =
        paymentFilter === 'all' ? true : r.payment === paymentFilter

      // NEW: search across key fields (AND across tokens)
      const hay = [
        r.eventName,
        r.clientName,
        r.location,
        r.date,
        r.startTime,
        r.endTime,
        r.packageName,
        r.contactPerson,
        r.contactNumber,
        r.notes,
        statusLabel(r.status),
        paymentLabel(r.payment),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const searchOk = tokens.length
        ? tokens.every((t) => hay.includes(t))
        : true

      return statusOk && itemsOk && paymentOk && searchOk
    })
  }, [rows, statusFilter, itemsFilter, paymentFilter, search])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, itemsFilter, paymentFilter, search])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const startIdx = (page - 1) * pageSize
  const pageRows = filteredRows.slice(startIdx, startIdx + pageSize)
  const windowPages = useMemo(
    () => pageWindow(page, totalPages, 3),
    [page, totalPages]
  )

  // Items modal state
  const [itemsOpen, setItemsOpen] = useState(false)
  const [itemsTarget, setItemsTarget] = useState<EventLogRow | null>(null)
  const [itemsReport, setItemsReport] = useState<ItemsBreakdown | null>(null)
  const [itemsReportLoading, setItemsReportLoading] = useState(false)
  const [itemsReportError, setItemsReportError] = useState<string | null>(null)

  // Optional: update function if you later wire PATCH to backend
  const updateRow = (id: string, patch: Partial<EventLogRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    // ...existing code... persist via API
  }

  const openItemsModal = async (row: EventLogRow) => {
    setItemsTarget(row)
    setItemsOpen(true)
    setItemsReportError(null)

    const cached = row.items
    if (cached && (cached.good.length || cached.damaged.length)) {
      setItemsReport(cached)
      return
    }
    if (!row.packageId) {
      setItemsReport(null)
      setItemsReportError('No package information available for this booking.')
      return
    }
    setItemsReport(null)
    setItemsReportLoading(true)
    try {
      const pkgItems = await listPackageItemsForPackageEmployee(row.packageId)
      const breakdown = summarizePackageItems(pkgItems)
      setItemsReport(breakdown)
      updateRow(row.id, { items: breakdown })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load items summary'
      setItemsReportError(message)
    } finally {
      setItemsReportLoading(false)
    }
  }

  const totalQty = (list?: ItemSummary[]) =>
    list?.reduce((sum, item) => sum + Number(item.qty || 0), 0) ?? 0

  return (
    <div className="p-4 flex flex-col min-h-screen w-full overflow-x-hidden">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Event Logs</h1>
      </header>

      {loading && (
        <div className="text-sm text-gray-500 mb-2">Loading events…</div>
      )}
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      <div className="p-4 bg-white rounded-xl h-123 gap-2 flex flex-col shadow relative">
        {/* Filters + Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Event Status filter */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as EventStatus | 'all')}
          >
            <SelectTrigger size="sm" className="w-[180px] rounded">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
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
            <SelectTrigger size="sm" className="w-[180px] rounded">
              <SelectValue placeholder="Items: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Items: All</SelectItem>
              <SelectItem value="with">With issues</SelectItem>
              <SelectItem value="without">No issues</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Status filter */}
          <Select
            value={paymentFilter}
            onValueChange={(v) => setPaymentFilter(v as PaymentStatus | 'all')}
          >
            <SelectTrigger size="sm" className="w-[180px] rounded">
              <SelectValue placeholder="Payment: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partially-paid">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          {/* NEW: Search input + clear */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events…"
              className="h-9 w-64 max-w-[60vw] px-3 rounded-full outline-none bg-gray-400 text-sm"
              aria-label="Search events"
            />
          </div>
        </div>

        {/* Table container (customer dashboard style) */}
        <div className="overflow-x-auto rounded-t-xl  bg-white">
          <div className="max-h-[60vh] md:max-h-72 overflow-y-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-gray-300">
                  {[
                    'Event Name',
                    'Client Name',
                    'Event Location',
                    'More Details',
                    'Event Status',
                    'Items',
                    'Payment',
                  ].map((title, i, arr) => (
                    <th
                      key={title}
                      className={`px-3 sm:px-4 py-2 text-left text-xs sm:text-sm md:text-base ${
                        i === 0 ? 'rounded-tl-xl' : ''
                      } ${i === arr.length - 1 ? 'rounded-tr-xl' : ''}`}
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr className="text-left bg-gray-50">
                    <td
                      className="px-3 sm:px-4 py-6 text-center text-sm"
                      colSpan={7}
                    >
                      No event logs found
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className="text-left bg-gray-100 even:bg-gray-50 border-t"
                    >
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        {row.eventName}
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        {row.clientName}
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        {row.location}
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="p-1 rounded hover:bg-gray-200 transition"
                              aria-label="More details"
                              title="More details"
                            >
                              <Ellipsis />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3" align="end">
                            <div className="text-sm space-y-2">
                              <div className="grid grid-cols-2 gap-x-2">
                                <div className="font-semibold">Date</div>
                                <div className="text-gray-700">
                                  {row.date ? formatDisplayDate(row.date) : '—'}
                                </div>
                                <div className="font-semibold">Time</div>
                                <div className="text-gray-700">
                                  {row.startTime
                                    ? formatDisplayTime(row.startTime)
                                    : '—'}
                                  {row.endTime
                                    ? ` - ${formatDisplayTime(row.endTime)}`
                                    : ''}
                                </div>
                                <div className="font-semibold">Package</div>
                                <div className="text-gray-700">
                                  {row.packageName || '—'}
                                </div>
                                <div className="font-semibold">Contact</div>
                                <div className="text-gray-700">
                                  {(row.contactPerson || '').trim() || '—'}
                                  {row.contactNumber
                                    ? ` | ${row.contactNumber}`
                                    : ''}
                                </div>
                              </div>
                              {row.notes ? (
                                <div>
                                  <div className="font-semibold">Notes</div>
                                  <div className="text-gray-700 whitespace-pre-wrap">
                                    {row.notes}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        <Select
                          value={row.status}
                          onValueChange={(v) =>
                            changeStatus(row, v as EventStatus)
                          }
                        >
                          <SelectTrigger
                            className={`h-7 text-xs w-32 px-3 border-0 rounded text-center  ${statusBadgeClass(
                              row.status
                            )}`}
                          >
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standby">
                              {statusLabel('standby')}
                            </SelectItem>
                            <SelectItem value="ongoing">
                              {statusLabel('ongoing')}
                            </SelectItem>
                            <SelectItem value="finished">
                              {statusLabel('finished')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        <button
                          className="px-2 py-1.5 rounded border text-sm"
                          onClick={() => {
                            void openItemsModal(row)
                          }}
                        >
                          View
                        </button>
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-1 w-22 text-center rounded-full text-xs font-medium ${paymentBadgeClass(
                            row.payment
                          )}`}
                        >
                          {paymentLabel(row.payment)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-3 py-2 absolute bottom-0 left-0 right-0">
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

      {/* Items modal (unchanged) */}
      <Dialog
        open={itemsOpen}
        onOpenChange={(o) => {
          if (!o) {
            setItemsOpen(false)
            setItemsTarget(null)
            setItemsReport(null)
            setItemsReportError(null)
            setItemsReportLoading(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Items report</DialogTitle>
            <DialogDescription>
              Equipment condition summary for this event
            </DialogDescription>
          </DialogHeader>
          {itemsReportLoading ? (
            <div className="text-sm text-gray-600">Loading items…</div>
          ) : itemsReportError ? (
            <div className="text-sm text-red-600">{itemsReportError}</div>
          ) : itemsReport ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded border p-3 bg-gray-50">
                  <div className="text-xs uppercase text-gray-500">Good</div>
                  <div className="text-2xl font-semibold text-emerald-600">
                    {totalQty(itemsReport.good)}
                  </div>
                </div>
                <div className="rounded border p-3 bg-gray-50">
                  <div className="text-xs uppercase text-gray-500">Damaged</div>
                  <div className="text-2xl font-semibold text-red-600">
                    {totalQty(itemsReport.damaged)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="font-semibold mb-2">Good</div>
                  {itemsReport.good.length ? (
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {itemsReport.good.map((it, idx) => (
                        <li key={`good-${idx}`}>
                          {it.name} × {it.qty}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-500">None</div>
                  )}
                </div>
                <div>
                  <div className="font-semibold mb-2">Damaged</div>
                  {itemsReport.damaged.length ? (
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {itemsReport.damaged.map((it, idx) => (
                        <li key={`dam-${idx}`}>
                          {it.name} × {it.qty}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-500">None</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Select an event to load its equipment list.
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              className="px-4 py-2 rounded border text-sm"
              onClick={() => {
                setItemsOpen(false)
                setItemsTarget(null)
                setItemsReport(null)
                setItemsReportError(null)
                setItemsReportLoading(false)
              }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
