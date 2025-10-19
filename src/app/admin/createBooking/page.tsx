'use client'
import Image from 'next/image'
import PromoCard from '../../../../Litratocomponents/Service_Card'
import Calendar from '../../../../Litratocomponents/LitratoCalendar'
import Timepicker from '../../../../Litratocomponents/Timepicker'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import loadGridsPublic, {
  type PublicGrid,
} from '../../../../schemas/functions/BookingRequest/loadGridsPublic'
import MotionDiv from '../../../../Litratocomponents/MotionDiv'
import {
  bookingFormSchema,
  type BookingForm,
} from '../../../../schemas/schema/requestvalidation'
import {
  loadPackages,
  type PackageDto,
} from '../../../../schemas/functions/BookingRequest/loadPackages'
import {
  adminCreateAndConfirm,
  type AdminCreateConfirmPayload,
} from '../../../../schemas/functions/BookingRequest/adminCreateAndConfirm'
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/auth/getProfile'

export default function BookingPage() {
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

  // Controlled booking form state + errors (aligned with customer page)
  const initialForm: BookingForm = {
    email: '',
    completeName: '',
    contactNumber: '',
    // Split contact person fields (UI uses these); keep legacy combined for fallback/compat
    contactPersonName: '',
    contactPersonNumber: '',
    contactPersonAndNumber: '',
    eventName: '',
    eventLocation: '',
    extensionHours: 0,
    boothPlacement: 'Indoor',
    signal: '',
    // Will be overwritten by first visible package if available
    package: 'The Hanz' as BookingForm['package'],
    selectedGrids: [],
    eventDate: new Date(),
    eventTime: '12:00',
    eventEndTime: '14:00',
  }
  const [form, setForm] = useState<BookingForm>(initialForm)
  const [errors, setErrors] = useState<
    Partial<Record<keyof BookingForm, string>>
  >({})

  // Packages (dynamic from DB)
  const [packages, setPackages] = useState<PackageDto[]>([])
  const [grids, setGrids] = useState<PublicGrid[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
    null
  )
  const [prefillPkgName, setPrefillPkgName] = useState<string | null>(null)
  const [timepickerReady, setTimepickerReady] = useState(false)

  // BookingForm['package'] is a union; guard before setting from DB names
  type PkgName = BookingForm['package']
  const KNOWN_PKG_NAMES: readonly PkgName[] = [
    'The Hanz',
    'The Corrupt',
    'The AI',
    'The OG',
  ] as const
  const isPkgName = (v: string): v is PkgName =>
    (KNOWN_PKG_NAMES as readonly string[]).includes(v)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Apply prefilled values when redirected from ManageBooking (Edit action)
    try {
      const raw = sessionStorage.getItem('edit_booking_prefill')
      if (raw) {
        const data = JSON.parse(raw)
        sessionStorage.removeItem('edit_booking_prefill')
        setIsEditable(true)
        setPrefillPkgName(
          typeof data.package === 'string' ? data.package : null
        )
        setForm((prev) => ({
          ...prev,
          email: data.email ?? prev.email,
          completeName: data.completeName ?? prev.completeName,
          contactNumber: data.contactNumber ?? prev.contactNumber,
          contactPersonAndNumber:
            data.contactPersonAndNumber ?? prev.contactPersonAndNumber,
          // If combined field comes as "Name | Number", attempt to split to new fields
          contactPersonName:
            typeof data.contactPersonAndNumber === 'string' &&
            data.contactPersonAndNumber.includes('|')
              ? data.contactPersonAndNumber.split('|')[0].trim()
              : prev.contactPersonName,
          contactPersonNumber:
            typeof data.contactPersonAndNumber === 'string' &&
            data.contactPersonAndNumber.includes('|')
              ? data.contactPersonAndNumber.split('|')[1]?.trim() ||
                prev.contactPersonNumber
              : prev.contactPersonNumber,
          eventName: data.eventName ?? prev.eventName,
          eventLocation: data.eventLocation ?? prev.eventLocation,
          extensionHours:
            typeof data.extensionHours === 'number'
              ? data.extensionHours
              : prev.extensionHours,
          boothPlacement: data.boothPlacement ?? prev.boothPlacement,
          signal: data.signal ?? prev.signal,
          package: (data.package as BookingForm['package']) ?? prev.package,
          selectedGrids: Array.isArray(data.selectedGrids)
            ? data.selectedGrids
            : prev.selectedGrids,
          eventDate: data.eventDate ? new Date(data.eventDate) : prev.eventDate,
          eventTime: data.eventTime ?? prev.eventTime,
          eventEndTime: data.eventEndTime ?? prev.eventEndTime,
        }))
      }
    } catch {}

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
        // Do not prefill form fields from profile on admin create.
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        toast.error('Error fetching profile')
      }
    })()

    return () => ac.abort()
  }, [router])

  // Load packages visible to admin (display=true via API)
  useEffect(() => {
    ;(async () => {
      try {
        const list = await loadPackages()
        const visible = Array.isArray(list) ? list.filter((p) => p.display) : []
        setPackages(visible)
        if (!selectedPackageId) {
          // If we came from Edit, try to resolve package by name
          const chosen = visible.find((p) => p.package_name === prefillPkgName)
          if (chosen) {
            setSelectedPackageId(chosen.id)
            setForm((p) => ({
              ...p,
              package: chosen.package_name as BookingForm['package'],
            }))
          } else if (visible.length) {
            // Default to first visible package
            const first = visible[0]
            setSelectedPackageId(first.id)
            setForm((p) => ({
              ...p,
              package: first.package_name as BookingForm['package'],
            }))
          }
        }
      } catch (e) {
        // Optional: show a toast, but avoid spamming admin
        // toast.error('Failed to load packages');
      }
    })()
    // Load available grids
    ;(async () => {
      try {
        const g = await loadGridsPublic()
        setGrids(g)
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackageId, prefillPkgName])

  // Timepicker readiness after mount (to avoid setState in render warnings)
  useEffect(() => {
    setTimepickerReady(true)
  }, [])

  // Helpers
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

  const handleSubmit = () => {
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
    // Admin create flow: create and confirm immediately
    const doSubmit = async () => {
      try {
        // Resolve package id from selection or by name
        const pkgId =
          selectedPackageId ??
          packages.find((p) => p.package_name === form.package)?.id ??
          null
        if (!pkgId) throw new Error('Please select a package')

        const fmtDate = (d: Date) => {
          const dd = new Date(d)
          const y = dd.getFullYear()
          const m = String(dd.getMonth() + 1).padStart(2, '0')
          const day = String(dd.getDate()).padStart(2, '0')
          return `${y}-${m}-${day}`
        }
        const toTimeWithSeconds = (t: string) =>
          t.length === 5 ? `${t}:00` : t

        const payload: AdminCreateConfirmPayload = {
          email: form.email || undefined,
          packageid: pkgId,
          event_date: fmtDate(form.eventDate),
          event_time: toTimeWithSeconds(form.eventTime),
          event_end_time: toTimeWithSeconds(form.eventEndTime),
          extension_duration:
            typeof form.extensionHours === 'number'
              ? form.extensionHours
              : Number(form.extensionHours) || 0,
          event_address: form.eventLocation,
          grid:
            Array.isArray(form.selectedGrids) && form.selectedGrids.length
              ? form.selectedGrids.join(',')
              : null,
          contact_info: form.contactNumber || null,
          // Prefer split fields; fallback to parsing legacy combined
          contact_person:
            form.contactPersonName?.trim() ||
            (form.contactPersonAndNumber?.includes('|')
              ? form.contactPersonAndNumber.split('|')[0].trim()
              : null),
          contact_person_number:
            form.contactPersonNumber?.trim() ||
            (form.contactPersonAndNumber?.includes('|')
              ? form.contactPersonAndNumber.split('|')[1]?.trim() || null
              : null),
          notes: null,
          event_name: form.eventName || null,
          strongest_signal: form.signal || null,
        }

        await adminCreateAndConfirm(payload)
        toast.success('Booking created and confirmed.')
        // Optionally redirect back to manage bookings
        // router.push('/admin/ManageBooking')
      } catch (e: any) {
        toast.error(e?.message || 'Failed to create booking')
      }
    }

    void doSubmit()
  }

  const handleClear = () => {
    setForm(initialForm)
    setSelectedPackageId(null)
    setPrefillPkgName(null)
    setErrors({})
    toast.message('Form cleared.')
  }

  const formFields = [
    'Email:',
    'Facebook:',
    'Complete name:',
    'Contact #:',
    'Contact Person & Number:',
    'Name of event (Ex. Maria & Jose Wedding):',
    'Location of event:',
    'Extension? (Our Minimum is 2hrs. Additional hour is Php2000):',
    'Placement of booth (Indoor/Outdoor):',
    'What signal is currently strong in the event area?:',
  ]

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
              onChange={(e) => setField('email', e.target.value)}
              onBlur={(e) => setField('email', e.target.value)}
            />
            {errors.email && (
              <p className="text-red-600 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Complete name */}
          <div>
            <label className="block text-lg mb-1">Complete name:</label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.completeName}
              onChange={(e) => setField('completeName', e.target.value)}
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

          {/* Packages (dynamic) */}
          <div className="flex flex-col justify-center mt-8">
            <p className="font-semibold text-xl">Select A Package:</p>
            <div className="flex flex-row gap-4 justify-center flex-wrap">
              {packages.length === 0 && (
                <p className="text-sm text-gray-500">No packages to display.</p>
              )}
              {packages.map((pkg) => (
                <PromoCard
                  key={pkg.id}
                  imageSrc={pkg.image_url || '/Images/litratobg.jpg'}
                  title={pkg.package_name}
                  price={`₱${Number(pkg.price).toLocaleString()}`}
                  descriptions={[pkg.description || 'Package']}
                  selected={selectedPackageId === pkg.id}
                  onSelect={() => {
                    setSelectedPackageId(pkg.id)
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

          {/* Grids (dynamic) */}
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
                      className={`group w-[270px] overflow-hidden rounded-xl border shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-litratored ${
                        picked ? 'ring-2 ring-litratored' : ''
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
                          <div className="absolute inset-0 bg-black/20" />
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
                {timepickerReady && (
                  <Timepicker
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
              Submit
            </button>
          </div>
        </div>
      </div>
    </MotionDiv>
  )
}
