'use client'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import LitratoBranding from '../../../Litratocomponents/Branding'
import Calendar from '../../../Litratocomponents/LitratoCalendar'
import { useRouter } from 'next/navigation'
import MotionDiv from '../../../Litratocomponents/MotionDiv'

type PackageAvailabilityStatus = 'available' | 'limited' | 'unavailable'

type PackageAvailability = {
  packageId: number
  packageName: string
  durationHours: number | null
  status: PackageAvailabilityStatus
  existingBookings: Array<{
    requestId: number
    eventName: string | null
    status: string
    eventStart: string
    eventEnd: string
    bufferStart: string
    bufferEnd: string
  }>
  blockedWindows: Array<{ start: string; end: string }>
  startWindows: Array<{ start: string; end: string }>
}

type DailyAvailabilityResponse = {
  date: string
  generatedAt: string
  constraints: {
    bufferHours: number
    potentialExtensionHours: number
  }
  packages: PackageAvailability[]
}

const STATUS_LABELS: Record<PackageAvailabilityStatus, string> = {
  available: 'Available',
  limited: 'Limited',
  unavailable: 'Unavailable',
}

const STATUS_BADGE_CLASSES: Record<PackageAvailabilityStatus, string> = {
  available: 'bg-green-100 text-green-800 border border-green-300',
  limited: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  unavailable: 'bg-red-100 text-red-700 border border-red-300',
}

const AVAILABILITY_DAY_API =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/auth/availability/day'

