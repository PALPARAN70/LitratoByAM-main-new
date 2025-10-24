'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  approveBookingRequest,
  rejectBookingRequest,
} from '../../../../schemas/functions/BookingRequest/evaluateBookingRequest'
import { cancelConfirmedBooking } from '../../../../schemas/functions/BookingRequest/cancelBooking'
import { updateConfirmedBooking } from '../../../../schemas/functions/BookingRequest/updateBooking'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  listEmployees,
  getConfirmedBookingIdByRequest,
  listAssignedStaff,
  replaceAssignedStaff,
  type StaffUser,
} from '../../../../schemas/functions/staffFunctions/staffAssignment'

type TabKey = 'bookings' | 'masterlist'
type BookingStatus = 'pending' | 'approved' | 'declined' | 'cancelled'
type BookingRow = {
  id: string
  requestid?: number | null
  confirmedid?: number | null
  eventName: string
  date: string // ISO or display string
  startTime: string
  endTime: string
  package: string
  grid: string // now showing actual value, comma-joined
  place: string
  status: BookingStatus
  contact_info?: string | null
  contact_person?: string | null
  contact_person_number?: string | null
  strongest_signal?: string | null
  extension_duration?: number | null
  username?: string | null
  firstname?: string | null
  lastname?: string | null
}
export default function ManageBookingPage() {
  const [active, setActive] = useState<TabKey>('masterlist')
  const [selectedForBooking, setSelectedForBooking] = useState<{
    requestid?: number | null
    eventName?: string
    date?: string
    startTime?: string
    endTime?: string
    package?: string
    grid?: string | null
    place?: string
    contact_info?: string | null
    contact_person?: string | null
    contact_person_number?: string | null
    strongest_signal?: string | null
    extension_duration?: number | null
    username?: string | null
    firstname?: string | null
    lastname?: string | null
  } | null>(null)
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
        {active === 'bookings' && (
          <BookingsPanel selected={selectedForBooking} />
        )}
        {active === 'masterlist' && (
          <MasterListPanel
            onSelectPending={(row) => {
              setSelectedForBooking({
                requestid: row.requestid ?? null,
                eventName: row.eventName,
                date: row.date,
                startTime: row.startTime,
                endTime: row.endTime,
                package: row.package,
                grid: row.grid,
                place: row.place,
                contact_info: row.contact_info ?? null,
                contact_person: row.contact_person ?? null,
                contact_person_number: row.contact_person_number ?? null,
                strongest_signal: row.strongest_signal ?? null,
                extension_duration: row.extension_duration ?? null,
                username: row.username ?? null,
                firstname: row.firstname ?? null,
                lastname: row.lastname ?? null,
              })
              setActive('bookings')
            }}
          />
        )}
      </section>
    </div>
  )
}
// Safely extract an ISO-like YYYY-MM-DD string from various date shapes
function toISODateString(value: unknown): string {
  if (!value) return '—'
  if (typeof value === 'string') {
    // If already ISO-like, take first 10 chars or part before 'T'
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return value.slice(0, 10)
  }
  if (value instanceof Date) {
    // Normalize to calendar date (no tz shift)
    const y = value.getFullYear()
    const m = value.getMonth()
    const d = value.getDate()
    const iso = new Date(Date.UTC(y, m, d)).toISOString()
    return iso.slice(0, 10)
  }
  const s = String(value)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s.slice(0, 10)
}
function BookingsPanel({
  selected,
}: {
  selected: {
    requestid?: number | null
    eventName?: string
    date?: string
    startTime?: string
    endTime?: string
    package?: string
    grid?: string | null
    place?: string
    contact_info?: string | null
    contact_person?: string | null
    contact_person_number?: string | null
    strongest_signal?: string | null
    extension_duration?: number | null
    username?: string | null
    firstname?: string | null
    lastname?: string | null
  } | null
}) {
  // All values as strings for text-only placeholders
  const defaultForm = {
    email: '',
    completeName: '',
    contactNumber: '',
    contactPersonAndNumber: '',
    eventName: '',
    eventLocation: '',
    extensionHours: '', // text
    boothPlacement: '', // text
    signal: '',
    package: '', // text
    eventDate: '',
    eventTime: '',
  }
  const [form, setForm] = useState(defaultForm)
  const [readonlyKeys, setReadonlyKeys] = useState<
    Set<keyof typeof defaultForm>
  >(new Set())
  const [submitting, setSubmitting] = useState<null | 'approve' | 'reject'>(
    null
  )
  // When a selection arrives, prefill the form
  useEffect(() => {
    if (!selected) {
      setReadonlyKeys(new Set())
      return
    }
    const contactPersonCombo = [
      selected.contact_person,
      selected.contact_person_number,
    ]
      .filter(Boolean)
      .join(' | ')
    const fullName = [selected.firstname, selected.lastname]
      .filter(Boolean)
      .join(' ')
    setForm((p) => ({
      ...p,
      email: selected.username || p.email,
      completeName: fullName || p.completeName,
      contactNumber: selected.contact_info || p.contactNumber,
      contactPersonAndNumber: contactPersonCombo,
      eventName: selected.eventName || p.eventName,
      eventLocation: selected.place || p.eventLocation,
      extensionHours:
        selected.extension_duration != null
          ? String(selected.extension_duration)
          : p.extensionHours,
      signal: selected.strongest_signal || p.signal,
      package: selected.package || p.package,
      eventDate: selected.date || p.eventDate,
      eventTime: selected.startTime || p.eventTime,
    }))
    // Mark all prefilled user booking fields as read-only (copyable)
    const ro = new Set<keyof typeof defaultForm>([
      'email',
      'completeName',
      'contactNumber',
      'contactPersonAndNumber',
      'eventName',
      'eventLocation',
      'extensionHours',
      'signal',
      'package',
      'eventDate',
      'eventTime',
    ])
    setReadonlyKeys(ro)
  }, [selected])

  // Simple config: all fields render as text inputs
  const fields: Array<{ key: keyof typeof defaultForm; label: string }> = [
    { key: 'email', label: 'Email:' },
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
        readOnly={readonlyKeys.has(f.key)}
        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
        placeholder="Enter here:"
      />
    </div>
  )

  // Parse selected date for calendar marking
  const markedDate = useMemo(() => {
    if (!selected?.date) return null
    const m = selected.date.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    const d = new Date(selected.date)
    return Number.isNaN(d.getTime()) ? null : d
  }, [selected?.date])

  return (
    <div className=" flex gap-2 p-2 ">
      <Calendar
        markedDate={markedDate ?? undefined}
        initialMonth={markedDate ?? undefined}
      />
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
            <button
              className="bg-red-500 text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={submitting !== null}
              onClick={async () => {
                if (!selected?.date) return
                try {
                  setSubmitting('reject')
                  const requestid = selected?.requestid ?? null
                  if (!requestid) throw new Error('Missing request id')
                  await rejectBookingRequest(requestid)
                  // Reset selection and go back to master list
                  toast.error('Booking rejected')
                  window.location.reload()
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to reject')
                } finally {
                  setSubmitting(null)
                }
              }}
            >
              {submitting === 'reject' ? 'Rejecting…' : 'Decline'}
            </button>
            <button
              className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={submitting !== null}
              onClick={async () => {
                if (!selected?.date) return
                try {
                  setSubmitting('approve')
                  const requestid = selected?.requestid ?? null
                  if (!requestid) throw new Error('Missing request id')
                  await approveBookingRequest(requestid)
                  toast.success('Booking approved and confirmed')
                  window.location.reload()
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to approve')
                } finally {
                  setSubmitting(null)
                }
              }}
            >
              {submitting === 'approve' ? 'Approving…' : 'Approve'}
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

function MasterListPanel({
  onSelectPending,
}: {
  onSelectPending: (row: BookingRow) => void
}) {
  const router = useRouter()
  const pageSize = 5
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<BookingRow[]>([])
  const [search, setSearch] = useState('')

  // Assign staff dialog state
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<BookingRow | null>(null)
  const [staffList, setStaffList] = useState<StaffUser[]>([])
  const [selectedStaff, setSelectedStaff] = useState<Set<number>>(new Set())
  const [assignBusy, setAssignBusy] = useState(false)

  // ADD: dialog state for cancel/undo cancel confirmations
  const [cancelOpen, setCancelOpen] = useState(false)
  const [undoOpen, setUndoOpen] = useState(false)
  const [targetRow, setTargetRow] = useState<BookingRow | null>(null)
  const [busy, setBusy] = useState<null | 'cancel' | 'undo'>(null)

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
          // Derive UI status. For confirmed bookings, reflect booking_status
          // (cancelled -> 'cancelled', others -> 'approved'). For requests, map DB status.
          let status: BookingStatus
          if (r.kind === 'confirmed') {
            status = r.booking_status === 'cancelled' ? 'cancelled' : 'approved'
          } else {
            const statusMap: Record<string, BookingStatus> = {
              pending: 'pending',
              accepted: 'approved',
              rejected: 'declined',
              cancelled: 'cancelled',
            }
            status = statusMap[(r.status as string) || 'pending'] ?? 'pending'
          }
          const date = toISODateString(r.event_date)
          const startTime = (r.event_time || '').toString().slice(0, 5)
          const endTime = (r.event_end_time || '').toString().slice(0, 5)
          return {
            id: String(r.requestid || r.confirmed_id || Math.random()),
            requestid: r.requestid ?? null,
            confirmedid: (r as any).confirmed_id ?? null,
            eventName: r.event_name || '—',
            date,
            startTime,
            endTime,
            package: r.package_name || '—',
            grid: r.grid || '—',
            place: r.event_address || '—',
            status,
            contact_info: r.contact_info ?? null,
            contact_person: r.contact_person ?? null,
            contact_person_number: r.contact_person_number ?? null,
            strongest_signal: r.strongest_signal ?? null,
            extension_duration: r.extension_duration ?? null,
            username: r.username ?? null,
            firstname: r.firstname ?? null,
            lastname: r.lastname ?? null,
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
    // First, filter by status
    const byStatus =
      statusFilter === 'all'
        ? rows
        : rows.filter((d) => d.status === statusFilter)
    // Then, apply search tokens (AND over tokens)
    const q = search.trim().toLowerCase()
    if (!q) return byStatus
    const tokens = q.split(/\s+/).filter(Boolean)
    if (!tokens.length) return byStatus
    return byStatus.filter((r) => {
      const hay = [
        r.eventName,
        r.date,
        r.startTime,
        r.endTime,
        r.package,
        r.grid,
        r.place,
        r.username,
        r.firstname,
        r.lastname,
        r.contact_info,
        r.contact_person,
        r.contact_person_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
  }, [statusFilter, rows, search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const startIdx = (page - 1) * pageSize
  const pageRows = filtered.slice(startIdx, startIdx + pageSize)
  const windowPages = useMemo(
    () => pageWindow(page, totalPages, 3),
    [page, totalPages]
  )

  const statusBadgeClasses: Record<BookingStatus, string> = {
    pending: 'bg-gray-700 text-white',
    approved: 'bg-green-700 text-white ',
    declined: 'bg-red-700 text-white ',
    cancelled: 'bg-orange-700 text-white',
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

  // Handlers for actions menu
  const handleEdit = (row: BookingRow) => {
    try {
      // Derive contact person fields with robust fallbacks
      const byFieldName = (row.contact_person || '').trim()
      const byName = [row.firstname, row.lastname]
        .filter(Boolean)
        .join(' ')
        .trim()
      const contactPersonName = byFieldName || byName || ''

      const directNum = (row.contact_person_number || '').trim()
      let contactPersonNumber = directNum
      if (!contactPersonNumber) {
        const info = (row.contact_info || '').toString()
        const m = info.match(/(\+?\d[\d\s-]{6,}\d)/)
        contactPersonNumber = (m?.[1] || '').trim()
      }
      // Always build a normalized combined string so the edit page can split reliably
      const combinedContact = `${contactPersonName} | ${contactPersonNumber}`
      // Build prefill payload for createBooking page
      const prefill = {
        email: row.username || '',
        completeName: [row.firstname, row.lastname].filter(Boolean).join(' '),
        contactNumber: row.contact_info || '',
        contactPersonAndNumber: combinedContact,
        eventName: row.eventName || '',
        eventLocation: row.place || '',
        extensionHours:
          typeof row.extension_duration === 'number'
            ? row.extension_duration
            : 0,
        boothPlacement: 'Indoor',
        signal: row.strongest_signal || '',
        package: (row.package || 'The Hanz') as any,
        selectedGrids: (row.grid || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        eventDate: row.date ? new Date(row.date) : new Date(),
        eventTime: row.startTime || '12:00',
        eventEndTime: row.endTime || '14:00',
        // Attach the requestid for reference if needed during save
        __requestid: row.requestid ?? null,
      }
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('edit_booking_prefill', JSON.stringify(prefill))
      }
      router.push('/admin/createBooking?prefill=1')
    } catch {
      // no-op; optionally toast an error
    }
  }

  // Helpers for Assign Staff
  const ensureConfirmedId = async (row: BookingRow): Promise<number | null> => {
    if (row.confirmedid && Number.isFinite(row.confirmedid)) {
      return Number(row.confirmedid)
    }
    if (!row.requestid) return null
    return getConfirmedBookingIdByRequest(row.requestid)
  }

  const openAssign = async (row: BookingRow) => {
    setAssignTarget(row)
    setAssignOpen(true)
    try {
      const employees = await listEmployees()
      setStaffList(employees)
      const cid = await ensureConfirmedId(row)
      if (cid) {
        const assigned = await listAssignedStaff(cid)
        const ids = assigned.map((s) => s.id).filter(Boolean)
        setSelectedStaff(new Set(ids))
      } else {
        setSelectedStaff(new Set())
      }
    } catch {
      setStaffList([])
      setSelectedStaff(new Set())
    }
  }

  const toggleStaff = (id: number) => {
    setSelectedStaff((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 2) return next // enforce max 2
        next.add(id)
      }
      return next
    })
  }

  const confirmAssign = async () => {
    if (!assignTarget) return
    const ids = Array.from(selectedStaff)
    if (!ids.length) {
      toast.error('Please select at least one staff')
      return
    }
    const cid = await ensureConfirmedId(assignTarget)
    if (!cid) {
      toast.error('Confirmed booking not found for this row')
      return
    }
    try {
      setAssignBusy(true)
      // Replace the current assigned staff set with the newly selected ones
      await replaceAssignedStaff(cid, ids)
      toast.success('Staff assignment updated')
      setAssignOpen(false)
      setAssignTarget(null)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign staff')
    } finally {
      setAssignBusy(false)
    }
  }

  // CHANGED: remove window.confirm, just perform the action
  const handleCancel = async (row: BookingRow) => {
    if (!(row.requestid && row.status === 'approved')) return
    try {
      setBusy('cancel')
      await cancelConfirmedBooking({
        requestid: row.requestid,
        reason: 'Admin cancel via ManageBooking',
      })
      setRows((prev) =>
        prev.map((r) =>
          r.requestid === row.requestid ? { ...r, status: 'cancelled' } : r
        )
      )
      toast.success('Booking cancelled')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cancel booking')
    } finally {
      setBusy(null)
      setCancelOpen(false)
      setTargetRow(null)
    }
  }

  const handleUndoCancel = async (row: BookingRow) => {
    if (!row.requestid || row.status !== 'cancelled') return
    try {
      setBusy('undo')
      await updateConfirmedBooking({
        requestid: row.requestid,
        updates: { bookingStatus: 'scheduled' },
      })
      setRows((prev) =>
        prev.map((r) =>
          r.requestid === row.requestid ? { ...r, status: 'approved' } : r
        )
      )
      toast.success('Booking restored to scheduled')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to undo cancel')
    } finally {
      setBusy(null)
      setUndoOpen(false)
      setTargetRow(null)
    }
  }

  return (
    <div className="p-2 flex flex-col h-[60vh] min-h-0">
      {/* Filter toolbar: popover styled like a select */}
      <div className="flex items-center gap-4 mb-3">
        {/* ...existing code... optional left title/space ... */}
        <Popover>
          <PopoverTrigger asChild>
            <div
              className="inline-flex items-center justify-between gap-2 min-w-[8rem] h-9 px-3 rounded border border-gray-300 bg-white text-sm"
              aria-label="Filter by status"
              title="Filter by status"
            >
              <span className="text-gray-700">{currentLabel}</span>
              <ChevronDown className="w-4 h-4 text-gray-700" />
            </div>
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

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name, date, user, place…"
            className="h-9 w-64 max-w-[50vw] px-3 rounded-full outline-none bg-gray-400 text-sm "
            aria-label="Search bookings"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setPage(1)
              }}
              className="h-9 px-3 rounded border border-gray-300 bg-white text-sm hover:bg-gray-100"
              aria-label="Clear search"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-t-xl border-2 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          {loading && (
            <div className="p-4 text-sm text-gray-500">Loading bookings…</div>
          )}
          {error && <div className="p-4 text-sm text-red-600">{error}</div>}
          <table className="min-w-full text-sm">
            <thead className="bg-gray-200 text-gray-700">
              <tr>
                <th className="text-left px-3 py-2">Event Name</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Start time</th>
                <th className="text-left px-3 py-2">End time</th>
                <th className="text-left px-3 py-2">Package</th>
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
                    colSpan={9}
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
                    <td className="px-3 py-2">{row.place}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-1 w-18 text-center rounded-full text-xs font-medium ${
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
                            className="p-1 rounded hover:bg-gray-200"
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
                              <div className="font-semibold">
                                Contact person
                              </div>
                              <div className="text-gray-700 whitespace-pre-wrap">
                                <div>
                                  <span className="font-medium">Name:</span>{' '}
                                  {(() => {
                                    const byField = (
                                      row.contact_person || ''
                                    ).trim()
                                    const byName = [row.firstname, row.lastname]
                                      .filter(Boolean)
                                      .join(' ')
                                      .trim()
                                    const val = byField || byName
                                    return val || '—'
                                  })()}
                                </div>
                                <div>
                                  <span className="font-medium">Number:</span>{' '}
                                  {(() => {
                                    const direct = (
                                      row.contact_person_number || ''
                                    ).trim()
                                    if (direct) return direct
                                    const info = (
                                      row.contact_info || ''
                                    ).toString()
                                    // Try to extract a phone-like sequence from contact_info
                                    const m = info.match(/(\+?\d[\d\s-]{6,}\d)/)
                                    const extracted = (m?.[1] || '').trim()
                                    return extracted || '—'
                                  })()}
                                </div>
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
                            <div>
                              <div className="font-semibold">Grids</div>
                              {(() => {
                                const names = (row.grid || '')
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter((s) => s && s !== '—')
                                return names.length ? (
                                  <ul className="list-disc list-inside text-gray-700">
                                    {names.map((n) => (
                                      <li key={n}>{n}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="text-gray-700">—</div>
                                )
                              })()}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="px-3 py-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-gray-100"
                            aria-label="Actions"
                            title="Actions"
                          >
                            <Ellipsis />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1" align="end">
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className={`text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
                                row.status === 'pending'
                                  ? ''
                                  : 'opacity-50 cursor-not-allowed'
                              }`}
                              disabled={row.status !== 'pending'}
                              onClick={() => onSelectPending(row)}
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              className={`text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
                                row.status === 'declined' ||
                                row.status === 'cancelled'
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                              }`}
                              disabled={
                                row.status === 'declined' ||
                                row.status === 'cancelled'
                              }
                              onClick={() => handleEdit(row)}
                            >
                              Edit
                            </button>
                            {/* CHANGED: open cancel confirmation dialog */}
                            <button
                              type="button"
                              className={`text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
                                row.status === 'approved'
                                  ? ''
                                  : 'opacity-50 cursor-not-allowed'
                              }`}
                              disabled={row.status !== 'approved'}
                              onClick={() => {
                                if (row.status !== 'approved' || !row.requestid)
                                  return
                                setTargetRow(row)
                                setCancelOpen(true)
                              }}
                            >
                              Cancel
                            </button>
                            {/* CHANGED: open undo confirmation dialog */}
                            <button
                              type="button"
                              className={`text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
                                row.status === 'cancelled'
                                  ? ''
                                  : 'opacity-50 cursor-not-allowed'
                              }`}
                              disabled={row.status !== 'cancelled'}
                              onClick={() => {
                                if (
                                  row.status !== 'cancelled' ||
                                  !row.requestid
                                )
                                  return
                                setTargetRow(row)
                                setUndoOpen(true)
                              }}
                            >
                              Undo Cancel
                            </button>
                            <button
                              type="button"
                              className={`text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
                                row.status === 'approved'
                                  ? ''
                                  : 'opacity-50 cursor-not-allowed'
                              }`}
                              disabled={row.status !== 'approved'}
                              onClick={() => openAssign(row)}
                            >
                              Assign Staff
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
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

      {/* ADD: Cancel confirmation dialog */}
      <Dialog
        open={cancelOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCancelOpen(false)
            setTargetRow(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>
              This action will mark the booking as cancelled.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Event:</span>{' '}
              {targetRow?.eventName || '—'}
            </div>
            <div>
              <span className="font-medium">Date:</span>{' '}
              {targetRow?.date || '—'}
            </div>
            <div>
              <span className="font-medium">Time:</span>{' '}
              {targetRow?.startTime || '—'}
              {targetRow?.endTime ? ` - ${targetRow.endTime}` : ''}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded border text-sm"
              >
                No, keep booking
              </button>
            </DialogClose>
            <button
              type="button"
              className="px-4 py-2 rounded bg-litratored text-white text-sm disabled:opacity-50"
              disabled={busy === 'cancel'}
              onClick={() => {
                if (targetRow) handleCancel(targetRow)
              }}
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD: Undo cancel confirmation dialog */}
      <Dialog
        open={undoOpen}
        onOpenChange={(o) => {
          if (!o) {
            setUndoOpen(false)
            setTargetRow(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore this booking?</DialogTitle>
            <DialogDescription>
              This will restore the booking back to scheduled.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Event:</span>{' '}
              {targetRow?.eventName || '—'}
            </div>
            <div>
              <span className="font-medium">Date:</span>{' '}
              {targetRow?.date || '—'}
            </div>
            <div>
              <span className="font-medium">Time:</span>{' '}
              {targetRow?.startTime || '—'}
              {targetRow?.endTime ? ` - ${targetRow.endTime}` : ''}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded border text-sm"
              >
                No, go back
              </button>
            </DialogClose>
            <button
              type="button"
              className="px-4 py-2 rounded bg-litratoblack text-white text-sm disabled:opacity-50"
              disabled={busy === 'undo'}
              onClick={() => {
                if (targetRow) handleUndoCancel(targetRow)
              }}
            >
              {busy === 'undo' ? 'Restoring…' : 'Yes, restore'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD: Assign staff dialog */}
      <Dialog
        open={assignOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAssignOpen(false)
            setAssignTarget(null)
            setSelectedStaff(new Set())
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign staff to booking</DialogTitle>
            <DialogDescription>
              Select up to two staff members to assign.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-auto border rounded">
            {staffList.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No staff found.</div>
            ) : (
              <ul>
                {staffList.map((s) => {
                  const checked = selectedStaff.has(s.id)
                  const disabled = !checked && selectedStaff.size >= 2
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleStaff(s.id)}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {`${s.firstname} ${s.lastname}`.trim() || s.email}
                        </span>
                        <span className="text-xs text-gray-600">{s.email}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded border text-sm"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="px-4 py-2 rounded bg-litratoblack text-white text-sm disabled:opacity-50"
              disabled={assignBusy || selectedStaff.size === 0}
              onClick={confirmAssign}
            >
              {assignBusy ? 'Assigning…' : 'Assign'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
