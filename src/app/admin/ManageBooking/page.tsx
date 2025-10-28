'use client'
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import type { ChangeEventHandler } from 'react'
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
import EventCard from '../../../../Litratocomponents/EventCard'
import {
  fetchPaymentSummaryForBooking,
  listPackageItemsForPackage,
} from '../../../../schemas/functions/EventCards/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Add shared item type for items overview
type Item = { name: string; qty?: number }

type TabKey = 'bookings' | 'masterlist' | 'eventcards' // + eventcards
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
  packageId?: number | null
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
  // Pricing summary (base + extension) for quick reference
  baseTotal?: number | null
  extHours?: number | null
  amountDue?: number | null

  // NEW: integrated event logs data
  clientName: string
  eventStatus: 'ongoing' | 'standby' | 'finished'
  payment: 'paid' | 'unpaid' | 'partially-paid'
  items: { damaged: Item[]; missing: Item[] }
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
        <TabButton
          active={active === 'eventcards'}
          onClick={() => setActive('eventcards')}
        >
          Event Cards
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
        {active === 'eventcards' && <EventCardsPanel />} {/* new */}
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
  const [approveOpen, setApproveOpen] = useState(false)
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
          <p className="text-xl font-semibold">User&apos;s Booking</p>
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
                } catch (e: unknown) {
                  const msg =
                    e instanceof Error ? e.message : 'Failed to reject'
                  toast.error(msg)
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
              onClick={() => setApproveOpen(true)}
            >
              {submitting === 'approve' ? 'Approving…' : 'Approve'}
            </button>
          </span>
        </div>
      </div>

      {/* Approve confirmation modal */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve this booking?</DialogTitle>
            <DialogDescription>
              This will accept the booking and automatically reject other
              pending requests with the same date, time, and package. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
                disabled={submitting === 'approve'}
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              disabled={submitting === 'approve'}
              onClick={async () => {
                if (!selected?.date) return
                try {
                  setSubmitting('approve')
                  const requestid = selected?.requestid ?? null
                  if (!requestid) throw new Error('Missing request id')
                  await approveBookingRequest(requestid)
                  toast.success('Booking approved and confirmed')
                  setApproveOpen(false)
                  window.location.reload()
                } catch (e: unknown) {
                  const msg =
                    e instanceof Error ? e.message : 'Failed to approve'
                  toast.error(msg)
                } finally {
                  setSubmitting(null)
                }
              }}
            >
              {submitting === 'approve' ? 'Approving…' : 'Approve'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

  // NEW: Event Report modal state
  const [reportOpen, setReportOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<BookingRow | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportPayment, setReportPayment] = useState<{
    paidTotal: number | null
    amountDue: number | null
    status: 'paid' | 'partial' | 'unpaid'
  } | null>(null)
  const [reportItems, setReportItems] = useState<{
    total: number
    ok: number
    damaged: number
    missing: number
  } | null>(null)
  const [reportStaff, setReportStaff] = useState<
    Array<{ id: number; firstname?: string; lastname?: string }>
  >([])
  const [reportItemLists, setReportItemLists] = useState<{
    good: Array<{ name: string; qty: number }>
    damaged: Array<{ name: string; qty: number }>
    missing: Array<{ name: string; qty: number }>
  } | null>(null)

  const openReport = async (row: BookingRow) => {
    setReportTarget(row)
    setReportOpen(true)
    setReportLoading(true)
    setReportPayment(null)
    setReportItems(null)
    setReportStaff([])
    setReportItemLists(null)
    try {
      const cid = await ensureConfirmedId(row)
      // Payment summary (admin)
      if (cid) {
        try {
          const sum: any = await fetchPaymentSummaryForBooking(
            cid as number,
            'admin' as any
          )
          if (sum) {
            setReportPayment({
              paidTotal: Number(sum.paidTotal ?? 0),
              amountDue: Number(sum.amountDue ?? 0),
              status:
                (sum.computedStatus as 'paid' | 'partial' | 'unpaid') ??
                'unpaid',
            })
          }
        } catch {}
      }
      // Staff list (best-effort)
      if (cid) {
        try {
          const staff = await listAssignedStaff(cid)
          setReportStaff(
            (staff || []).map((s) => ({
              id: Number(s.id),
              firstname: String((s as any).firstname || ''),
              lastname: String((s as any).lastname || ''),
            }))
          )
        } catch {}
      }
      // Items summary if we have a packageId
      if (row.packageId && Number(row.packageId)) {
        try {
          const items: any[] = await listPackageItemsForPackage(
            Number(row.packageId)
          )
          let total = 0,
            missing = 0,
            damaged = 0,
            ok = 0
          const goodAgg = new Map<string, number>()
          const damagedAgg = new Map<string, number>()
          const missingAgg = new Map<string, number>()
          for (const it of items) {
            const q = Math.max(1, Number((it as any).quantity || 1))
            total += q
            const stat = (it as any).status
            const cond = String((it as any).condition || '').toLowerCase()
            const name = String((it as any).material_name || 'Item')
            if (stat === false) {
              missing += q
              missingAgg.set(name, (missingAgg.get(name) || 0) + q)
            } else if (cond === 'damaged') {
              damaged += q
              damagedAgg.set(name, (damagedAgg.get(name) || 0) + q)
            } else {
              ok += q
              goodAgg.set(name, (goodAgg.get(name) || 0) + q)
            }
          }
          setReportItems({ total, ok, damaged, missing })
          const toArray = (m: Map<string, number>) =>
            Array.from(m.entries()).map(([name, qty]) => ({ name, qty }))
          setReportItemLists({
            good: toArray(goodAgg),
            damaged: toArray(damagedAgg),
            missing: toArray(missingAgg),
          })
        } catch {}
      }
    } finally {
      setReportLoading(false)
    }
  }

  // Extend hours dialog state
  const [extendOpen, setExtendOpen] = useState(false)
  const [extendTarget, setExtendTarget] = useState<{
    row: BookingRow
    cid: number
  } | null>(null)
  const [extendHours, setExtendHours] = useState<string>('1')
  const [extendBusy, setExtendBusy] = useState(false)
  const [extendConflict, setExtendConflict] = useState<null | {
    requestid: number
    event_date: string
    event_time: string
  }>(null)

  // ADD: contract upload helpers
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadTarget, setUploadTarget] = useState<BookingRow | null>(null)
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000'
  const CONTRACTS_CUSTOMER = `${API_BASE}/api/customer/contracts`
  const CONTRACTS_ADMIN = `${API_BASE}/api/admin/contracts`
  // Always return a HeadersInit-compatible object (avoid unions that confuse TS)
  const getAuthHeader = (): HeadersInit => {
    const token =
      (typeof window !== 'undefined' && localStorage.getItem('access_token')) ||
      null
    return token
      ? ({ Authorization: `Bearer ${token}` } as Record<string, string>)
      : ({} as Record<string, string>)
  }
  const viewContract = async (row: BookingRow) => {
    if (!row.requestid) {
      toast.error('Missing request id.')
      return
    }
    try {
      const res = await fetch(
        `${CONTRACTS_CUSTOMER}/by-request/${encodeURIComponent(
          String(row.requestid)
        )}`,
        { headers: getAuthHeader(), cache: 'no-store' }
      )
      if (!res.ok) throw new Error(await res.text())
      const data: { contract?: { url?: string } } & {
        url?: string
        contract_url?: string
      } = await res.json().catch(
        () =>
          ({} as {
            contract?: { url?: string }
            url?: string
            contract_url?: string
          })
      )
      const url: string | undefined =
        data?.contract?.url || data?.url || data?.contract_url
      if (!url) {
        toast.error('No contract available.')
        return
      }
      window.open(url, '_blank')
    } catch {
      toast.error('Failed to open contract.')
    }
  }
  const onPickUpload = (row: BookingRow) => {
    if (!row.requestid) {
      toast.error('Missing request id.')
      return
    }
    setUploadTarget(row)
    uploadInputRef.current?.click()
  }
  const onUploadFile: ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    e.currentTarget.value = ''
    if (!file || !uploadTarget?.requestid) return
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('requestid', String(uploadTarget.requestid))
      const res = await fetch(`${CONTRACTS_ADMIN}/upload`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Contract uploaded.')
    } catch {
      toast.error('Upload failed.')
    } finally {
      setUploadTarget(null)
    }
  }

  // ADD: helpers for event status and payment badges/labels
  const eventStatusLabel = (s: BookingRow['eventStatus']) =>
    s === 'standby' ? 'Standby' : s === 'ongoing' ? 'Ongoing' : 'Finished'
  const eventStatusBadgeClass = (s: BookingRow['eventStatus']) => {
    if (s === 'ongoing') return 'bg-yellow-700 text-white'
    if (s === 'finished') return 'bg-green-700 text-white'
    return 'bg-gray-700 text-white' // standby
  }
  const paymentLabel = (p: BookingRow['payment']) =>
    p === 'paid' ? 'Paid' : p === 'unpaid' ? 'Unpaid' : 'Partially Paid'
  const paymentBadgeClass = (p: BookingRow['payment']) => {
    if (p === 'paid') return 'bg-green-700 text-white'
    if (p === 'partially-paid') return 'bg-yellow-700 text-white'
    return 'bg-red-700 text-white' // unpaid
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const list = await readBookings()
        if (cancelled) return

        // Map master list + event logs fields
        const mapBookingStatusToEvent = (
          s?: string
        ): BookingRow['eventStatus'] => {
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
        const mapPaymentStatus = (s?: string): BookingRow['payment'] => {
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
          const rx = r as Record<string, unknown>
          const baseCandidate =
            (typeof rx['total_booking_price'] === 'number'
              ? (rx['total_booking_price'] as number)
              : undefined) ??
            (typeof rx['package_price'] === 'number'
              ? (rx['package_price'] as number)
              : undefined) ??
            (typeof rx['price'] === 'number'
              ? (rx['price'] as number)
              : undefined) ??
            0
          const baseTotal = Number(baseCandidate)
          const extHoursNum = Number(r.extension_duration ?? 0)
          const extHours = Number.isFinite(extHoursNum)
            ? Math.max(0, extHoursNum)
            : 0
          const amountDue = Number.isFinite(baseTotal)
            ? Math.max(0, Number(baseTotal) + extHours * 2000)
            : null

          // NEW: derive client name, event status, payment and items
          const clientName =
            [r.firstname, r.lastname].filter(Boolean).join(' ').trim() ||
            String(r.username || '')
          const bookingStatusRaw =
            typeof rx['booking_status'] === 'string'
              ? (rx['booking_status'] as string)
              : undefined
          const paymentStatusRaw =
            typeof rx['payment_status'] === 'string'
              ? (rx['payment_status'] as string)
              : undefined
          const eventStatus =
            r.kind === 'confirmed'
              ? mapBookingStatusToEvent(bookingStatusRaw)
              : 'standby'
          const payment =
            r.kind === 'confirmed'
              ? mapPaymentStatus(paymentStatusRaw)
              : 'unpaid'
          const items = { damaged: [] as Item[], missing: [] as Item[] }

          // NEW: capture package id when available (from confirmed bookings select)
          const packageId =
            typeof (rx['package_id'] as unknown) === 'number'
              ? (rx['package_id'] as number)
              : null

          return {
            id: String(r.requestid || r.confirmed_id || Math.random()),
            requestid: r.requestid ?? null,
            confirmedid:
              typeof rx['confirmed_id'] === 'number'
                ? (rx['confirmed_id'] as number)
                : null,
            eventName: r.event_name || '—',
            date,
            startTime,
            endTime,
            package: r.package_name || '—',
            packageId,
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
            baseTotal: Number.isFinite(baseTotal) ? Number(baseTotal) : null,
            extHours,
            amountDue,

            // NEW: integrated fields
            clientName,
            eventStatus,
            payment,
            items,
          }
        }

        const mapped = list.map(toRow)
        setRows(mapped)
        setPage(1)
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load bookings'
        setError(msg)
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
        r.clientName, // ADD: allow searching by client name
        r.place,
        r.date,
        r.startTime,
        r.endTime,
        r.package,
        r.grid,
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
        package: row.package || 'The Hanz',
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

  // Open extend modal for approved/confirmed bookings
  const openExtend = async (row: BookingRow) => {
    try {
      const cid = await ensureConfirmedId(row)
      if (!cid) {
        toast.error('Confirmed booking not found for this row')
        return
      }
      setExtendTarget({ row, cid })
      setExtendHours('1')
      setExtendConflict(null)
      setExtendOpen(true)
    } catch (e) {
      toast.error('Unable to open extension dialog')
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to assign staff'
      toast.error(msg)
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to cancel booking'
      toast.error(msg)
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to undo cancel'
      toast.error(msg)
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
        <div className="flex-1 min-h-0 ">
          {loading && (
            <div className="p-4 text-sm text-gray-500">Loading bookings…</div>
          )}
          {error && <div className="p-4 text-sm text-red-600">{error}</div>}
          <table className="min-w-full text-sm">
            <thead className="bg-gray-200 text-gray-700">
              <tr>
                {/* Only the three primary descriptors, then More Details + statuses */}
                <th className="text-left px-3 py-2 rounded-tl-xl">
                  Event Name
                </th>
                <th className="text-left px-3 py-2">Client Name</th>
                <th className="text-left px-3 py-2">Event Location</th>
                <th className="text-left px-3 py-2">More Details</th>
                <th className="text-left px-3 py-2">Approval Status</th>
                <th className="text-left px-3 py-2">Event Status</th>
                <th className="text-left px-3 py-2">Event Report</th>
                <th className="text-left px-3 py-2">Payment Status</th>
                <th className="text-left px-3 py-2 rounded-tr-xl">Actions</th>
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
                    {/* Only the three primary descriptors */}
                    <td className="px-3 py-2">{row.eventName}</td>
                    <td className="px-3 py-2">{row.clientName}</td>
                    <td className="px-3 py-2">{row.place}</td>

                    {/* MOVED: More Details popover right after the main details */}
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
                                  {(row.contact_person || '').trim() || '—'}
                                </div>
                                <div>
                                  <span className="font-medium">Number:</span>{' '}
                                  {(row.contact_person_number || '').trim() ||
                                    '—'}
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
                              <div className="font-semibold">
                                Total price (incl. extension)
                              </div>
                              <div className="text-gray-700">
                                {typeof row.amountDue === 'number'
                                  ? `₱${row.amountDue.toLocaleString('en-PH', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                  : '—'}
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

                    {/* Approval Status (booking status) */}
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

                    {/* Event Status */}
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-1 w-18 text-center rounded-full text-xs font-medium ${eventStatusBadgeClass(
                          row.eventStatus
                        )}`}
                      >
                        {eventStatusLabel(row.eventStatus)}
                      </span>
                    </td>

                    {/* Event Report trigger */}
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="px-2 py-1.5 rounded border text-xs"
                        onClick={() => openReport(row)}
                      >
                        View
                      </button>
                    </td>

                    {/* Payment Status */}
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-1 w-22 text-center rounded-full text-xs font-medium ${paymentBadgeClass(
                          row.payment
                        )}`}
                      >
                        {paymentLabel(row.payment)}
                      </span>
                    </td>

                    {/* Actions */}
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
                            {/* NEW: Contract actions */}
                            <button
                              type="button"
                              className="text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100"
                              onClick={() => viewContract(row)}
                            >
                              View Contract
                            </button>
                            <button
                              type="button"
                              className="text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100"
                              onClick={() => onPickUpload(row)}
                            >
                              Upload Contract
                            </button>
                            {/* Review */}
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
                            {/* Edit */}
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
                            {/* Cancel */}
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
                            {/* Undo Cancel */}
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
                            {/* Assign staff */}
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
                            {/* Extend hours */}
                            <button
                              type="button"
                              className={`text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
                                row.status === 'approved'
                                  ? ''
                                  : 'opacity-50 cursor-not-allowed'
                              }`}
                              disabled={row.status !== 'approved'}
                              onClick={() => openExtend(row)}
                            >
                              Extend hours…
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

      {/* Extend hours modal */}
      <Dialog
        open={extendOpen}
        onOpenChange={(o) => {
          if (!o) {
            setExtendOpen(false)
            setExtendTarget(null)
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
                setExtendTarget(null)
                setExtendConflict(null)
              }}
              disabled={extendBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded bg-litratoblack text-white text-sm disabled:opacity-50"
              onClick={async () => {
                if (!extendTarget) return
                const add = Math.max(0, Number(extendHours) || 0)
                if (!Number.isFinite(add)) return
                setExtendBusy(true)
                try {
                  // Lazy import to avoid top-level coupling
                  const {
                    preflightAdminExtensionConflicts,
                    setAdminExtensionDuration,
                  } = await import(
                    '../../../../schemas/functions/ConfirmedBookings/admin'
                  )
                  if (extendConflict) {
                    await setAdminExtensionDuration(extendTarget.cid, {
                      add_hours: add,
                      force: true,
                    })
                  } else {
                    const { conflicts } =
                      await preflightAdminExtensionConflicts(extendTarget.cid, {
                        add_hours: add,
                        bufferHours: 2,
                      })
                    if (Array.isArray(conflicts) && conflicts.length) {
                      setExtendConflict(conflicts[0])
                      return
                    }
                    await setAdminExtensionDuration(extendTarget.cid, {
                      add_hours: add,
                    })
                  }
                  // Optimistically update the row in-place
                  setRows((prev) =>
                    prev.map((r) => {
                      const same = r.requestid
                        ? r.requestid === extendTarget.row.requestid
                        : r.id === extendTarget.row.id
                      if (!same) return r
                      const base = Number(r.baseTotal || 0)
                      const currExt = Math.max(
                        0,
                        Number(r.extension_duration || 0)
                      )
                      const nextExt = currExt + add
                      return {
                        ...r,
                        extension_duration: nextExt,
                        amountDue: base + nextExt * 2000,
                      }
                    })
                  )
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

      {/* Event Report modal (masterlist) */}
      <Dialog
        open={reportOpen}
        onOpenChange={(o) => {
          if (!o) {
            setReportOpen(false)
            setReportTarget(null)
            setReportPayment(null)
            setReportItems(null)
            setReportStaff([])
            setReportItemLists(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Event report</DialogTitle>
            <DialogDescription>
              Summary of event, payment, equipment, and staff.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* Event details */}
            <div className="rounded border p-3 bg-gray-50">
              <div className="text-[11px] uppercase text-gray-600 font-semibold mb-2">
                Event details
              </div>
              <div className="space-y-1 text-gray-900">
                <div>
                  <span className="text-gray-600">Event:</span>{' '}
                  {reportTarget?.eventName || '—'}
                </div>
                <div>
                  <span className="text-gray-600">Date:</span>{' '}
                  {reportTarget?.date || '—'}
                </div>
                <div>
                  <span className="text-gray-600">Time:</span>{' '}
                  {reportTarget?.startTime || '—'}
                  {reportTarget?.endTime ? ` - ${reportTarget.endTime}` : ''}
                </div>
                <div>
                  <span className="text-gray-600">Location:</span>{' '}
                  {reportTarget?.place || '—'}
                </div>
                <div>
                  <span className="text-gray-600">Package:</span>{' '}
                  {reportTarget?.package || '—'}
                </div>
                <div>
                  <span className="text-gray-600">Grid:</span>{' '}
                  {reportTarget?.grid || '—'}
                </div>
                <div>
                  <span className="text-gray-600">Event status:</span>{' '}
                  {reportTarget
                    ? eventStatusLabel(reportTarget.eventStatus)
                    : '—'}
                </div>
              </div>
            </div>

            {/* Payment details */}
            <div className="rounded border p-3 bg-gray-50">
              <div className="text-[11px] uppercase text-gray-600 font-semibold mb-2">
                Payment details
              </div>
              {reportLoading ? (
                <div className="text-gray-700">Loading…</div>
              ) : (
                <div className="space-y-1 text-gray-900">
                  <div>
                    <span className="text-gray-600">Status:</span>{' '}
                    {reportPayment
                      ? reportPayment.status === 'paid'
                        ? 'Paid'
                        : reportPayment.status === 'partial'
                        ? 'Partially Paid'
                        : 'Unpaid'
                      : '—'}
                  </div>
                  <div>
                    <span className="text-gray-600">Paid so far:</span>{' '}
                    {typeof reportPayment?.paidTotal === 'number'
                      ? `₱${reportPayment.paidTotal.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : '—'}
                  </div>
                  <div>
                    <span className="text-gray-600">Amount due:</span>{' '}
                    {typeof reportPayment?.amountDue === 'number'
                      ? `₱${reportPayment.amountDue.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : '—'}
                  </div>
                </div>
              )}
            </div>

            {/* Equipment details */}
            <div className="rounded border p-3 bg-gray-50">
              <div className="text-[11px] uppercase text-gray-600 font-semibold mb-2">
                Equipment details
              </div>
              {reportLoading ? (
                <div className="text-gray-700">Loading…</div>
              ) : reportItems ? (
                <div className="space-y-3 text-gray-900">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <div>
                      <span className="text-gray-600">Total:</span>{' '}
                      {reportItems.total}
                    </div>
                    <div>
                      <span className="text-gray-600">OK:</span>{' '}
                      {reportItems.ok}
                    </div>
                    <div>
                      <span className="text-gray-600">Damaged:</span>{' '}
                      {reportItems.damaged}
                    </div>
                    <div>
                      <span className="text-gray-600">Missing:</span>{' '}
                      {reportItems.missing}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="font-semibold mb-1">Damaged items</div>
                      {reportItemLists && reportItemLists.damaged.length ? (
                        <ul className="list-disc list-inside space-y-0.5">
                          {reportItemLists.damaged.map((it, idx) => (
                            <li key={`dam-${idx}`}>
                              {it.name} × {it.qty}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-gray-700">None</div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Missing items</div>
                      {reportItemLists && reportItemLists.missing.length ? (
                        <ul className="list-disc list-inside space-y-0.5">
                          {reportItemLists.missing.map((it, idx) => (
                            <li key={`miss-${idx}`}>
                              {it.name} × {it.qty}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-gray-700">None</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-700">No items available.</div>
              )}
            </div>

            {/* Staff entry logs (simple list) */}
            <div className="rounded border p-3 bg-gray-50">
              <div className="text-[11px] uppercase text-gray-600 font-semibold mb-2">
                Staff entry logs
              </div>
              {reportLoading ? (
                <div className="text-gray-700">Loading…</div>
              ) : reportStaff.length ? (
                <ul className="list-disc list-inside text-gray-900">
                  {reportStaff.map((s) => (
                    <li key={s.id}>
                      {`${s.firstname || ''} ${s.lastname || ''}`.trim() ||
                        s.id}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-700">—</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="px-4 py-2 rounded border text-sm"
              onClick={() => {
                setReportOpen(false)
                setReportTarget(null)
              }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NEW: Hidden input for contract upload */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={onUploadFile}
      />
    </div>
  )
}

// NOTE: Removed the duplicate `use client` block and default export for AdminEventCardsPage at the end of the file.
// Replaced it with the panelized version below.
function EventCardsPanel() {
  // Local types to avoid conflicts
  type Status = 'ongoing' | 'standby' | 'finished'
  type Payment = 'unpaid' | 'partially-paid' | 'paid'
  type Item = { name: string; qty?: number }
  type AdminEvent = {
    id: string | number
    title: string
    packageName?: string
    packageId?: number
    accountName?: string
    dateTime: string
    location: string
    status: Status
    payment: Payment
    basePrice?: number
    extensionHours?: number
    totalPrice?: number
    imageUrl?: string
    damagedItems?: Item[]
    missingItems?: Item[]
    assignedStaff?: { id: number; firstname: string; lastname: string }[]
    // extra details
    strongestSignal?: string
    contactInfo?: string
    contactPerson?: string
    contactPersonNumber?: string
    grid?: string
  }

  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const API_BASE =
    (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
      'http://localhost:5000') + '/api/admin/confirmed-bookings'

  const mapBookingStatus = useCallback((s?: string): Status => {
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
  }, [])
  const mapPaymentStatus = useCallback((s?: string): Payment => {
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
  }, [])

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
        const data = (await res.json()) as unknown
        type AdminBookingAPI = {
          id?: number
          confirmed_id?: number
          event_name?: string
          package_name?: string
          package_id?: number
          event_date?: string
          event_time?: string
          event_address?: string
          extension_duration?: number | string | null
          total_booking_price?: number | string | null
          booking_status?: string
          payment_status?: string
          strongest_signal?: string
          contact_info?: string
          contact_person?: string
          contact_person_number?: string
          grid?: string
          firstname?: string
          lastname?: string
          username?: string
        }
        const raw: unknown[] =
          typeof data === 'object' &&
          data !== null &&
          'bookings' in (data as Record<string, unknown>) &&
          Array.isArray((data as Record<string, unknown>).bookings)
            ? ((data as Record<string, unknown>).bookings as unknown[])
            : []
        const allowed = new Set(['scheduled', 'in_progress', 'completed'])
        const mapped: AdminEvent[] = raw
          .filter(
            (b): b is AdminBookingAPI => typeof b === 'object' && b !== null
          )
          .filter((b) =>
            allowed.has(String(b.booking_status ?? '').toLowerCase())
          )
          .map((b) => {
            const title = b.event_name || b.package_name || 'Event'
            const date = b.event_date || ''
            const time = b.event_time || ''
            const dateTime = [date, time].filter(Boolean).join(' - ')
            const location = b.event_address || ''
            const extHours = Number(b.extension_duration ?? 0)
            const base = Number(b.total_booking_price ?? 0)
            const totalPrice = base + extHours * 2000
            const accountName =
              [b.firstname, b.lastname].filter(Boolean).join(' ').trim() ||
              b.username ||
              undefined
            return {
              id: b.id ?? b.confirmed_id ?? '',
              title,
              packageName: b.package_name || undefined,
              packageId:
                typeof b.package_id === 'number' ? b.package_id : undefined,
              accountName,
              dateTime,
              location,
              status: mapBookingStatus(b.booking_status),
              payment: mapPaymentStatus(b.payment_status),
              basePrice: base,
              extensionHours: extHours,
              totalPrice,
              imageUrl: undefined,
              damagedItems: [],
              missingItems: [],
              assignedStaff: [],
              strongestSignal: b.strongest_signal || undefined,
              contactInfo: b.contact_info || undefined,
              contactPerson: b.contact_person || undefined,
              contactPersonNumber: b.contact_person_number || undefined,
              grid: b.grid || undefined,
            }
          })
        if (mounted) {
          setEvents(mapped)
          // Fetch assigned staff for each booking (best-effort)
          try {
            const { listAssignedStaff } = await import(
              '../../../../schemas/functions/staffFunctions/staffAssignment'
            )
            const results = await Promise.all(
              mapped.map(async (ev) => {
                const idNum = Number(ev.id)
                if (!Number.isFinite(idNum)) return { id: ev.id, staff: [] }
                const staff = await listAssignedStaff(idNum).catch(() => [])
                return { id: ev.id, staff }
              })
            )
            const byId = new Map<AdminEvent['id'], any[]>(
              results.map((r) => [r.id, r.staff])
            )
            setEvents((prev) =>
              prev.map((ev) => ({
                ...ev,
                assignedStaff: (byId.get(ev.id) || []).map((s: any) => ({
                  id: Number(s.id),
                  firstname: String(s.firstname || ''),
                  lastname: String(s.lastname || ''),
                })),
              }))
            )
          } catch {
            // ignore if staff fetch fails; UI will show none
          }
        }
      } catch (e: unknown) {
        if (mounted)
          setError(e instanceof Error ? e.message : 'Failed to load events')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [API_BASE, mapBookingStatus, mapPaymentStatus])

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

  // Handle status change from EventCard details
  const handleCardStatusChange = async (
    bookingId: AdminEvent['id'],
    next: Status
  ) => {
    const toAdmin = (s: Status): 'scheduled' | 'in_progress' | 'completed' =>
      s === 'ongoing'
        ? 'in_progress'
        : s === 'finished'
        ? 'completed'
        : 'scheduled'
    // optimistic update
    const prev = events
    setEvents((cur) =>
      cur.map((e) => (e.id === bookingId ? { ...e, status: next } : e))
    )
    try {
      const { updateAdminBookingStatus } = await import(
        '../../../../schemas/functions/ConfirmedBookings/admin'
      )
      await updateAdminBookingStatus(bookingId, toAdmin(next))
      // success toast if available
      try {
        // @ts-ignore toast likely available in this file's scope
        toast?.success?.('Event status updated')
      } catch {}
    } catch (e: unknown) {
      // revert on failure
      setEvents(prev)
      try {
        const msg = e instanceof Error ? e.message : 'Failed to update status'
        // @ts-ignore toast likely available in this file's scope
        toast?.error?.(msg)
      } catch {}
    }
  }

  return (
    <div className="min-h-[60vh] w-full overflow-x-hidden">
      <div className="px-2 py-2">
        <div className=" gap-2 flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as Status | 'all')}
            >
              <SelectTrigger className="w-[180px] rounded h-9">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Statuses: All</SelectItem>
                <SelectItem value="standby">Standby</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="finished">Finished</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={itemsFilter}
              onValueChange={(v) =>
                setItemsFilter((v as 'all' | 'with' | 'without') ?? 'all')
              }
            >
              <SelectTrigger className="w-[180px] rounded h-9">
                <SelectValue placeholder="Items: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Items: All</SelectItem>
                <SelectItem value="with">With issues</SelectItem>
                <SelectItem value="without">No issues</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={paymentFilter}
              onValueChange={(v) => setPaymentFilter(v as Payment | 'all')}
            >
              <SelectTrigger className="w-[200px] rounded h-9">
                <SelectValue placeholder="Payment: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Payments: All</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partially-paid">Partially Paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events…"
              className="h-9 w-64 max-w-[60vw] px-3 rounded-full outline-none bg-gray-400 text-sm"
              aria-label="Search events"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {paginated.map((ev, idx) => (
              <EventCard
                key={`${ev.title}-${idx}`}
                bookingId={ev.id}
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
                missingItems={ev.missingItems}
                assignedStaff={ev.assignedStaff}
                strongestSignal={ev.strongestSignal}
                contactInfo={ev.contactInfo}
                contactPerson={ev.contactPerson}
                contactPersonNumber={ev.contactPersonNumber}
                grid={ev.grid}
                onStatusChange={(s) => handleCardStatusChange(ev.id, s)}
              />
            ))}
            {loading && (
              <div className="col-span-full text-sm text-gray-500 px-2">
                Loading events…
              </div>
            )}
            {error && (
              <div className="col-span-full text-sm text-red-600 px-2">
                {error}
              </div>
            )}
          </div>

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
