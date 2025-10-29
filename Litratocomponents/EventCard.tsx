'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { HiOutlineLocationMarker } from 'react-icons/hi'
import { User, Phone, Signal, Grid2x2 } from 'lucide-react'
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
  listVisibleInventory,
} from '../schemas/functions/EventCards/api'
import StaffTimelineLogger from './StaffTimelineLogger'

type Status = 'ongoing' | 'standby' | 'finished'
type Payment = 'unpaid' | 'partially-paid' | 'paid'
type Item = { name: string; qty?: number }

interface EventCardProps {
  bookingId?: number | string
  summaryRole?: 'admin' | 'employee'
  allowPaymentEdit?: boolean
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
  missingItems?: Item[]
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
  onItemsChange?: (
    items: Array<{ type: 'damaged' | 'missing'; name: string; qty?: number }>
  ) => void
  onPaymentChange?: (status: Payment, amountPaid?: number) => void
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
  allowPaymentEdit = false,
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
  missingItems = [],
  basePrice,
  extensionHours,
  totalPrice,
  assignedStaff,
  strongestSignal,
  contactInfo,
  grid,
  contactPerson,
  contactPersonNumber,
  onItemsChange,
  onPaymentChange,
  onStatusChange,
  itemsCatalog,
  // NEW: payment proof
  paymentProofUrl,
}: EventCardProps) {
  type ItemEntry = {
    id: string
    name: string
    type: 'ok' | 'damaged' | 'missing'
    inventoryId?: number
  }
  const [editItems, setEditItems] = useState<ItemEntry[]>([])

  const [paymentStatus, setPaymentStatus] = useState<Payment>(payment)
  const [partialAmount, setPartialAmount] = useState<number | ''>('')
  const [paidTotal, setPaidTotal] = useState<number | null>(null)
  const [amountDue, setAmountDue] = useState<number | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  // NEW: local state for event status selection within Details
  const [eventStatus, setEventStatus] = useState<Status>(status)
  // NEW: track whether we have loaded dynamic items for this open session
  const [itemsLoadedFromPackage, setItemsLoadedFromPackage] = useState(false)

  // NEW: modal to view payment details/proof
  const [viewPaymentOpen, setViewPaymentOpen] = useState(false)
  const [proofType, setProofType] = useState<'image' | 'cash'>(
    paymentProofUrl ? 'image' : 'cash'
  )

  useEffect(() => {
    setPaymentStatus(payment)
  }, [payment])

  useEffect(() => {
    setEventStatus(status)
  }, [status])

  // NEW: allow staff or admin to edit, or if explicitly enabled by prop
  const canEditPayment =
    summaryRole === 'admin' || summaryRole === 'employee' || allowPaymentEdit

  const setItemStatus = (id: string, type: 'ok' | 'damaged' | 'missing') => {
    setEditItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, type } : it))
    )
  }

  // Helper to initialize items when dialog opens
  const initializeItems = () => {
    const catalog = (itemsCatalog && itemsCatalog.length ? itemsCatalog : [])
      .map((n) => n.trim())
      .filter(Boolean)

    const damagedSet = new Set(damagedItems.map((it) => it.name))
    const missingSet = new Set(missingItems.map((it) => it.name))

    const toEntries: ItemEntry[] = catalog.map((name, i) => {
      if (damagedSet.has(name))
        return { id: `d-${i}-${name}`, name, type: 'damaged' }
      if (missingSet.has(name))
        return { id: `m-${i}-${name}`, name, type: 'missing' }
      return { id: `o-${i}-${name}`, name, type: 'ok' }
    })
    setEditItems(toEntries)
  }

  // NEW: load items dynamically from package when available
  const loadPackageItems = async () => {
    if (!packageId) return false
    try {
      const items =
        summaryRole === 'employee'
          ? await listPackageItemsForPackageEmployee(packageId)
          : await listPackageItemsForPackage(packageId)
      // Fetch current inventory to reflect latest condition/status in the UI.
      // This may be admin-only; if forbidden, proceed without it.
      let inventory: Array<{
        id: number
        condition?: string
        status?: boolean
      }> = []
      try {
        inventory = await listVisibleInventory()
      } catch {
        inventory = []
      }
      const invMap = new Map<number, { condition?: string; status?: boolean }>()
      for (const inv of inventory) {
        if (typeof (inv as any).id === 'number') {
          invMap.set((inv as any).id as number, {
            condition: (inv as any).condition,
            status: (inv as any).status,
          })
        }
      }
      if (!items.length) {
        setItemsLoadedFromPackage(true)
        setEditItems([])
        return true
      }

      // Build entries per unit so each unit can be marked Good/Damaged/Missing
      const damagedSet = new Set(
        damagedItems.map((it) => String(it.name || '').trim())
      )
      const missingSet = new Set(
        missingItems.map((it) => String(it.name || '').trim())
      )
      const entries: ItemEntry[] = []
      items.forEach((it, idx) => {
        const baseName = String(it.material_name || '').trim()
        const qty = Math.max(1, Number(it.quantity || 1))
        const invId =
          typeof it.inventory_id === 'number' ? it.inventory_id : undefined
        const current =
          // Prefer condition/status coming directly with the item
          it && (typeof it.status === 'boolean' || it.condition)
            ? { condition: it.condition, status: it.status }
            : invId != null
            ? invMap.get(invId)
            : undefined
        for (let i = 0; i < qty; i++) {
          const label = qty > 1 ? `${baseName} (${i + 1}/${qty})` : baseName
          // Priority for initial selection:
          // 1) If inventory status is unavailable => Missing
          // 2) Else if inventory condition is Damaged => Damaged
          // 3) Else fallback to provided damaged/missing lists
          // 4) Else OK
          let type: 'ok' | 'damaged' | 'missing' = 'ok'
          if (current && current.status === false) {
            type = 'missing'
          } else if (
            current &&
            typeof current.condition === 'string' &&
            current.condition.toLowerCase() === 'damaged'
          ) {
            type = 'damaged'
          } else if (damagedSet.has(baseName)) {
            type = 'damaged'
          } else if (missingSet.has(baseName)) {
            type = 'missing'
          }
          entries.push({
            id: `pkg-${idx}-${i}-${baseName}`,
            name: label,
            type,
            inventoryId: invId,
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
        hasMissing: boolean
        hasDamaged: boolean
        total: number
        okCount: number
      }
    >()
    for (const it of editItems) {
      if (!it.inventoryId) continue
      const g = groups.get(it.inventoryId) || {
        hasMissing: false,
        hasDamaged: false,
        total: 0,
        okCount: 0,
      }
      g.total += 1
      if (it.type === 'missing') g.hasMissing = true
      else if (it.type === 'damaged') g.hasDamaged = true
      else if (it.type === 'ok') g.okCount += 1
      groups.set(it.inventoryId, g)
    }

    if (groups.size === 0) return

    // Decide updates per inventory item
    const tasks: Array<Promise<void>> = []
    groups.forEach((g, invId) => {
      let body: Record<string, unknown> | null = null
      if (g.hasMissing) {
        // missing: set status to unavailable
        body = { status: false }
      } else if (g.hasDamaged) {
        // damaged: set condition to 'Damaged'
        body = { condition: 'Damaged' }
      } else if (g.okCount === g.total) {
        // all OK: set condition to 'Good' and status to available
        body = { condition: 'Good', status: true }
      }
      if (!body) return
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
  const fetchPaymentSummary = async () => {
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
  const s = statusStyles[status]
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
          <p className="text-xs m-0 leading-tight">{dateTime || '—'}</p>
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
                    {dateTime || '—'} • {location || '—'}
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
                        <span className="text-gray-900">{dateTime}</span>
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
                    {canEditPayment ? (
                      <div className="flex flex-col gap-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="payment-status"
                            checked={paymentStatus === 'unpaid'}
                            onChange={() => setPaymentStatus('unpaid')}
                          />
                          Unpaid
                        </label>

                        {/* Partially Paid row with View Payment beside it */}
                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name="payment-status"
                              checked={paymentStatus === 'partially-paid'}
                              onChange={() =>
                                setPaymentStatus('partially-paid')
                              }
                            />
                            Partially Paid
                          </label>
                          <button
                            type="button"
                            className="px-2 py-1 rounded border text-xs"
                            onClick={() => setViewPaymentOpen(true)}
                          >
                            View Payment
                          </button>
                        </div>

                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="payment-status"
                            checked={paymentStatus === 'paid'}
                            onChange={() => setPaymentStatus('paid')}
                          />
                          Paid
                        </label>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600">
                        Payment status is computed automatically.
                      </div>
                    )}

                    {/* View Payment modal (nested) */}
                    <Dialog
                      open={viewPaymentOpen}
                      onOpenChange={setViewPaymentOpen}
                    >
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Payment Details</DialogTitle>
                          <DialogDescription>
                            Summary, logs, and proof selection for this booking.
                          </DialogDescription>
                        </DialogHeader>

                        {/* Summary */}
                        <div className="text-sm space-y-2">
                          <div>
                            <span className="font-semibold">Paid so far:</span>{' '}
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
                            <span className="font-semibold">Amount due:</span>{' '}
                            {summaryLoading || typeof amountDue !== 'number'
                              ? '—'
                              : `₱${amountDue.toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`}
                          </div>
                        </div>

                        {/* Proof preview */}
                        <div className="mt-3">
                          <div className="font-semibold">Proof Type</div>
                          <div className="flex items-center text-sm">
                            <div className=" space-y-2">
                              <button
                                type="button"
                                className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                                disabled={!paymentProofUrl}
                                onClick={() => {
                                  if (paymentProofUrl)
                                    window.open(paymentProofUrl, '_blank')
                                }}
                              >
                                Open proof
                              </button>
                              {paymentProofUrl ? (
                                <div className="border rounded p-1">
                                  <img
                                    src={paymentProofUrl}
                                    alt="Payment proof"
                                    className="max-h-64 w-auto object-contain rounded"
                                  />
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500">
                                  No proof uploaded
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Logs */}
                        <div className="mt-4">
                          <div className="font-semibold mb-1">Payment Logs</div>
                          <div className="text-sm text-gray-600">
                            No logs available.
                          </div>
                        </div>

                        <DialogFooter>
                          <button
                            type="button"
                            className="px-4 py-2 rounded border text-sm"
                            onClick={() => setViewPaymentOpen(false)}
                          >
                            Close
                          </button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Damaged / Missing items controls */}
                  <div className="rounded-lg border p-4">
                    <div className="font-semibold mb-2">
                      Damaged / Missing Items
                    </div>
                    <div className="space-y-3">
                      {editItems.length === 0 ? (
                        <div className="text-gray-600">No items available.</div>
                      ) : (
                        <div className="space-y-2">
                          {editItems.map((it) => (
                            <div
                              key={it.id}
                              className="flex flex-wrap items-center gap-3"
                            >
                              <div className="min-w-[180px] font-medium">
                                {it.name}
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <label className="inline-flex items-center gap-1">
                                  <input
                                    type="radio"
                                    name={`status-${it.id}`}
                                    checked={it.type === 'ok'}
                                    onChange={() => setItemStatus(it.id, 'ok')}
                                  />
                                  OK
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
                                <label className="inline-flex items-center gap-1">
                                  <input
                                    type="radio"
                                    name={`status-${it.id}`}
                                    checked={it.type === 'missing'}
                                    onChange={() =>
                                      setItemStatus(it.id, 'missing')
                                    }
                                  />
                                  Missing
                                </label>
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
                          <div className="font-semibold mb-1">Missing</div>
                          {editItems.filter((x) => x.type === 'missing')
                            .length ? (
                            <ul className="list-disc list-inside">
                              {editItems
                                .filter((x) => x.type === 'missing')
                                .map((it) => (
                                  <li key={`sum-m-${it.id}`}>{it.name}</li>
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
                      onItemsChange?.(
                        editItems
                          .filter(
                            (x) => x.type === 'damaged' || x.type === 'missing'
                          )
                          .map(({ name, type }) => ({
                            name,
                            type: type as 'damaged' | 'missing',
                          }))
                      )
                      if (canEditPayment) {
                        onPaymentChange?.(
                          paymentStatus,
                          paymentStatus === 'partially-paid' &&
                            partialAmount !== ''
                            ? Number(partialAmount)
                            : undefined
                        )
                      }
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
