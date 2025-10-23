'use client'
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

export default function CustomerPaymentsIndex() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
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
          const data = await res.json()
          setPayments(data.payments || [])
        }
      } catch (e) {
        console.error('Load my payments failed:', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

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
                <th className="px-3 py-2">Payment ID</th>
                <th className="px-3 py-2">Booking</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.payment_id} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2">{p.payment_id}</td>
                  <td className="px-3 py-2">{p.booking_id}</td>
                  <td className="px-3 py-2">
                    {Number(p.amount_paid || 0).toFixed(2)}
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

      <div className="mt-6 p-3 border rounded">
        <div className="text-sm font-medium mb-2">Know your booking ID?</div>
        <div className="text-sm text-gray-600">
          Navigate directly to <code>/customer/payments/&lt;bookingId&gt;</code>{' '}
          (e.g. 123), or click Pay from your booking details.
        </div>
      </div>
    </div>
  )
}
