'use client'
import React, { useEffect, useMemo, useState } from 'react'
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

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [edit, setEdit] = useState<{ [id: number]: Partial<Payment> }>({})
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [qrFile, setQrFile] = useState<File | null>(null)
  const [qrUploading, setQrUploading] = useState(false)
  const [openLogsForId, setOpenLogsForId] = useState<number | null>(null)
  const [logsByPayment, setLogsByPayment] = useState<
    Record<number, PaymentLog[]>
  >({})
  const [logsLoading, setLogsLoading] = useState(false)
  const [logEdits, setLogEdits] = useState<
    Record<number, { additional_notes?: string | null; notes?: string | null }>
  >({})
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

  const API_ORIGIN =
    process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
  const API_BASE = `${API_ORIGIN}/api`

  const printSalesReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/payments/report`, {
        headers: {
          ...getAuthHeadersInit(),
        },
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

  // API calls handled via adminPayments helper

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
    // Load current QR
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

  // Load confirmed bookings when the create panel opens (for dropdown)
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
        const data = await res.json().catch(() => ({} as any))
        const rows: any[] = Array.isArray(data?.bookings) ? data.bookings : []
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

  const toggleLogs = async (paymentId: number) => {
    if (openLogsForId === paymentId) {
      setOpenLogsForId(null)
      return
    }
    setOpenLogsForId(paymentId)
    if (!logsByPayment[paymentId]) {
      setLogsLoading(true)
      try {
        const rows = await listAdminPaymentLogs(paymentId)
        setLogsByPayment((m) => ({ ...m, [paymentId]: rows }))
        // prime edits map with existing values
        const nextEdits: Record<
          number,
          { additional_notes?: string | null; notes?: string | null }
        > = {}
        rows.forEach((lg) => {
          nextEdits[lg.log_id] = {
            additional_notes: lg.additional_notes ?? '',
          }
        })
        setLogEdits((s) => ({ ...s, ...nextEdits }))
      } catch (e) {
        console.error('Load payment logs failed:', e)
      } finally {
        setLogsLoading(false)
      }
    }
  }

  const saveLog = async (log: PaymentLog) => {
    const body = logEdits[log.log_id]
    if (!body) return
    try {
      const updated = await updateAdminPaymentLog(log.log_id, body)
      // update local cache
      if (openLogsForId) {
        setLogsByPayment((m) => ({
          ...m,
          [openLogsForId]: (m[openLogsForId] || []).map((l) =>
            l.log_id === log.log_id ? updated : l
          ),
        }))
      }
    } catch (e) {
      console.error('Update payment log failed:', e)
    }
  }

  return (
    <div className="h-screen flex flex-col p-4 min-h-0">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Payments</h1>
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
      </header>

      {createOpen && (
        <section className="border rounded-xl p-4 mb-4 bg-white">
          <h2 className="font-medium mb-2">Create Payment (Admin)</h2>
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
                  setCreateForm((p) => ({ ...p, amount_paid: e.target.value }))
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
                  setCreateForm((p) => ({ ...p, reference_no: e.target.value }))
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
                    payment_status: e.target.value as any,
                  }))
                }
              >
                <option value="completed">completed</option>
                <option value="pending">pending</option>
                <option value="failed">failed</option>
                <option value="refunded">refunded</option>
              </select>
              <button
                className="ml-auto px-3 py-2 rounded bg-litratoblack text-white"
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
                    // reset
                    setCreateOpen(false)
                    setCreateForm({
                      booking_id: '',
                      amount_paid: '',
                      payment_method: 'cash',
                      reference_no: '',
                      notes: '',
                      verified: true,
                      payment_status: 'completed',
                    })
                    await load()
                  } catch (e) {
                    console.error('Create admin payment failed:', e)
                    alert('Failed to create payment')
                  }
                }}
              >
                Create
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Top bar with search (mirrors Inventory style) */}
      <nav className="flex gap-2 mb-6">
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

      <section className="bg-white h-125 rounded-xl shadow p-4 flex flex-col min-h-0 gap-4">
        {/* QR panel */}
        <div className="border rounded-xl p-3 flex flex-col gap-2">
          <div className="font-medium">Payment QR</div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-start gap-2">
              <div className="text-sm text-gray-600">Current</div>
              {qrUrl ? (
                <img
                  src={qrUrl || undefined}
                  alt="Current QR"
                  className="border rounded max-h-40 w-auto"
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

        {/* Table */}
        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : !filtered.length ? (
          <div className="text-sm text-gray-600">No payments found.</div>
        ) : (
          <div className="overflow-x-auto rounded-t-xl border border-gray-200">
            <div className="max-h-[60vh] md:max-h-96 overflow-y-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="bg-gray-300 text-left">
                    {[
                      'ID',
                      'Booking',
                      'User',
                      'Amount',
                      'Paid',
                      'Ref',
                      'Status',
                      'Notes',
                      'Proof',
                      'Actions',
                    ].map((title, i, arr) => (
                      <th
                        key={title}
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
                  {filtered.map((p) => (
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
                          {Number(p.booking_amount_due ?? p.amount).toFixed(2)}
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
                            <div className="text-xs text-gray-600">
                              Payment:{' '}
                              <span className="font-medium">
                                {p.payment_status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600">
                                Booking:
                              </span>
                              <select
                                className="border rounded px-2 py-1"
                                value={p.booking_payment_status || 'unpaid'}
                                onChange={async (e) => {
                                  const val = e.target.value as
                                    | 'unpaid'
                                    | 'partial'
                                    | 'paid'
                                    | 'refunded'
                                    | 'failed'
                                  try {
                                    const res = await fetch(
                                      `${API_BASE}/admin/confirmed-bookings/${p.booking_id}/payment-status`,
                                      {
                                        method: 'PATCH',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          ...getAuthHeadersInit(),
                                        },
                                        body: JSON.stringify({ status: val }),
                                      }
                                    )
                                    if (!res.ok)
                                      throw new Error(await res.text())
                                    // reload to reflect both booking status and any derived changes
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
                                <option value="unpaid">unpaid</option>
                                <option value="partial">partial</option>
                                <option value="paid">paid</option>
                                <option value="refunded">refunded</option>
                                <option value="failed">failed</option>
                              </select>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            className="border rounded px-2 py-1 w-64 h-16"
                            defaultValue={p.notes || ''}
                            onChange={(e) =>
                              setEdit((s) => ({
                                ...s,
                                [p.payment_id]: {
                                  ...s[p.payment_id],
                                  notes: e.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {p.proof_image_url ? (
                            <a
                              href={p.proof_image_url}
                              target="_blank"
                              className="text-blue-600 underline"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button
                            className="px-3 py-1 rounded bg-litratoblack text-white"
                            onClick={() => save(p.payment_id)}
                          >
                            Save
                          </button>
                          <button
                            className="ml-2 px-3 py-1 rounded border"
                            onClick={() => toggleLogs(p.payment_id)}
                          >
                            {openLogsForId === p.payment_id
                              ? 'Hide Logs'
                              : 'Logs'}
                          </button>
                        </td>
                      </tr>
                      {openLogsForId === p.payment_id && (
                        <tr>
                          <td colSpan={10} className="px-3 py-2 bg-white">
                            {logsLoading && !logsByPayment[p.payment_id] ? (
                              <div className="text-sm text-gray-600">
                                Loading logs...
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="text-sm font-medium">
                                  Payment Logs
                                </div>
                                {!(logsByPayment[p.payment_id] || []).length ? (
                                  <div className="text-sm text-gray-600">
                                    No logs yet.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {(logsByPayment[p.payment_id] || []).map(
                                      (lg) => (
                                        <div
                                          key={lg.log_id}
                                          className="border rounded p-2"
                                        >
                                          <div className="text-xs text-gray-600 mb-1">
                                            {new Date(
                                              lg.created_at
                                            ).toLocaleString()}{' '}
                                            • {lg.performed_by} • {lg.action}
                                          </div>
                                          <div className="text-sm mb-1">
                                            Status:{' '}
                                            <span className="font-medium">
                                              {lg.previous_status}
                                            </span>{' '}
                                            →{' '}
                                            <span className="font-medium">
                                              {lg.new_status}
                                            </span>
                                          </div>
                                          <div className="text-sm mb-2">
                                            Notes:{' '}
                                            <span className="text-gray-700">
                                              {lg.notes || '—'}
                                            </span>
                                          </div>
                                          <div className="flex items-start gap-2">
                                            <textarea
                                              className="border rounded px-2 py-1 w-full h-16"
                                              placeholder="Additional notes (admin only)"
                                              value={
                                                logEdits[lg.log_id]
                                                  ?.additional_notes ?? ''
                                              }
                                              onChange={(e) =>
                                                setLogEdits((s) => ({
                                                  ...s,
                                                  [lg.log_id]: {
                                                    ...s[lg.log_id],
                                                    additional_notes:
                                                      e.target.value,
                                                  },
                                                }))
                                              }
                                            />
                                            <button
                                              className="px-3 py-1 rounded bg-litratoblack text-white whitespace-nowrap"
                                              onClick={() => saveLog(lg)}
                                            >
                                              Update
                                            </button>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
