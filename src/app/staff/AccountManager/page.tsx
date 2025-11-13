'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { FaFemale, FaMale, FaUser } from 'react-icons/fa'
import { Eye, EyeOff } from 'lucide-react'

import MotionDiv from '../../../../Litratocomponents/MotionDiv'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { profileUpdateSchema } from '../../../../schemas/schema/uservalidation'
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'

type SexOption = 'Male' | 'Female' | 'Prefer not to say'

type ProfileForm = {
  firstname: string
  lastname: string
  birthdate: string
  sex: '' | SexOption
  contact: string
  region: string
  province: string
  city: string
  barangay: string
  postalCode: string
}

const BLANK_PROFILE: ProfileForm = {
  firstname: '',
  lastname: '',
  birthdate: '',
  sex: '',
  contact: '',
  region: '',
  province: '',
  city: '',
  barangay: '',
  postalCode: '',
}

type PersonalField = {
  label: string
  type: string
  key: 'firstname' | 'lastname' | 'contact'
}

type AddressField = {
  label: string
  type: string
  key: 'region' | 'province' | 'city' | 'barangay' | 'postalCode'
}

// Hoisted static schemas (prevents re-allocations each render)
const PERSONAL_FIELDS: readonly PersonalField[] = [
  { label: 'First Name', type: 'text', key: 'firstname' },
  { label: 'Last Name', type: 'text', key: 'lastname' },
  { label: 'Contact Number', type: 'tel', key: 'contact' },
] as const

const ADDRESS_FIELDS: readonly AddressField[] = [
  { label: 'Region', type: 'text', key: 'region' },
  { label: 'Province', type: 'text', key: 'province' },
  { label: 'City/Town', type: 'text', key: 'city' },
  { label: 'Barangay', type: 'text', key: 'barangay' },
  { label: 'Postal Code', type: 'text', key: 'postalCode' },
] as const

const SEX_OPTIONS: SexOption[] = ['Male', 'Female', 'Prefer not to say']

const DATE_LOWER_BOUND = new Date(1900, 0, 1)

function normalizeBirthdate(value: string | null | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return format(parsed, 'yyyy-MM-dd')
}

function isSexOption(value: unknown): value is SexOption {
  return typeof value === 'string' && SEX_OPTIONS.includes(value as SexOption)
}

type PasswordFieldKey = 'oldPassword' | 'newPassword' | 'confirmPassword'

const ACCOUNT_SETTINGS: Array<{
  label: string
  key: PasswordFieldKey
}> = [
  { label: 'Old Password', key: 'oldPassword' },
  { label: 'New Password', key: 'newPassword' },
  { label: 'Confirm Password', key: 'confirmPassword' },
]

