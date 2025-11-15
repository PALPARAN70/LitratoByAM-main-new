'use client'
import { useEffect, useState } from 'react'
import { formatDisplayDateTime } from '@/lib/datetime'
import { toast } from 'sonner'
import {
  type createUserData,
  createUserSchema,
} from '../../../../schemas/schema/requestvalidation'
import { Ellipsis, Eye, EyeOff } from 'lucide-react'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'

// ADD: pagination components
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
type User = {
  id: string
  firstname: string
  lastname: string
  email: string
  contact: string
  isactive: boolean
  last_updated: string | null
  last_login?: string | null
  role?: string
}
type TabKey = 'createusers' | 'customers' | 'staff' | 'admin'

// ADD: shared 3-page window helper (same as other tables)
function pageWindow(current: number, total: number, size = 3): number[] {
  if (total <= 0) return []
  const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1
  const end = Math.min(total, start + size - 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default function AdminAccountManagementPage() {
  const [active, setActive] = useState<TabKey>('customers')
  // controlled search input and applied search term
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Debounce: when user types, wait 500ms after last keystroke to apply searchTerm
  useEffect(() => {
    const trimmed = searchInput.trim()
    // If input equals applied term, do nothing
    if (trimmed === searchTerm) return
    const id = setTimeout(() => {
      setSearchTerm(trimmed)
    }, 500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]) // intentionally only depends on searchInput

  // Note: advanced filter options can be added in future if needed

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Account Management</h1>
      </header>

      <nav className="flex gap-2 mb-6">
        <TabButton
          active={active === 'createusers'}
          onClick={() => setActive('createusers')}
        >
          Create User
        </TabButton>
        <TabButton
          active={active === 'customers'}
          onClick={() => setActive('customers')}
        >
          Customers
        </TabButton>
        <TabButton
          active={active === 'staff'}
          onClick={() => setActive('staff')}
        >
          Staff
        </TabButton>
        <TabButton
          active={active === 'admin'}
          onClick={() => setActive('admin')}
        >
          Admin
        </TabButton>
        <div className="flex-grow flex">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSearchTerm(searchInput.trim())
            }}
            className="w-1/4 bg-gray-400 rounded-full items-center flex px-1 py-1"
          >
            <input
              type="text"
              placeholder="Search User..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-transparent outline-none w-full px-2"
            />
          </form>
        </div>
      </nav>
      <section className="bg-white h-125 rounded-xl shadow p-4">
        {active === 'createusers' && <CreateUserPanel />}
        {active === 'customers' && (
          <UserListPanel
            role="customer"
            title="Customer Accounts"
            searchTerm={searchTerm}
          />
        )}
        {active === 'staff' && (
          <UserListPanel
            role="employee"
            title="Staff (Employee) Accounts"
            searchTerm={searchTerm}
          />
        )}
        {active === 'admin' && (
          <UserListPanel
            role="admin"
            title="Admin Accounts"
            searchTerm={searchTerm}
          />
        )}
      </section>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <div
      onClick={onClick}
      className={`px-4 py-2 rounded-full cursor-pointer border font-semibold transition
        ${
          active
            ? 'bg-litratoblack text-white border-litratoblack'
            : 'bg-white text-litratoblack border-gray-300 hover:bg-gray-100'
        }`}
    >
      {children}
    </div>
  )
}

