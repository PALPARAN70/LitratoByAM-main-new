'use client'
import Image from 'next/image'
import { useState, useEffect, useCallback, useRef } from 'react'
import { HiOutlineLocationMarker } from 'react-icons/hi'
import { User, Phone, Signal, Grid2x2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDisplayDateTime } from '@/lib/datetime'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  listPackageItemsForPackage,
  listPackageItemsForPackageEmployee,
  patchInventory,
  patchInventoryEmployee,
  fetchPaymentSummaryForBooking,
  listPaymentsForBooking,
  createPaymentForBooking,
  uploadPaymentProofImage,
  listVisibleInventory,
} from '../schemas/functions/EventCards/api'
// Admin payments helpers (for verification from the Event modal)
import {
  updateAdminPayment,
  getAdminBookingBalance,
} from '../schemas/functions/Payment/adminPayments'
import StaffTimelineLogger from './StaffTimelineLogger'
// Booking status update helpers (admin/staff)
import {
  updateAdminBookingStatus,
  type AdminBookingStatus,
} from '../schemas/functions/ConfirmedBookings/admin'
import {
  updateAssignedBookingStatus,
  type StaffBookingStatus,
} from '../schemas/functions/ConfirmedBookings/staff'

type Status = 'ongoing' | 'standby' | 'finished'
type Payment = 'unpaid' | 'partially-paid' | 'paid'
type Item = { name: string; qty?: number; notes?: string }

interface EventCardProps {
  bookingId?: number | string
  summaryRole?: 'admin' | 'employee'
  title?: string
  // NEW: account name to show in Overview instead of Booking ID
  accountName?: string
  packageName?: string
  // NEW: package id to fetch dynamic equipment items
  packageId?: number
  dateTime?: string
  location?: string
  status?: Status
  payment?: Payment
  imageUrl?: string
  damagedItems?: Item[]
  basePrice?: number // base booking price
  extensionHours?: number // extension hours
  totalPrice?: number // optional total price to display
  // NEW: staff display
  assignedStaff?: Array<{ firstname?: string; lastname?: string }>
  // NEW: extra event details
  strongestSignal?: string
  contactInfo?: string
  grid?: string | string[]
  contactPerson?: string
  contactPersonNumber?: string
  boothPlacement?: string
  onItemsChange?: (
    items: Array<{
      type: 'damaged'
      name: string
      qty?: number
      notes?: string
    }>
  ) => void
  // NEW: allow changing event status from Details dialog
  onStatusChange?: (status: Status) => void
  itemsCatalog?: string[]
  // NEW: optional payment proof URL to preview
  paymentProofUrl?: string
}

// No static default items. Items are loaded dynamically by packageId or provided via itemsCatalog.

