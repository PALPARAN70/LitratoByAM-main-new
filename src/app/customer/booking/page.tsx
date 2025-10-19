'use client'
import Image from 'next/image'
import PromoCard from '../../../../Litratocomponents/Service_Card'
import Calendar from '../../../../Litratocomponents/LitratoCalendar'
import Timepicker from '../../../../Litratocomponents/Timepicker'
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
  const [packages, setPackages] = useState<PackageDto[]>([])
  const [grids, setGrids] = useState<PublicGrid[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
    null
  )
  const [timepickerReady, setTimepickerReady] = useState(false)
  const didPrefillRef = useRef(false)

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
    signal: '',
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

  // Type guard for package name coming from API
  type PkgName = BookingForm['package']
  const KNOWN_PKG_NAMES: readonly PkgName[] = [
    'The Hanz',
    'The Corrupt',
    'The AI',
    'The OG',
  ] as const
  const isPkgName = (v: string): v is PkgName =>
    (KNOWN_PKG_NAMES as readonly string[]).includes(v)

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
        setProfile(data)
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
        }))
      } catch (err: any) {
        if (err?.name === 'AbortError') return
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
        setForm((prev) => ({ ...prev, ...res.patch }))
        didPrefillRef.current = true
        // optional toast
      } catch (e: any) {
        console.error(e)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestIdParam, packages])

  const handleSubmit = async () => {
    setErrors({})
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
        action: ['Cancel', 'Reschedule'] as string[],
        requestid: resp?.booking?.requestid, // keep id for reschedule
      }
      const raw =
        (typeof window !== 'undefined' &&
          localStorage.getItem(DASHBOARD_KEY)) ||
        '[]'
      const arr = Array.isArray(JSON.parse(raw))
        ? (JSON.parse(raw) as any[])
        : []
      arr.unshift(row)
      localStorage.setItem(DASHBOARD_KEY, JSON.stringify(arr))

      toast.success(resp?.message || 'Booking request submitted.')
      router.push('/customer/dashboard')
    } catch (e: any) {
      toast.error(
        e?.message ||
          (isUpdate
            ? 'Failed to update booking.'
            : 'Failed to submit booking request.')
      )
    }
  }

  const handleClear = () => {
    setForm((prev) => ({
      ...initialForm,
      email: prev.email,
      completeName: prev.completeName,
    }))
    setErrors({})
    toast.message('Form cleared. Email and name kept from your profile.')
  }

  const formFields = [
    'Email:',
    'Complete name:',
    'Contact #:',
    'Contact Person & Number:',
    'Name of event (Ex. Maria & Jose Wedding):',
    'Location of event:',
    'Extension? (Our Minimum is 2hrs. Additional hour is Php2000):',
    'Placement of booth (Indoor/Outdoor):',
    'What signal is currently strong in the event area?:',
  ]

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
          <div className="relative h-[160px]">
            <Image
              src={'/Images/litratobg.jpg'}
              alt="Booking Header"
              fill
              className="object-cover rounded-b-lg"
              priority
            />
          </div>
          <p className="text-litratoblack text-center text-4xl font-semibold font-didone pt-4">
            Welcome, {personalForm.Firstname} {personalForm.Lastname}!<br />
            Schedule a photobooth session with us!
          </p>
        </div>

        <div className=" p-4 rounded-lg shadow-md space-y-3">
          <p className="font-semibold text-xl">Please Fill In The Following:</p>

          {/* Email */}
          <div>
            <label className="block text-lg mb-1">Email:</label>
            <input
              type="email"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.email}
              readOnly
              aria-readonly="true"
            />
            {errors.email && (
              <p className="text-red-600 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Facebook removed */}

          {/* Complete name */}
          <div>
            <label className="block text-lg mb-1">Complete name:</label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.completeName}
              readOnly
              aria-readonly="true"
            />
            {errors.completeName && (
              <p className="text-red-600 text-sm mt-1">{errors.completeName}</p>
            )}
          </div>

          {/* Contact #: */}
          <div>
            <label className="block text-lg mb-1">Contact #:</label>
            <input
              type="tel"
              placeholder="e.g. +639171234567"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.contactNumber}
              onChange={(e) => setField('contactNumber', e.target.value)}
              onBlur={(e) => setField('contactNumber', e.target.value)}
            />
            {errors.contactNumber && (
              <p className="text-red-600 text-sm mt-1">
                {errors.contactNumber}
              </p>
            )}
          </div>

          {/* Contact Person (split fields) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-lg mb-1">Contact Person Name:</label>
              <input
                type="text"
                placeholder="Enter here:"
                className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
                value={form.contactPersonName || ''}
                onChange={(e) =>
                  setField('contactPersonName', e.target.value as any)
                }
              />
              {errors.contactPersonName && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.contactPersonName}
                </p>
              )}
            </div>
            <div>
              <label className="block text-lg mb-1">
                Contact Person Number:
              </label>
              <input
                type="tel"
                placeholder="e.g. +639171234567"
                className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
                value={form.contactPersonNumber || ''}
                onChange={(e) =>
                  setField('contactPersonNumber', e.target.value as any)
                }
                onBlur={(e) =>
                  setField('contactPersonNumber', e.target.value as any)
                }
              />
              {errors.contactPersonNumber && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.contactPersonNumber}
                </p>
              )}
            </div>
          </div>

          {/* Event name */}
          <div>
            <label className="block text-lg mb-1">
              Name of event (Ex. Maria & Jose Wedding):
            </label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.eventName}
              onChange={(e) => setField('eventName', e.target.value)}
            />
            {errors.eventName && (
              <p className="text-red-600 text-sm mt-1">{errors.eventName}</p>
            )}
          </div>

          {/* Event location */}
          <div>
            <label className="block text-lg mb-1">Location of event:</label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.eventLocation}
              onChange={(e) => setField('eventLocation', e.target.value)}
            />
            {errors.eventLocation && (
              <p className="text-red-600 text-sm mt-1">
                {errors.eventLocation}
              </p>
            )}
          </div>

          {/* Extension hours */}
          <div>
            <label className="block text-lg mb-1">
              Extension? (Our Minimum is 2hrs. Additional hour is Php2000):
            </label>
            <select
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={String(form.extensionHours)}
              onChange={(e) =>
                setField('extensionHours', Number(e.target.value))
              }
            >
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
            {errors.extensionHours && (
              <p className="text-red-600 text-sm mt-1">
                {errors.extensionHours}
              </p>
            )}
          </div>

          {/* Booth placement */}
          <div>
            <label className="block text-lg mb-1">Placement of booth:</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="boothPlacement"
                  checked={form.boothPlacement === 'Indoor'}
                  onChange={() => setField('boothPlacement', 'Indoor')}
                />
                Indoor
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="boothPlacement"
                  checked={form.boothPlacement === 'Outdoor'}
                  onChange={() => setField('boothPlacement', 'Outdoor')}
                />
                Outdoor
              </label>
            </div>
            {errors.boothPlacement && (
              <p className="text-red-600 text-sm mt-1">
                {errors.boothPlacement}
              </p>
            )}
          </div>

          {/* Signal */}
          <div>
            <label className="block text-lg mb-1">
              What signal is currently strong in the event area?:
            </label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.signal}
              onChange={(e) => setField('signal', e.target.value)}
            />
            {errors.signal && (
              <p className="text-red-600 text-sm mt-1">{errors.signal}</p>
            )}
          </div>

          {/* Packages */}
          <div className="flex flex-col justify-center mt-8">
            <p className="font-semibold text-xl">Select A Package:</p>
            <div className="flex flex-row gap-4 justify-center flex-wrap">
              {packages.map((pkg) => (
                <PromoCard
                  key={pkg.id}
                  imageSrc={pkg.image_url || '/Images/litratobg.jpg'}
                  title={pkg.package_name}
                  price={`₱${Number(pkg.price).toLocaleString()}`}
                  descriptions={[
                    pkg.description || 'Package',
                    // you can extend with more feature fields if you add them
                  ]}
                  selected={selectedPackageId === pkg.id}
                  onSelect={() => {
                    setSelectedPackageId(pkg.id)
                    // Always set the package name from DB now that validation allows any non-empty string
                    setField(
                      'package',
                      pkg.package_name as BookingForm['package']
                    )
                  }}
                />
              ))}
            </div>
            {errors.package && (
              <p className="text-red-600 text-sm mt-1 text-center">
                {errors.package}
              </p>
            )}
          </div>

          {/* Grids (dynamic from admin-defined list) */}
          <div className="flex flex-col justify-center mt-8">
            <p className="font-semibold text-xl">
              Select the Type of Grids you want for your Photos (max of 2) :
            </p>
            <div className="mt-4 flex flex-wrap gap-4 justify-center">
              {grids.length === 0 ? (
                <span className="text-sm text-gray-500">
                  No grids available yet.
                </span>
              ) : (
                grids.map((g) => {
                  const picked = form.selectedGrids.includes(g.grid_name)
                  const atLimit = form.selectedGrids.length >= 2 && !picked
                  const imgSrc = g.image_url || '/Images/litratobg.jpg'
                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={atLimit}
                      aria-pressed={picked}
                      className={`group w-[270px] overflow-hidden rounded-xl border shadow-sm transition focus:outline-none ${
                        picked
                          ? 'border-2 border-red-500 ring-2 ring-red-500 ring-offset-2 ring-offset-white'
                          : 'border-gray-200 focus-visible:ring-2 focus-visible:ring-litratored'
                      } ${
                        atLimit
                          ? 'opacity-60 cursor-not-allowed'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => {
                        const next = picked
                          ? form.selectedGrids.filter((n) => n !== g.grid_name)
                          : [...form.selectedGrids, g.grid_name]
                        setField('selectedGrids', next)
                      }}
                    >
                      <div className="relative w-full h-[200px] bg-gray-100">
                        <Image
                          src={imgSrc}
                          alt={g.grid_name}
                          fill
                          className="object-cover"
                        />
                        {picked && (
                          <div className="absolute inset-0 bg-black/30" />
                        )}
                      </div>
                      <div className="p-2 text-center">
                        <span className="text-sm font-medium text-litratoblack">
                          {g.grid_name}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
            {errors.selectedGrids && (
              <p className="text-red-600 text-sm mt-1 text-center">
                {errors.selectedGrids}
              </p>
            )}
          </div>

          {/* Date & Time */}
          <div className="flex flex-col justify-center mt-12">
            <p className="font-semibold text-xl">
              Select the date and time for your event:
            </p>
            <div className="flex flex-row justify-center gap-24 ">
              <div>
                <Calendar
                  value={form.eventDate}
                  onDateChangeAction={(d) => setField('eventDate', d as any)}
                />
                {errors.eventDate && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.eventDate}
                  </p>
                )}
              </div>
              <div className="mt-8 ">
                {/* Render Timepicker only after mount to avoid setState-in-render */}
                {timepickerReady && (
                  <Timepicker
                    // Force a remount if prefilled times change so the child re-initializes cleanly
                    key={`${form.eventTime}-${form.eventEndTime}`}
                    start={form.eventTime}
                    end={form.eventEndTime}
                    onChange={({ start, end }) => {
                      setField('eventTime', start)
                      setField('eventEndTime', end)
                    }}
                  />
                )}
                {errors.eventTime && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.eventTime}
                  </p>
                )}
                {errors.eventEndTime && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.eventEndTime}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClear}
              type="button"
              className="bg-gray-200 text-litratoblack px-4 py-2 hover:bg-gray-300 rounded"
            >
              Clear
            </button>
            <button
              onClick={handleSubmit}
              type="button"
              className="bg-litratoblack text-white px-4 py-2 hover:bg-black rounded"
            >
              {isUpdate ? 'Update' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </MotionDiv>
  )
}
