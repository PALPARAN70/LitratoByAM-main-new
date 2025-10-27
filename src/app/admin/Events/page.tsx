'use client'
import { useMemo, useState, useEffect } from 'react'
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
import { Ellipsis } from 'lucide-react'
import {
  fetchAdminConfirmedBookings,
  updateAdminBookingStatus,
  preflightAdminExtensionConflicts,
  setAdminExtensionDuration,
} from '../../../../schemas/functions/ConfirmedBookings/admin'
import type { AdminBookingStatus } from '../../../../schemas/functions/ConfirmedBookings/admin'

// Reuse the same types as staff event logs for now
type EventStatus = 'ongoing' | 'standby' | 'finished'
type PaymentStatus = 'paid' | 'unpaid' | 'partially-paid'

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
  items: {
    damaged: Array<{ name: string; qty?: number }>
    missing: Array<{ name: string; qty?: number }>
  }
}

// simple pagination window
function pageWindow(current: number, total: number, size = 3): number[] {
  if (total <= 0) return []
  const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1
  const end = Math.min(total, start + size - 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

// badges helpers
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

export default function AdminEventsPage() {
  // Live data derived from admin confirmed bookings
  const [rows, setRows] = useState<EventLogRow[]>([])
  // UI state for extension
  const [extendOpen, setExtendOpen] = useState(false)
  const [extendTargetId, setExtendTargetId] = useState<string | null>(null)
  const [extendHours, setExtendHours] = useState<string>('1')
  const [extendBusy, setExtendBusy] = useState(false)
  const [extendConflict, setExtendConflict] = useState<null | {
    requestid: number
    event_date: string
    event_time: string
  }>(null)
  // removed unused loading/error state

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
  const toBackendStatus = (s: EventStatus): AdminBookingStatus => {
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
    type AdminBooking = {
      id?: string | number
      confirmed_id?: string | number
      booking_status?: string
      firstname?: string
      lastname?: string
      username?: string
      contact_info?: string
      event_name?: string
      package_name?: string
      event_address?: string
      event_date?: string
      event_time?: string
      event_end_time?: string
      payment_status?: string
    }
    async function load() {
      try {
        const bookings = (await fetchAdminConfirmedBookings()) as AdminBooking[]
        // Exclude cancelled for Events view
        const allowed = new Set(['scheduled', 'in_progress', 'completed'])
        const mapped: EventLogRow[] = bookings
          .filter((b) =>
            allowed.has(String(b?.booking_status || '').toLowerCase())
          )
          .map((b) => {
            const clientName =
              [b?.firstname, b?.lastname].filter(Boolean).join(' ').trim() ||
              String(b?.username || '')
            const contactInfo = String(b?.contact_info || '')
            const phoneMatch = contactInfo.match(/(\+?\d[\d\s-]{6,}\d)/)
            const contactNumber = (phoneMatch?.[1] || '').trim()
            return {
              id: String(b?.id || b?.confirmed_id || Math.random()),
              eventName: String(b?.event_name || b?.package_name || 'Event'),
              clientName,
              location: String(b?.event_address || ''),
              date: String(b?.event_date || ''),
              startTime: String(b?.event_time || ''),
              endTime: b?.event_end_time
                ? String(b.event_end_time).slice(0, 5)
                : undefined,
              packageName: String(b?.package_name || ''),
              contactPerson: clientName,
              contactNumber: contactNumber || undefined,
              notes: '',
              status: mapBookingStatus(b?.booking_status),
              payment: mapPaymentStatus(b?.payment_status),
              items: { damaged: [], missing: [] },
            }
          })
        if (active) setRows(mapped)
      } catch (e) {
        if (active) {
          // Log and continue; UI will simply show no data
          console.error('Failed to load events', e)
        }
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  // Change status handler (admin endpoint)
  const changeStatus = async (row: EventLogRow, next: EventStatus) => {
    try {
      await updateAdminBookingStatus(row.id, toBackendStatus(next))
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: next } : r))
      )
    } catch (e) {
      console.error('Change status failed:', e)
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
  const [search, setSearch] = useState('')

  // Pagination derived from filtered rows
  const [page, setPage] = useState(1)
  const pageSize = 5

  const filteredRows = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return rows.filter((r) => {
      const statusOk = statusFilter === 'all' ? true : r.status === statusFilter
      const itemsCount =
        (r.items?.damaged?.length || 0) + (r.items?.missing?.length || 0)
      const itemsOk =
        itemsFilter === 'all'
          ? true
          : itemsFilter === 'with'
          ? itemsCount > 0
          : itemsCount === 0
      const paymentOk =
        paymentFilter === 'all' ? true : r.payment === paymentFilter

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

  return (
    <div className="p-4 flex flex-col min-h-screen w-full overflow-x-hidden">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Events</h1>
      </header>

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

          {/* Search */}
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

        <div className="overflow-x-auto rounded-t-xl bg-white">
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
                    'Actions',
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
                      colSpan={8}
                    >
                      No events found
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
                                  {row.date || '—'}
                                </div>
                                <div className="font-semibold">Time</div>
                                <div className="text-gray-700">
                                  {row.startTime || '—'}
                                  {row.endTime ? ` - ${row.endTime}` : ''}
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
                            className={`h-7 text-xs w-32 px-3 border-0 rounded-full ${statusBadgeClass(
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
                            setItemsTarget(row)
                            setItemsOpen(true)
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
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        <button
                          className="px-2 py-1.5 rounded border text-sm"
                          onClick={() => {
                            setExtendTargetId(row.id)
                            setExtendHours('1')
                            setExtendConflict(null)
                            setExtendOpen(true)
                          }}
                        >
                          Extend hours…
                        </button>
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

      {/* Items modal */}
      <Dialog
        open={itemsOpen}
        onOpenChange={(o) => {
          if (!o) {
            setItemsOpen(false)
            setItemsTarget(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Items report</DialogTitle>
            <DialogDescription>
              Damaged and missing items for this event
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="font-semibold mb-2">Damaged</div>
              {itemsTarget?.items.damaged?.length ? (
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {itemsTarget.items.damaged.map((it, idx) => (
                    <li key={`d-${idx}`}>
                      {it.name}
                      {it.qty ? ` × ${it.qty}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">None</div>
              )}
            </div>
            <div>
              <div className="font-semibold mb-2">Missing</div>
              {itemsTarget?.items.missing?.length ? (
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {itemsTarget.items.missing.map((it, idx) => (
                    <li key={`m-${idx}`}>
                      {it.name}
                      {it.qty ? ` × ${it.qty}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">None</div>
              )}
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              className="px-4 py-2 rounded border text-sm"
              onClick={() => {
                setItemsOpen(false)
                setItemsTarget(null)
              }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend hours modal */}
      <Dialog
        open={extendOpen}
        onOpenChange={(o) => {
          if (!o) {
            setExtendOpen(false)
            setExtendTargetId(null)
            setExtendConflict(null)
            setExtendBusy(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend event hours</DialogTitle>
            <DialogDescription>
              Add hours to this confirmed booking. Conflicts include
              setup/cleanup buffers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm">
              Add hours
              <input
                type="number"
                min={0}
                step={1}
                value={extendHours}
                onChange={(e) => setExtendHours(e.target.value)}
                className="mt-1 w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              />
            </label>
            {extendConflict ? (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                This extension overlaps another accepted booking on{' '}
                {extendConflict.event_date} at {extendConflict.event_time} (with
                buffer).
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="px-4 py-2 rounded border text-sm"
              onClick={() => {
                setExtendOpen(false)
                setExtendTargetId(null)
                setExtendConflict(null)
              }}
              disabled={extendBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
              onClick={async () => {
                if (!extendTargetId) return
                const add = Math.max(0, Number(extendHours) || 0)
                if (!Number.isFinite(add)) return
                setExtendBusy(true)
                try {
                  if (extendConflict) {
                    // Proceed with force
                    await setAdminExtensionDuration(extendTargetId, {
                      add_hours: add,
                      force: true,
                    })
                  } else {
                    // Preflight
                    const { conflicts } =
                      await preflightAdminExtensionConflicts(extendTargetId, {
                        add_hours: add,
                        bufferHours: 2,
                      })
                    if (Array.isArray(conflicts) && conflicts.length) {
                      setExtendConflict(conflicts[0])
                      // Ask to proceed: click again to force
                      return
                    }
                    await setAdminExtensionDuration(extendTargetId, {
                      add_hours: add,
                    })
                  }
                  // refresh rows
                  const bookings = await fetchAdminConfirmedBookings()
                  // keep existing mapping logic
                  // Filter to allowed statuses as above
                  const allowed = new Set([
                    'scheduled',
                    'in_progress',
                    'completed',
                  ])
                  const mapped: EventLogRow[] = bookings
                    .filter((b: any) =>
                      allowed.has(String(b?.booking_status || '').toLowerCase())
                    )
                    .map((b: any) => {
                      const clientName =
                        [b?.firstname, b?.lastname]
                          .filter(Boolean)
                          .join(' ')
                          .trim() || String(b?.username || '')
                      const contactInfo = String(b?.contact_info || '')
                      const phoneMatch =
                        contactInfo.match(/(\+?\d[\d\s-]{6,}\d)/)
                      const contactNumber = (phoneMatch?.[1] || '').trim()
                      return {
                        id: String(b?.id || b?.confirmed_id || Math.random()),
                        eventName: String(
                          b?.event_name || b?.package_name || 'Event'
                        ),
                        clientName,
                        location: String(b?.event_address || ''),
                        date: String(b?.event_date || ''),
                        startTime: String(b?.event_time || ''),
                        endTime: b?.event_end_time
                          ? String(b.event_end_time).slice(0, 5)
                          : undefined,
                        packageName: String(b?.package_name || ''),
                        contactPerson: clientName,
                        contactNumber: contactNumber || undefined,
                        notes: '',
                        status: mapBookingStatus(b?.booking_status),
                        payment: mapPaymentStatus(b?.payment_status),
                        items: { damaged: [], missing: [] },
                      }
                    })
                  setRows(mapped)
                  setExtendOpen(false)
                } catch (e) {
                  console.error('Extension failed:', e)
                } finally {
                  setExtendBusy(false)
                }
              }}
            >
              {extendConflict
                ? 'Proceed anyway'
                : extendBusy
                ? 'Saving…'
                : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
