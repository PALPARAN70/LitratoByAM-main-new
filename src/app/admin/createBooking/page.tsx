'use client'
import Image from 'next/image'
import PromoCard from '../../../../Litratocomponents/Service_Card'
import Calendar from '../../../../Litratocomponents/LitratoCalendar'
import PackageCarousel from '../../../../Litratocomponents/PackageCarousel'
import GridCarousel from '../../../../Litratocomponents/GridCarousel'
// Timepicker removed: end time is auto-calculated from start + package duration + extension
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
import { submitAdminUpdate } from '../../../../schemas/functions/BookingRequest/adminupdateBooking'
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/auth/getProfile'

export default function BookingPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmUpdate, setShowConfirmUpdate] = useState(false)
  const [personalForm, setPersonalForm] = useState({
    Firstname: '',
    Lastname: '',
  })

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
  // Timepicker no longer used; keep simple time inputs with computed end time
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null)
  // Read-only locks for fields populated from a user record (name & contact only)
  const [locks, setLocks] = useState({
    name: false,
    contact: false,
  })

  // BookingForm['package'] handled via API-provided names

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Apply prefilled values when redirected from ManageBooking (Edit action)
    try {
      const raw = sessionStorage.getItem('edit_booking_prefill')
      if (raw) {
        const data = JSON.parse(raw)
        sessionStorage.removeItem('edit_booking_prefill')
        // editing mode
        // Capture request id to enable update flow instead of create
        if (typeof data.__requestid === 'number' && data.__requestid > 0) {
          setEditingRequestId(data.__requestid)
        } else if (
          typeof data.__requestid === 'string' &&
          !Number.isNaN(Number(data.__requestid))
        ) {
          setEditingRequestId(Number(data.__requestid))
        }
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
        setPersonalForm({
          Firstname: data.firstname || '',
          Lastname: data.lastname || '',
        })
        // Do not prefill form fields from profile on admin create.
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
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
              eventEndTime: computeEndTime(
                p.eventTime,
                Number((chosen as any)?.duration_hours ?? 2),
                Number(p.extensionHours)
              ),
            }))
          } else if (visible.length) {
            // Default to first visible package
            const first = visible[0]
            setSelectedPackageId(first.id)
            setForm((p) => ({
              ...p,
              package: first.package_name as BookingForm['package'],
              eventEndTime: computeEndTime(
                p.eventTime,
                Number((first as any)?.duration_hours ?? 2),
                Number(p.extensionHours)
              ),
            }))
          }
        }
      } catch {
        // Optional: show a toast, but avoid spamming admin
        // toast.error('Failed to load packages');
      }
    })()
    // Load available grids
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
      } catch {}
    })()
  }, [selectedPackageId, prefillPkgName])

  // No-op mount effect retained for parity; can be removed if desired
  useEffect(() => {}, [])

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

  // Auto-calc end time: start + package duration + extension hours
  const getSelectedPackage = () =>
    packages.find((p) => p.id === selectedPackageId) ||
    packages.find((p) => p.package_name === form.package)
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

  // Helper: derive a readable name from an email local-part (e.g., john.doe -> John Doe)
  const deriveNameFromEmail = (email: string) => {
    try {
      const local = (email || '').split('@')[0] || ''
      if (!local) return ''
      const parts = local
        .replace(/[._-]+/g, ' ')
        .split(' ')
        .filter(Boolean)
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
      return parts.map(cap).join(' ').trim()
    } catch {
      return ''
    }
  }

  // Auto-fill Complete name based on email (admin helper)
  const handleEmailBlur = async (email: string) => {
    try {
      const trimmed = (email || '').trim()
      if (!trimmed) return
      // Do not override if name already present
      if (form.completeName) return
      // If editing existing booking, avoid unexpected overrides
      if (editingRequestId) return
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token')
          : null
      if (!token) return
      const base =
        process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
        'http://localhost:5000'
      const url = `${base}/api/admin/user/by-email?email=${encodeURIComponent(
        trimmed
      )}`
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          user?: { firstname?: string; lastname?: string; contact?: string }
        }
        const u = data.user
        if (u) {
          const full = `${u.firstname || ''} ${u.lastname || ''}`.trim()
          const nameToUse = full || deriveNameFromEmail(trimmed)
          if (nameToUse) {
            setField('completeName', nameToUse)
          }
          if (!form.contactNumber && u.contact) {
            setField('contactNumber', u.contact)
          }
          // Lock only what we actually set
          setLocks({
            name: Boolean(nameToUse),
            contact: Boolean(u.contact),
          })
          return
        }
      }
      // Fallback: even if no user, try to derive a name for convenience (no lock on contact)
      const guess = deriveNameFromEmail(trimmed)
      if (guess) {
        setField('completeName', guess)
        setLocks((prev) => ({ ...prev, name: true }))
      }
    } catch {}
  }

  // Core submit routine used by both create and update
  const performSubmit = async () => {
    setSubmitting(true)
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
      const toTimeWithSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t)

      if (editingRequestId) {
        await submitAdminUpdate({
          requestid: editingRequestId,
          form,
          selectedPackageId: pkgId,
        })
        toast.success('Booking updated.')
        router.push('/admin/ManageBooking')
      } else {
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
        // Redirect after creating
        router.push('/admin/ManageBooking')
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to create booking'
      toast.error(message)
    } finally {
      setSubmitting(false)
      setShowConfirmUpdate(false)
    }
  }

  const handleSubmit = () => {
    if (submitting) return
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
    // If editing, confirm before proceeding
    if (editingRequestId) {
      setShowConfirmUpdate(true)
      return
    }
    void performSubmit()
  }

  const handleClear = () => {
    setForm(initialForm)
    setSelectedPackageId(null)
    setPrefillPkgName(null)
    setErrors({})
    toast.message('Form cleared.')
  }

  // formFields were unused and removed to satisfy lint rules

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
          {/* Personal Information Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-3 text-litratoblack">
              Client Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Email */}
              <div className="min-h-[90px]">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  placeholder="Enter here:"
                  className="w-full bg-gray-50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200"
                  value={form.email}
                  onChange={(e) => {
                    // If email changes, unlock any previously locked fields
                    setLocks({ name: false, contact: false })
                    setField('email', e.target.value)
                  }}
                  onBlur={(e) => {
                    const v = e.target.value
                    setField('email', v)
                    void handleEmailBlur(v)
                  }}
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
                  className={`w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200 ${
                    locks.name ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-50'
                  }`}
                  value={form.completeName}
                  onChange={(e) => setField('completeName', e.target.value)}
                  readOnly={locks.name}
                  aria-readonly={locks.name}
                  title={
                    locks.name ? "Auto-filled from user's profile" : undefined
                  }
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
                  className={`w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200 ${
                    locks.contact
                      ? 'bg-gray-100 cursor-not-allowed'
                      : 'bg-gray-50'
                  }`}
                  value={form.contactNumber}
                  onChange={(e) => setField('contactNumber', e.target.value)}
                  onBlur={(e) => setField('contactNumber', e.target.value)}
                  readOnly={locks.contact}
                  aria-readonly={locks.contact}
                  title={
                    locks.contact
                      ? "Auto-filled from user's profile"
                      : undefined
                  }
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
                  onChange={(e) => setField('signal', e.target.value)}
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
                  Placement of Booth
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="boothPlacement"
                      checked={form.boothPlacement === 'Indoor'}
                      onChange={() => setField('boothPlacement', 'Indoor')}
                    />
                    <span className="text-sm">Indoor</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="boothPlacement"
                      checked={form.boothPlacement === 'Outdoor'}
                      onChange={() => setField('boothPlacement', 'Outdoor')}
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
                    const pkg = getSelectedPackage()
                    const end = computeEndTime(
                      form.eventTime,
                      Number((pkg as any)?.duration_hours ?? 2),
                      ext
                    )
                    setField('extensionHours', ext)
                    setField('eventEndTime', end)
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

          {/* Packages (dynamic) */}
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
                  Number((pkg as any)?.duration_hours ?? 2),
                  Number(form.extensionHours)
                )
                setField('eventEndTime', end)
              }}
            />
            {errors.package && (
              <p className="text-red-600 text-xs mt-1 text-center">
                {errors.package}
              </p>
            )}
          </div>

          {/* Grids (dynamic) */}
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
              <p className="text-red-600 text-xs mt-1 text-center">
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
                <Calendar
                  value={form.eventDate}
                  onDateChangeAction={(d) => setField('eventDate', d as Date)}
                />
                {errors.eventDate && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.eventDate}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    className="w-full bg-gray-50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-litratored border border-gray-200"
                    value={form.eventTime}
                    onChange={(e) => {
                      const start = e.target.value
                      setField('eventTime', start)
                      const pkg = getSelectedPackage()
                      const end = computeEndTime(
                        start,
                        Number((pkg as any)?.duration_hours ?? 2),
                        Number(form.extensionHours)
                      )
                      setField('eventEndTime', end)
                    }}
                  />
                  {errors.eventTime && (
                    <p className="text-red-600 text-xs mt-1">
                      {errors.eventTime}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    className="w-full bg-gray-100 rounded-md px-3 py-2 text-sm border border-gray-200"
                    value={form.eventEndTime}
                    readOnly
                    aria-readonly="true"
                  />
                  {errors.eventEndTime && (
                    <p className="text-red-600 text-xs mt-1">
                      {errors.eventEndTime}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClear}
              type="button"
              className="bg-gray-200 text-litratoblack px-4 py-2 rounded-md hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              Clear
            </button>
            <button
              onClick={handleSubmit}
              type="button"
              className="bg-litratoblack text-white px-4 py-2 rounded-md hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting
                ? editingRequestId
                  ? 'Updating…'
                  : 'Submitting…'
                : editingRequestId
                ? 'Update Booking'
                : 'Submit Booking'}
            </button>
          </div>

          {showConfirmUpdate && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center"
            >
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowConfirmUpdate(false)}
              />
              <div className="relative z-10 w-[95%] max-w-md rounded-lg bg-white p-4 shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Confirm update</h3>
                <p className="text-sm text-gray-700 mb-4">
                  You are about to update this booking. Proceed?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
                    onClick={() => setShowConfirmUpdate(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-litratoblack text-white hover:bg-black disabled:opacity-50"
                    onClick={() => void performSubmit()}
                    disabled={submitting}
                  >
                    Proceed
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MotionDiv>
  )
}
