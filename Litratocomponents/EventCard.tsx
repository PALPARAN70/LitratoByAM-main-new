'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { HiOutlineLocationMarker } from 'react-icons/hi'
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

type Status = 'ongoing' | 'standby' | 'finished'
type Payment = 'unpaid' | 'partially-paid' | 'paid'
type Item = { name: string; qty?: number }

interface EventCardProps {
  bookingId?: number | string
  summaryRole?: 'admin' | 'employee'
  allowPaymentEdit?: boolean
  title?: string
  dateTime?: string
  location?: string
  status?: Status
  payment?: Payment
  imageUrl?: string
  damagedItems?: Item[]
  missingItems?: Item[]
  totalPrice?: number // optional total price to display
  onItemsChange?: (
    items: Array<{ type: 'damaged' | 'missing'; name: string; qty?: number }>
  ) => void
  onPaymentChange?: (status: Payment, amountPaid?: number) => void
  itemsCatalog?: string[]
}

const DEFAULT_ITEMS: string[] = [
  'Camera Body',
  'Lens 50mm',
  'Lens 85mm',
  'Tripod',
  'Flash',
  'Light Stand',
  'Battery Pack',
  'Charger',
  'Memory Card',
]

export default function EventCard({
  bookingId,
  summaryRole = 'admin',
  allowPaymentEdit = false,
  title = 'Wedding',
  dateTime = 'June 5, 2026 - 3:00PM',
  location = 'Davao, Sitio Kantutan',
  status = 'ongoing',
  payment = 'paid',
  imageUrl = '/Images/litratobg.jpg',
  damagedItems = [],
  missingItems = [],
  totalPrice,
  onItemsChange,
  onPaymentChange,
  itemsCatalog,
}: EventCardProps) {
  type ItemEntry = {
    id: string
    name: string
    type: 'ok' | 'damaged' | 'missing'
  }
  const [editItems, setEditItems] = useState<ItemEntry[]>([])

  const [paymentStatus, setPaymentStatus] = useState<Payment>(payment)
  const [partialAmount, setPartialAmount] = useState<number | ''>('')
  const [paidTotal, setPaidTotal] = useState<number | null>(null)
  const [amountDue, setAmountDue] = useState<number | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    setPaymentStatus(payment)
  }, [payment])

  const setItemStatus = (id: string, type: 'ok' | 'damaged' | 'missing') => {
    setEditItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, type } : it))
    )
  }

  // Helper to initialize items when dialog opens
  const initializeItems = () => {
    const catalog = (
      itemsCatalog && itemsCatalog.length ? itemsCatalog : DEFAULT_ITEMS
    )
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

  // Fetch payment summary (admin endpoint) when dialog opens
  const fetchPaymentSummary = async () => {
    if (!bookingId) return
    try {
      setSummaryLoading(true)
      const base = (
        typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE
          ? String(process.env.NEXT_PUBLIC_API_BASE)
          : 'http://localhost:5000'
      ).replace(/\/$/, '')
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token')
          : null
      const path =
        summaryRole === 'employee'
          ? `/api/employee/assigned-confirmed-bookings/${encodeURIComponent(
              String(bookingId)
            )}/payment-summary`
          : `/api/admin/confirmed-bookings/${encodeURIComponent(
              String(bookingId)
            )}/payment-summary`
      const res = await fetch(`${base}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      const data = await res.json().catch(() => ({}))
      const paid = Number(data?.paidTotal ?? 0)
      const due = Number(data?.amountDue ?? 0)
      setPaidTotal(paid)
      setAmountDue(due)
      // Optionally sync paymentStatus to computedStatus from backend
      const comp = String(data?.computedStatus || '').toLowerCase()
      if (comp === 'paid') setPaymentStatus('paid')
      else if (comp === 'partial') setPaymentStatus('partially-paid')
      else setPaymentStatus('unpaid')
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
    standby: {
      label: 'Standby',
      cls: 'bg-gray-700  text-white',
    },
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
          <p className="text-xs m-0 leading-tight">{dateTime}</p>
          <p className="font-bold m-0 leading-tight flex items-center gap-1">
            {title}
          </p>
          <p className="text-xs m-0 leading-tight flex mb-2 gap-1">
            <HiOutlineLocationMarker className="h-3 w-3 mt-[1.5px]" />
            {location}
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
                initializeItems()
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT: Information */}
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Title:</span> {title}
                  </div>
                  <div>
                    <span className="font-semibold">Date & Time:</span>{' '}
                    {dateTime}
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="font-semibold">Location:</span>
                    <span>{location}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Status:</span> {s.label}
                  </div>
                  <div>
                    <span className="font-semibold">Payment:</span> {p.label}
                  </div>
                  {/* Optional: Preview image */}
                </div>

                {/* RIGHT: Controls */}
                <div className="space-y-5 text-sm">
                  {/* Payment summary (read-only by default) */}
                  <div className="p-3 border rounded">
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
                    {allowPaymentEdit ? (
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
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="payment-status"
                            checked={paymentStatus === 'partially-paid'}
                            onChange={() => setPaymentStatus('partially-paid')}
                          />
                          Partially Paid
                        </label>
                        {paymentStatus === 'partially-paid' && (
                          <div className="pl-6">
                            <label className="block text-xs mb-1">
                              Amount received (optional)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={partialAmount}
                              onChange={(e) =>
                                setPartialAmount(
                                  e.target.value === ''
                                    ? ''
                                    : Number(e.target.value)
                                )
                              }
                              className="w-40 px-2 py-1 rounded border bg-white focus:outline-none focus:ring-0"
                            />
                          </div>
                        )}
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
                  </div>

                  {/* Damaged / Missing items controls */}
                  <div className="p-3 border rounded">
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
                      if (allowPaymentEdit) {
                        onPaymentChange?.(
                          paymentStatus,
                          paymentStatus === 'partially-paid' &&
                            partialAmount !== ''
                            ? Number(partialAmount)
                            : undefined
                        )
                      }
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