function toDisplayTime(time24: string): string {
  if (!time24) return '—'
  const [rawHours, rawMinutes] = time24.split(':')
  let hours = Number(rawHours)
  const minutes = Number(rawMinutes ?? '0')
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time24
  hours = ((hours % 24) + 24) % 24
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function formatRange(start: string, end: string): string {
  if (start === end) return toDisplayTime(start)
  return `${toDisplayTime(start)} – ${toDisplayTime(end)}`
}

function formatStartWindow(window: { start: string; end: string }): string {
  if (window.start === window.end) {
    return `Start at ${toDisplayTime(window.start)}`
  }
  return `Start between ${toDisplayTime(window.start)} and ${toDisplayTime(
    window.end
  )}`
}

export default function AvailabilityPage() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedISO, setSelectedISO] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [showPopover, setShowPopover] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availability, setAvailability] =
    useState<DailyAvailabilityResponse | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleLogin = () => {
    router.push('/login')
  }

  const handleBack = () => {
    router.push('/home')
  }

  const closePopover = () => {
    setShowPopover(false)
    setPopoverPosition(null)
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
  }

  useEffect(() => {
    if (!showPopover) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopover()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [showPopover])

  useEffect(() => {
    if (!showPopover || !popoverPosition) return
    if (typeof window === 'undefined') return

    const adjustPosition = () => {
      const el = popoverRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const margin = 16
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let nextTop = popoverPosition.top
      let nextLeft = popoverPosition.left
      const halfWidth = rect.width / 2
      const halfHeight = rect.height / 2

      const minLeft = margin + halfWidth
      const maxLeft = viewportWidth - margin - halfWidth
      if (nextLeft < minLeft) nextLeft = minLeft
      if (nextLeft > maxLeft) nextLeft = maxLeft

      const minTop = margin + halfHeight
      const maxTop = viewportHeight - margin - halfHeight
      if (nextTop < minTop) nextTop = minTop
      if (nextTop > maxTop) nextTop = maxTop

      if (
        Math.abs(nextTop - popoverPosition.top) > 1 ||
        Math.abs(nextLeft - popoverPosition.left) > 1
      ) {
        setPopoverPosition({ top: nextTop, left: nextLeft })
      }
    }

    const raf = window.requestAnimationFrame(adjustPosition)
    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [showPopover, popoverPosition, availability])

  useEffect(() => {
    if (!selectedISO || fetchKey === 0) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    setAvailability(null)

    const run = async () => {
      try {
        const url = `${AVAILABILITY_DAY_API}?date=${encodeURIComponent(
          selectedISO
        )}`
        const res = await fetch(url, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(
            text || `Failed to load availability (status ${res.status})`
          )
        }
        const data = (await res.json()) as DailyAvailabilityResponse
        if (controller.signal.aborted) return
        setAvailability(data)
        setLoading(false)
        abortRef.current = null
      } catch (err) {
        if (controller.signal.aborted) return
        const message =
          err instanceof Error ? err.message : 'Failed to load availability'
        setError(message)
        setLoading(false)
        abortRef.current = null
      }
    }

    void run()

    return () => {
      controller.abort()
    }
  }, [selectedISO, fetchKey])

  const handleDayClick = (
    date: Date,
    meta?: {
      boundingRect: DOMRect
    }
  ) => {
    const iso = format(date, 'yyyy-MM-dd')
    const top = typeof window !== 'undefined' ? window.innerHeight / 2 : 240
    const left = typeof window !== 'undefined' ? window.innerWidth / 2 : 0

    setPopoverPosition({ top, left })
    setSelectedDate(date)
    setShowPopover(true)
    setError(null)
    if (selectedISO !== iso) {
      setSelectedISO(iso)
    }
    setFetchKey((prev) => prev + 1)
  }

  const defaultTop =
    typeof window !== 'undefined' ? window.innerHeight / 2 : 240
  const defaultLeft = typeof window !== 'undefined' ? window.innerWidth / 2 : 0

  const popoverStyle = {
    top: popoverPosition?.top ?? defaultTop,
    left: popoverPosition?.left ?? defaultLeft,
    transform: 'translate(-50%, -50%)',
  }

  const selectedDateLabel = selectedDate
    ? format(selectedDate, 'MMMM d, yyyy')
    : ''

  return (
    <MotionDiv>
      <div>
        <section>
          <div className="relative h-56 w-full mb-6">
            <Image
              src="/Images/litratobg.jpg"
              alt="background_img"
              fill
              className="object-cover bg-no-repeat"
              priority
            ></Image>
          </div>
          <LitratoBranding />
        </section>
        <section className="flex-grow flex py-4 justify-center">
          <Calendar
            value={selectedDate}
            onDateChangeAction={(date) => setSelectedDate(date)}
            onDateClickAction={handleDayClick}
          />
        </section>
        <div className="flex flex-row justify-center gap-8 my-8">
          <div
            onClick={handleBack}
            className="bg-[#878787] select-none text-litratoblack px-4 py-2 w-28 text-center rounded-lg hover:cursor-pointer font-bold"
          >
            Back
          </div>
          <div
            onClick={handleLogin}
            className="bg-litratoblack select-none text-white px-4 py-2 w-28 text-center rounded-lg hover:cursor-pointer font-bold"
          >
            LOGIN
          </div>
        </div>
      </div>
      {showPopover && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={closePopover}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed z-50 w-[min(92vw,420px)] max-h-[70vh] overflow-y-auto rounded-xl bg-white shadow-2xl border border-gray-200 p-5"
            ref={popoverRef}
            style={popoverStyle}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-litratoblack">
                  {selectedDateLabel || 'Availability'}
                </h3>
              </div>
              <button
                type="button"
                className="text-sm text-gray-600 hover:text-litratoblack"
                onClick={closePopover}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              {loading && (
                <div className="flex items-center justify-center py-6 text-gray-600">
                  Loading availability…
                </div>
              )}
              {!loading && error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {!loading && !error && availability && (
                <>
                  {availability.packages.length === 0 ? (
                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      No packages available to display.
                    </div>
                  ) : (
                    availability.packages.map((pkg) => (
                      <div
                        key={pkg.packageId}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-base text-litratoblack">
                            {pkg.packageName}
                          </p>
                          <span
                            className={`text-xs px-2 py-1 rounded-full capitalize ${
                              STATUS_BADGE_CLASSES[pkg.status]
                            }`}
                          >
                            {STATUS_LABELS[pkg.status]}
                          </span>
                        </div>

                        {pkg.existingBookings.length ? (
                          <div className="mt-2 space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">
                              Reservations
                            </p>
                            {pkg.existingBookings.map((booking) => (
                              <div
                                key={`${pkg.packageId}-${booking.requestId}`}
                                className="rounded border border-gray-100 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                              >
                                <div>
                                  Event:{' '}
                                  {formatRange(
                                    booking.eventStart,
                                    booking.eventEnd
                                  )}
                                </div>
                                <div className="text-gray-500">
                                  Buffer:{' '}
                                  {formatRange(
                                    booking.bufferStart,
                                    booking.bufferEnd
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 rounded border border-green-200 bg-green-50 px-2 py-2 text-xs text-green-700">
                            No reservations yet for this date.
                          </div>
                        )}

                        <div className="mt-3">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">
                            Available start times
                          </p>
                          {pkg.startWindows.length ? (
                            <ul className="mt-1 space-y-1 text-xs text-gray-700">
                              {pkg.startWindows.map((window, idx) => (
                                <li key={`${pkg.packageId}-window-${idx}`}>
                                  {formatStartWindow(window)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-red-600">
                              Not enough room for a new booking on this date.
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <p className="pt-1 text-[11px] text-gray-500">
                    {/* Availability accounts for approximately{' '}
                    {availability.constraints.bufferHours}h setup/cleanup buffer
                    before and after each booking and up to{' '}
                    {availability.constraints.potentialExtensionHours}h
                    on-the-day extension. */}
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </MotionDiv>
  )
}
