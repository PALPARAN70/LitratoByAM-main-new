'use client'
import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

export default function CustomerPaymentsIndex() {
  interface PaymentRow {
    payment_id: string
    booking_id: string
    amount_paid: number
    payment_status: string
    event_name: string
  }

  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(false)
  const API_ORIGIN =
    process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
  const API_BASE = `${API_ORIGIN}/api`

  const getCookie = useCallback((name: string) => {
    if (typeof document === 'undefined') return ''
    return (
      document.cookie
        .split('; ')
        .find((r) => r.startsWith(name + '='))
        ?.split('=')[1] || ''
    )
  }, [])

  const getAuthHeaderString = useCallback(() => {
    const raw =
      (typeof window !== 'undefined' && localStorage.getItem('access_token')) ||
      getCookie('access_token')
    if (!raw) return ''
    return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`
  }, [getCookie])

  const getAuthHeadersInit = useCallback((): HeadersInit => {
    const auth = getAuthHeaderString()
    const h: Record<string, string> = {}
    if (auth) h['Authorization'] = auth
    return h
  }, [getAuthHeaderString])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/customer/payments`, {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeadersInit(),
          },
        })
        if (res.ok) {
          const data: unknown = await res.json()
          const list: unknown[] =
            data &&
            typeof data === 'object' &&
            Array.isArray((data as Record<string, unknown>).payments)
              ? ((data as Record<string, unknown>).payments as unknown[])
              : []
          const rows: PaymentRow[] = list.map((it: unknown) => {
            const r =
              it && typeof it === 'object'
                ? (it as Record<string, unknown>)
                : {}
            const payment_id = String(r.payment_id ?? '')
            const booking_id = String(r.booking_id ?? '')
            const amount_paid = Number(r.amount_paid ?? 0)
            const payment_status = String(r.payment_status ?? '')
            const event_name = String(r.booking_event_name ?? '').trim()
            return {
              payment_id,
              booking_id,
              amount_paid,
              payment_status,
              event_name,
            }
          })
          setPayments(rows)
        }
      } catch (e) {
        console.error('Load my payments failed:', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [API_BASE, getAuthHeadersInit])

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">My Payments</h1>
      <p className="text-sm text-gray-600">
        To pay a booking, open its Pay page and submit your GCash reference and
        screenshot.
      </p>

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : !payments.length ? (
        <div className="text-sm text-gray-500">You have no payments yet.</div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.payment_id} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2">
                    {p.event_name || `Booking ${p.booking_id}`}
                  </td>
                  <td className="px-3 py-2">
                    {Number(p.amount_paid ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 capitalize">{p.payment_status}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/customer/payments/${p.booking_id}`}
                      className="px-3 py-1 rounded bg-black text-white"
                    >
                      Pay / View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
