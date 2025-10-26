'use client'
import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  getLatestPaymentQR,
  getAuthHeadersInit,
} from '../../../../schemas/functions/Payment/createPayment'
import {
  listAdminPayments,
  updateAdminPayment,
  uploadAdminPaymentQR,
  listAdminPaymentLogs,
  updateAdminPaymentLog,
  createAdminPayment,
  type PaymentLog,
} from '../../../../schemas/functions/Payment/adminPayments'
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
  DialogClose,
} from '@/components/ui/dialog'
import { Ellipsis, Pencil } from 'lucide-react'
// ADD: match ManageBooking Select components
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Payment = {
  payment_id: number
  booking_id: number
  user_id: number
  amount: number
  amount_paid: number
  payment_method: string
  qr_image_url?: string | null
  proof_image_url?: string | null
  reference_no?: string | null
  payment_status: string
  booking_payment_status?: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'failed'
  booking_base_total?: number
  booking_ext_hours?: number
  booking_amount_due?: number
  notes?: string | null
  verified_at?: string | null
  created_at: string
}

// Add: pagination window helper (like ManageBooking)
function pageWindow(current: number, total: number, size = 3): number[] {
  if (total <= 0) return []
  const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1
  const end = Math.min(total, start + size - 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [edit, setEdit] = useState<{ [id: number]: Partial<Payment> }>({})
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [qrFile, setQrFile] = useState<File | null>(null)
  const [qrUploading, setQrUploading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    booking_id: '' as string,
    amount_paid: '' as string,
    payment_method: 'cash',
    reference_no: '' as string,
    notes: '' as string,
    verified: true,
    payment_status: 'completed' as
      | 'pending'
      | 'completed'
      | 'failed'
      | 'refunded',
  })
  const [eventOptions, setEventOptions] = useState<
    Array<{ id: number; label: string; userLabel: string }>
  >([])

  // Notes edit dialog state (like Inventory Logs)
  // Removed previously unused notes edit states (notes are view-only here)

  const API_ORIGIN =
    process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
  const API_BASE = `${API_ORIGIN}/api`

  const printSalesReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/payments/report`, {
        headers: { ...getAuthHeadersInit() },
      })
      if (res.status === 501) {
        const msg = await res.text().catch(() => '')
        alert(
          msg ||
            'PDF generator not installed on server. Please install pdfkit in backend.'
        )
        return
      }
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      setTimeout(() => {
        try {
          w?.print?.()
        } catch {}
      }, 500)
    } catch (e) {
      console.error('Generate sales report failed:', e)
      alert('Failed to generate sales report. See console for details.')
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const rows = await listAdminPayments()
      setPayments(rows)
    } catch (e) {
      console.error('Load payments failed:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const loadQR = async () => {
      try {
        const url = await getLatestPaymentQR()
        setQrUrl(url)
      } catch {
        setQrUrl(null)
      }
    }
    loadQR()
  }, [])

  useEffect(() => {
    if (!createOpen) return
    let ignore = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/confirmed-bookings`, {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeadersInit(),
          },
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(await res.text())
        const data: unknown = await res.json().catch(() => ({} as unknown))
        type ConfirmedBookingRow = {
          id?: number | string
          firstname?: string
          lastname?: string
          username?: string
          event_date?: string
          event_time?: string
          event_name?: string
          package_name?: string
        }
        const rows: ConfirmedBookingRow[] =
          typeof data === 'object' &&
          data !== null &&
          'bookings' in (data as Record<string, unknown>) &&
          Array.isArray((data as Record<string, unknown>).bookings)
            ? ((data as Record<string, unknown>).bookings as unknown[]).filter(
                (b): b is ConfirmedBookingRow =>
                  typeof b === 'object' && b !== null
              )
            : []
        const opts = rows.map((b) => {
          const userLabel = [b.firstname, b.lastname]
            .filter(Boolean)
            .join(' ')
            .trim()
          const fallback = b.username || 'Customer'
          const who = userLabel || fallback
          const when = [b.event_date, b.event_time].filter(Boolean).join(' ')
          const title = b.event_name || b.package_name || 'Event'
          return {
            id: Number(b.id),
            label: `#${b.id} • ${title} • ${when} • ${who}`,
            userLabel: who,
          }
        })
        if (!ignore) setEventOptions(opts)
      } catch (e) {
        console.error('Load confirmed bookings for dropdown failed:', e)
      }
    })()
    return () => {
      ignore = true
    }
  }, [createOpen, API_BASE])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return payments
    return payments.filter((p) =>
      [
        p.payment_id,
        p.booking_id,
        p.user_id,
        p.payment_status,
        p.booking_payment_status || '',
        p.reference_no || '',
      ].some((v) => String(v).toLowerCase().includes(q))
    )
  }, [payments, filter])

  const save = async (id: number) => {
    const body = edit[id]
    if (!body) return
    try {
      await updateAdminPayment(id, body)
      setEdit((e) => ({ ...e, [id]: {} }))
      await load()
    } catch (e) {
      console.error('Update payment failed:', e)
    }
  }

  // Tabs
  type TabKey = 'payments' | 'payment-logs' | 'qr'
  const [active, setActive] = useState<TabKey>('payments')
  const [selectedPaymentForLogs, setSelectedPaymentForLogs] = useState<
    number | null
  >(null)

  // Pagination
  const pageSize = 5
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [filter])
  const totalPages = Math.max(
    1,
    Math.ceil((payments.length ? filtered.length : 0) / pageSize)
  )
  const startIdx = (page - 1) * pageSize
  const paginated = filtered.slice(startIdx, startIdx + pageSize)
  const windowPages = useMemo(
    () => pageWindow(page, totalPages, 3),
    [page, totalPages]
  )

  // Payment status select helpers
  type BookingPayUi = 'unpaid' | 'partially-paid' | 'paid'
  const toUiPayment = (s?: string): BookingPayUi =>
    (s || '').toLowerCase() === 'partial'
      ? 'partially-paid'
      : (s || 'unpaid').toLowerCase() === 'paid'
      ? 'paid'
      : 'unpaid'
  const paymentLabel = (p: BookingPayUi) =>
    p === 'paid' ? 'Paid' : p === 'partially-paid' ? 'Partially Paid' : 'Unpaid'
  const paymentBadgeClass = (p: BookingPayUi) =>
    p === 'paid'
      ? 'bg-green-700 text-white'
      : p === 'partially-paid'
      ? 'bg-yellow-700 text-white'
      : 'bg-red-700 text-white'

  return (
    <div className="h-screen flex flex-col p-4 min-h-0">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Payments</h1>
        {active === 'payments' && (
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded bg-litratoblack text-white"
              onClick={printSalesReport}
            >
              Sales Report (PDF)
            </button>
            <button
              className="px-3 py-2 rounded border"
              onClick={() => setCreateOpen((v) => !v)}
            >
              {createOpen ? 'Close' : 'Create Payment'}
            </button>
          </div>
        )}
      </header>

      <nav className="flex gap-2 mb-4">
        <TabButton
          active={active === 'payments'}
          onClick={() => setActive('payments')}
        >
          Payments
        </TabButton>
        <TabButton
          active={active === 'payment-logs'}
          onClick={() => setActive('payment-logs')}
        >
          Payment Logs
        </TabButton>
        <TabButton active={active === 'qr'} onClick={() => setActive('qr')}>
          QR Control
        </TabButton>
      </nav>

      {active === 'payment-logs' && (
        <PaymentLogsPanel
          selectedPaymentId={selectedPaymentForLogs}
          onChangeSelected={setSelectedPaymentForLogs}
        />
      )}

      {active === 'qr' && (
        <section className="bg-white h-125 rounded-xl shadow p-4 flex flex-col min-h-0 gap-4">
          <div className="border rounded-xl p-3 flex flex-col gap-2">
            <div className="font-medium">Payment QR</div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-start gap-2">
                <div className="text-sm text-gray-600">Current</div>
                {qrUrl ? (
                  <Image
                    src={qrUrl}
                    alt="Current QR"
                    width={160}
                    height={160}
                    className="border rounded h-auto w-auto max-h-40"
                  />
                ) : (
                  <div className="text-sm text-gray-500">No QR uploaded.</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                />
                <button
                  className="px-3 py-2 rounded bg-litratoblack text-white disabled:opacity-60"
                  disabled={!qrFile || qrUploading}
                  onClick={async () => {
                    if (!qrFile) return
                    setQrUploading(true)
                    try {
                      const { url } = await uploadAdminPaymentQR(qrFile)
                      setQrUrl(url || null)
                      setQrFile(null)
                    } catch (e) {
                      console.error('QR upload failed:', e)
                    } finally {
                      setQrUploading(false)
                    }
                  }}
                >
                  {qrUploading ? 'Uploading...' : 'Upload QR'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {active === 'payments' && (
        <section className="bg-white h-125 rounded-xl shadow p-4 flex flex-col min-h-0 gap-4">
          <nav className="flex gap-2 mb-4">
            <div className="flex-grow flex">
              <form
                className="w-1/4 bg-gray-400 rounded-full items-center flex px-1 py-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  setFilter(filter.trim())
                }}
              >
                <input
                  type="text"
                  placeholder="Search by id, status, ref no, user, booking..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-transparent outline-none w-full px-2 h-8"
                />
              </form>
            </div>
          </nav>

          {loading ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : !filtered.length ? (
            <div className="text-sm text-gray-600">No payments found.</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-t-xl border border-gray-200">
                <div className="max-h-[60vh] md:max-h-96 overflow-y-auto">
                  <table className="w-full table-auto text-sm">
                    <thead>
                      <tr className="bg-gray-300 text-left">
                        {Object.entries({
                          id: 'ID',
                          booking: 'Booking',
                          user: 'User',
                          amount: 'Amount',
                          paid: 'Paid',
                          ref: 'Ref',
                          status: 'Status',
                          notes: 'Notes',
                          actions: 'Actions',
                        }).map(([key, title], i, arr) => (
                          <th
                            key={key}
                            className={`px-3 py-2 ${
                              i === 0 ? 'rounded-tl-xl' : ''
                            } ${i === arr.length - 1 ? 'rounded-tr-xl' : ''}`}
                          >
                            {title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((p) => (
                        <React.Fragment key={p.payment_id}>
                          <tr className="text-left bg-gray-100 even:bg-gray-50 align-top">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {p.payment_id}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {p.booking_id}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {p.user_id}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {Number(p.booking_amount_due ?? p.amount).toFixed(
                                2
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <input
                                className="border rounded px-2 py-1 w-24"
                                type="number"
                                defaultValue={p.amount_paid}
                                onChange={(e) =>
                                  setEdit((s) => ({
                                    ...s,
                                    [p.payment_id]: {
                                      ...s[p.payment_id],
                                      amount_paid: Number(e.target.value),
                                    },
                                  }))
                                }
                              />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {p.reference_no || ''}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const uiVal = toUiPayment(
                                      p.booking_payment_status
                                    )
                                    return (
                                      <Select
                                        value={uiVal}
                                        onValueChange={async (val) => {
                                          const apiVal =
                                            (val as
                                              | 'unpaid'
                                              | 'paid'
                                              | 'partially-paid') ===
                                            'partially-paid'
                                              ? 'partial'
                                              : (val as 'unpaid' | 'paid')
                                          try {
                                            const res = await fetch(
                                              `${API_BASE}/admin/confirmed-bookings/${p.booking_id}/payment-status`,
                                              {
                                                method: 'PATCH',
                                                headers: {
                                                  'Content-Type':
                                                    'application/json',
                                                  ...getAuthHeadersInit(),
                                                },
                                                body: JSON.stringify({
                                                  status: apiVal,
                                                }),
                                              }
                                            )
                                            if (!res.ok)
                                              throw new Error(await res.text())
                                            await load()
                                          } catch (err) {
                                            console.error(
                                              'Update booking payment_status failed:',
                                              err
                                            )
                                            alert(
                                              'Failed to update booking payment status'
                                            )
                                          }
                                        }}
                                      >
                                        <SelectTrigger
                                          className={`h-7 text-[11px] w-24 px-2 border-0 rounded text-center ${paymentBadgeClass(
                                            uiVal
                                          )}`}
                                        >
                                          <SelectValue placeholder="Payment" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unpaid">
                                            {paymentLabel('unpaid')}
                                          </SelectItem>
                                          <SelectItem value="partially-paid">
                                            {paymentLabel('partially-paid')}
                                          </SelectItem>
                                          <SelectItem value="paid">
                                            {paymentLabel('paid')}
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )
                                  })()}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2">{p.notes || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-2 rounded hover:bg-gray-200 transition"
                                    aria-label="Actions"
                                    title="Actions"
                                  >
                                    <Ellipsis className="text-lg" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="end"
                                  className="w-40 p-2"
                                >
                                  <div className="flex flex-col gap-2">
                                    <button
                                      className="w-full bg-litratoblack text-white rounded px-2 py-1 text-xs"
                                      onClick={() => save(p.payment_id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      className="w-full rounded px-2 py-1 text-xs border"
                                      onClick={() => {
                                        setSelectedPaymentForLogs(p.payment_id)
                                        setActive('payment-logs')
                                      }}
                                    >
                                      View Logs
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>
                          </tr>
                          {/* Inline logs removed; see Payment Logs tab */}
                        </React.Fragment>
                      ))}
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
            </>
          )}
        </section>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) setCreateOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-[720px] max-h-[70vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Payment (Admin)</DialogTitle>
            <DialogDescription>
              Select a confirmed booking and enter payment details.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm">Event (Confirmed Booking)</label>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={createForm.booking_id}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, booking_id: e.target.value }))
                  }
                >
                  <option value="">Select an event…</option>
                  {eventOptions.map((opt) => (
                    <option key={opt.id} value={String(opt.id)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Customer</label>
                <input
                  className="border rounded px-2 py-1 w-full bg-gray-50"
                  value={
                    (createForm.booking_id &&
                      (eventOptions.find(
                        (o) => String(o.id) === String(createForm.booking_id)
                      )?.userLabel ||
                        '')) ||
                    ''
                  }
                  readOnly
                  placeholder="Auto-filled when event is selected"
                />
              </div>

              <div>
                <label className="text-sm">Amount Paid</label>
                <input
                  className="border rounded px-2 py-1 w-full"
                  type="number"
                  value={createForm.amount_paid}
                  onChange={(e) =>
                    setCreateForm((p) => ({
                      ...p,
                      amount_paid: e.target.value,
                    }))
                  }
                  placeholder="e.g., 5000"
                />
              </div>

              <div>
                <label className="text-sm">Method</label>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={createForm.payment_method}
                  onChange={(e) =>
                    setCreateForm((p) => ({
                      ...p,
                      payment_method: e.target.value,
                    }))
                  }
                >
                  <option value="cash">cash</option>
                  <option value="gcash">gcash</option>
                  <option value="bank">bank</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-sm">Reference No. (optional)</label>
                <input
                  className="border rounded px-2 py-1 w-full"
                  value={createForm.reference_no}
                  onChange={(e) =>
                    setCreateForm((p) => ({
                      ...p,
                      reference_no: e.target.value,
                    }))
                  }
                  placeholder="e.g., CASH-ON-EVENT"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-sm">Notes (optional)</label>
                <textarea
                  className="border rounded px-2 py-1 w-full h-20"
                  value={createForm.notes}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Any remarks about the payment"
                />
              </div>

              <div className="flex items-center gap-3 sm:col-span-3">
                <label className="text-sm">Mark as verified</label>
                <input
                  type="checkbox"
                  checked={createForm.verified}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, verified: e.target.checked }))
                  }
                />
                <label className="text-sm">Status</label>
                <select
                  className="border rounded px-2 py-1"
                  value={createForm.payment_status}
                  onChange={(e) =>
                    setCreateForm((p) => ({
                      ...p,
                      payment_status: e.target.value as
                        | 'pending'
                        | 'completed'
                        | 'failed'
                        | 'refunded',
                    }))
                  }
                >
                  <option value="completed">completed</option>
                  <option value="pending">pending</option>
                  <option value="failed">failed</option>
                  <option value="refunded">refunded</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
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
              className="px-4 py-2 rounded bg-litratoblack text-white text-sm"
              onClick={async () => {
                const booking_id = Number(createForm.booking_id)
                const amount_paid = Number(createForm.amount_paid)
                if (!booking_id || !amount_paid) {
                  alert('Booking ID and Amount Paid are required')
                  return
                }
                try {
                  await createAdminPayment({
                    booking_id,
                    amount_paid,
                    payment_method: createForm.payment_method,
                    reference_no:
                      createForm.reference_no.trim() || 'CASH-ON-EVENT',
                    notes: createForm.notes.trim() || undefined,
                    verified: createForm.verified,
                    payment_status: createForm.payment_status,
                  })
                  setCreateForm({
                    booking_id: '',
                    amount_paid: '',
                    payment_method: 'cash',
                    reference_no: '',
                    notes: '',
                    verified: true,
                    payment_status: 'completed',
                  })
                  setCreateOpen(false)
                  await load()
                } catch (e) {
                  console.error('Create admin payment failed:', e)
                  alert('Failed to create payment')
                }
              }}
            >
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentLogsPanel({
  selectedPaymentId,
  onChangeSelected,
}: {
  selectedPaymentId: number | null
  onChangeSelected: (id: number | null) => void
}) {
  const [paymentsList, setPaymentsList] = React.useState<Payment[]>([])
  const [logsCache, setLogsCache] = React.useState<
    Record<number, PaymentLog[]>
  >({})
  const [logsLoading, setLogsLoading] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const PER_PAGE = 5

  const [editOpen, setEditOpen] = React.useState(false)
  const [editingLog, setEditingLog] = React.useState<PaymentLog | null>(null)
  const [editAdditional, setEditAdditional] = React.useState('')

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const rows = await listAdminPayments()
        if (!ignore) setPaymentsList(rows)
      } catch (e) {
        console.error('Load payments for logs failed:', e)
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  const ensureLogs = React.useCallback(
    async (pid: number | null, force = false) => {
      if (!pid) return
      if (!force && logsCache[pid]) return
      setLogsLoading(true)
      try {
        const rows = await listAdminPaymentLogs(pid)
        setLogsCache((m) => ({ ...m, [pid]: rows }))
      } catch (e) {
        console.error('Load payment logs failed:', e)
      } finally {
        setLogsLoading(false)
      }
    },
    [logsCache]
  )

  useEffect(() => {
    if (selectedPaymentId) ensureLogs(selectedPaymentId)
  }, [selectedPaymentId, ensureLogs])

  const logs = React.useMemo(
    () => (selectedPaymentId ? logsCache[selectedPaymentId] || [] : []),
    [logsCache, selectedPaymentId]
  )

  const normalized = (search || '').trim().toLowerCase()
  const filtered = React.useMemo(() => {
    if (!normalized) return logs
    return logs.filter((lg) => {
      const hay = [
        lg.action,
        lg.previous_status,
        lg.new_status,
        lg.notes || '',
        (lg as { additional_notes?: string }).additional_notes || '',
        String(lg.performed_by || ''),
        new Date(lg.created_at).toLocaleString(),
      ]
        .join('\n')
        .toLowerCase()
      return hay.includes(normalized)
    })
  }, [logs, normalized])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  useEffect(
    () => setPage((p) => Math.min(Math.max(1, p), totalPages)),
    [totalPages]
  )
  const start = (page - 1) * PER_PAGE
  const paginated = React.useMemo(
    () => filtered.slice(start, start + PER_PAGE),
    [filtered, start]
  )
  const windowPages = React.useMemo(
    () => pageWindow(page, totalPages, 3),
    [page, totalPages]
  )

  const openEdit = (lg: PaymentLog) => {
    setEditingLog(lg)
    setEditAdditional(
      ((lg as { additional_notes?: string }).additional_notes as string) || ''
    )
    setEditOpen(true)
  }
  const saveEdit = async () => {
    if (!editingLog) return
    try {
      const updated = await updateAdminPaymentLog(editingLog.log_id, {
        additional_notes: editAdditional,
      })
      const pid = selectedPaymentId!
      setLogsCache((m) => ({
        ...m,
        [pid]: (m[pid] || []).map((l) =>
          l.log_id === updated.log_id ? updated : l
        ),
      }))
      setEditOpen(false)
      setEditingLog(null)
      setEditAdditional('')
    } catch (e) {
      console.error('Update payment log failed:', e)
      alert('Failed to update log notes')
    }
  }

  return (
    <section className="bg-white h-125 rounded-xl shadow p-4 flex flex-col min-h-0 gap-4">
      <nav className="flex gap-2 items-center">
        <div className="flex-grow flex">
          <form
            className="w-1/3 bg-gray-400 rounded-full items-center flex px-1 py-1"
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(search.trim())
            }}
          >
            <input
              type="text"
              placeholder="Search logs (status, action, notes, user)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none w-full px-2 h-8"
            />
          </form>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 h-9"
            value={selectedPaymentId ?? ''}
            onChange={async (e) => {
              const v = e.target.value
              const id = v ? Number(v) : null
              onChangeSelected(id)
              setPage(1)
              if (id) await ensureLogs(id)
            }}
          >
            <option value="">Select a payment…</option>
            {paymentsList.map((p) => (
              <option key={p.payment_id} value={p.payment_id}>
                #{p.payment_id} • Booking {p.booking_id} • User {p.user_id}
              </option>
            ))}
          </select>
          <button
            className="px-3 py-2 rounded border text-sm"
            disabled={!selectedPaymentId || logsLoading}
            onClick={() => ensureLogs(selectedPaymentId!, true)}
            title="Refresh logs"
          >
            Refresh
          </button>
        </div>
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto border rounded-xl">
        <div className="p-3">
          {!selectedPaymentId ? (
            <div className="text-sm text-gray-600">
              Select a payment to view its logs.
            </div>
          ) : logsLoading && !(logsCache[selectedPaymentId] || []).length ? (
            <div className="text-sm text-gray-600">Loading logs…</div>
          ) : !logs.length ? (
            <div className="text-sm text-gray-600">No logs found.</div>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="bg-gray-300 text-left">
                      {[
                        'Date/Time',
                        'Payment',
                        'Action',
                        'Status',
                        'Notes',
                        'Additional Notes',
                        'By',
                        'Actions',
                      ].map((h, i, arr) => (
                        <th
                          key={h}
                          className={`px-3 py-2 ${
                            i === 0 ? 'rounded-tl-xl' : ''
                          } ${i === arr.length - 1 ? 'rounded-tr-xl' : ''}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((lg) => (
                      <tr
                        key={lg.log_id}
                        className="text-left bg-gray-100 even:bg-gray-50 align-top"
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {new Date(lg.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          #{selectedPaymentId}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {lg.action}
                        </td>
                        <td className="px-3 py-2">
                          <div className="whitespace-nowrap">
                            <span className="font-medium">
                              {lg.previous_status}
                            </span>{' '}
                            →{' '}
                            <span className="font-medium">{lg.new_status}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">{lg.notes || '—'}</td>
                        <td className="px-3 py-2">
                          {(
                            lg as {
                              additional_notes?: string
                            }
                          ).additional_notes || '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {String(lg.performed_by || '')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button
                            type="button"
                            title="Edit additional notes"
                            className="inline-flex items-center justify-center rounded-full hover:text-black text-litratoblack"
                            onClick={() => openEdit(lg)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
          )}
        </div>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!o) {
            setEditOpen(false)
            setEditingLog(null)
            setEditAdditional('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Log Notes</DialogTitle>
            <DialogDescription>
              Update additional notes for this payment log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-xs text-gray-500">
              Log ID: {editingLog?.log_id ?? '—'}
            </div>
            <textarea
              rows={5}
              className="w-full border rounded px-2 py-1 text-sm"
              value={editAdditional}
              onChange={(e) => setEditAdditional(e.target.value)}
              placeholder="Enter additional notes..."
            />
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
              className="px-4 py-2 rounded bg-litratoblack text-white text-sm"
              onClick={saveEdit}
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
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
      className={`px-4 py-2 rounded-full cursor-pointer border font-semibold transition ${
        active
          ? 'bg-litratoblack text-white border-litratoblack'
          : 'bg-white text-litratoblack border-gray-300 hover:bg-gray-100'
      }`}
    >
      {children}
    </div>
  )
}