export default function EventCard({
  bookingId,
  summaryRole = 'admin',
  title,
  accountName,
  packageName,
  packageId,
  dateTime,
  location,
  status = 'standby',
  payment = 'unpaid',
  imageUrl = '/Images/litratobg.jpg',
  damagedItems = [],
  basePrice,
  extensionHours,
  totalPrice,
  assignedStaff,
  strongestSignal,
  contactInfo,
  grid,
  contactPerson,
  contactPersonNumber,
  boothPlacement,
  onItemsChange,
  onStatusChange,
  itemsCatalog,
  // NEW: payment proof
  paymentProofUrl,
}: EventCardProps) {
  type ItemEntry = {
    id: string
    name: string
    type: 'good' | 'damaged'
    inventoryId?: number
    notes?: string // staff notes per item
    showNotes?: boolean // UI: toggle to reveal notes input
  }
  const [editItems, setEditItems] = useState<ItemEntry[]>([])

  const [paymentStatus, setPaymentStatus] = useState<Payment>(payment)
  const [paidTotal, setPaidTotal] = useState<number | null>(null)
  const [amountDue, setAmountDue] = useState<number | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  // NEW: local state for event status selection within Details
  const [eventStatus, setEventStatus] = useState<Status>(status)
  // NEW: local card status for immediate badge reflection
  const [cardStatus, setCardStatus] = useState<Status>(status)
  // NEW: track whether we have loaded dynamic items for this open session
  const [itemsLoadedFromPackage, setItemsLoadedFromPackage] = useState(false)

  // NEW: Payments manager modal (list + create + proof preview)
  const [paymentsOpen, setPaymentsOpen] = useState(false)
  const [payments, setPayments] = useState<
    Array<{
      payment_id: number
      booking_id: number
      user_id: number
      amount: number
      amount_paid: number
      payment_method: string
      proof_image_url?: string | null
      reference_no?: string | null
      payment_status: string
      notes?: string | null
      verified_at?: string | null
      created_at?: string
    }>
  >([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)
  // create form state
  const [newAmount, setNewAmount] = useState<string>('')
  const [newMethod, setNewMethod] = useState<'cash' | 'gcash'>('cash')
  const [newRef, setNewRef] = useState<string>('')
  const [newNotes, setNewNotes] = useState<string>('')
  const [createBusy, setCreateBusy] = useState(false)
  const [newProofUrl, setNewProofUrl] = useState<string>('')
  const [uploadBusy, setUploadBusy] = useState(false)
  // Proof viewer + verify states
  const [proofOpen, setProofOpen] = useState(false)
  const [proofPaymentId, setProofPaymentId] = useState<number | null>(null)
  const [confirmVerifyOpen, setConfirmVerifyOpen] = useState(false)
  const [verifySubmitting, setVerifySubmitting] = useState(false)
  // Ref to GCash file input section so we can auto-scroll it into view when selecting GCash
  const gcashSectionRef = useRef<HTMLDivElement | null>(null)

  // When payment method switches to GCash, ensure the file chooser is visible without manual scroll
  useEffect(() => {
    if (newMethod === 'gcash' && gcashSectionRef.current) {
      try {
        gcashSectionRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      } catch {
        // no-op if scrolling fails
      }
    }
  }, [newMethod])

  useEffect(() => {
    setPaymentStatus(payment)
  }, [payment])

  useEffect(() => {
    setEventStatus(status)
  }, [status])

  // Keep local badge in sync when parent prop changes externally
  useEffect(() => {
    setCardStatus(status)
  }, [status])

  const setItemStatus = (id: string, type: 'good' | 'damaged') => {
    setEditItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, type } : it))
    )
  }
  const setItemNotes = (id: string, notes: string) => {
    setEditItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, notes } : it))
    )
  }
  const toggleItemNotes = (id: string, force?: boolean) => {
    setEditItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, showNotes: force != null ? force : !it.showNotes }
          : it
      )
    )
  }

  // Helper to initialize items when dialog opens
  const initializeItems = () => {
    const catalog = (itemsCatalog && itemsCatalog.length ? itemsCatalog : [])
      .map((n) => n.trim())
      .filter(Boolean)

    const normalize = (value: string) =>
      value
        .replace(/\s*\(.*?\)\s*$/, '')
        .trim()
        .toLowerCase()
    const damagedMap = new Map(
      damagedItems
        .map((it) => {
          const key = normalize(String(it.name || ''))
          if (!key.length) return null
          const note =
            typeof it.notes === 'string' && it.notes.trim().length
              ? it.notes.trim()
              : undefined
          return [key, note] as [string, string | undefined]
        })
        .filter(Boolean) as Array<[string, string | undefined]>
    )

    const toEntries: ItemEntry[] = catalog.map((name, i) => {
      const key = normalize(name)
      if (damagedMap.has(key)) {
        const note = (damagedMap.get(key) as string | undefined)?.trim()
        return {
          id: `d-${i}-${name}`,
          name,
          type: 'damaged',
          notes: note,
          showNotes: Boolean(note?.length),
        }
      }
      return { id: `g-${i}-${name}`, name, type: 'good' }
    })
    setEditItems(toEntries)
  }

  // NEW: load items dynamically from package when available
  const loadPackageItems = async () => {
    if (!packageId) return false
    const resolveItemNote = (item: any): string | undefined => {
      if (!item || typeof item !== 'object') return undefined
      const candidates = [
        item.inventory_notes,
        item.equipment_notes,
        item.notes,
        item.item_notes,
      ]
      for (const candidate of candidates) {
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim()
          if (trimmed.length) return trimmed
        }
      }
      return undefined
    }
    try {
      const items =
        summaryRole === 'employee'
          ? await listPackageItemsForPackageEmployee(packageId)
          : await listPackageItemsForPackage(packageId)
      // Fetch current inventory to reflect latest condition/status in the UI when permitted.
      let inventory: Array<{
        id: number
        condition?: string
        status?: boolean
        notes?: string | null
      }> = []
      if (summaryRole !== 'employee') {
        try {
          inventory = await listVisibleInventory()
        } catch {
          inventory = []
        }
      }
      const invMap = new Map<
        number,
        { condition?: string; status?: boolean; notes?: string | null }
      >()
      for (const inv of inventory) {
        if (typeof (inv as any).id === 'number') {
          invMap.set((inv as any).id as number, {
            condition: (inv as any).condition,
            status: (inv as any).status,
            notes: (inv as any).notes ?? null,
          })
        }
      }
      if (!items.length) {
        setItemsLoadedFromPackage(true)
        setEditItems([])
        return true
      }

      // Build entries per unit so each unit can be marked Good or Damaged
      const normalize = (value: string) =>
        value
          .replace(/\s*\(.*?\)\s*$/, '')
          .trim()
          .toLowerCase()
      const damagedMap = new Map(
        damagedItems
          .map((it) => {
            const key = normalize(String(it.name || ''))
            if (!key.length) return null
            const note =
              typeof it.notes === 'string' && it.notes.trim().length
                ? it.notes.trim()
                : undefined
            return [key, note] as [string, string | undefined]
          })
          .filter(Boolean) as Array<[string, string | undefined]>
      )
      const entries: ItemEntry[] = []
      items.forEach((it, idx) => {
        const baseName = String(it.material_name || '').trim()
        if (!baseName.length) return
        const normalizedName = normalize(baseName)
        const qty = Math.max(1, Number(it.quantity || 1))
        const invId =
          typeof it.inventory_id === 'number' ? it.inventory_id : undefined
        const fallbackNote = resolveItemNote(it)
        const current =
          invId != null
            ? invMap.get(invId) ?? {
                condition: it.condition,
                status: it.status,
                notes: fallbackNote ?? null,
              }
            : {
                condition: it.condition,
                status: it.status,
                notes: fallbackNote ?? null,
              }
        for (let i = 0; i < qty; i++) {
          const label = qty > 1 ? `${baseName} (${i + 1}/${qty})` : baseName
          // Priority for initial selection:
          // 1) If inventory status is unavailable => mark as Damaged
          // 2) Else if inventory condition is Damaged => Damaged
          // 3) Else fallback to provided damaged list
          // 4) Else Good
          let type: 'good' | 'damaged' = 'good'
          if (current && current.status === false) {
            type = 'damaged'
          } else if (
            current &&
            typeof current.condition === 'string' &&
            current.condition.toLowerCase() === 'damaged'
          ) {
            type = 'damaged'
          } else if (damagedMap.has(normalizedName)) {
            type = 'damaged'
          }
          const inventoryNotes =
            typeof current?.notes === 'string' && current.notes.trim().length
              ? current.notes.trim()
              : undefined
          const packageNotes = fallbackNote
          const listNotes = damagedMap.get(normalizedName)
          const existingNotes =
            inventoryNotes || packageNotes || listNotes || undefined
          entries.push({
            id: `pkg-${idx}-${i}-${baseName}`,
            name: label,
            type,
            inventoryId: invId,
            notes: existingNotes,
            showNotes: Boolean(existingNotes && existingNotes.length),
          })
        }
      })
      setEditItems(entries)
      setItemsLoadedFromPackage(true)
      return true
    } catch {
      // fallback to defaults if fetch fails
      setItemsLoadedFromPackage(false)
      return false
    }
  }

  // NEW: persist inventory updates based on item statuses
  const persistInventoryUpdates = async () => {
    // Group by inventoryId
    const groups = new Map<
      number,
      {
        hasDamaged: boolean
        total: number
        goodCount: number
        notes: Set<string>
      }
    >()
    for (const it of editItems) {
      if (!it.inventoryId) continue
      const g = groups.get(it.inventoryId) || {
        hasDamaged: false,
        total: 0,
        goodCount: 0,
        notes: new Set<string>(),
      }
      g.total += 1
      if (it.type === 'damaged') g.hasDamaged = true
      else if (it.type === 'good') g.goodCount += 1
      if (it.notes && it.notes.trim()) {
        g.notes.add(it.notes.trim())
      }
      groups.set(it.inventoryId, g)
    }

    if (groups.size === 0) return

    // Decide updates per inventory item
    const tasks: Array<Promise<void>> = []
    groups.forEach((g, invId) => {
      let body: Record<string, unknown> | null = null
      if (g.hasDamaged) {
        // damaged: set condition to 'Damaged'
        body = { condition: 'Damaged' }
      } else if (g.goodCount === g.total) {
        // all Good: set condition to 'Good' and status to available
        body = { condition: 'Good', status: true }
      }
      if (!body) body = {}
      // Persist combined notes from all units (if any). Empty when all cleared.
      const combined = Array.from(g.notes)
        .map((s) => s.trim())
        .filter(Boolean)
        .join('\n')
      if (combined || g.notes.size >= 0) {
        body.notes = combined // allow '' to clear
      }
      const t =
        summaryRole === 'employee'
          ? patchInventoryEmployee(invId, body)
          : patchInventory(invId, body)
              .then(() => {})
              .catch(() => {})
      tasks.push(t as unknown as Promise<void>)
    })
    if (tasks.length) await Promise.allSettled(tasks)
  }

  // Fetch payment summary (admin endpoint) when dialog opens
  const fetchPaymentSummary = useCallback(async () => {
    if (!bookingId) return
    try {
      setSummaryLoading(true)
      const data = await fetchPaymentSummaryForBooking(bookingId, summaryRole)
      if (data) {
        const paid = Number(data.paidTotal ?? 0)
        const due = Number(data.amountDue ?? 0)
        setPaidTotal(paid)
        setAmountDue(due)
        if (data.computedStatus === 'paid') setPaymentStatus('paid')
        else if (data.computedStatus === 'partial')
          setPaymentStatus('partially-paid')
        else setPaymentStatus('unpaid')
      } else {
        setPaidTotal(null)
        setAmountDue(null)
        setPaymentStatus('unpaid')
      }
    } catch (e) {
      // silently ignore in UI; you may add a toast if desired
      setPaidTotal(null)
      setAmountDue(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [bookingId, summaryRole])

  // Load all payments for this booking into modal list
  const loadPayments = useCallback(async () => {
    if (!bookingId) return
    setPaymentsLoading(true)
    setPaymentsError(null)
    try {
      const rows = await listPaymentsForBooking(bookingId, summaryRole)
      setPayments(Array.isArray(rows) ? rows : [])
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in (e as any)
          ? String((e as any).message || '')
          : ''
      setPaymentsError(msg || 'Failed to load payments')
    } finally {
      setPaymentsLoading(false)
    }
  }, [bookingId, summaryRole])

  useEffect(() => {
    if (!paymentsOpen) return
    void (async () => {
      await loadPayments()
      await fetchPaymentSummary()
    })()
  }, [paymentsOpen, loadPayments, fetchPaymentSummary])

  // Verify handler (admin only)
  const verifyCurrentPayment = async () => {
    if (!proofPaymentId) return
    try {
      setVerifySubmitting(true)
      const current = payments.find((pp) => pp.payment_id === proofPaymentId)
      if (!current) throw new Error('Payment not found')
      const bal = await getAdminBookingBalance(Number(current.booking_id))
      const remaining = Math.max(0, bal.amount_due - bal.total_paid)
      const amt = Number(current.amount_paid || 0)
      const rowStatus = amt >= remaining ? 'Fully Paid' : 'Partially Paid'
      await updateAdminPayment(proofPaymentId, {
        verified_at: new Date().toISOString(),
        payment_status: rowStatus,
      })
      setConfirmVerifyOpen(false)
      setProofOpen(false)
      setProofPaymentId(null)
      toast.success('Payment verified')
      await loadPayments()
      await fetchPaymentSummary()
    } catch (e) {
      // @ts-ignore
      console.error('Verify payment failed:', e?.message || e)
      toast.error('Failed to verify payment')
    } finally {
      setVerifySubmitting(false)
    }
  }

  const handleSavePayment = async () => {
    if (!bookingId || uploadBusy || createBusy) return
    const amt = Number(newAmount)
    if (!Number.isFinite(amt) || amt <= 0) return
    const remaining =
      typeof amountDue === 'number' && typeof paidTotal === 'number'
        ? Math.max(0, amountDue - paidTotal)
        : null
    if (remaining === 0) {
      toast.error(
        'This booking is already fully paid. No additional payment is needed.'
      )
      return
    }
    if (remaining != null && amt > remaining) {
      toast.error(
        `Payment exceeds remaining balance (₱${remaining.toLocaleString(
          'en-PH',
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )})`
      )
      return
    }
    try {
      setCreateBusy(true)
      const created = await createPaymentForBooking(
        bookingId,
        {
          amount_paid: amt,
          payment_method: newMethod,
          reference_no: newRef || null,
          notes: newNotes || null,
          proofImageUrl:
            newMethod === 'gcash' && newProofUrl ? newProofUrl : null,
        },
        summaryRole
      )
      if (created) {
        toast.success('Payment recorded')
        setNewAmount('')
        setNewMethod('cash')
        setNewRef('')
        setNewNotes('')
        setNewProofUrl('')
        await loadPayments()
        await fetchPaymentSummary()
      } else {
        toast.error('Failed to create payment')
      }
    } finally {
      setCreateBusy(false)
    }
  }
  const statusStyles: Record<Status, { label: string; cls: string }> = {
    ongoing: { label: 'Ongoing', cls: 'bg-yellow-700 text-white' },
    standby: { label: 'Standby', cls: 'bg-gray-700  text-white' },
    finished: { label: 'Finished', cls: 'bg-green-700 text-white' },
  }
  const paymentStyles: Record<Payment, { label: string; cls: string }> = {
    'partially-paid': {
      label: 'Partially Paid',
      cls: 'bg-yellow-700 text-white',
    },
    unpaid: { label: 'Unpaid', cls: 'bg-red-700 text-white' },
    paid: { label: 'Paid', cls: 'bg-green-700 text-white' },
  }
  const formatPaymentMethod = (method?: string | null) => {
    if (!method) return '—'
    const lower = method.toLowerCase()
    if (lower === 'cash') return 'Cash'
    if (lower === 'gcash') return 'GCash'
    return method
  }
  const s = statusStyles[cardStatus]
  const p = paymentStyles[paymentStatus]
  const HOURLY_RATE = 2000
  const extHours = Math.max(0, Number(extensionHours || 0))
  const base = Number(basePrice || 0)
  const computedTotal =
    typeof totalPrice === 'number' ? totalPrice : base + extHours * HOURLY_RATE
  return (
    <div>
      <div className="flex flex-col w-56 bg-gray-300 p-2 rounded-xl">
        <div className="relative w-52 h-44">
          <Image
            src={imageUrl}
            alt="Event Pic"
            fill
            priority
            className="object-cover rounded-lg"
          />
          <div
            className={`absolute top-2 right-2 w-28 text-center text-xs font-bold px-2 py-1 rounded ${s.cls}`}
          >
            {s.label}
          </div>
          <div
            className={`absolute top-10 right-2 w-28 text-center text-xs font-bold px-2 py-1 rounded ${p.cls}`}
          >
            {p.label}
          </div>
        </div>
        <div className="flex flex-col gap-1 items-start">
          <p className="text-xs m-0 leading-tight">
            {dateTime ? formatDisplayDateTime(dateTime) : '—'}
          </p>
          <p className="font-bold m-0 leading-tight flex items-center gap-1">
            {title || '—'}
          </p>
          <p className="text-xs m-0 leading-tight flex mb-2 gap-1">
            <HiOutlineLocationMarker className="h-3 w-3 mt-[1.5px]" />
            {location || '—'}
          </p>
          {/* Staff line */}
          <p className="text-xs m-0 leading-tight mb-2">
            <span className="font-semibold">Staff:</span>{' '}
            {Array.isArray(assignedStaff) && assignedStaff.length
              ? assignedStaff
                  .map((s) => `${s.firstname || ''} ${s.lastname || ''}`.trim())
                  .filter(Boolean)
                  .join(', ')
              : '—'}
          </p>
          {typeof totalPrice === 'number' ? (
            <p className="text-xs m-0 leading-tight mb-1">
              Total: ₱
              {Number(totalPrice).toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end pt-2">
          <Dialog
            onOpenChange={(open) => {
              if (open) {
                // Prefer dynamic items from package when available
                if (packageId) {
                  loadPackageItems().then((ok) => {
                    if (!ok) initializeItems()
                  })
                } else {
                  initializeItems()
                }
                fetchPaymentSummary()
              }
            }}
          >
            <DialogTrigger asChild>
              <button
                type="button"
                className="rounded text-center px-2 text-white transition-all duration-300 cursor-pointer bg-black"
              >
                Details
              </button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto p-6">
              <DialogHeader>
                <DialogTitle>Event Details</DialogTitle>
                <DialogDescription>
                  Information and controls for this event.
                </DialogDescription>
              </DialogHeader>
              {/* Summary bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 mb-4">
                <div className="min-w-0">
                  <div className="text-base font-semibold truncate text-gray-900">
                    {title || '—'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {dateTime ? formatDisplayDateTime(dateTime) : '—'} •{' '}
                    {location || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}
                  >
                    {s.label}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${p.cls}`}
                  >
                    {p.label}
                  </span>
                </div>
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* LEFT: Details */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Overview */}
                  <div className="rounded-lg border p-4 bg-gray-50 space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">
                      Overview
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                      <div>
                        <span className="font-medium text-gray-600">
                          Event Name:
                        </span>{' '}
                        <span className="text-gray-900">{title}</span>
                      </div>
                      {accountName ? (
                        <div>
                          <span className="font-medium text-gray-600">
                            Account Name:
                          </span>{' '}
                          <span className="text-gray-900">{accountName}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Schedule & Location */}
                  <div className="rounded-lg border p-4 bg-gray-50 space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">
                      Schedule & Location
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                      <div>
                        <span className="font-medium text-gray-600">
                          Date & Time:
                        </span>{' '}
                        <span className="text-gray-900">
                          {dateTime ? formatDisplayDateTime(dateTime) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">
                          Location:
                        </span>{' '}
                        <span className="text-gray-900">{location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Package & Pricing */}
                  <div className="rounded-lg border p-4 bg-gray-50 space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">
                      Package & Pricing
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                      {packageName ? (
                        <div>
                          <span className="font-medium text-gray-600">
                            Package:
                          </span>{' '}
                          <span className="text-gray-900">{packageName}</span>
                        </div>
                      ) : null}
                      <div>
                        <span className="font-medium text-gray-600">
                          Base Price:
                        </span>{' '}
                        <span className="text-gray-900">{`₱${base.toLocaleString(
                          'en-PH',
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}`}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">
                          Extension Hours:
                        </span>{' '}
                        <span className="text-gray-900">{extHours}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">
                          Extension Add-on:
                        </span>{' '}
                        <span className="text-gray-900">{`₱${(
                          extHours * HOURLY_RATE
                        ).toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-base font-semibold text-gray-900">
                      Total:{' '}
                      {`₱${Number(computedTotal).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </div>
                  </div>

                  {/* Contact & On-site */}
                  <div className="rounded-lg border p-4 bg-gray-50 space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">
                      Contact & On-site
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                      <div>
                        <span className="font-medium text-gray-600">
                          Contact Info:
                        </span>{' '}
                        {contactInfo && String(contactInfo).trim().length
                          ? contactInfo
                          : '—'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">
                          Contact Person:
                        </span>{' '}
                        {contactPerson && String(contactPerson).trim().length
                          ? contactPerson
                          : '—'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">
                          Contact Person #:
                        </span>{' '}
                        {contactPersonNumber &&
                        String(contactPersonNumber).trim().length
                          ? contactPersonNumber
                          : '—'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">
                          Strongest Signal:
                        </span>{' '}
                        {strongestSignal &&
                        String(strongestSignal).trim().length
                          ? strongestSignal
                          : '—'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Grid:</span>{' '}
                        {Array.isArray(grid)
                          ? (grid as string[]).filter(Boolean).join(', ')
                          : grid && String(grid).trim().length
                          ? String(grid)
                          : '—'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">
                          Booth Placement:
                        </span>{' '}
                        {boothPlacement && String(boothPlacement).trim().length
                          ? boothPlacement
                          : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Staff + Statuses side-by-side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Staff */}
                    <div className="rounded-lg border p-4 bg-gray-50 space-y-2">
                      <div className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">
                        Assigned Staff
                      </div>
                      {Array.isArray(assignedStaff) && assignedStaff.length ? (
                        <ul className="list-disc list-inside text-gray-900">
                          {assignedStaff
                            .map((s) =>
                              `${s.firstname || ''} ${s.lastname || ''}`.trim()
                            )
                            .filter(Boolean)
                            .map((name, i) => (
                              <li key={`${name}-${i}`}>{name}</li>
                            ))}
                        </ul>
                      ) : (
                        <div className="text-gray-700">—</div>
                      )}
                    </div>

                    {/* Statuses */}
                    <div className="rounded-lg border p-4 bg-gray-50 space-y-2">
                      <div className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">
                        Statuses
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}
                        >
                          {s.label}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${p.cls}`}
                        >
                          {p.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Controls */}
                <div className="space-y-5 text-sm">
                  {/* Staff timeline logging (employee only) */}
                  {summaryRole === 'employee' && bookingId ? (
                    <StaffTimelineLogger bookingId={bookingId} />
                  ) : null}
                  {/* Event status controls */}
                  <div className="rounded-lg border p-4">
                    <div className="font-semibold mb-2">Event Status</div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="event-status"
                          checked={eventStatus === 'standby'}
                          onChange={() => setEventStatus('standby')}
                        />
                        Standby
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="event-status"
                          checked={eventStatus === 'ongoing'}
                          onChange={() => setEventStatus('ongoing')}
                        />
                        Ongoing
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="event-status"
                          checked={eventStatus === 'finished'}
                          onChange={() => setEventStatus('finished')}
                        />
                        Finished
                      </label>
                    </div>
                  </div>

                  {/* Payment summary (read-only by default) */}
                  <div className="rounded-lg border p-4">
                    <div className="font-semibold mb-2">Payment</div>
                    <div className="text-xs text-gray-700 mb-2">
                      <span className="font-semibold">Paid so far:</span>{' '}
                      {summaryLoading
                        ? 'Loading…'
                        : typeof paidTotal === 'number'
                        ? `₱${paidTotal.toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : '—'}
                      {typeof amountDue === 'number' && !summaryLoading ? (
                        <>
                          {' '}
                          · <span className="font-semibold">
                            Amount due:
                          </span>{' '}
                          {`₱${amountDue.toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`}
                        </>
                      ) : null}
                    </div>
                    {paymentProofUrl ? (
                      <div className="mb-3">
                        <div className="text-xs text-gray-600 mb-1">
                          Payment proof
                        </div>
                        <div className="flex items-center gap-3">
                          <img
                            src={paymentProofUrl}
                            alt="Payment proof"
                            className="h-16 w-16 object-cover rounded border"
                          />
                          <button
                            type="button"
                            className="px-2 py-1 rounded border text-xs"
                            onClick={() =>
                              window.open(paymentProofUrl!, '_blank')
                            }
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-2 text-xs text-gray-600">
                      <span>
                        Payment status is computed automatically based on the
                        recorded payments.
                      </span>
                      <div>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border text-xs"
                          onClick={() => setPaymentsOpen(true)}
                        >
                          View Payments
                        </button>
                      </div>
                    </div>

                    {/* Payments manager modal */}
                    <Dialog
                      open={paymentsOpen}
                      onOpenChange={(o) => {
                        setPaymentsOpen(o)
                        if (!o) {
                          setPaymentsError(null)
                        }
                      }}
                    >
                      <DialogContent className="sm:max-w-3xl w-[90vw] h-[88vh] overflow-hidden p-0">
                        <div className="flex h-full flex-col overflow-hidden">
                          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">
                            <DialogHeader>
                              <DialogTitle>Payments</DialogTitle>
                              <DialogDescription>
                                Review existing payments and add a new one.
                              </DialogDescription>
                            </DialogHeader>

                            {/* Summary */}
                            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-semibold">
                                  Paid so far:
                                </span>{' '}
                                {summaryLoading
                                  ? 'Loading…'
                                  : typeof paidTotal === 'number'
                                  ? `₱${paidTotal.toLocaleString('en-PH', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                  : '—'}
                              </div>
                              <div>
                                <span className="font-semibold">
                                  Amount due:
                                </span>{' '}
                                {summaryLoading || typeof amountDue !== 'number'
                                  ? '—'
                                  : `₱${amountDue.toLocaleString('en-PH', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`}
                              </div>
                            </div>

                            {/* List payments */}
                            <div className="mt-6">
                              <div className="mb-1 flex items-center justify-between">
                                <div className="font-semibold">
                                  Existing payments
                                </div>
                                <button
                                  type="button"
                                  className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                                  disabled={paymentsLoading}
                                  onClick={() => {
                                    void loadPayments()
                                    void fetchPaymentSummary()
                                  }}
                                >
                                  {paymentsLoading ? 'Refreshing…' : 'Refresh'}
                                </button>
                              </div>
                              {paymentsLoading ? (
                                <div className="text-sm text-gray-500">
                                  Loading…
                                </div>
                              ) : paymentsError ? (
                                <div className="text-sm text-red-600">
                                  {paymentsError}
                                </div>
                              ) : payments.length === 0 ? (
                                <div className="text-sm text-gray-600">
                                  No payments yet.
                                </div>
                              ) : (
                                <div className="max-h-52 overflow-y-auto rounded border">
                                  <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-gray-100">
                                      <tr>
                                        <th className="px-2 py-1 text-left">
                                          Date/Time
                                        </th>
                                        <th className="px-2 py-1 text-left">
                                          Method
                                        </th>
                                        <th className="px-2 py-1 text-right">
                                          Paid
                                        </th>
                                        <th className="px-2 py-1 text-left">
                                          Status
                                        </th>
                                        <th className="px-2 py-1 text-left">
                                          Ref #
                                        </th>
                                        <th className="px-2 py-1 text-left">
                                          Proof
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {payments.map((p) => (
                                        <tr
                                          key={p.payment_id}
                                          className="border-t"
                                        >
                                          <td className="px-2 py-1">
                                            {p.created_at
                                              ? formatDisplayDateTime(
                                                  p.created_at
                                                )
                                              : '—'}
                                          </td>
                                          <td className="px-2 py-1">
                                            {p.payment_method || '—'}
                                          </td>
                                          <td className="px-2 py-1 text-right">
                                            ₱
                                            {Number(
                                              p.amount_paid || 0
                                            ).toLocaleString('en-PH', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}
                                          </td>
                                          <td className="px-2 py-1">
                                            {p.payment_status || '—'}
                                          </td>
                                          <td className="px-2 py-1">
                                            {p.reference_no || '—'}
                                          </td>
                                          <td className="px-2 py-1">
                                            <button
                                              type="button"
                                              className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                                              disabled={!p.proof_image_url}
                                              onClick={() => {
                                                if (!p.proof_image_url) return
                                                setProofPaymentId(p.payment_id)
                                                setProofOpen(true)
                                              }}
                                            >
                                              View
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Create new payment */}
                            {bookingId ? (
                              <div className="mt-6 border-t pt-4">
                                <div className="mb-2 font-semibold">
                                  Add payment
                                </div>
                                <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-4">
                                  <div className="col-span-1">
                                    <label className="text-xs text-gray-600">
                                      Amount paid
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={newAmount}
                                      onChange={(e) =>
                                        setNewAmount(e.target.value)
                                      }
                                      className="w-full h-9 rounded border px-2"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  <div className="col-span-1">
                                    <label className="text-xs text-gray-600">
                                      Method
                                    </label>
                                    <select
                                      value={newMethod}
                                      onChange={(e) =>
                                        setNewMethod(
                                          (e.target.value as
                                            | 'cash'
                                            | 'gcash') || 'cash'
                                        )
                                      }
                                      className="w-full h-9 rounded border bg-white px-2"
                                    >
                                      <option value="cash">Cash</option>
                                      <option value="gcash">GCash</option>
                                    </select>
                                  </div>
                                  <div className="col-span-1">
                                    <label className="text-xs text-gray-600">
                                      Reference #
                                    </label>
                                    <input
                                      type="text"
                                      value={newRef}
                                      onChange={(e) =>
                                        setNewRef(e.target.value)
                                      }
                                      className="w-full h-9 rounded border px-2"
                                      placeholder="Optional"
                                    />
                                  </div>
                                  <div className="col-span-1">
                                    <label className="text-xs text-gray-600">
                                      Notes
                                    </label>
                                    <input
                                      type="text"
                                      value={newNotes}
                                      onChange={(e) =>
                                        setNewNotes(e.target.value)
                                      }
                                      className="w-full h-9 rounded border px-2"
                                      placeholder="Optional"
                                    />
                                  </div>
                                  {newMethod === 'gcash' ? (
                                    <div
                                      ref={gcashSectionRef}
                                      className="col-span-full"
                                    >
                                      <label className="text-xs text-gray-600 block mb-1">
                                        GCash receipt (image)
                                      </label>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="text-xs max-w-full"
                                          onChange={async (e) => {
                                            const f = e.target.files?.[0]
                                            if (!f) return
                                            try {
                                              setUploadBusy(true)
                                              const url =
                                                await uploadPaymentProofImage(
                                                  f,
                                                  summaryRole,
                                                  bookingId as number | string
                                                )
                                              setNewProofUrl(url)
                                            } catch (err) {
                                              // @ts-ignore optional toast
                                              toast?.error?.('Upload failed')
                                            } finally {
                                              setUploadBusy(false)
                                            }
                                          }}
                                        />
                                        {uploadBusy && (
                                          <span className="text-xs text-gray-500">
                                            Uploading…
                                          </span>
                                        )}
                                        {newProofUrl ? (
                                          <button
                                            type="button"
                                            className="rounded border px-2 py-1 text-xs whitespace-nowrap"
                                            onClick={() =>
                                              window.open(newProofUrl, '_blank')
                                            }
                                          >
                                            Preview
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <DialogFooter className="sticky bottom-0 flex flex-col gap-3 border-t bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                            <button
                              type="button"
                              className="rounded border px-4 py-2 text-sm"
                              onClick={() => setPaymentsOpen(false)}
                            >
                              Close
                            </button>
                            {bookingId ? (
                              <button
                                type="button"
                                className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                                disabled={
                                  createBusy ||
                                  uploadBusy ||
                                  !newAmount ||
                                  Number(newAmount) <= 0
                                }
                                onClick={handleSavePayment}
                              >
                                {createBusy ? 'Saving…' : 'Save payment'}
                              </button>
                            ) : null}
                          </DialogFooter>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Proof Viewer Dialog (admin can verify) */}
                    <Dialog
                      open={proofOpen}
                      onOpenChange={(o) => {
                        setProofOpen(o)
                        if (!o) setProofPaymentId(null)
                      }}
                    >
                      <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Payment Proof</DialogTitle>
                          <DialogDescription>
                            Review the uploaded receipt.
                          </DialogDescription>
                        </DialogHeader>
                        {(() => {
                          if (!proofPaymentId) return null
                          const p = payments.find(
                            (x) => x.payment_id === proofPaymentId
                          )
                          if (!p)
                            return <div className="text-sm">Not found.</div>
                          const url = p.proof_image_url || ''
                          const isVerified = Boolean(p.verified_at)
                          return (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="text-gray-500">
                                    Payment ID
                                  </div>
                                  <div className="font-medium">
                                    {p.payment_id}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Method</div>
                                  <div className="font-medium">
                                    {formatPaymentMethod(p.payment_method)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">
                                    Amount Paid
                                  </div>
                                  <div className="font-medium">
                                    ₱
                                    {Number(p.amount_paid || 0).toLocaleString(
                                      'en-PH',
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Ref #</div>
                                  <div className="font-medium">
                                    {p.reference_no || '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Status</div>
                                  <div className="font-medium">
                                    {p.payment_status || '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Verified</div>
                                  <div className="font-medium">
                                    {isVerified ? 'Yes' : 'No'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-center">
                                {url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={url}
                                    alt="Payment proof"
                                    className="max-h-80 rounded border object-contain"
                                  />
                                ) : (
                                  <div className="rounded border px-4 py-2 text-sm text-gray-600">
                                    No proof uploaded.
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                        <DialogFooter>
                          {summaryRole === 'admin' &&
                          proofPaymentId &&
                          !payments.find((x) => x.payment_id === proofPaymentId)
                            ?.verified_at ? (
                            <button
                              type="button"
                              className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
                              disabled={verifySubmitting}
                              onClick={() => setConfirmVerifyOpen(true)}
                            >
                              Verify
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="px-4 py-2 rounded border text-sm"
                            onClick={() => setProofOpen(false)}
                          >
                            Close
                          </button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Verify Confirmation Dialog */}
                    <Dialog
                      open={confirmVerifyOpen}
                      onOpenChange={(o) => {
                        if (!o) setConfirmVerifyOpen(false)
                      }}
                    >
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Verify payment</DialogTitle>
                          <DialogDescription>
                            Proceed to verify this payment?
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <button
                            type="button"
                            className="px-4 py-2 rounded border text-sm"
                            onClick={() => setConfirmVerifyOpen(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
                            disabled={!proofPaymentId || verifySubmitting}
                            onClick={verifyCurrentPayment}
                          >
                            {verifySubmitting ? 'Verifying…' : 'Confirm Verify'}
                          </button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Equipment controls */}
                  <div className="rounded-lg border p-4">
                    <div className="font-semibold mb-2">Equipment</div>
                    <div className="space-y-3">
                      {editItems.length === 0 ? (
                        <div className="text-gray-600">No items available.</div>
                      ) : (
                        <div className="space-y-2">
                          {editItems.map((it) => (
                            <div
                              key={it.id}
                              className="flex w-full flex-col gap-2 rounded border p-2"
                            >
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="min-w-[180px] font-medium">
                                  {it.name}
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <label className="inline-flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`status-${it.id}`}
                                      checked={it.type === 'good'}
                                      onChange={() =>
                                        setItemStatus(it.id, 'good')
                                      }
                                    />
                                    Good
                                  </label>
                                  <label className="inline-flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`status-${it.id}`}
                                      checked={it.type === 'damaged'}
                                      onChange={() =>
                                        setItemStatus(it.id, 'damaged')
                                      }
                                    />
                                    Damaged
                                  </label>
                                </div>
                              </div>
                              <div className="flex w-full flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="rounded border px-2 py-1 text-xs"
                                    onClick={() => toggleItemNotes(it.id)}
                                  >
                                    {it.showNotes || it.notes
                                      ? 'Hide notes'
                                      : 'Add notes'}
                                  </button>
                                </div>
                                {(it.showNotes || it.notes) && (
                                  <div className="mt-1">
                                    <label
                                      className="text-xs text-gray-600"
                                      htmlFor={`notes-${it.id}`}
                                    >
                                      Notes
                                    </label>
                                    <textarea
                                      id={`notes-${it.id}`}
                                      className="min-h-[56px] w-full resize-y rounded border px-2 py-1 text-xs"
                                      placeholder="Staff notes (damage description, handling notes, etc.)"
                                      value={it.notes || ''}
                                      onChange={(e) =>
                                        setItemNotes(it.id, e.target.value)
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Summary by category */}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <div className="font-semibold mb-1">Damaged</div>
                          {editItems.filter((x) => x.type === 'damaged')
                            .length ? (
                            <ul className="list-disc list-inside">
                              {editItems
                                .filter((x) => x.type === 'damaged')
                                .map((it) => (
                                  <li key={`sum-d-${it.id}`}>{it.name}</li>
                                ))}
                            </ul>
                          ) : (
                            <div className="text-gray-600">None</div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold mb-1">Good</div>
                          {editItems.filter((x) => x.type === 'good').length ? (
                            <ul className="list-disc list-inside">
                              {editItems
                                .filter((x) => x.type === 'good')
                                .map((it) => (
                                  <li key={`sum-g-${it.id}`}>{it.name}</li>
                                ))}
                            </ul>
                          ) : (
                            <div className="text-gray-600">None</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <button
                    type="button"
                    className="px-4 py-2 rounded border text-sm"
                  >
                    Close
                  </button>
                </DialogClose>
                <DialogClose asChild>
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-litratored text-white text-sm"
                    onClick={() => {
                      // persist inventory changes (fire-and-forget)
                      void persistInventoryUpdates()
                      // persist event status (fire-and-forget) and reflect immediately on card
                      void (async () => {
                        if (!bookingId) return
                        // map UI status -> backend status values
                        const mapToBackend: Record<Status, AdminBookingStatus> =
                          {
                            standby: 'scheduled',
                            ongoing: 'in_progress',
                            finished: 'completed',
                          }
                        try {
                          if (summaryRole === 'employee') {
                            await updateAssignedBookingStatus(
                              bookingId,
                              mapToBackend[
                                eventStatus
                              ] as unknown as StaffBookingStatus
                            )
                          } else {
                            await updateAdminBookingStatus(
                              bookingId,
                              mapToBackend[eventStatus]
                            )
                          }
                          setCardStatus(eventStatus)
                        } catch (e) {
                          // Optionally surface a toast; for now, ignore to not block UI
                        }
                      })()
                      onItemsChange?.(
                        editItems
                          .filter((x) => x.type === 'damaged')
                          .map(({ name, notes }) => ({
                            name,
                            type: 'damaged',
                            notes: notes?.trim() || undefined,
                          }))
                      )
                      // NEW: propagate selected event status to parent
                      onStatusChange?.(eventStatus)
                    }}
                  >
                    Save
                  </button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
