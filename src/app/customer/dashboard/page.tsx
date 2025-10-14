'use client'
import {
  HiOutlineExternalLink,
  HiOutlinePlusCircle,
  HiOutlineDotsHorizontal,
} from 'react-icons/hi'
import { FaRegFileAlt } from 'react-icons/fa'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import MotionDiv from '../../../../Litratocomponents/MotionDiv'
import { cancelBookingRequest as cancelReq } from '../../../../schemas/functions/BookingRequest/cancelBookingRequest'
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
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/auth/getProfile'

export default function DashboardPage() {
  const router = useRouter()
  const [isEditable, setIsEditable] = useState(false)
  const [personalForm, setPersonalForm] = useState({
    Firstname: '',
    Lastname: '',
  })

  const [profile, setProfile] = useState<{
    username: string
    email: string
    role: string
    url?: string
    firstname?: string
    lastname?: string
  } | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.replace('/login')
      return
    }
    const ac = new AbortController()

    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          signal: ac.signal,
        })

        if (res.status === 401) {
          try {
            localStorage.removeItem('access_token')
          } catch {}
          router.replace('/login')
          return
        }
        if (!res.ok) throw new Error('Failed to fetch profile')

        const data = await res.json()
        setProfile(data)
        setPersonalForm({
          Firstname: data.firstname || '',
          Lastname: data.lastname || '',
        })
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        toast.error('Error fetching profile')
      }
    })()

    return () => ac.abort()
  }, [router])

  const Carddetails = [
    { name: 'Approved', content: '7' },
    { name: 'Declined', content: '3' },
    { name: 'Pending', content: '5' },
  ]
  const QuickActions = [
    {
      name: 'Add Organization',
      icon: (
        <HiOutlinePlusCircle className="mr-2 text-base sm:text-lg md:text-xl" />
      ),
    },
    {
      name: 'View Logs',
      icon: <FaRegFileAlt className="mr-2 text-base sm:text-lg md:text-xl" />,
    },
  ]
  // Add: dashboard rows + pagination
  type Row = {
    name: string
    date: string
    startTime: string
    endTime: string
    package: string
    place: string
    paymentStatus: string
    status?: 'Approved' | 'Declined' | 'Pending' | 'Cancelled' // extended
    action: string[]
    requestid?: number // add: used for update navigation
  }
  const DASHBOARD_KEY = 'litrato_dashboard_table'
  const [rows, setRows] = useState<Row[]>([])
  const PER_PAGE = 5
  const [page, setPage] = useState(1)

  // NEW: status filter state
  const [statusFilter, setStatusFilter] = useState<Row['status'] | null>(null)
  useEffect(() => {
    setPage(1) // reset to first page when filter changes
  }, [statusFilter])

  const pageWindow = (current: number, total: number, size = 3) => {
    if (total <= 0) return []
    const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1
    const end = Math.min(total, start + size - 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  // Convert "hh:mm am/pm" to "HH:MM"
  const to24h = (s: string) => {
    if (!s) return ''
    const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
    if (!m) return s
    let h = parseInt(m[1], 10)
    const mm = m[2]
    const ap = m[3].toLowerCase()
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${mm}`
  }

  // Fetch user's bookings and fill missing requestid in local rows
  const hydrateRequestIds = async (currentRows: Row[]) => {
    try {
      const token =
        (typeof window !== 'undefined' &&
          localStorage.getItem('access_token')) ||
        null
      if (!token) return

      const API_BASE =
        (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
          'http://localhost:5000') + '/api/customer/bookingRequest'

      const res = await fetch(API_BASE, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const bookings = Array.isArray(data?.bookings) ? data.bookings : []

      // Build quick lookup by date|time|address|package
      const keySrv = (b: any) =>
        `${b.eventdate}|${String(b.eventtime).slice(0, 5)}|${(
          b.eventaddress || ''
        ).trim()}|${(b.package_name || '').trim()}`
      const map = new Map<string, any>()
      bookings.forEach((b: any) => map.set(keySrv(b), b))

      let changed = false
      const patched = currentRows.map((r) => {
        if (r.requestid) return r
        const k = `${r.date}|${to24h(r.startTime)}|${(r.place || '').trim()}|${(
          r.package || ''
        ).trim()}`
        const hit = map.get(k)
        if (hit?.requestid) {
          changed = true
          return { ...r, requestid: hit.requestid }
        }
        return r
      })

      if (changed) {
        setRows(patched)
        try {
          localStorage.setItem(DASHBOARD_KEY, JSON.stringify(patched))
        } catch {}
      }
    } catch {
      // silent
    }
  }

  const loadRows = () => {
    try {
      const raw =
        (typeof window !== 'undefined' &&
          localStorage.getItem(DASHBOARD_KEY)) ||
        '[]'
      const arr = Array.isArray(JSON.parse(raw))
        ? (JSON.parse(raw) as Row[])
        : []
      const normalized = arr.map((r) => ({
        ...r,
        status: (r.status ?? 'Pending') as
          | 'Approved'
          | 'Declined'
          | 'Pending'
          | 'Cancelled',
      }))
      setRows(normalized)
      setPage(1)
      // Try to backfill missing ids
      hydrateRequestIds(normalized)
    } catch {
      setRows([])
      setPage(1)
    }
  }
  useEffect(() => {
    loadRows()
    const onStorage = (e: StorageEvent) => {
      if (e.key === DASHBOARD_KEY) loadRows()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Compute filtered rows based on selected status
  const filteredRows = statusFilter
    ? rows.filter((r) => (r.status ?? 'Pending') === statusFilter)
    : rows

  // Use filtered rows for pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PER_PAGE))
  const windowPages = pageWindow(page, totalPages, 3)
  const paginated = filteredRows.slice(
    (page - 1) * PER_PAGE,
    (page - 1) * PER_PAGE + PER_PAGE
  )

  // Derive counts per status and card colors
  const counts = {
    Approved: rows.filter((r) => r.status === 'Approved').length,
    Declined: rows.filter((r) => r.status === 'Declined').length,
    Pending: rows.filter((r) => (r.status ?? 'Pending') === 'Pending').length,
    Cancelled: rows.filter((r) => r.status === 'Cancelled').length, // fixed
  }
  const statusCards: { name: Row['status']; content: string; bg: string }[] = [
    { name: 'Pending', content: String(counts.Pending), bg: 'bg-gray-700' },
    { name: 'Approved', content: String(counts.Approved), bg: 'bg-green-700' },
    { name: 'Declined', content: String(counts.Declined), bg: 'bg-litratored' },

    {
      name: 'Cancelled',
      content: String(counts.Cancelled),
      bg: 'bg-orange-700',
    },
  ]

  const badgeClass = (s: Row['status']) => {
    if (s === 'Approved')
      return 'bg-green-100 text-white border border-green-300'
    if (s === 'Declined') return 'bg-red-100 text-white border border-red-300'
    if (s === 'Cancelled')
      return 'bg-orange-100 text-white border border-orange-300'
    return 'bg-gray-600 text-white border border-gray-300'
  }

  const handleReschedule = (row: Row) => {
    if (!row.requestid) {
      toast.error('Cannot update this entry. Missing request id.')
      return
    }
    router.push(`/customer/booking?requestid=${row.requestid}`)
  }

  const handleCancel = async (row: Row) => {
    if (!row.requestid) {
      toast.error('Cannot cancel this entry. Missing request id.')
      return
    }
    try {
      await cancelReq(row.requestid)
      // Update local state/status to Declined (or Cancelled) and persist to localStorage
      const updated: Row[] = rows.map((r) =>
        r.requestid === row.requestid
          ? { ...r, status: 'Cancelled' as 'Cancelled' }
          : r
      )
      setRows(updated)
      try {
        localStorage.setItem(DASHBOARD_KEY, JSON.stringify(updated))
      } catch {}
      toast.success('Booking cancelled')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cancel booking')
    }
  }

  // NEW: handle payment
  const handlePay = (row: Row) => {
    if (!row.requestid) {
      toast.error('Cannot proceed to payment. Missing request id.')
      return
    }
    if ((row.status ?? 'Pending') !== 'Approved') {
      toast.error('Payment is only available for approved bookings.')
      return
    }
    // Navigate to a payment page for this booking
    router.push(`/customer/payment?requestid=${row.requestid}`)
  }

  return (
    <MotionDiv>
      <div className="min-h-screen w-full overflow-x-hidden">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold">
              Hello, {personalForm.Firstname} {personalForm.Lastname}!
            </h1>

            <div className="flex flex-col">
              <h5 className="text-base sm:text-lg md:text-xl font-medium mb-3">
                Booking Requests Status
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {statusCards.map((card, i) => {
                  const active = statusFilter === card.name
                  return (
                    <Card
                      key={i}
                      onClick={() =>
                        setStatusFilter((prev) =>
                          prev === card.name ? null : card.name
                        )
                      }
                      className={`rounded-2xl hover:shadow-litratored shadow-md ${
                        card.bg
                      } text-white ${
                        active ? 'ring-2 ring-litratored' : 'border-none'
                      } cursor-pointer transition`}
                    >
                      <CardHeader className="flex flex-row items-center justify-between text-base sm:text-lg font-medium">
                        {card.name}
                        <a
                          href="#"
                          className="shrink-0"
                          onClick={(e) => e.preventDefault()}
                        >
                          <HiOutlineExternalLink className="text-white" />
                        </a>
                      </CardHeader>
                      <CardContent className="text-3xl sm:text-4xl font-semibold -mt-2">
                        {card.content}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col">
              <h5 className="text-base sm:text-lg md:text-xl font-medium mb-3">
                Dashboard{statusFilter ? ` • ${statusFilter}` : ''}
              </h5>
              <div className="overflow-x-auto rounded-t-xl border border-gray-200">
                <div className="max-h-[60vh] md:max-h-72 overflow-y-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="bg-gray-300">
                        {[
                          'Event Name',
                          'Date',
                          'Start Time',
                          'End Time',
                          'Package',
                          'Place',
                          'Status', // NEW
                          'Payment Status',
                          'Actions',
                        ].map((title, i, arr) => (
                          <th
                            key={i}
                            className={`px-3 sm:px-4 py-2 text-left text-xs sm:text-sm md:text-base ${
                              i === 0 ? 'rounded-tl-xl' : ''
                            } ${i === arr.length - 1 ? 'rounded-tr-xl' : ''}`}
                          >
                            {title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.length === 0 ? (
                        <tr className="text-left bg-gray-50">
                          <td
                            className="px-3 sm:px-4 py-6 text-center text-sm"
                            colSpan={9}
                          >
                            {statusFilter
                              ? 'No bookings for this status.'
                              : 'No bookings yet.'}
                          </td>
                        </tr>
                      ) : (
                        paginated.map((data, i) => (
                          <tr
                            className="text-left bg-gray-100 even:bg-gray-50"
                            key={i}
                          >
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.name}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.date}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.startTime}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.endTime}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.package}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.place}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 rounded-full text-xs sm:text-sm ${badgeClass(
                                  data.status ?? 'Pending'
                                )}`}
                              >
                                {data.status ?? 'Pending'}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.paymentStatus}
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              {Array.isArray(data.action) && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      className="p-2 rounded hover:bg-gray-200 transition"
                                      aria-label="Actions"
                                    >
                                      <HiOutlineDotsHorizontal className="text-lg" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    align="end"
                                    className="w-44 p-2"
                                  >
                                    <div className="flex flex-col gap-2 text-center">
                                      Approval is needed for payment.
                                      <button
                                        className="w-full bg-litratoblack text-white rounded px-2 py-1 text-xs sm:text-sm"
                                        onClick={() => handleCancel(data)}
                                      >
                                        {data.action[0] ?? 'Cancel'}
                                      </button>
                                      <button
                                        className="w-full bg-litratored  text-white rounded px-2 py-1 text-xs sm:text-sm"
                                        onClick={() => handleReschedule(data)}
                                      >
                                        {data.action[1] ?? 'Reschedule'}
                                      </button>
                                      <button
                                        className="w-full bg-green-700 text-white rounded px-2 py-1 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={() => handlePay(data)}
                                        disabled={
                                          (data.status ?? 'Pending') !==
                                          'Approved'
                                        }
                                      >
                                        Pay
                                      </button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add: pagination like inventory tables */}
              <div className="mt-3">
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
      </div>
    </MotionDiv>
  )
}
