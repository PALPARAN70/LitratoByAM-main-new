'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { formatDisplayDateTime } from '@/lib/datetime'
import Image from 'next/image'
import {
  getLatestPaymentQR,
  getAuthHeadersInit,
} from '../../../../schemas/functions/Payment/createPayment'
import {
  fetchAdminSalesReport,
  openBlobInNewTabAndPrint,
  type SalesReportRange,
} from '../../../../schemas/functions/Payment/printSalesReport'
import {
  uploadAdminPaymentQR,
  listAdminPaymentLogs,
  updateAdminPaymentLog,
  createAdminPayment,
  type PaymentLog,
  getAdminBookingBalance,
  type BookingBalance,
  createAdminRefund,
  updateAdminPayment,
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
import { Pencil } from 'lucide-react'

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
  // Logs state (this page now shows Payment Logs by default)
  const [logs, setLogs] = useState<PaymentLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 5

  // QR state
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
    payment_status: 'Pending' as
      | 'Pending'
      | 'Partially Paid'
      | 'Failed'
      | 'Refunded'
      | 'Fully Paid',
  })
  const [eventOptions, setEventOptions] = useState<
    Array<{ id: number; label: string; userLabel: string }>
  >([])
  const [balance, setBalance] = useState<BookingBalance | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  // Notes edit dialog state (like Inventory Logs)
  // Removed previously unused notes edit states (notes are view-only here)

  const API_ORIGIN =
    process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
  const API_BASE = `${API_ORIGIN}/api`

  const [reportRange, setReportRange] = useState<SalesReportRange>('month')
  const printSalesReport = async () => {
    try {
      const blob = await fetchAdminSalesReport({ range: reportRange })
      openBlobInNewTabAndPrint(blob)
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err?.status === 501) {
        alert(err.message)
        return
      }
      console.error('Generate sales report failed:', e)
      alert('Failed to generate sales report. See console for details.')
    }
  }

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const rows = await listAdminPaymentLogs()
      setLogs(rows)
    } catch (e) {
      console.error('Load payment logs failed:', e)
    } finally {
      setLogsLoading(false)
    }
  }

  // Edit notes dialog state & handlers
  const [editOpen, setEditOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<PaymentLog | null>(null)
  const [editAdditional, setEditAdditional] = useState('')

  // Refund dialog state
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundPaymentId, setRefundPaymentId] = useState<number | null>(null)
  const [refundAmount, setRefundAmount] = useState<string>('')
  const [refundReason, setRefundReason] = useState<string>('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)

  // Proof viewer dialog state
  const [proofOpen, setProofOpen] = useState(false)
  const [proofPaymentId, setProofPaymentId] = useState<number | null>(null)
  const [verifySubmitting, setVerifySubmitting] = useState(false)
  const [confirmVerifyOpen, setConfirmVerifyOpen] = useState(false)

  // Centralized verify handler used by confirmation dialog
  const verifyCurrentPayment = async () => {
    if (!proofPaymentId) return
    setVerifySubmitting(true)
    try {
      const p = await ensurePayment(proofPaymentId)
      if (!p) throw new Error('Payment not found')
      const bal = p.booking_id
        ? await getAdminBookingBalance(p.booking_id)
        : null
      const remaining = bal ? Math.max(0, bal.amount_due - bal.total_paid) : 0
      const amt = Number(p.amount_paid || 0)
      const rowStatus = amt >= remaining ? 'Fully Paid' : 'Partially Paid'
      await updateAdminPayment(proofPaymentId, {
        verified_at: new Date().toISOString(),
        payment_status: rowStatus,
      })
      // Invalidate cache for this payment so the Verified badge refreshes
      setPaymentCache((m) => {
        const { [proofPaymentId]: _omit, ...rest } = m
        return rest
      })
      setConfirmVerifyOpen(false)
      setProofOpen(false)
      setProofPaymentId(null)
      await loadLogs()
    } catch (e) {
      console.error('Verify payment failed:', e)
      alert('Failed to verify payment')
    } finally {
      setVerifySubmitting(false)
    }
  }

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
      setLogs((arr) =>
        arr.map((l) => (l.log_id === updated.log_id ? updated : l))
      )
      setEditOpen(false)
      setEditingLog(null)
      setEditAdditional('')
    } catch (e) {
      console.error('Update payment log failed:', e)
      alert('Failed to update log notes')
    }
  }

  // --- Enrichment caches for Event/Customer/Proof ---
  type PaymentLite = {
    booking_id: number
    user_id: number
    amount_paid?: number
    proof_image_url?: string | null
    verified_at?: string | null
  }
  type BookingLite = {
    event_name?: string | null
    firstname?: string | null
    lastname?: string | null
    username?: string | null
  }
  const [paymentCache, setPaymentCache] = useState<Record<number, PaymentLite>>(
    {}
  )
  const [bookingCache, setBookingCache] = useState<Record<number, BookingLite>>(
    {}
  )

  const ensurePayment = React.useCallback(
    async (paymentId: number) => {
      if (!paymentId) return null
      if (paymentCache[paymentId]) return paymentCache[paymentId]
      try {
        const res = await fetch(`${API_BASE}/admin/payments/${paymentId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeadersInit(),
          },
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json().catch(() => ({}))
        const p = (data as any)?.payment as
          | {
              booking_id: number
              user_id: number
              amount_paid?: number
              proof_image_url?: string | null
              verified_at?: string | null
            }
          | undefined
        if (p && p.booking_id) {
          const lite: PaymentLite = {
            booking_id: Number(p.booking_id),
            user_id: Number(p.user_id),
            amount_paid:
              p.amount_paid != null ? Number(p.amount_paid) : undefined,
            proof_image_url: p.proof_image_url ?? null,
            verified_at: p.verified_at ?? null,
          }
          setPaymentCache((m) => ({ ...m, [paymentId]: lite }))
          return lite
        }
      } catch (e) {
        console.warn('ensurePayment failed:', e)
      }
      return null
    },
    [API_BASE, paymentCache]
  )

  const ensureBooking = React.useCallback(
    async (bookingId: number) => {
      if (!bookingId) return null
      if (bookingCache[bookingId]) return bookingCache[bookingId]
      try {
        const res = await fetch(
          `${API_BASE}/admin/confirmed-bookings/${bookingId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeadersInit(),
            },
            cache: 'no-store',
          }
        )
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json().catch(() => ({}))
        const b = (data as any)?.booking as BookingLite | undefined
        if (b) {
          setBookingCache((m) => ({ ...m, [bookingId]: b }))
          return b
        }
      } catch (e) {
        console.warn('ensureBooking failed:', e)
      }
      return null
    },
    [API_BASE, bookingCache]
  )

  useEffect(() => {
    loadLogs()
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

  // Load booking balance when booking changes in create form
  useEffect(() => {
    const id = Number(createForm.booking_id)
    if (!createOpen || !id) {
      setBalance(null)
      return
    }
    let ignore = false
    setBalanceLoading(true)
    getAdminBookingBalance(id)
      .then((b) => {
        if (!ignore) setBalance(b)
      })
      .catch((e) => {
        console.warn('Load admin booking balance failed:', e)
        if (!ignore) setBalance(null)
      })
      .finally(() => {
        if (!ignore) setBalanceLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [createOpen, createForm.booking_id])

  const normalized = (search || '').trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!normalized) return logs
    return logs.filter((lg) => {
      const p = paymentCache[lg.payment_id]
      const b = p ? bookingCache[p.booking_id] : undefined
      const customerName =
        [b?.firstname, b?.lastname].filter(Boolean).join(' ').trim() ||
        b?.username ||
        ''
      const hay = [
        lg.payment_id,
        lg.action,
        lg.previous_status,
        lg.new_status,
        String(lg.performed_by || ''),
        formatDisplayDateTime(lg.created_at),
        b?.event_name || '',
        customerName,
      ]
        .join('\n')
        .toLowerCase()
      return hay.includes(normalized)
    })
  }, [logs, normalized, paymentCache, bookingCache])

  // Tabs
  type TabKey = 'payments' | 'qr'
  const [active, setActive] = useState<TabKey>('payments')

  // Pagination
  useEffect(() => setPage(1), [search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const startIdx = (page - 1) * PER_PAGE
  const paginated = filtered.slice(startIdx, startIdx + PER_PAGE)
  const windowPages = useMemo(
    () => pageWindow(page, totalPages, 3),
    [page, totalPages]
  )

  // Ensure enrichment for currently visible logs
  useEffect(() => {
    const run = async () => {
      const ids = Array.from(new Set(paginated.map((lg) => lg.payment_id)))
      for (const pid of ids) {
        const p = await ensurePayment(pid)
        if (p?.booking_id) await ensureBooking(p.booking_id)
      }
    }
    if (paginated.length) run()
  }, [paginated, ensurePayment, ensureBooking])

  // Ensure we have payment/booking data for the selected refund when dialog opens
  useEffect(() => {
    if (!refundOpen || !refundPaymentId) return
    ;(async () => {
      const p = await ensurePayment(refundPaymentId)
      if (p?.booking_id) await ensureBooking(p.booking_id)
    })()
  }, [refundOpen, refundPaymentId, ensurePayment, ensureBooking])

  // Derived event name for refund dialog
  const refundEventName = useMemo(() => {
    if (!refundPaymentId) return ''
    const p = paymentCache[refundPaymentId]
    if (!p) return ''
    const b = bookingCache[p.booking_id]
    return b?.event_name || ''
  }, [refundPaymentId, paymentCache, bookingCache])

  // Derived customer name for refund dialog
  const refundCustomerName = useMemo(() => {
    if (!refundPaymentId) return ''
    const p = paymentCache[refundPaymentId]
    if (!p) return ''
    const b = bookingCache[p.booking_id]
    const full = [b?.firstname, b?.lastname].filter(Boolean).join(' ').trim()
    return full || b?.username || ''
  }, [refundPaymentId, paymentCache, bookingCache])

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
        <h1 className="text-2xl font-bold">Payment Logs</h1>
        {active === 'payments' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700" htmlFor="reportRange">
                Period
              </label>
              <select
                id="reportRange"
                className="border rounded px-2 py-1 text-sm"
                value={reportRange}
                onChange={(e) =>
                  setReportRange(e.target.value as SalesReportRange)
                }
                title="Select report period"
              >
                <option value="today">Today</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <button
              className="px-3 py-2 rounded bg-litratoblack text-white"
              onClick={printSalesReport}
              title="Generate sales report PDF for selected period"
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
        <TabButton active={active === 'qr'} onClick={() => setActive('qr')}>
          QR Control
        </TabButton>
      </nav>

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
          <nav className="flex gap-2 items-center mb-2">
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
                  placeholder="Search logs (status, action, event, customer, user)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent outline-none w-full px-2 h-8"
                />
              </form>
            </div>
            <button
              className="px-3 py-2 rounded border text-sm"
              onClick={loadLogs}
              disabled={logsLoading}
              title="Refresh logs"
            >
              {logsLoading ? 'Loading…' : 'Refresh'}
            </button>
          </nav>

          {logsLoading && !logs.length ? (
            <div className="text-sm text-gray-600">Loading logs…</div>
          ) : !filtered.length ? (
            <div className="text-sm text-gray-600">No logs found.</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-t-xl border border-gray-200">
                <div className="max-h-[60vh] md:max-h-96 overflow-y-auto">
                  <table className="w-full table-auto text-sm">
                    <thead>
                      <tr className="bg-gray-300 text-left">
                        {[
                          'Date/Time',
                          'Event',
                          'Verified',
                          'Customer',
                          'Proof',
                          'Action',
                          'Status',
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
                      {paginated.map((lg) => {
                        const p = paymentCache[lg.payment_id]
                        const b = p ? bookingCache[p.booking_id] : undefined
                        const eventName = b?.event_name || ''
                        const customerName =
                          [b?.firstname, b?.lastname]
                            .filter(Boolean)
                            .join(' ')
                            .trim() ||
                          b?.username ||
                          ''
                        const proofUrl = p?.proof_image_url || ''
                        return (
                          <tr
                            key={lg.log_id}
                            className="text-left bg-gray-100 even:bg-gray-50 align-top"
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              {formatDisplayDateTime(lg.created_at)}
                            </td>
                            <td
                              className="px-3 py-2 whitespace-nowrap max-w-[14rem] truncate"
                              title={eventName}
                            >
                              {eventName || '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {(() => {
                                if (!p) return '—'
                                const verified = !!p.verified_at
                                const cls = verified
                                  ? 'bg-green-700 text-white'
                                  : 'bg-gray-700 text-white'
                                const label = verified
                                  ? 'Verified'
                                  : 'Unverified'
                                return (
                                  <span
                                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${cls}`}
                                  >
                                    {label}
                                  </span>
                                )
                              })()}
                            </td>
                            <td
                              className="px-3 py-2 whitespace-nowrap max-w-[12rem] truncate"
                              title={customerName}
                            >
                              {customerName || '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <button
                                type="button"
                                className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                                disabled={!proofUrl}
                                onClick={async () => {
                                  setProofPaymentId(lg.payment_id)
                                  const pLite = await ensurePayment(
                                    lg.payment_id
                                  )
                                  if (pLite?.booking_id)
                                    await ensureBooking(pLite.booking_id)
                                  setProofOpen(true)
                                }}
                              >
                                View
                              </button>
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
                                <span className="font-medium">
                                  {lg.new_status}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {(lg as { additional_notes?: string })
                                .additional_notes || '—'}
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
                              <button
                                type="button"
                                title="Create refund"
                                className="ml-2 inline-flex items-center justify-center rounded-full hover:text-black text-litratoblack"
                                onClick={() => {
                                  setRefundPaymentId(lg.payment_id)
                                  setRefundAmount('')
                                  setRefundReason('')
                                  setRefundOpen(true)
                                }}
                              >
                                Refund
                              </button>
                            </td>
                          </tr>
                        )
                      })}
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

      {/* Edit Log Notes Dialog */}
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

      {/* Proof Viewer Dialog */}
      <Dialog
        open={proofOpen}
        onOpenChange={(o) => {
          if (!o) {
            setProofOpen(false)
            setProofPaymentId(null)
            setVerifySubmitting(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
            <DialogDescription>
              Review the uploaded receipt and verify the payment if valid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(() => {
              if (!proofPaymentId) return null
              const p = paymentCache[proofPaymentId]
              const b = p?.booking_id ? bookingCache[p.booking_id] : undefined
              const eventName = b?.event_name || ''
              const customerName =
                [b?.firstname, b?.lastname].filter(Boolean).join(' ').trim() ||
                b?.username ||
                ''
              const url = p?.proof_image_url || ''
              return (
                <>
                  <div className="text-sm">Payment ID: {proofPaymentId}</div>
                  <div className="text-sm">Event: {eventName || '—'}</div>
                  <div className="text-sm">Customer: {customerName || '—'}</div>
                  {url ? (
                    // Use img to allow arbitrary remote sources
                    <div className="border rounded overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Payment proof"
                        className="max-h-[420px] w-full object-contain bg-black/5"
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      No proof image provided.
                    </div>
                  )}
                </>
              )
            })()}
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
            <button
              type="button"
              className="px-4 py-2 rounded bg-litratoblack text-white text-sm disabled:opacity-60"
              disabled={!proofPaymentId || verifySubmitting}
              onClick={() => setConfirmVerifyOpen(true)}
            >
              Verify
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
            <DialogTitle>Confirm Verification</DialogTitle>
            <DialogDescription>
              This will mark the payment as verified and set its status based on
              the remaining balance.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-700">
            Proceed to verify this payment?
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
              className="px-4 py-2 rounded bg-litratoblack text-white text-sm disabled:opacity-60"
              disabled={!proofPaymentId || verifySubmitting}
              onClick={verifyCurrentPayment}
            >
              {verifySubmitting ? 'Verifying…' : 'Confirm Verify'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  min={0}
                  max={balance ? balance.balance : undefined}
                />
                {balance && (
                  <div className="text-xs text-gray-600 mt-1">
                    Amount due: {balance.amount_due.toFixed(2)} • Paid:{' '}
                    {balance.total_paid.toFixed(2)} • Remaining:{' '}
                    {balance.balance.toFixed(2)}
                  </div>
                )}
                {balanceLoading && (
                  <div className="text-xs text-gray-500 mt-1">
                    Loading balance…
                  </div>
                )}
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
                        | 'Pending'
                        | 'Partially Paid'
                        | 'Failed'
                        | 'Refunded'
                        | 'Fully Paid',
                    }))
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Failed">Failed</option>
                  <option value="Refunded">Refunded</option>
                  <option value="Fully Paid">Fully Paid</option>
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
                if (balance && amount_paid > balance.balance) {
                  alert(
                    `Amount exceeds remaining balance (${balance.balance.toFixed(
                      2
                    )}).`
                  )
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
                    payment_status: 'Pending',
                  })
                  setBalance(null)
                  setCreateOpen(false)
                  await loadLogs()
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

      {/* Refund Dialog */}
      <Dialog
        open={refundOpen}
        onOpenChange={(o) => {
          if (!o) {
            setRefundOpen(false)
            setRefundPaymentId(null)
            setRefundAmount('')
            setRefundReason('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Refund</DialogTitle>
            <DialogDescription>
              Issue a partial or full refund for the selected payment. Only
              verified successful payments are refundable; the server will
              validate the amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm">Payment ID: {refundPaymentId ?? '—'}</div>
            <div className="text-sm">Event: {refundEventName || '—'}</div>
            <div className="text-sm">Customer: {refundCustomerName || '—'}</div>
            <div>
              <label className="text-sm">Amount</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded px-2 py-1"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="e.g., 1000"
              />
            </div>
            <div>
              <label className="text-sm">Reason (optional)</label>
              <textarea
                rows={3}
                className="w-full border rounded px-2 py-1"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter reason for refund"
              />
            </div>
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
              className="px-4 py-2 rounded bg-litratoblack text-white text-sm disabled:opacity-60"
              disabled={
                !refundPaymentId || !Number(refundAmount) || refundSubmitting
              }
              onClick={async () => {
                if (!refundPaymentId) return
                const amt = Number(refundAmount)
                if (!Number.isFinite(amt) || amt <= 0) {
                  alert('Enter a valid refund amount')
                  return
                }
                setRefundSubmitting(true)
                try {
                  await createAdminRefund(refundPaymentId, {
                    amount: amt,
                    reason: refundReason.trim() || undefined,
                  })
                  // Invalidate cache so any derived payment details refresh
                  setPaymentCache((m) => {
                    const { [refundPaymentId]: _omit, ...rest } = m
                    return rest
                  })
                  setRefundOpen(false)
                  setRefundPaymentId(null)
                  setRefundAmount('')
                  setRefundReason('')
                  await loadLogs()
                } catch (e) {
                  console.error('Create refund failed:', e)
                  alert('Failed to create refund')
                } finally {
                  setRefundSubmitting(false)
                }
              }}
            >
              {refundSubmitting ? 'Submitting…' : 'Create Refund'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// (Old PaymentLogsPanel removed)

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
