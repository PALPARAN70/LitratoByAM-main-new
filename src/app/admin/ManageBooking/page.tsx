'use client'
import { useEffect, useMemo, useState } from 'react'
import Calendar from '../../../../Litratocomponents/LitratoCalendar'
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ChevronDown, Check, Ellipsis } from 'lucide-react'
import {
  readBookings,
  type BookingRequestRow,
} from '../../../../schemas/functions/BookingRequest/readBookings'

type TabKey = 'bookings' | 'masterlist'
export default function ManageBookingPage() {
  const [active, setActive] = useState<TabKey>('masterlist')
  return (
    <div className="p-4 flex flex-col">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Bookings</h1>
      </header>
      <nav className="flex gap-2 mb-6">
        <TabButton
          active={active === 'masterlist'}
          onClick={() => setActive('masterlist')}
        >
          Master List
        </TabButton>
        <TabButton
          active={active === 'bookings'}
          onClick={() => setActive('bookings')}
        >
          Bookings
        </TabButton>
      </nav>
      <section className="bg-white rounded-xl shadow p-2">
        {active === 'bookings' && <BookingsPanel />}
        {active === 'masterlist' && <MasterListPanel />}
      </section>
    </div>
  )
}
function BookingsPanel() {
  // All values as strings for text-only placeholders
  const defaultForm = {
    email: '',
    facebook: '',
    completeName: '',
    contactNumber: '',
    contactPersonAndNumber: '',
    eventName: '',
    eventLocation: '',
    extensionHours: '', // text
    boothPlacement: 'Indoor', // text
    signal: '',
    package: 'The Hanz', // text
    eventDate: '',
    eventTime: '',
  }
  const [form, setForm] = useState(defaultForm)

  // Simple config: all fields render as text inputs
  const fields: Array<{ key: keyof typeof defaultForm; label: string }> = [
    { key: 'email', label: 'Email:' },
    { key: 'facebook', label: 'Facebook:' },
    { key: 'completeName', label: 'Complete name:' },
    { key: 'contactNumber', label: 'Contact #:' },
    { key: 'contactPersonAndNumber', label: 'Contact Person & Number:' },
    { key: 'eventName', label: 'Name of event (Ex. Maria & Jose Wedding):' },
    { key: 'eventLocation', label: 'Location of event:' },
    {
      key: 'extensionHours',
      label: 'Extension? (Minimum 2hrs. Additional hour is Php2000):',
    },
    { key: 'boothPlacement', label: 'Placement of booth:' },
    {
      key: 'signal',
      label: 'What signal is currently strong in the event area?:',
    },
    { key: 'package', label: 'Package:' },
    { key: 'eventDate', label: 'Event date:' },
    { key: 'eventTime', label: 'Event start time:' },
  ]

  const renderField = (f: { key: keyof typeof defaultForm; label: string }) => (
    <div key={String(f.key)}>
      <label className="block text-lg mb-1">{f.label}</label>
      <input
        type="text"
        className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
        value={form[f.key]}
        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
        placeholder="Enter here:"
      />
    </div>
  )

  return (
    <div className=" flex gap-2 p-2 ">
      <Calendar />
      <div className=" flex flex-col p-2 bg-gray-300 w-full rounded ">
        <div className="flex justify-between">
          {/* (api name fetching here) */}
          <p className="text-xl font-semibold">User's Booking</p>
          {/* (date fetching here when booking was made) */}
          <p>02/10/2025</p>
        </div>

        <div className=" bg-gray-300 rounded h-full">
          <div className="overflow-y-auto max-h-[42vh] space-y-3 pr-1">
            {fields.map(renderField)}
          </div>

          <span className="flex justify-end gap-2 mt-4">
            <button className="bg-red-500 text-white px-4 py-2 rounded">
              Decline
            </button>
            <button className="bg-green-500 text-white px-4 py-2 rounded">
              Approve
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

function pageWindow(current: number, total: number, size = 3): number[] {
  if (total <= 0) return []
  const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1
  const end = Math.min(total, start + size - 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function MasterListPanel() {
  type BookingStatus = 'pending' | 'approved' | 'declined' | 'cancelled'
  type BookingRow = {
    id: string
    eventName: string
    date: string // ISO or display string
    startTime: string
    endTime: string
    package: string
    grid: string // now showing actual value, comma-joined
    place: string
    status: BookingStatus
    contact_info?: string | null
    strongest_signal?: string | null
    extension_duration?: number | null
  }

  const pageSize = 5
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<BookingRow[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const list = await readBookings()
        if (cancelled) return
        // Map API rows into table rows
        const toRow = (r: BookingRequestRow): BookingRow => {
          const statusMap: Record<string, BookingStatus> = {
            pending: 'pending',
            accepted: 'approved',
            rejected: 'declined',
            cancelled: 'cancelled',
          }
          const status =
            statusMap[(r.status as string) || 'pending'] ?? 'pending'
          const date = (r.event_date || '').toString().slice(0, 10)
          const startTime = (r.event_time || '').toString().slice(0, 5)
          const endTime = (r.event_end_time || '').toString().slice(0, 5)
          return {
            id: String(r.requestid || r.confirmed_id || Math.random()),
            eventName: r.event_name || '—',
            date,
            startTime,
            endTime,
            package: r.package_name || '—',
            grid: r.grid || '—',
            place: r.event_address || '—',
            status,
            contact_info: r.contact_info ?? null,
            strongest_signal: r.strongest_signal ?? null,
            extension_duration: r.extension_duration ?? null,
          }
        }
        const mapped = list.map(toRow)
        setRows(mapped)
        setPage(1)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || 'Failed to load bookings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((d) => d.status === statusFilter)
  }, [statusFilter, rows])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const startIdx = (page - 1) * pageSize
  const pageRows = filtered.slice(startIdx, startIdx + pageSize)
  const windowPages = useMemo(
    () => pageWindow(page, totalPages, 3),
    [page, totalPages]
  )

  const statusBadgeClasses: Record<BookingStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    declined: 'bg-red-100 text-red-800 border-red-200',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  }

  const statusOptions: Array<{ value: BookingStatus | 'all'; label: string }> =
    [
      { value: 'all', label: 'All' },
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'declined', label: 'Declined' },
      { value: 'cancelled', label: 'Cancelled' },
    ]
  const currentLabel =
    statusOptions.find((o) => o.value === statusFilter)?.label ?? 'All'

  return (
    <div className="p-2 flex flex-col h-[60vh] min-h-0">
      {/* Filter toolbar: popover styled like a select */}
      <div className="flex items-center gap-4 mb-3">
        {/* ...existing code... optional left title/space ... */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-between gap-2 min-w-[8rem] h-9 px-3 rounded border border-gray-300 bg-white text-sm"
              aria-label="Filter by status"
              title="Filter by status"
            >
              <span className="text-gray-700">{currentLabel}</span>
              <ChevronDown className="w-4 h-4 text-gray-700" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1" align="end">
            <div className="flex flex-col">
              {statusOptions.map((opt) => {
                const selected = opt.value === statusFilter
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`flex items-center justify-between w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
                      selected ? 'bg-gray-50' : ''
                    }`}
                    onClick={() => {
                      setStatusFilter(opt.value as BookingStatus | 'all')
                      setPage(1)
                    }}
                  >
                    <span>{opt.label}</span>
                    {selected ? (
                      <Check className="w-4 h-4 text-black" />
                    ) : (
                      <span className="w-4 h-4" />
                    )}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>

        <div>Search Bar</div>
      </div>

      <div className="bg-white rounded-xl shadow flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          {loading && (
            <div className="p-4 text-sm text-gray-500">Loading bookings…</div>
          )}
          {error && <div className="p-4 text-sm text-red-600">{error}</div>}
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="text-left px-3 py-2">Event Name</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Start time</th>
                <th className="text-left px-3 py-2">End time</th>
                <th className="text-left px-3 py-2">Package</th>
                <th className="text-left px-3 py-2">Grid</th>
                <th className="text-left px-3 py-2">Place</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">More Details</th>

                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && !loading ? (
                <tr>
                  <td
                    className="px-3 py-4 text-center text-gray-500"
                    colSpan={8}
                  >
                    No bookings found
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row.eventName}</td>
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{row.startTime}</td>
                    <td className="px-3 py-2">{row.endTime}</td>
                    <td className="px-3 py-2">{row.package}</td>
                    <td className="px-3 py-2">{row.grid}</td>
                    <td className="px-3 py-2">{row.place}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${
                          statusBadgeClasses[row.status]
                        }`}
                      >
                        {row.status.charAt(0).toUpperCase() +
                          row.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2 ">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="p-1 rounded hover:bg-gray-100"
                            aria-label="More details"
                            title="More details"
                          >
                            <Ellipsis />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" align="end">
                          <div className="text-sm space-y-2">
                            <div>
                              <div className="font-semibold">Contact info</div>
                              <div className="text-gray-700 whitespace-pre-wrap">
                                {row.contact_info || '—'}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold">Address</div>
                              <div className="text-gray-700">
                                {row.place || '—'}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold">
                                Strongest signal
                              </div>
                              <div className="text-gray-700">
                                {row.strongest_signal || '—'}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold">
                                Extension duration
                              </div>
                              <div className="text-gray-700">
                                {row.extension_duration ?? '—'}
                                {row.extension_duration != null ? ' hr' : ''}
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="px-3 py-2">
                      <button className="rounded bg-green-400 p-1">
                        Validate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-3 py-2">
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
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <div
      onClick={onClick}
      className={`px-4 py-2 rounded-full cursor-pointer border font-semibold transition
        ${
          active
            ? 'bg-litratoblack text-white border-litratoblack'
            : 'bg-white text-litratoblack border-gray-300 hover:bg-gray-100'
        }`}
    >
      {children}
    </div>
  )
}