/* Unified User List Panel */
function UserListPanel({
  role,
  title,
  // added: incoming search term to filter by last name (server-side query)
  searchTerm,
}: {
  role: 'customer' | 'employee' | 'admin'
  title: string
  searchTerm?: string
}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchUsers = async () => {
      setLoading(true)
      setError(null)
      try {
        const raw =
          typeof window !== 'undefined'
            ? localStorage.getItem('access_token')
            : null
        const authHeader =
          raw && raw.startsWith('Bearer ') ? raw : raw ? `Bearer ${raw}` : ''
        const url =
          `http://localhost:5000/api/admin/list?role=${role}` +
          (searchTerm ? `&lastname=${encodeURIComponent(searchTerm)}` : '')
        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
        })
        if (res.status === 401)
          throw new Error('Unauthorized. Please log in again.')
        if (res.status === 403)
          throw new Error('Forbidden: Admin role required.')
        if (!res.ok) {
          const msg = await res.text()
          throw new Error(msg || `Failed to load ${role} list (${res.status})`)
        }
        const data = await res.json()
        if (!cancelled) {
          setUsers(Array.isArray(data.users) ? data.users : [])
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load users'
        if (!cancelled) setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchUsers()
    return () => {
      cancelled = true
    }
  }, [role, searchTerm]) // re-run when searchTerm changes

  // Helper to normalize Authorization header
  const getAuthHeader = () => {
    const raw =
      typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null
    return raw ? (raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`) : ''
  }

  // Re-fetch list helper can be reintroduced if needed

  // Connect to backend block/unblock
  const callAdminAction = async (id: string, action: 'block' | 'unblock') => {
    try {
      const authHeader = getAuthHeader()
      const res = await fetch(
        `http://localhost:5000/api/admin/user/${id}/${action}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({}),
        }
      )
      const data = await res.json()

      if (!res.ok) {
        // Prefer backend toast message when available
        const msg =
          data?.toast?.message || data?.message || `Failed to ${action} user`
        toast.error(msg)
        throw new Error(msg)
      }

      // Show backend toast (success / error) if present, fallback to generic
      if (data?.toast?.message) {
        if (data.toast.type === 'success') toast.success(data.toast.message)
        else toast.error(data.toast.message)
      } else {
        toast.success(
          `User ${action === 'block' ? 'blocked' : 'unblocked'} successfully`
        )
      }

      // Use the backend response to update the toggled user's status
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isactive: !!data.isactive } : u))
      )
      // No need to refresh; the UI already reflects the new state
    } catch (e) {
      // Use sonner toast for errors instead of alert
      const message =
        e instanceof Error ? e.message : `Failed to ${action} user`
      toast.error(message)
    }
  }

  const block = (id: string) => callAdminAction(id, 'block')
  const unblock = (id: string) => callAdminAction(id, 'unblock')

  // --- NEW: compute available role change choices based on current panel role
  const roleChoices: {
    label: string
    value: 'customer' | 'employee'
  }[] = (() => {
    if (role === 'customer') return [{ label: 'Staff', value: 'employee' }]
    if (role === 'employee') return [{ label: 'Customer', value: 'customer' }]
    // role === "admin"
    return [
      { label: 'Customer', value: 'customer' },
      { label: 'Staff', value: 'employee' },
    ]
  })()

  // --- NEW: arrow function to change a user's role
  const changeRole = async (id: string, newRole: 'customer' | 'employee') => {
    try {
      const authHeader = getAuthHeader()
      const res = await fetch(
        `http://localhost:5000/api/admin/user/${id}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({ role: newRole }),
        }
      )
      const data = await res.json()

      if (!res.ok) {
        const msg =
          data?.toast?.message || data?.message || 'Failed to change role'
        if (data?.toast?.type === 'error') toast.error(msg)
        else toast.error(msg)
        throw new Error(msg)
      }

      // show backend toast if present, fallback to generic
      if (data?.toast?.message) {
        if (data.toast.type === 'success') {
          toast.success(data.toast.message)
        } else {
          toast.error(data.toast.message)
        }
      } else {
        toast.success('Role changed successfully')
      }

      // If the user's new role no longer matches the current panel's role, remove them from list.
      if (newRole !== role) {
        setUsers((prev) => prev.filter((u) => u.id !== id))
      } else {
        // otherwise update the user's role in-place
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
        )
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to change role'
      toast.error(message)
    }
  }

  // Client-side fallback filter so matched users always display in the table
  const normalizedSearch = (searchTerm || '').trim().toLowerCase()
  const displayedUsers = users.filter((u) =>
    normalizedSearch
      ? u.firstname.toLowerCase().includes(normalizedSearch) ||
        u.lastname.toLowerCase().includes(normalizedSearch) ||
        u.email.toLowerCase().includes(normalizedSearch) ||
        u.contact.toLowerCase().includes(normalizedSearch)
      : true
  )

  // ADD: pagination for the role table
  const PER_PAGE = 5
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(displayedUsers.length / PER_PAGE))
  const windowPages = pageWindow(page, totalPages, 3)
  useEffect(() => {
    // clamp page when data changes
    setPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages, displayedUsers.length])
  useEffect(() => {
    // reset to page 1 when role or search changes
    setPage(1)
  }, [role, searchTerm])
  const paginatedUsers = displayedUsers.slice(
    (page - 1) * PER_PAGE,
    (page - 1) * PER_PAGE + PER_PAGE
  )

  const tabletitles = [
    { label: 'First Name' },
    { label: 'Last Name' },
    { label: 'Email' },
    { label: 'Contact' },
    { label: 'Status' },
    { label: 'Last Logged In' },
    { label: 'Last Updated' },
    { label: 'Actions' },
  ]
  return (
    <div className="flex h-full flex-col">
      <div className="border-b-2 border-black mb-4">
        <h2 className="text-xl font-semibold mb-3">{title}</h2>
      </div>
      {loading && <p className="text-gray-500 mb-2">Loading…</p>}
      {error && <p className="text-red-600 mb-2">{error}</p>}
      {/* CHANGED: table area grows and scrolls; pagination stays at bottom */}
      <div className="rounded-t-2xl border-2 flex-1 overflow-auto">
        <table className="w-full text-left  rounded-t-xl overflow-hidden">
          <thead className="bg-gray-200">
            <tr>
              {tabletitles.map((item, idx) => (
                <Th
                  key={item.label}
                  className={`whitespace-nowrap ${
                    idx === 0 ? 'rounded-tl-xl' : ''
                  } ${idx === tabletitles.length - 1 ? 'rounded-tr-xl' : ''}`}
                >
                  {item.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((u) => (
              <tr key={u.id} className="border-t">
                <Td>{u.firstname}</Td>
                <Td>{u.lastname}</Td>
                <Td>{u.email}</Td>
                <Td>{u.contact}</Td>

                <Td>
                  <div className="flex w-20">
                    {u.isactive ? 'Active' : 'Inactive'}
                  </div>
                </Td>
                <Td>
                  {u.last_login ? formatDisplayDateTime(u.last_login) : '—'}
                </Td>
                <Td>
                  {u.last_updated ? formatDisplayDateTime(u.last_updated) : '—'}
                </Td>
                <Td>
                  {/* ...existing actions popover... */}
                  <Popover>
                    <PopoverTrigger>
                      <div className=" flex cursor-pointer p-1 hover:bg-gray-200 rounded">
                        <Ellipsis></Ellipsis>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent>
                      {u.firstname} {u.lastname}
                      {u.isactive ? (
                        <div
                          onClick={() => block(u.id)}
                          className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600  cursor-pointer"
                        >
                          Block
                        </div>
                      ) : (
                        <div
                          onClick={() => unblock(u.id)}
                          className="px-3 py-1 rounded bg-green-500 text-white hover:bg-green-600  cursor-pointer"
                        >
                          Unblock
                        </div>
                      )}
                      {/* REPLACED: dynamic role choices based on panel role */}
                      <Popover>
                        <PopoverTrigger>
                          <div className="px-3 py-1  text-left rounded bg-gray-200 text-black cursor-pointer hover:bg-gray-300">
                            Change Role
                          </div>
                        </PopoverTrigger>
                        <PopoverContent>
                          <div className="font-medium mb-2">
                            Change {u.firstname}&apos;s Role to
                          </div>
                          {roleChoices.map((choice) => (
                            <div
                              key={choice.value}
                              onClick={() => changeRole(u.id, choice.value)}
                              className="px-3 py-1 rounded bg-gray-200 text-black hover:text-white hover:bg-gray-300 cursor-pointer mb-1"
                            >
                              {choice.label}
                            </div>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </PopoverContent>
                  </Popover>
                </Td>
              </tr>
            ))}
            {/* NEW: filler rows to keep the table at exactly 5 rows on the page */}
            {!loading &&
              paginatedUsers.length > 0 &&
              paginatedUsers.length < PER_PAGE &&
              Array.from({ length: PER_PAGE - paginatedUsers.length }).map(
                (_, i) => (
                  <tr key={`filler-${i}`} className="border-t">
                    <td colSpan={8} className="px-3 py-2 text-sm">
                      <div className="h-4" />
                    </td>
                  </tr>
                )
              )}
            {displayedUsers.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-gray-500">
                  {searchTerm ? 'No available users' : `No ${role}s found`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CHANGED: fixed at bottom of the panel */}
      <div className="mt-auto pt-3">
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
  )
}

// Create User Panel (local state only)
function CreateUserPanel() {
  const [error, setError] = useState<string | null>(null)

  // Local form type including role (customer | employee)
  type AdminCreateUserForm = createUserData & {
    role: 'customer' | 'employee'
  }

  const [formData, setFormData] = useState<AdminCreateUserForm>({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    contact: '',
    // NEW: include role in form state (UI constraint: customer or employee)
    // We'll send this only to the admin endpoint. Public register ignores roles.
    role: 'customer' as 'customer' | 'employee',
  })

  const reset = () => {
    setFormData({
      firstname: '',
      lastname: '',
      email: '',
      password: '',
      contact: '',
      role: 'customer',
    })
    // clear field errors on reset
    setFormErrors({})
  }

  // replace read-only errors with setter-backed errors
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof createUserData, string>>
  >({})

  const save = async () => {
    setError(null)

    // Validate with Zod and show field errors below inputs
    const parsed = createUserSchema.safeParse({
      firstname: formData.firstname,
      lastname: formData.lastname,
      email: formData.email,
      password: formData.password,
      contact: formData.contact,
    })

    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof createUserData, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof createUserData
        if (key) fieldErrors[key] = issue.message
      }
      setFormErrors(fieldErrors)
      return
    } else {
      setFormErrors({})
    }

    try {
      // Prefer admin endpoint (requires Authorization) to allow setting role (customer/employee)
      const raw =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token')
          : null
      const authHeader = raw
        ? raw.startsWith('Bearer ')
          ? raw
          : `Bearer ${raw}`
        : ''

      const useAdminEndpoint = !!authHeader // we can call admin endpoint only if logged in and token present

      const url = useAdminEndpoint
        ? 'http://localhost:5000/api/admin/user'
        : 'http://localhost:5000/api/auth/register'

      const payload = useAdminEndpoint
        ? {
            username: formData.email,
            password: formData.password,
            firstname: formData.firstname,
            lastname: formData.lastname,
            birthdate: null,
            sex: null,
            region: null,
            province: null,
            city: null,
            barangay: null,
            postal_code: null,
            contact: formData.contact,
            role: formData.role, // only honored by admin endpoint
          }
        : {
            username: formData.email,
            password: formData.password,
            firstname: formData.firstname,
            lastname: formData.lastname,
            birthdate: null,
            sex: null,
            region: null,
            province: null,
            city: null,
            barangay: null,
            postal_code: null,
            contact: formData.contact,
          }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-type': 'application/json',
          ...(useAdminEndpoint && authHeader
            ? { Authorization: authHeader }
            : {}),
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        // if admin endpoint, no email verification required
        const msg = useAdminEndpoint
          ? data?.toast?.message || 'User created successfully'
          : 'User Creation successful! Please verify your email.'
        toast.success(msg)
        // Optimistically add to the right-side Users table when admin created
        if (useAdminEndpoint && data?.user) {
          setUsers((prev) => {
            const exists = prev.some((u) => u.id === String(data.user.id))
            if (exists) return prev
            // normalize shape — backend already returns id, firstname, lastname, email, contact, role
            const next: User = {
              id: String(data.user.id),
              firstname: data.user.firstname || '',
              lastname: data.user.lastname || '',
              email: data.user.email,
              contact: data.user.contact || '',
              role: data.user.role,
              isactive: true,
              last_updated: null,
              last_login: null,
            }
            return [next, ...prev]
          })
        }
      } else {
        setError(data?.toast?.message || data.message || 'User creation failed')
      }
    } catch {
      setError('An error occurred')
    }
    reset()
  }

  // --- NEW: users list for table in right column ---
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      setLoadingUsers(true)
      setUsersError(null)
      try {
        const raw =
          typeof window !== 'undefined'
            ? localStorage.getItem('access_token')
            : null
        const authHeader =
          raw && raw.startsWith('Bearer ') ? raw : raw ? `Bearer ${raw}` : ''
        const roles = ['customer', 'employee', 'admin']
        const promises = roles.map((r) =>
          fetch(`http://localhost:5000/api/admin/list?role=${r}`, {
            headers: {
              'Content-Type': 'application/json',
              ...(authHeader ? { Authorization: authHeader } : {}),
            },
          })
            .then(async (res) => {
              if (!res.ok) return { users: [] }
              return res.json()
            })
            .catch(() => ({ users: [] }))
        )
        const results = await Promise.all(promises)
        if (cancelled) return
        // combine and dedupe by id
        const combined: User[] = []
        const seen = new Set<string>()
        for (const r of results) {
          const list = Array.isArray(r.users) ? r.users : []
          for (const u of list) {
            if (!seen.has(u.id)) {
              seen.add(u.id)
              combined.push(u)
            }
          }
        }
        setUsers(combined)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load users'
        if (!cancelled) setUsersError(message)
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    }
    fetchAll()
    return () => {
      cancelled = true
    }
  }, [])

  // --- NEW: pagination for right-side Users table ---
  const USERS_PER_PAGE = 5
  const [usersPage, setUsersPage] = useState(1)
  const usersTotalPages = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE))
  const usersWindowPages = pageWindow(usersPage, usersTotalPages, 3)
  useEffect(() => {
    setUsersPage((p) => Math.min(Math.max(1, p), usersTotalPages))
  }, [usersTotalPages, users.length])

  const paginatedUsersRight = users.slice(
    (usersPage - 1) * USERS_PER_PAGE,
    (usersPage - 1) * USERS_PER_PAGE + USERS_PER_PAGE
  )

  return (
    <div className="grid gap-6 md:grid-cols-2 items-start">
      <div>
        <h2 className="text-xl font-semibold mb-3">Create User</h2>
        <div className="bg-white overflow-y-auto max-h-96">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
            className="grid gap-3"
          >
            <Input
              label="First name"
              value={formData.firstname}
              onChange={(v) => {
                setFormData((s) => ({ ...s, firstname: v }))
                setFormErrors((e) => ({ ...e, firstname: undefined }))
              }}
            />
            {formErrors.firstname && (
              <p className="text-red-500">{formErrors.firstname}</p>
            )}
            <Input
              label="Last name"
              value={formData.lastname}
              onChange={(v) => {
                setFormData((s) => ({ ...s, lastname: v }))
                setFormErrors((e) => ({ ...e, lastname: undefined }))
              }}
            />
            {formErrors.lastname && (
              <p className="text-red-500">{formErrors.lastname}</p>
            )}
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(v) => {
                setFormData((s) => ({ ...s, email: v }))
                setFormErrors((e) => ({ ...e, email: undefined }))
              }}
            />
            {formErrors.email && (
              <p className="text-red-500">{formErrors.email}</p>
            )}
            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(v) => {
                setFormData((s) => ({ ...s, password: v }))
                setFormErrors((e) => ({ ...e, password: undefined }))
              }}
            />
            {formErrors.password && (
              <p className="text-red-500">{formErrors.password}</p>
            )}
            <Input
              label="Contact"
              value={formData.contact}
              onChange={(v) => {
                setFormData((s) => ({ ...s, contact: v }))
                setFormErrors((e) => ({ ...e, contact: undefined }))
              }}
            />
            {formErrors.contact && (
              <p className="text-red-500">{formErrors.contact}</p>
            )}
            {/* NEW: Role dropdown (admin-only usability; harmless when using public register) */}
            <label className="block">
              <span className="block text-sm font-medium mb-1">Role</span>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData((s) => ({
                    ...s,
                    role: e.target.value as 'customer' | 'employee',
                  }))
                }
                className="w-full border rounded-lg px-3 py-2 outline-none bg-white"
              >
                <option value="customer">Customer</option>
                <option value="employee">Staff</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-litratoblack text-white p-2 rounded font-bold"
              >
                Save
              </button>
            </div>
            {error && <p className="text-red-600 mt-2">{error}</p>}
          </form>
        </div>
      </div>

      {/* --- right column table of users --- */}
      <div className="flex flex-col">
        <h2 className="text-xl font-semibold mb-3">Users</h2>
        <div className="bg-white rounded-lg border overflow-auto max-h-[26rem]">
          {loadingUsers && <p className="text-gray-500">Loading users…</p>}
          {usersError && <p className="text-red-600">{usersError}</p>}
          {!loadingUsers && !usersError && (
            <>
              <table className="w-full text-left border-gray-200  overflow-hidden">
                <thead className="bg-gray-200 ">
                  <tr>
                    <Th className="">First</Th>
                    <Th>Last</Th>
                    <Th>Email</Th>
                    <Th className="">Role</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-4 text-gray-500"
                      >
                        No users found
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* CHANGED: map paginated users */}
                      {paginatedUsersRight.map((u) => (
                        <tr key={u.id} className="border-t">
                          <Td>{u.firstname}</Td>
                          <Td>{u.lastname}</Td>
                          <Td>{u.email}</Td>
                          <Td>{u.role ?? '—'}</Td>
                        </tr>
                      ))}
                      {/* NEW: filler rows to keep table height at 5 rows */}
                      {paginatedUsersRight.length < USERS_PER_PAGE &&
                        Array.from({
                          length: USERS_PER_PAGE - paginatedUsersRight.length,
                        }).map((_, i) => (
                          <tr key={`filler-${i}`} className="border-t">
                            <td colSpan={4} className="px-3 py-2 text-sm">
                              {/* spacer */}
                              <div className="h-4" />
                            </td>
                          </tr>
                        ))}
                    </>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* CHANGED: fixed at bottom of the column */}
        {!loadingUsers && !usersError && users.length > 0 && (
          <div className="mt-auto pt-3 px-2 pb-2">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    className="text-black no-underline hover:no-underline hover:text-black"
                    style={{ textDecoration: 'none' }}
                    onClick={(e) => {
                      e.preventDefault()
                      setUsersPage((p) => Math.max(1, p - 1))
                    }}
                  />
                </PaginationItem>

                {usersWindowPages.map((n) => (
                  <PaginationItem key={n}>
                    <PaginationLink
                      href="#"
                      isActive={n === usersPage}
                      className="text-black no-underline hover:no-underline hover:text-black"
                      style={{ textDecoration: 'none' }}
                      onClick={(e) => {
                        e.preventDefault()
                        setUsersPage(n)
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
                      setUsersPage((p) => Math.min(usersTotalPages, p + 1))
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  const isPassword = type === 'password'
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!isPassword || value === '') setIsVisible(false)
  }, [isPassword, value])

  const inputType = isPassword && isVisible ? 'text' : type

  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <div className="relative flex items-center">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border rounded-lg px-3 py-2 outline-none${
            isPassword ? ' pr-10' : ''
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setIsVisible((prev) => !prev)}
            className="absolute right-3 text-gray-600"
            aria-label={isVisible ? 'Hide password' : 'Show password'}
          >
            {isVisible ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
    </label>
  )
}
/* UI table helpers (pruned unused components) */
function Th({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th className={`px-3 py-2 text-sm font-semibold ${className}`}>
      {children}
    </th>
  )
}
function Td({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={`px-3 py-2 text-sm ${className}`}>{children}</td>
}
