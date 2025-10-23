'use client'
import React, { useEffect, useMemo, useState } from 'react'

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

  const API_ORIGIN =
    process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
  const API_BASE = `${API_ORIGIN}/api`

  const getCookie = (name: string) =>
    typeof document === 'undefined'
      ? ''
      : document.cookie
          .split('; ')
          .find((r) => r.startsWith(name + '='))
          ?.split('=')[1] || ''
  const getAuthHeaderString = () => {
    const raw =
      (typeof window !== 'undefined' && localStorage.getItem('access_token')) ||
      getCookie('access_token')
    if (!raw) return ''
    return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`
  }
  const getAuthHeadersInit = (): HeadersInit => {
    const auth = getAuthHeaderString()
    const h: Record<string, string> = {}
    if (auth) h['Authorization'] = auth
    return h
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/payments`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeadersInit(),
        },
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setPayments((data.payments ?? []) as Payment[])
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
        const res = await fetch(`${API_BASE}/customer/payment-qr`)
        if (!res.ok) return setQrUrl(null)
        const data = await res.json()
        setQrUrl((data && data.url) || null)
      } catch (e) {
        setQrUrl(null)
      }
    }
    loadQR()
  }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return payments
    return payments.filter((p) =>
      [
        p.payment_id,
        p.booking_id,
        p.user_id,
        p.payment_status,
        p.reference_no || '',
      ].some((v) => String(v).toLowerCase().includes(q))
    )
  }, [payments, filter])

  const save = async (id: number) => {
    const body = edit[id]
    if (!body) return
    try {
      const res = await fetch(`${API_BASE}/admin/payments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeadersInit(),
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setEdit((e) => ({ ...e, [id]: {} }))
      await load()
    } catch (e) {
      console.error('Update payment failed:', e)
    }
  }

  return (
    <div className="h-screen flex flex-col p-4 min-h-0">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Payments</h1>
      </header>

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
                  src={qrUrl}
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
                    const fd = new FormData()
                    fd.append('image', qrFile)
                    const res = await fetch(
                      `${API_BASE}/admin/payment-qr-image`,
                      {
                        method: 'POST',
                        headers: {
                          ...getAuthHeadersInit(),
                        },
                        body: fd,
                      }
                    )
                    if (!res.ok) throw new Error(await res.text())
                    const data = await res.json()
                    setQrUrl(data.url || null)
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
                    <tr
                      key={p.payment_id}
                      className="text-left bg-gray-100 even:bg-gray-50 align-top"
                    >
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
                        {Number(p.amount).toFixed(2)}
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
                        <select
                          defaultValue={p.payment_status}
                          className="border rounded px-2 py-1"
                          onChange={(e) =>
                            setEdit((s) => ({
                              ...s,
                              [p.payment_id]: {
                                ...s[p.payment_id],
                                payment_status: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="pending">pending</option>
                          <option value="completed">completed</option>
                          <option value="failed">failed</option>
                          <option value="refunded">refunded</option>
                        </select>
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
                      </td>
                    </tr>
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
