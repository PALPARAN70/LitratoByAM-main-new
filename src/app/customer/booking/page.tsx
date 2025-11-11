'use client'
import Image from 'next/image'
import PromoCard from '../../../../Litratocomponents/Service_Card'
import Calendar from '../../../../Litratocomponents/LitratoCalendar'
import PackageCarousel from '../../../../Litratocomponents/PackageCarousel'
import GridCarousel from '../../../../Litratocomponents/GridCarousel'
// Timepicker removed: end time is auto-calculated from start + package duration + extension
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import MotionDiv from '../../../../Litratocomponents/MotionDiv'
// Grids now loaded dynamically from backend
import loadGridsPublic, {
  type PublicGrid,
} from '../../../../schemas/functions/BookingRequest/loadGridsPublic'
import {
  bookingFormSchema,
  type BookingForm,
} from '../../../../schemas/schema/requestvalidation'
import { createBookingRequest } from '../../../../schemas/functions/BookingRequest/createBookingRequest'
import {
  loadAndPrefill,
  submitUpdate,
} from '../../../../schemas/functions/BookingRequest/updateBookingRequest'
import {
  loadPackages,
  type PackageDto,
} from '../../../../schemas/functions/BookingRequest/loadPackages'

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/auth/getProfile'

export default function BookingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Prefer ?requestid=, but keep backward-compat with ?id=
  const requestIdParam = searchParams.get('requestid') || searchParams.get('id')
  const isUpdate = !!requestIdParam

  const [submitting, setSubmitting] = useState(false)
  const [personalForm, setPersonalForm] = useState({
    Firstname: '',
    Lastname: '',
  })
  const [packages, setPackages] = useState<PackageDto[]>([])
  const [grids, setGrids] = useState<PublicGrid[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
    null
  )
  const [timepickerReady, setTimepickerReady] = useState(false)
  const didPrefillRef = useRef(false)
  const [currentStatus, setCurrentStatus] = useState<
    'Approved' | 'Declined' | 'Pending' | 'Cancelled' | null
  >(null)
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false)
  const [pendingScheduleChange, setPendingScheduleChange] = useState<{
    eventDate?: Date
    eventTime?: string
    eventEndTime?: string
  } | null>(null)

  // Moved UP: booking form state before useEffects
  const initialForm: BookingForm = {
    email: '',
    completeName: '',
    contactNumber: '',
    // New split fields; keep legacy combined empty for compatibility
    contactPersonName: '',
    contactPersonNumber: '',
    contactPersonAndNumber: '',
    eventName: '',
    eventLocation: '',
    extensionHours: 0,
    boothPlacement: 'Indoor',
    signal: '' as unknown as BookingForm['signal'],
    package: 'The Hanz',
    selectedGrids: [],
    eventDate: new Date(),
    eventTime: '12:00',
    eventEndTime: '14:00',
  }
  const [form, setForm] = useState<BookingForm>(initialForm)
  const [errors, setErrors] = useState<
    Partial<Record<keyof BookingForm, string>>
  >({})
  const [hasSubmitted, setHasSubmitted] = useState(false)

  // Auto-calc end time: start + package duration + extension hours
  const getSelectedPackage = () =>
    packages.find((p) => p.id === selectedPackageId)
  const computeEndTime = (
    start: string,
    baseHours: number,
    extHours: number
  ): string => {
    const [HH, MM] = String(start || '00:00')
      .split(':')
      .map((n) => parseInt(n || '0', 10))
    const base = Math.max(0, Math.floor(baseHours || 0))
    const ext = Math.max(0, Math.floor(extHours || 0))
    const outH = (((HH + base + ext) % 24) + 24) % 24
    const outM = isNaN(MM) ? 0 : MM
    return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`
  }

  // Removed unused package-name type guard

  // Helper to update fields + live-validate
  const setField = <K extends keyof BookingForm>(
    key: K,
    value: BookingForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (
      [
        'email',
        'contactNumber',
        'contactPersonName',
        'contactPersonNumber',
        'eventTime',
        'eventEndTime',
        'extensionHours',
      ].includes(key as string)
    ) {
      const parsed = bookingFormSchema.safeParse({ ...form, [key]: value })
      const fieldIssues = parsed.success
        ? []
        : parsed.error.issues.filter((i) => i.path[0] === key)
      setErrors((e) => ({ ...e, [key]: fieldIssues[0]?.message }))
    }
    // After a submit attempt, keep all errors fresh by validating entire form
    if (hasSubmitted) {
      const parsedAll = bookingFormSchema.safeParse({ ...form, [key]: value })
      if (!parsedAll.success) {
        const newErrors: Partial<Record<keyof BookingForm, string>> = {}
        for (const issue of parsedAll.error.issues) {
          const f = issue.path[0] as keyof BookingForm
          if (!newErrors[f]) newErrors[f] = issue.message
        }
        setErrors((prev) => ({ ...prev, ...newErrors }))
      } else {
        // Clear error for this field if now valid
        setErrors((prev) => ({ ...prev, [key]: undefined }))
      }
    }
  }

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
        setPersonalForm({
          Firstname: data.firstname || '',
          Lastname: data.lastname || '',
        })
        setForm((prev) => ({
          ...prev,
          email: data.email || prev.email,
          completeName:
            `${data.firstname ?? ''} ${data.lastname ?? ''}`.trim() ||
            prev.completeName,
          // Prefill contact number from profile if available
          contactNumber: (data.contact ?? '').toString() || prev.contactNumber,
        }))
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        toast.error('Error fetching profile')
      }
    })()
    return () => ac.abort()
  }, [router])

  useEffect(() => {
    ;(async () => {
      try {
        const list = await loadPackages()
        setPackages(list)
        // Set a default selection only on first load when nothing selected yet
        if (!selectedPackageId && list.length) {
          const first = list[0]
          setSelectedPackageId(first.id)
          setForm((p) => ({
            ...p,
            package: first.package_name as BookingForm['package'],
          }))
          // Initialize end time based on default package duration
          setForm((p) => ({
            ...p,
            eventEndTime: computeEndTime(
              p.eventTime,
              Number((first as any).duration_hours ?? 2),
              Number(p.extensionHours)
            ),
          }))
        }
      } catch {
        // ignore
      }
    })()
    // Load available grids (display=true)
    ;(async () => {
      try {
        const g = await loadGridsPublic()
        setGrids(g)
        try {
          localStorage.setItem(
            'public_grids_cache',
            JSON.stringify(g.map(({ id, grid_name }) => ({ id, grid_name })))
          )
        } catch {}
      } catch {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setTimepickerReady(true) // enable child onChange after first commit
  }, [])

  // Prefill using requestid (after packages are loaded)
  useEffect(() => {
    if (!requestIdParam) return
    if (!packages?.length) return
    if (didPrefillRef.current) return
    const token =
      (typeof window !== 'undefined' && localStorage.getItem('access_token')) ||
      null
    if (!token) return
    ;(async () => {
      try {
        const res = await loadAndPrefill({
          requestid: Number(requestIdParam),
          packages,
          token,
          prevForm: form,
        })
        setSelectedPackageId(res.selectedPackageId)
        // Merge patch but keep previously prefilled contactNumber from profile
        setForm((prev) => ({
          ...prev,
          ...res.patch,
          contactNumber:
            prev.contactNumber || (res.patch as any)?.contactNumber || '',
        }))
        // Derive status for UI restrictions from fetched booking
        try {
          const st = String(res.booking?.status || '').toLowerCase()
          const title =
            st === 'accepted' || st === 'approved'
              ? 'Approved'
              : st === 'rejected' || st === 'declined'
              ? 'Declined'
              : st === 'cancelled'
              ? 'Cancelled'
              : 'Pending'
          setCurrentStatus(
            title as 'Approved' | 'Declined' | 'Pending' | 'Cancelled'
          )
        } catch {}
        didPrefillRef.current = true
        // optional toast
      } catch (e: unknown) {
        console.error(e)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestIdParam, packages])

  // Intercept schedule changes for approved bookings
  const requestScheduleChange = (patch: {
    eventDate?: Date
    eventTime?: string
    eventEndTime?: string
  }) => {
    if (currentStatus === 'Approved') {
      setPendingScheduleChange(patch)
      setShowScheduleConfirm(true)
      return
    }
    if (patch.eventDate) setField('eventDate', patch.eventDate as Date)
    if (patch.eventTime) setField('eventTime', patch.eventTime)
    if (patch.eventEndTime) setField('eventEndTime', patch.eventEndTime)
  }

  const confirmApplyScheduleChange = () => {
    if (!pendingScheduleChange) return
    const { eventDate, eventTime, eventEndTime } = pendingScheduleChange
    if (eventDate) setField('eventDate', eventDate as Date)
    if (eventTime) setField('eventTime', eventTime)
    if (eventEndTime) setField('eventEndTime', eventEndTime)
    setPendingScheduleChange(null)
    setShowScheduleConfirm(false)
  }

  const cancelScheduleChange = () => {
    setPendingScheduleChange(null)
    setShowScheduleConfirm(false)
  }

  const handleSubmit = async () => {
    if (submitting) return
    setErrors({})
    setHasSubmitted(true)
    const result = bookingFormSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof BookingForm, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof BookingForm
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      toast.error('Please fill in all required fields.')
      return
    }

    try {
      setSubmitting(true)
      if (isUpdate) {
        const resp = await submitUpdate({
          requestid: Number(requestIdParam),
          form,
          selectedPackageId,
        })
        toast.success(resp?.message || 'Booking updated.')
        router.push('/customer/dashboard')
        return
      }

      // CREATE flow
      const resp = await createBookingRequest({
        form,
        packageid: selectedPackageId ?? undefined,
      })

      // Use the selected package's actual name from the loaded list for dashboard display
      const selectedPkg = packages.find((p) => p.id === selectedPackageId)
      const displayPackageName = (
        selectedPkg?.package_name || form.package
      ).trim()

      const row = {
        name: form.eventName,
        date: fmtDate(form.eventDate),
        startTime: to12h(form.eventTime),
        endTime: to12h(form.eventEndTime),
        package: displayPackageName,
        place: form.eventLocation,
        paymentStatus: 'Pending',
        status: 'Pending' as 'Approved' | 'Declined' | 'Pending',
        // Updated: second action label from Reschedule to Edit after removing rescheduling tab
        action: ['Cancel', 'Edit'] as string[],
        requestid: resp?.booking?.requestid, // keep id for reschedule
      }
      const raw =
        (typeof window !== 'undefined' &&
          localStorage.getItem(DASHBOARD_KEY)) ||
        '[]'
      const parsed = JSON.parse(raw)
      const arr: unknown[] = Array.isArray(parsed) ? parsed : []
      arr.unshift(row)
      localStorage.setItem(DASHBOARD_KEY, JSON.stringify(arr))

      toast.success(resp?.message || 'Booking request submitted.')
      router.push('/customer/dashboard')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : undefined
      toast.error(
        msg ||
          (isUpdate
            ? 'Failed to update booking.'
            : 'Failed to submit booking request.')
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleClear = () => {
    setForm((prev) => ({
      ...initialForm,
      email: prev.email,
      completeName: prev.completeName,
      contactNumber: prev.contactNumber,
    }))
    setErrors({})
    setHasSubmitted(false)
    toast.message('Form cleared. Email and name kept from your profile.')
  }

  // Removed unused formFields descriptor list

  // Add: dashboard storage key and formatters
  const DASHBOARD_KEY = 'litrato_dashboard_table'
  const to12h = (t: string) => {
    const [HH, MM] = t.split(':').map((n) => parseInt(n || '0', 10))
    const ampm = HH >= 12 ? 'pm' : 'am'
    const h12 = (HH % 12 || 12).toString().padStart(2, '0')
    return `${h12}:${String(MM || 0).padStart(2, '0')} ${ampm}`
  }
  const fmtDate = (d: Date) => {
    try {
      const dd = new Date(d)
      const y = dd.getFullYear()
      const m = String(dd.getMonth() + 1).padStart(2, '0')
      const day = String(dd.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    } catch {
      return ''
    }
  }

  return (
    <MotionDiv>
      <div className="min-h-screen w-full overflow-y-auto">
        <div className="w-full">
          <div className="relative h-[120px]">
            <Image
              src={'/Images/litratobg.jpg'}
              alt="Booking Header"
              fill
              className="object-cover rounded-b-lg"
              priority
            />
          </div>
          <p className="text-litratoblack text-center text-3xl font-semibold font-didone pt-3 pb-2">
            Welcome, {personalForm.Firstname} {personalForm.Lastname}!<br />
            Schedule a photobooth session with us!
          </p>
        </div>

        <div className="max-w-5xl mx-auto px-4 pb-6 space-y-4">
          {currentStatus === 'Approved' && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 text-yellow-900 px-3 py-2 text-sm">
              This booking is approved. You can update contact details and
              preferences. Changing the date or time will resubmit for approval.
            </div>
          )}

          {/* Personal Information Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-3 text-litratoblack">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Email */}
              <div className="min-h-[90px]">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  placeholder="Enter here:"
                  className="w-full bg-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored"
                  value={form.email}
                  readOnly
                  aria-readonly="true"
                />
                {errors.email && (
                  <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Complete name */}
              <div className="min-h-[90px]">
                <label className="block text-sm font-medium mb-1">
                  Complete Name
                </label>
                <input
                  type="text"
                  placeholder="Enter here:"
                  className="w-full bg-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored"
                  value={form.completeName}
                  readOnly
                  aria-readonly="true"
                />
                {errors.completeName && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.completeName}
                  </p>
                )}
              </div>

              {/* Contact #: */}
              <div className="min-h-[90px]">
                <label className="block text-sm font-medium mb-1">
                  Contact #
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +639171234567"
                  className="w-full bg-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored"
                  value={form.contactNumber}
                  readOnly
                  aria-readonly="true"
                />
                {errors.contactNumber && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.contactNumber}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Person Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-3 text-litratoblack">
              Contact Person on Event Day
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="min-h-[110px]">
                <label className="block text-sm font-medium mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  placeholder="Enter here:"
                  className="w-full bg-gray-50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200"
                  value={form.contactPersonName || ''}
                  onChange={(e) =>
                    setField('contactPersonName', e.target.value)
                  }
                />
                {errors.contactPersonName && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.contactPersonName}
                  </p>
                )}
              </div>
              <div className="min-h-[110px]">
                <label className="block text-sm font-medium mb-1">
                  Contact Person Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +639171234567"
                  className="w-full bg-gray-50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200"
                  value={form.contactPersonNumber || ''}
                  onChange={(e) =>
                    setField('contactPersonNumber', e.target.value)
                  }
                  onBlur={(e) =>
                    setField('contactPersonNumber', e.target.value)
                  }
                />
                {errors.contactPersonNumber && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.contactPersonNumber}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Event Details Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-3 text-litratoblack">
              Event Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Event name */}
              <div className="min-h-[90px]">
                <label className="block text-sm font-medium mb-1">
                  Name of Event
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maria & Jose Wedding"
                  className="w-full bg-gray-50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200"
                  value={form.eventName}
                  onChange={(e) => setField('eventName', e.target.value)}
                />
                {errors.eventName && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.eventName}
                  </p>
                )}
              </div>

              {/* Event location */}
              <div className="min-h-[90px]">
                <label className="block text-sm font-medium mb-1">
                  Location of Event
                </label>
                <input
                  type="text"
                  placeholder="Enter here:"
                  className="w-full bg-gray-50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200"
                  value={form.eventLocation}
                  onChange={(e) => setField('eventLocation', e.target.value)}
                />
                {errors.eventLocation && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.eventLocation}
                  </p>
                )}
              </div>

              {/* Signal */}
              <div className="min-h-[90px]">
                <label className="block text-sm font-medium mb-1">
                  Strongest Signal in Area
                </label>
                <select
                  className="w-full bg-gray-50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200"
                  value={form.signal}
                  onChange={(e) =>
                    setField('signal', e.target.value as BookingForm['signal'])
                  }
                >
                  <option value="">Select Signal</option>
                  <option value="SMART">SMART</option>
                  <option value="DITO">DITO</option>
                  <option value="Globe">Globe</option>
                  <option value="TM">TM</option>
                </select>
                {errors.signal && (
                  <p className="text-red-600 text-xs mt-1">{errors.signal}</p>
                )}
              </div>

              {/* Booth placement */}
              <div className="min-h-[90px]">
                <label className="block text-sm font-medium mb-1">
                  Booth Placement
                </label>
                <div className="flex gap-3 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="boothPlacement"
                      checked={form.boothPlacement === 'Indoor'}
                      onChange={() => setField('boothPlacement', 'Indoor')}
                      className="text-litratored focus:ring-litratored"
                    />
                    <span className="text-sm">Indoor</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="boothPlacement"
                      checked={form.boothPlacement === 'Outdoor'}
                      onChange={() => setField('boothPlacement', 'Outdoor')}
                      className="text-litratored focus:ring-litratored"
                    />
                    <span className="text-sm">Outdoor</span>
                  </label>
                </div>
                {errors.boothPlacement && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.boothPlacement}
                  </p>
                )}
              </div>

              {/* Extension hours */}
              <div className="md:col-span-2 min-h-[90px]">
                <label className="block text-sm font-medium mb-1">
                  Extension Hours (₱2,000/hour)
                </label>
                <select
                  className="w-full md:w-64 bg-gray-50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200"
                  value={String(form.extensionHours)}
                  onChange={(e) => {
                    const ext = Number(e.target.value)
                    const end = computeEndTime(
                      form.eventTime,
                      Number(
                        (getSelectedPackage() as any)?.duration_hours ?? 2
                      ),
                      ext
                    )
                    if (currentStatus === 'Approved') {
                      setField('extensionHours', ext)
                      requestScheduleChange({ eventEndTime: end })
                    } else {
                      setField('extensionHours', ext)
                      setField('eventEndTime', end)
                    }
                  }}
                >
                  <option value="0">No extension</option>
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                </select>
                {errors.extensionHours && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.extensionHours}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Packages */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-3 text-litratoblack">
              Select A Package
            </h3>
            <PackageCarousel
              packages={packages}
              selectedId={selectedPackageId}
              onSelectAction={(pkg) => {
                setSelectedPackageId(pkg.id)
                setField('package', pkg.package_name as BookingForm['package'])
                const end = computeEndTime(
                  form.eventTime,
                  Number((pkg as any).duration_hours ?? 2),
                  Number(form.extensionHours)
                )
                setField('eventEndTime', end)
              }}
            />
            {errors.package && (
              <p className="text-red-600 text-sm mt-1 text-center">
                {errors.package}
              </p>
            )}
          </div>

          {/* Grids (dynamic from admin-defined list) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-3 text-litratoblack">
              Select Photo Grids (max of 2)
            </h3>
            <GridCarousel
              grids={grids}
              selectedGrids={form.selectedGrids}
              onSelectAction={(gridNames) =>
                setField('selectedGrids', gridNames)
              }
              maxSelections={2}
            />
            {errors.selectedGrids && (
              <p className="text-red-600 text-sm mt-1 text-center">
                {errors.selectedGrids}
              </p>
            )}
          </div>

          {/* Date & Time */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-3 text-litratoblack">
              Select Date and Time
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Event Date
                </label>
                <Calendar
                  value={form.eventDate}
                  onDateChangeAction={(d) =>
                    requestScheduleChange({ eventDate: d as Date })
                  }
                />
                {errors.eventDate && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.eventDate}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Event Time
                </label>
                {/* Render time inputs only after mount to avoid setState-in-render */}
                {timepickerReady && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Start time
                      </label>
                      <input
                        type="time"
                        className="w-full bg-gray-50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200"
                        value={form.eventTime}
                        onChange={(e) => {
                          const start = e.target.value
                          const end = computeEndTime(
                            start,
                            Number(
                              (getSelectedPackage() as any)?.duration_hours ?? 2
                            ),
                            Number(form.extensionHours)
                          )
                          if (currentStatus === 'Approved') {
                            requestScheduleChange({
                              eventTime: start,
                              eventEndTime: end,
                            })
                          } else {
                            setField('eventTime', start)
                            setField('eventEndTime', end)
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        End time (calculated)
                      </label>
                      <input
                        type="time"
                        className="w-full bg-gray-100 rounded-md px-3 py-2 text-sm border border-gray-200"
                        value={form.eventEndTime}
                        readOnly
                        aria-readonly="true"
                      />
                    </div>
                  </div>
                )}
                {errors.eventTime && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.eventTime}
                  </p>
                )}
                {errors.eventEndTime && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.eventEndTime}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={handleClear}
              type="button"
              className="bg-gray-100 text-litratoblack px-5 py-2 hover:bg-gray-200 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
              disabled={submitting}
            >
              Clear
            </button>
            <button
              onClick={handleSubmit}
              type="button"
              className="bg-litratoblack text-white px-6 py-2 hover:bg-black rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting
                ? isUpdate
                  ? 'Updating…'
                  : 'Submitting…'
                : isUpdate
                ? 'Update Booking'
                : 'Submit Booking'}
            </button>
          </div>
        </div>
      </div>
      {showScheduleConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={cancelScheduleChange}
          />
          <div className="relative z-10 w-[95%] max-w-md rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Change schedule?</h3>
            <p className="text-sm text-gray-700 mb-4">
              This booking is currently approved. Changing the date or time will
              send it back for approval and may cancel any existing
              confirmation. Do you want to proceed?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
                onClick={cancelScheduleChange}
              >
                Keep current schedule
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-litratoblack text-white hover:bg-black"
                onClick={confirmApplyScheduleChange}
              >
                Change schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </MotionDiv>
  )
}

// Lightweight modal for schedule change confirmation
// Rendered at the end of the component above MotionDiv close