export default function AccountManagementPage() {
  const router = useRouter()

  // ✅ Toggle between read-only and editable profile
  const [isEditable, setIsEditable] = useState(false)

  // (Removed unused 'profile' state)

  // ✅ Default structure for user profile data
  const [originalForm, setOriginalForm] = useState<ProfileForm>(() => ({
    ...BLANK_PROFILE,
  }))

  // ✅ Form for handling password changes
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordEditMode, setPasswordEditMode] = useState(false)
  const [passwordVisibility, setPasswordVisibility] = useState<
    Record<PasswordFieldKey, boolean>
  >({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false,
  })

  // ✅ Editable version of personal data
  const [personalForm, setPersonalForm] = useState<ProfileForm>(() => ({
    ...BLANK_PROFILE,
  }))

  // ✅ Track when saving profile
  const [saving, setSaving] = useState(false)

  const parsedBirthdate = useMemo(() => {
    if (!personalForm.birthdate) return undefined
    const parsed = parseISO(personalForm.birthdate)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }, [personalForm.birthdate])

  const displayName = useMemo(() => {
    const first = personalForm.firstname || 'User'
    const last = personalForm.lastname ? ` ${personalForm.lastname}` : ''
    return `${first}${last}`
  }, [personalForm.firstname, personalForm.lastname])

  const [birthdatePickerOpen, setBirthdatePickerOpen] = useState(false)

  const editableInputClass =
    'w-full rounded-md px-3 py-2 text-sm focus:outline-none bg-gray-200'
  const readOnlyInputClass =
    'w-full rounded-md px-3 py-2 text-sm focus:outline-none bg-gray-100 text-gray-400 cursor-not-allowed'

  const ProfileIcon = useMemo(() => {
    if (personalForm.sex === 'Male') return FaMale
    if (personalForm.sex === 'Female') return FaFemale
    return FaUser
  }, [personalForm.sex])

  /**
   * ✅ Load profile data when component mounts
   */
  useEffect(() => {
    const controller = new AbortController()
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null

    if (!token) return
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/getProfile`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.status === 401) {
          // If unauthorized, clear token and redirect to login
          localStorage.removeItem('access_token')
          router.replace('/login')
          return
        }

        const data = await res.json()

        const formData: ProfileForm = {
          firstname: data.firstname ?? '',
          lastname: data.lastname ?? '',
          birthdate: normalizeBirthdate(data.birthdate),
          sex: isSexOption(data.sex) ? data.sex : '',
          contact: data.contact ?? '',
          region: data.region ?? '',
          province: data.province ?? '',
          city: data.city ?? '',
          barangay: data.barangay ?? '',
          postalCode: data.postal_code ?? '',
        }

        setOriginalForm(formData)
        setPersonalForm({ ...formData })
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Profile fetch failed:', err)
      }
    })()

    return () => controller.abort()
  }, [router])

  useEffect(() => {
    if (!isEditable) {
      setBirthdatePickerOpen(false)
    }
  }, [isEditable])

  /**
   * ✅ Helper function to display dates nicely
   */
  function formatReadableDate(isoString: string): string {
    if (!isoString) return ''
    const parsed = parseISO(isoString)
    if (Number.isNaN(parsed.getTime())) return ''
    return format(parsed, 'MMM d, yyyy')
  }

  // Memoized dirty detectors (avoid stringify)
  const isPersonalDirty = useMemo(() => {
    const keys: Array<keyof ProfileForm> = [
      'firstname',
      'lastname',
      'birthdate',
      'sex',
      'contact',
      'region',
      'province',
      'city',
      'barangay',
      'postalCode',
    ]
    return keys.some((key) => personalForm[key] !== originalForm[key])
  }, [personalForm, originalForm])

  const passwordDirty = useMemo(
    () =>
      Boolean(
        passwordForm.oldPassword ||
          passwordForm.newPassword ||
          passwordForm.confirmPassword
      ),
    [passwordForm]
  )

  // Save profile wrapped in useCallback
  const saveProfile = useCallback(async () => {
    const parsed = profileUpdateSchema.safeParse({
      firstname: personalForm.firstname,
      lastname: personalForm.lastname,
      birthdate: personalForm.birthdate,
      sex: personalForm.sex,
      contact: personalForm.contact,
      region: personalForm.region,
      province: personalForm.province,
      city: personalForm.city,
      barangay: personalForm.barangay,
      postalCode: personalForm.postalCode,
    })

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) throw new Error('You are not authenticated')

      const payload = parsed.data
      const res = await fetch(`${API_BASE}/api/auth/updateProfile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstname: payload.firstname,
          lastname: payload.lastname,
          birthdate: payload.birthdate,
          sex: payload.sex,
          contact: payload.contact,
          region: payload.region,
          province: payload.province,
          city: payload.city,
          barangay: payload.barangay,
          postal_code: payload.postalCode,
        }),
      })

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.message || 'Failed to save changes')
      }

      const data = await res.json()
      const updated: ProfileForm = {
        firstname: data.user?.firstname ?? payload.firstname,
        lastname: data.user?.lastname ?? payload.lastname,
        birthdate: normalizeBirthdate(
          data.user?.birthdate ?? payload.birthdate
        ),
        sex: isSexOption(data.user?.sex) ? data.user.sex : payload.sex,
        contact: data.user?.contact ?? payload.contact,
        region: data.user?.region ?? payload.region,
        province: data.user?.province ?? payload.province,
        city: data.user?.city ?? payload.city,
        barangay: data.user?.barangay ?? payload.barangay,
        postalCode: data.user?.postal_code ?? payload.postalCode,
      }

      setOriginalForm(updated)
      setPersonalForm({ ...updated })
      setIsEditable(false)
      toast.success('Changes have been saved')
    } catch (e: unknown) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }, [personalForm])

  const startProfileEdit = useCallback(() => {
    setIsEditable(true)
  }, [])

  const cancelProfileEdit = useCallback(() => {
    setPersonalForm({ ...originalForm })
    setIsEditable(false)
  }, [originalForm])

  const handleSaveProfile = useCallback(async () => {
    if (!isPersonalDirty || saving) return
    await saveProfile()
  }, [isPersonalDirty, saving, saveProfile])

  const startPasswordEdit = useCallback(() => {
    if (changingPassword) return
    setPasswordEditMode(true)
  }, [changingPassword])

  const cancelPasswordEdit = useCallback(() => {
    if (changingPassword) return
    setPasswordEditMode(false)
    setPasswordForm({
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    setPasswordVisibility({
      oldPassword: false,
      newPassword: false,
      confirmPassword: false,
    })
  }, [changingPassword])

  const handleSavePassword = useCallback(async () => {
    if (changingPassword || !passwordDirty) return

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password and confirmation do not match')
      return
    }

    setChangingPassword(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${API_BASE}/api/auth/changePassword`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to change password')

      toast.success('Password changed successfully!')
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setPasswordEditMode(false)
      setPasswordVisibility({
        oldPassword: false,
        newPassword: false,
        confirmPassword: false,
      })
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error changing password'
      )
    } finally {
      setChangingPassword(false)
    }
  }, [
    API_BASE,
    changingPassword,
    passwordDirty,
    passwordForm.confirmPassword,
    passwordForm.newPassword,
    passwordForm.oldPassword,
  ])

  const togglePasswordVisibility = useCallback((key: PasswordFieldKey) => {
    setPasswordVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <MotionDiv>
      <div className="h-screen p-4">
        <div className="flex flex-col p-4 justify-center gap-4">
          {/* ================= Profile Section ================= */}
          <div className="flex flex-col justify-center gap-2 items-center">
            {/* Profile picture */}
            <div className="flex items-center justify-center bg-black h-30 w-30 rounded-full">
              <ProfileIcon size={64} className="text-white" />
            </div>

            {/* Welcome text */}
            <p className="text-black text-center text-3xl font-semibold">
              Welcome, {displayName}!
            </p>

            {/* Profile action buttons */}
            <div className="flex flex-row gap-6">
              {/* Unified Edit/Cancel/Save button */}

              {/* Black Change Password button with improved detector */}
            </div>
          </div>

          {/* ================= Personal Info Section ================= */}
          <p className="text-2xl font-semibold">Manage your account</p>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {PERSONAL_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <label>{field.label}:</label>
                <input
                  type={field.type}
                  value={personalForm[field.key]}
                  onChange={(e) =>
                    setPersonalForm((prev: ProfileForm) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  disabled={!isEditable}
                  className={
                    isEditable ? editableInputClass : readOnlyInputClass
                  }
                />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label>Birthdate:</label>
              {isEditable ? (
                <Popover
                  open={birthdatePickerOpen}
                  onOpenChange={(open) =>
                    setBirthdatePickerOpen(isEditable ? open : false)
                  }
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${
                        !parsedBirthdate ? 'text-muted-foreground' : ''
                      }`}
                    >
                      {parsedBirthdate
                        ? format(parsedBirthdate, 'MMM d, yyyy')
                        : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parsedBirthdate}
                      onSelect={(date) => {
                        if (!date) return
                        const normalized = new Date(
                          date.getFullYear(),
                          date.getMonth(),
                          date.getDate()
                        )
                        setPersonalForm((prev: ProfileForm) => ({
                          ...prev,
                          birthdate: format(normalized, 'yyyy-MM-dd'),
                        }))
                        setBirthdatePickerOpen(false)
                      }}
                      disabled={(date) => {
                        const normalized = new Date(
                          date.getFullYear(),
                          date.getMonth(),
                          date.getDate()
                        )
                        const today = new Date()
                        const todayNormalized = new Date(
                          today.getFullYear(),
                          today.getMonth(),
                          today.getDate()
                        )
                        return (
                          normalized >= todayNormalized ||
                          normalized < DATE_LOWER_BOUND
                        )
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <input
                  value={
                    personalForm.birthdate
                      ? formatReadableDate(personalForm.birthdate)
                      : ''
                  }
                  readOnly
                  className={readOnlyInputClass}
                />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label>Sex:</label>
              {isEditable ? (
                <Select
                  value={personalForm.sex || undefined}
                  onValueChange={(value) =>
                    setPersonalForm((prev: ProfileForm) => ({
                      ...prev,
                      sex: value as SexOption,
                    }))
                  }
                >
                  <SelectTrigger className="w-full h-9 rounded-md bg-gray-200 justify-start">
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEX_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  value={personalForm.sex || ''}
                  readOnly
                  className={readOnlyInputClass}
                />
              )}
            </div>
          </div>

          {/* ================= Address Info Section ================= */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {ADDRESS_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <label>{field.label}:</label>
                <input
                  type={field.type}
                  value={personalForm[field.key]}
                  onChange={(e) =>
                    setPersonalForm((prev: ProfileForm) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  disabled={!isEditable}
                  className={
                    isEditable ? editableInputClass : readOnlyInputClass
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            {!isEditable ? (
              <button
                type="button"
                onClick={startProfileEdit}
                className="bg-litratoblack rounded-full py-2 px-4 text-white cursor-pointer"
                style={{ borderRadius: '9999px' }}
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelProfileEdit}
                  disabled={saving}
                  className="rounded-full border border-litratoblack bg-white py-2 px-4 text-litratoblack cursor-pointer disabled:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed"
                  style={{ borderRadius: '9999px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={!isPersonalDirty || saving}
                  className="bg-litratoblack rounded-full py-2 px-4 text-white cursor-pointer disabled:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed"
                  style={{ borderRadius: '9999px' }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          <p className="text-2xl font-semibold">Account Settings</p>
          <div className="flex flex-col gap-4 w-1/3">
            {ACCOUNT_SETTINGS.map(({ label, key }) => {
              const isDisabled = !passwordEditMode || changingPassword
              const isVisible = passwordVisibility[key]
              return (
                <div key={key} className="flex flex-col">
                  <label>{label}:</label>
                  <div className="relative">
                    <input
                      type={isVisible ? 'text' : 'password'}
                      placeholder="Enter here:"
                      value={passwordForm[key]}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      disabled={isDisabled}
                      className={`w-full rounded-md px-3 py-2 text-sm focus:outline-none pr-10 ${
                        isDisabled
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(key)}
                      disabled={isDisabled}
                      className="absolute inset-y-0 right-2 flex items-center text-gray-600 disabled:text-gray-400"
                    >
                      {isVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-end">
            {' '}
            {!passwordEditMode ? (
              <button
                type="button"
                onClick={startPasswordEdit}
                disabled={changingPassword}
                className="bg-litratoblack rounded-full py-2 px-4 text-white cursor-pointer disabled:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed"
                style={{ borderRadius: '9999px' }}
              >
                Change Password
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelPasswordEdit}
                  disabled={changingPassword}
                  className="rounded-full border border-litratoblack bg-white py-2 px-4 text-litratoblack cursor-pointer disabled:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed"
                  style={{ borderRadius: '9999px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePassword}
                  disabled={!passwordDirty || changingPassword}
                  className="bg-litratoblack rounded-full py-2 px-4 text-white cursor-pointer disabled:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed"
                  style={{ borderRadius: '9999px' }}
                >
                  {changingPassword ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </MotionDiv>
  )
}
