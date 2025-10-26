'use client'
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  MoreHorizontal as Ellipsis,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
} from 'lucide-react'
// Grid Admin helpers (extracted API logic)
import createGridAdmin, {
  type GridRow as AdminGridRow,
} from '../../../../schemas/functions/InventoryAdmin/createGrid'
import {
  loadActiveGrids,
  loadArchivedGrids,
} from '../../../../schemas/functions/InventoryAdmin/loadGridsAdmin'
import updateGridAdmin from '../../../../schemas/functions/InventoryAdmin/updateGrid'
import {
  archiveGrid,
  unarchiveGrid,
} from '../../../../schemas/functions/InventoryAdmin/archivedGrid'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
// Removed unused PromoCard-based rendering; using internal SimplePackageCard instead
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
// Shared types hoisted for stability
type TabKey = 'equipment' | 'package' | 'grid' | 'logitems'
type EquipmentTabKey = 'available' | 'unavailable'
type EquipmentRow = {
  id: string
  name: string
  type: string
  condition: string
  status: EquipmentTabKey
  moreDetails: string
  last_date_checked: string
  notes: string
  created_at: string
  last_updated: string
}

// Default equipment type options
const DEFAULT_EQUIPMENT_TYPES = [
  'Camera',
  'Tripod',
  'Lighting',
  'Backdrop',
  'Printer',
  'Prop',
  'Speech bubble',
  'Frame',
  'Electronics',
]

//<------------------------ Add Type button component----------[ Part of Add Equipment ]------------------------->
const AddTypeButton = ({ onAdd }: { onAdd: (type: string) => void }) => {
  const [adding, setAdding] = React.useState(false)
  const [value, setValue] = React.useState('')

  const normalize = (v: string) => {
    const trimmed = v.trim()
    if (!trimmed) return ''
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }
  const commit = () => {
    const v = normalize(value)
    if (!v) return
    onAdd(v)
    setValue('')
    setAdding(false)
  }
  return (
    <div className="flex items-center">
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            className="h-9 w-28 rounded border bg-background px-2 text-xs"
            placeholder="New type"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') {
                setAdding(false)
                setValue('')
              }
            }}
          />
          <button
            type="button"
            className="rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:opacity-90"
            onClick={commit}
          >
            Add
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1 text-[10px] hover:bg-muted"
            onClick={() => {
              setAdding(false)
              setValue('')
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="h-9 whitespace-nowrap rounded border px-2 text-xs font-medium hover:bg-muted"
          onClick={() => setAdding(true)}
          title="Add new equipment type"
        >
          New
        </button>
      )}
    </div>
  )
}

// Removed unused FILTER_OPTIONS

// NEW: helper to build a 3-page window like {1,2,3}, {4,5,6}, etc.
function pageWindow(current: number, total: number, size = 3): number[] {
  if (total <= 0) return []
  const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1
  const end = Math.min(total, start + size - 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default function InventoryManagementPage() {
  const [active, setActive] = useState<TabKey>('equipment')
  // Search state (mirrors AdminAccountManagementPage): input value + debounced applied term
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Debounce: apply searchTerm 500ms after last keystroke
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === searchTerm) return
    const id = setTimeout(() => setSearchTerm(trimmed), 500)
    return () => clearTimeout(id)
  }, [searchInput, searchTerm])

  // NEW: memoize heavy panels so typing in the search box doesn't re-render them
  const equipmentPanelEl = useMemo(
    () => <CreateEquipmentPanel searchTerm={searchTerm} />,
    [searchTerm, CreateEquipmentPanel]
  )
  const packagePanelEl = useMemo(
    () => <CreatePackagePanel searchTerm={searchTerm} />,
    [searchTerm, CreatePackagePanel]
  )
  const gridPanelEl = useMemo(
    () => <GridPanel searchTerm={searchTerm} />,
    [searchTerm, GridPanel]
  )
  const itemLogsPanelEl = useMemo(
    () => <ItemLogsPanel searchTerm={searchTerm} />,
    [searchTerm, ItemLogsPanel]
  )

  return (
    <>
      <div className="h-screen flex flex-col p-4 min-h-0">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Inventory</h1>
        </header>
        <nav className="flex gap-2  mb-6">
          <TabButton
            active={active === 'equipment'}
            onClick={() => setActive('equipment')}
          >
            Equipments
          </TabButton>
          <TabButton
            active={active === 'package'}
            onClick={() => setActive('package')}
          >
            Packages
          </TabButton>
          <TabButton
            active={active === 'grid'}
            onClick={() => setActive('grid')}
          >
            Grid
          </TabButton>
          <TabButton
            active={active === 'logitems'}
            onClick={() => setActive('logitems')}
          >
            Item Logs
          </TabButton>

          <div className="flex-grow flex">
            {/* Search similar to AdminAccountManagementPage: controlled input + debounce; submit applies immediately */}
            <form
              className="w-1/4 bg-gray-400 rounded-full items-center flex px-1 py-1"
              onSubmit={(e) => {
                e.preventDefault()
                setSearchTerm(searchInput.trim())
              }}
            >
              <input
                type="text"
                placeholder="Search items by ID, Name, Type, Condition..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="bg-transparent outline-none w-full px-2 h-8"
              />
            </form>
          </div>
        </nav>
        <section className="bg-white h-125 rounded-xl shadow p-4 flex flex-col min-h-0">
          {active === 'equipment' && equipmentPanelEl}
          {active === 'package' && packagePanelEl}
          {active === 'grid' && gridPanelEl}
          {active === 'logitems' && itemLogsPanelEl}
          {/* NEW */}
        </section>
      </div>
    </>
  )

  // Panels
  function CreateEquipmentPanel({ searchTerm }: { searchTerm?: string }) {
    const [active, setActive] = useState<EquipmentTabKey>('available')
    const [items, setItems] = useState<EquipmentRow[]>([])
    const [equipmentTypes, setEquipmentTypes] = useState<string[]>(
      DEFAULT_EQUIPMENT_TYPES
    )
    // API base (override via .env.local NEXT_PUBLIC_API_ORIGIN=http://localhost:5000)
    const API_ORIGIN =
      process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
    const API_BASE = `${API_ORIGIN}/api/admin`

    // small helpers
    const getCookie = (name: string) =>
      typeof document === 'undefined'
        ? ''
        : document.cookie
            .split('; ')
            .find((r) => r.startsWith(name + '='))
            ?.split('=')[1] || ''

    // CHANGED: align with AccountManager -> use "access_token" and ensure Bearer prefix
    const getAuthHeaderString = useCallback(() => {
      const raw =
        (typeof window !== 'undefined' &&
          localStorage.getItem('access_token')) ||
        getCookie('access_token')
      if (!raw) return ''
      return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`
    }, [])

    const getAuthHeaders = useCallback((): Record<string, string> => {
      const auth = getAuthHeaderString()
      return auth ? { Authorization: auth } : {}
    }, [getAuthHeaderString])
    const mapItem = (it: Record<string, unknown>): EquipmentRow => ({
      id: String(it.id ?? ''),
      name: String((it as { material_name?: unknown }).material_name ?? ''),
      type: String((it as { material_type?: unknown }).material_type ?? ''),
      condition: String((it as { condition?: unknown }).condition ?? ''),
      status: ((it as { status?: unknown }).status
        ? 'available'
        : 'unavailable') as EquipmentTabKey,
      moreDetails: 'View',
      last_date_checked: String(
        (it as { last_date_checked?: unknown }).last_date_checked ?? ''
      ),
      notes: String((it as { notes?: unknown }).notes ?? ''),
      created_at: String((it as { created_at?: unknown }).created_at ?? ''),
      last_updated: String(
        (it as { last_updated?: unknown }).last_updated ?? ''
      ),
    })

    // load from backend
    useEffect(() => {
      let ignore = false
      ;(async () => {
        try {
          console.log('API_BASE', API_BASE)
          const res = await fetch(`${API_BASE}/inventory`, {
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
          })
          if (res.status === 401)
            throw new Error('Unauthorized. Please log in.')
          if (res.status === 403)
            throw new Error('Forbidden: Admin role required.')
          if (!res.ok) throw new Error(`GET /inventory ${res.status}`)
          const data = await res.json()
          if (!ignore) setItems((data.items ?? data ?? []).map(mapItem))
        } catch (e) {
          console.error('Load inventory failed:', e)
        }
      })()
      return () => {
        ignore = true
      }
    }, [API_BASE, getAuthHeaders])

    // Form state for the Add Equipment modal
    const [form, setForm] = useState({
      id: '',
      name: '',
      type: '',
      condition: '',
      status: 'available' as EquipmentTabKey,
      last_date_checked: '',
      notes: '',
      created_at: '',
      last_updated: '',
    })
    const updateForm = <K extends keyof typeof form>(
      key: K,
      value: (typeof form)[K]
    ) => setForm((prev) => ({ ...prev, [key]: value }))
    const handleCreate = async () => {
      try {
        // Basic validation: require name and type selection
        if (!form.name.trim() || !form.type.trim()) {
          console.warn('Name and Type are required to create equipment')
          return
        }
        const body = {
          materialName: form.name.trim(),
          materialType: form.type.trim(),
          condition: form.condition.trim() || 'Good',
          status: form.status === 'available',
          lastDateChecked: new Date().toISOString(),
          notes: form.notes,
          display: true,
        }
        const res = await fetch(`${API_BASE}/inventory`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`POST /inventory ${res.status}`)
        const data = await res.json()
        if (data.item) setItems((prev) => [...prev, mapItem(data.item)])
      } catch (e) {
        console.error('Create inventory failed:', e)
      }
      // reset form
      setForm({
        id: '',
        name: '',
        type: '',
        condition: '',
        status: 'available',
        last_date_checked: '',
        notes: '',
        created_at: '',
        last_updated: '',
      })
    }

    // Generic form handlers to reduce inline functions
    const handleText = useCallback(
      (key: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setForm((prev) => ({ ...prev, [key]: e.target.value })),
      [setForm]
    )
    // removed unused handleNumber

    // Stable status update
    const updateStatus = useCallback(
      async (id: string, status: EquipmentTabKey) => {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status } : it))
        )
        try {
          const res = await fetch(`${API_BASE}/inventory/${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ status: status === 'available' }),
          })
          if (!res.ok) throw new Error(`PATCH /inventory/${id} ${res.status}`)
        } catch (e) {
          console.error('Update status failed:', e)
          setItems((prev) =>
            prev.map((it) =>
              it.id === id
                ? {
                    ...it,
                    status:
                      status === 'available' ? 'unavailable' : 'available',
                  }
                : it
            )
          )
        }
      },
      [API_BASE, getAuthHeaders]
    )

    const handleDelete = useCallback(
      async (id: string) => {
        const prev = items
        setItems((p) => p.filter((it) => it.id !== id))
        try {
          const res = await fetch(`${API_BASE}/inventory/${id}`, {
            method: 'DELETE',
            headers: { ...getAuthHeaders() },
          })
          if (!res.ok) throw new Error(`DELETE /inventory/${id} ${res.status}`)
        } catch (e) {
          console.error('Delete failed, restoring item:', e)
          setItems(prev)
        }
      },
      [items, API_BASE, getAuthHeaders]
    )

    // Columns defined once
    const columns = useMemo(
      () => [
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'condition', label: 'Condition' },
        { key: 'status', label: 'Status' },
        { key: 'moreDetails', label: 'More Details' },
        { key: 'actions', label: 'Actions' },
      ],
      []
    )

    // REPLACED: edit modal state now only tracks open + selected row; form lives inside the dialog component
    const [editOpen, setEditOpen] = useState(false)
    const [editRow, setEditRow] = useState<EquipmentRow | null>(null)

    const openEditModal = (row: EquipmentRow) => {
      setEditRow(row)
      setEditOpen(true)
    }

    // NEW: API update + local state sync for edited equipment
    const updateEquipment = async (id: string, form: Partial<EquipmentRow>) => {
      // Map partial form -> backend snake_case fields, include only provided keys
      const updates: Partial<{
        material_name: string
        material_type: string
        condition: string
        notes: string
      }> = {}
      if (form.name !== undefined)
        updates.material_name = String(form.name).trim()
      if (form.type !== undefined)
        updates.material_type = String(form.type).trim()
      // quantity fields removed from schema; ignore any legacy fields
      if (form.condition !== undefined)
        updates.condition = String(form.condition).trim() || 'Good'
      if (form.notes !== undefined) updates.notes = form.notes ?? ''

      // If nothing to update, skip request
      if (Object.keys(updates).length === 0) return

      try {
        const res = await fetch(`${API_BASE}/inventory/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(updates),
        })
        if (!res.ok) throw new Error(`PATCH /inventory/${id} ${res.status}`)

        // Prefer server-updated row to avoid drift
        let nextRow: EquipmentRow | null = null
        try {
          const data = await res.json()
          const updated = (data && (data.item || data)) ?? null
          if (updated && updated.id !== undefined) {
            nextRow = mapItem(updated)
          }
        } catch {
          // ignore body parse errors; fallback to local merge
        }

        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id) return it
            if (nextRow) return nextRow
            // Fallback: apply local updates to current row
            return {
              ...it,
              ...(updates.material_name !== undefined && {
                name: updates.material_name,
              }),
              ...(updates.material_type !== undefined && {
                type: updates.material_type,
              }),
              // quantity fields removed
              ...(updates.condition !== undefined && {
                condition: updates.condition,
              }),
              ...(updates.notes !== undefined && { notes: updates.notes }),
            }
          })
        )
      } catch (e) {
        console.error('Edit equipment failed:', e)
      }
    }

    // Search filter: id, type, name, condition
    const normalizedSearch = (searchTerm || '').trim().toLowerCase()
    const filteredItems = useMemo(() => {
      if (!normalizedSearch) return items
      return items.filter((it) => {
        const id = (it.id || '').toString().toLowerCase()
        const name = (it.name || '').toLowerCase()
        const type = (it.type || '').toLowerCase()
        const condition = (it.condition || '').toLowerCase()
        return (
          id.includes(normalizedSearch) ||
          name.includes(normalizedSearch) ||
          type.includes(normalizedSearch) ||
          condition.includes(normalizedSearch)
        )
      })
    }, [items, normalizedSearch])

    // Memoized filtered rows
    const availableRows = useMemo(
      () => filteredItems.filter((it) => it.status === 'available'),
      [filteredItems]
    )
    const unavailableRows = useMemo(
      () => filteredItems.filter((it) => it.status === 'unavailable'),
      [filteredItems]
    )

    // NEW: pagination state + derived slices (5 per page)
    const PER_PAGE = 5
    const [pageAvail, setPageAvail] = useState(1)
    const [pageUnavail, setPageUnavail] = useState(1)
    const totalPagesAvail = Math.max(
      1,
      Math.ceil(availableRows.length / PER_PAGE)
    )
    const totalPagesUnavail = Math.max(
      1,
      Math.ceil(unavailableRows.length / PER_PAGE)
    )

    useEffect(() => {
      setPageAvail((p) => Math.min(Math.max(1, p), totalPagesAvail))
    }, [totalPagesAvail])
    useEffect(() => {
      setPageUnavail((p) => Math.min(Math.max(1, p), totalPagesUnavail))
    }, [totalPagesUnavail])

    const paginatedAvailableRows = useMemo(() => {
      const start = (pageAvail - 1) * PER_PAGE
      return availableRows.slice(start, start + PER_PAGE)
    }, [availableRows, pageAvail])

    const paginatedUnavailableRows = useMemo(() => {
      const start = (pageUnavail - 1) * PER_PAGE
      return unavailableRows.slice(start, start + PER_PAGE)
    }, [unavailableRows, pageUnavail])

    return (
      <>
        {/* make panel fill parent and allow inner area to push pagination to bottom */}
        <div className="flex flex-col h-full min-h-0">
          <div className="flex justify-between border-b-2 border-black">
            <div className="flex flex-row gap-4 ">
              <h2>Equipment</h2>
              <div className="flex gap-2 mb-2">
                <TabButton
                  active={active === 'available'}
                  onClick={() => setActive('available')}
                >
                  Available
                </TabButton>
                <TabButton
                  active={active === 'unavailable'}
                  onClick={() => setActive('unavailable')}
                >
                  Unavailable
                </TabButton>
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  className="bg-litratoblack text-white p-2 mb-2 rounded"
                >
                  Add Equipment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[640px] max-h-[70vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Add Equipment</DialogTitle>
                  <DialogDescription>
                    Provide the details for the new equipment.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto p-2">
                  <form
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        className="h-9 rounded-md border px-3 text-sm outline-none "
                        placeholder="e.g. Camera"
                        value={form.name}
                        onChange={handleText('name')}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">Type</label>
                      <div className="flex gap-2">
                        <Select
                          value={form.type}
                          onValueChange={(value) => updateForm('type', value)}
                        >
                          <SelectTrigger className="h-9 text-sm rounded w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 overflow-auto">
                            {equipmentTypes.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <AddTypeButton
                          onAdd={(newType) => {
                            setEquipmentTypes((prev) => {
                              if (prev.includes(newType)) return prev
                              return [...prev, newType]
                            })
                            updateForm('type', newType)
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">Condition</label>
                      <Select
                        value={form.condition}
                        onValueChange={(value) =>
                          updateForm('condition', value)
                        }
                      >
                        <SelectTrigger className="h-9 text-sm rounded">
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Good">Good</SelectItem>
                          <SelectItem value="Damaged">Damaged</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Quantity fields removed */}

                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        value={form.status}
                        onValueChange={(value) =>
                          updateForm('status', value as EquipmentTabKey)
                        }
                      >
                        <SelectTrigger className="h-9 text-sm rounded">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="unavailable">
                            Unavailable
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea
                        rows={2}
                        className="rounded-md border px-3 py-2 text-sm outline-none "
                        value={form.notes}
                        onChange={handleText('notes')}
                      />
                    </div>
                  </form>
                </div>
                <DialogFooter className="mt-2">
                  <DialogClose asChild>
                    <Button
                      type="button"
                      className="px-4 py-2 rounded border"
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      className="px-4 py-2 rounded bg-litratoblack text-white"
                      onClick={handleCreate}
                    >
                      Create
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <section className="mt-4 flex-1 min-h-0 flex flex-col">
            {active === 'available' && (
              <AvailableEquipmentPanel
                rows={paginatedAvailableRows}
                currentPage={pageAvail}
                totalPages={totalPagesAvail}
                onPageChange={setPageAvail}
              />
            )}
            {active === 'unavailable' && (
              <UnavailableEquipmentPanel
                rows={paginatedUnavailableRows}
                currentPage={pageUnavail}
                totalPages={totalPagesUnavail}
                onPageChange={setPageUnavail}
              />
            )}
          </section>
        </div>

        {/* NEW: single dialog instance outside the table. Local form state is contained in the dialog component. */}
        <EditEquipmentDialog
          open={editOpen}
          row={editRow}
          onOpenChange={(open) => {
            setEditOpen(open)
            if (!open) setEditRow(null)
          }}
          onSave={async (form) => {
            if (!editRow) return
            await updateEquipment(editRow.id, form)
            setEditOpen(false)
            setEditRow(null)
          }}
        />
      </>
    )

    // Equipment table components (internal, purely for deduping)
    function StatusSelect({
      value,
      onChange,
      triggerClassName,
    }: {
      value: EquipmentTabKey
      onChange: (v: EquipmentTabKey) => void
      triggerClassName: string
    }) {
      return (
        <Select
          value={value}
          onValueChange={(v) => onChange(v as EquipmentTabKey)}
        >
          <SelectTrigger className={triggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    function MoreDetailsCell({ row }: { row: EquipmentRow }) {
      // Readable format for Date and Time values - More details popover
      const formatDateTime = (value: unknown): string => {
        if (!value) return '—'
        // handle number timestamps and ISO strings
        let d =
          typeof value === 'number' ? new Date(value) : new Date(String(value))
        if (isNaN(d.getTime())) {
          const n = Number(value)
          if (Number.isFinite(n)) {
            const d2 = new Date(n)
            if (!isNaN(d2.getTime())) d = d2
          }
        }
        if (isNaN(d.getTime())) return String(value)
        try {
          return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(d)
        } catch {
          return d.toLocaleString()
        }
      }
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="More details"
              className="inline-flex items-center justify-center rounded border px-2 py-1 bg-gray-100 hover:bg-gray-200"
            >
              <Ellipsis className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 text-sm">
            <div className="space-y-1">
              <div>
                <span className="font-medium">Last checked: </span>
                <time dateTime={String(row.last_date_checked)}>
                  {formatDateTime(row.last_date_checked)}
                </time>
              </div>
              <div>
                <span className="font-medium">Notes: </span>
                {row.notes}
              </div>
              <div>
                <span className="font-medium">Created: </span>
                <time dateTime={String(row.created_at)}>
                  {formatDateTime(row.created_at)}
                </time>
              </div>
              <div>
                <span className="font-medium">Updated: </span>
                <time dateTime={String(row.last_updated)}>
                  {formatDateTime(row.last_updated)}
                </time>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )
    }

    function EquipmentTable({
      rows,
      triggerClassName,
      currentPage,
      totalPages,
      onPageChange,
    }: {
      rows: EquipmentRow[]
      triggerClassName: string
      currentPage: number
      totalPages: number
      onPageChange: (p: number) => void
    }) {
      const goTo = (p: number) =>
        onPageChange(Math.min(Math.max(1, p), totalPages))
      // CHANGED: only show a 3-page window
      const windowPages = useMemo(
        () => pageWindow(currentPage, totalPages, 3),
        [currentPage, totalPages]
      )

      return (
        <>
          {/* table area scrolls; pagination stays at bottom */}
          <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 min-h-0 overflow-auto rounded-t-md border">
              <Table className="w-full table-auto">
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead
                        key={col.key}
                        className="px-4 py-2 whitespace-nowrap text-left bg-gray-200"
                      >
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="text-left even:bg-gray-50"
                    >
                      {columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className="px-4 py-2 whitespace-nowrap"
                        >
                          {col.key === 'status' ? (
                            <div className="inline-block">
                              <StatusSelect
                                value={row.status}
                                onChange={(v) => updateStatus(row.id, v)}
                                triggerClassName={triggerClassName}
                              />
                            </div>
                          ) : col.key === 'moreDetails' ? (
                            <MoreDetailsCell row={row} />
                          ) : col.key === 'actions' ? (
                            <div className="flex gap-2 items-center">
                              <button
                                type="button"
                                onClick={() => openEditModal(row)}
                                aria-label={`Edit ${row.name}`}
                                title="Edit"
                                className="inline-flex justify-center rounded-full text-litratoblack hover:text-black"
                              >
                                <Pencil />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row.id)}
                                aria-label={`Delete ${row.name}`}
                                title="Delete"
                                className="inline-flex justify-center rounded-full text-litratored hover:text-red-600"
                              >
                                <Trash2 />
                              </button>
                            </div>
                          ) : (
                            String(
                              row[
                                col.key as keyof EquipmentRow
                              ] as unknown as string
                            )
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination pinned at bottom of panel */}
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
                        goTo(currentPage - 1)
                      }}
                    />
                  </PaginationItem>

                  {windowPages.map((n) => (
                    <PaginationItem key={n}>
                      <PaginationLink
                        href="#"
                        isActive={n === currentPage}
                        style={{ textDecoration: 'none' }}
                        className="text-black no-underline hover:no-underline hover:text-black"
                        onClick={(e) => {
                          e.preventDefault()
                          goTo(n)
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
                        goTo(currentPage + 1)
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </>
      )
    }

    function AvailableEquipmentPanel(props: {
      rows: EquipmentRow[]
      currentPage: number
      totalPages: number
      onPageChange: (p: number) => void
    }) {
      return (
        <EquipmentTable
          rows={props.rows}
          triggerClassName=" text-sm rounded"
          currentPage={props.currentPage}
          totalPages={props.totalPages}
          onPageChange={props.onPageChange}
        />
      )
    }
    function UnavailableEquipmentPanel(props: {
      rows: EquipmentRow[]
      currentPage: number
      totalPages: number
      onPageChange: (p: number) => void
    }) {
      return (
        <EquipmentTable
          rows={props.rows}
          triggerClassName="h-9 rounded text-sm"
          currentPage={props.currentPage}
          totalPages={props.totalPages}
          onPageChange={props.onPageChange}
        />
      )
    }

    // NEW: Self-contained edit dialog with local form state to prevent parent/table re-renders while typing
    function EditEquipmentDialog({
      open,
      row,
      onOpenChange,
      onSave,
    }: {
      open: boolean
      row: EquipmentRow | null
      onOpenChange: (open: boolean) => void
      onSave: (form: Partial<EquipmentRow>) => void | Promise<void>
    }) {
      const [form, setForm] = useState<Partial<EquipmentRow>>({})

      useEffect(() => {
        if (open && row) {
          setForm({
            name: row.name,
            type: row.type,
            // quantity fields removed
            condition: row.condition,
            notes: row.notes,
          })
        }
      }, [open, row])

      const handleChange =
        <K extends keyof EquipmentRow>(key: K) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          const value =
            e.target instanceof HTMLInputElement && e.target.type === 'number'
              ? Number(e.target.value)
              : e.target.value
          setForm((p) => ({ ...p, [key]: value }))
        }

      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[640px] max-h-[70vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit Equipment</DialogTitle>
              <DialogDescription>
                Edit the details of this equipment.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              <form
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    className="h-9 rounded-md border px-3 text-sm outline-none"
                    placeholder="e.g. Camera"
                    value={(form.name as string) ?? ''}
                    onChange={handleChange('name')}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Type</label>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={(form.type as string) ?? ''}
                      onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}
                    >
                      <SelectTrigger className="h-9 text-sm rounded w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {equipmentTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <AddTypeButton
                      onAdd={(newType) => {
                        setEquipmentTypes((prev) => {
                          if (prev.includes(newType)) return prev
                          return [...prev, newType]
                        })
                        setForm((p) => ({ ...p, type: newType }))
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Condition</label>
                  <Select
                    value={(form.condition as string) ?? ''}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, condition: v }))
                    }
                  >
                    <SelectTrigger className="h-9 text-sm rounded">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Quantity fields removed from edit dialog */}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    rows={2}
                    className="rounded-md border px-3 py-2 text-sm outline-none"
                    value={(form.notes as string) ?? ''}
                    onChange={handleChange('notes')}
                  />
                </div>
              </form>
            </div>
            <DialogFooter className="mt-2">
              <DialogClose asChild>
                <Button
                  type="button"
                  className="px-4 py-2 rounded border"
                  variant="outline"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                className="px-4 py-2 rounded bg-litratoblack text-white"
                onClick={() => onSave(form)}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
    }
  }

  // Grid panel with header and API helpers
  function GridPanel({ searchTerm }: { searchTerm?: string }) {
    const [view, setView] = useState<'active' | 'archived'>('active')
    const [open, setOpen] = useState(false)
    const [grids, setGrids] = useState<AdminGridRow[]>([])
    const [archived, setArchived] = useState<AdminGridRow[]>([])
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState<{
      grid_name: string
      imageFile: File | null
    }>({ grid_name: '', imageFile: null })
    const [editOpen, setEditOpen] = useState(false)
    const [editForm, setEditForm] = useState<{
      id: number | null
      grid_name: string
      imageFile: File | null
      image_url: string | null
    }>({ id: null, grid_name: '', imageFile: null, image_url: null })

    // Load lists
    useEffect(() => {
      let ignore = false
      ;(async () => {
        try {
          setLoading(true)
          if (view === 'active') {
            const rows = await loadActiveGrids()
            if (!ignore) setGrids(rows)
          } else {
            const rows = await loadArchivedGrids()
            if (!ignore) setArchived(rows)
          }
        } catch (e) {
          console.error('Load grids failed:', e)
        } finally {
          setLoading(false)
        }
      })()
      return () => {
        ignore = true
      }
    }, [view])

    // Create grid
    const handleCreateGrid = async () => {
      const name = form.grid_name.trim()
      if (!name) return
      try {
        const row = await createGridAdmin({
          grid_name: name,
          status: true,
          display: true,
          imageFile: form.imageFile ?? undefined,
        })
        setGrids((prev) => [row, ...prev])
        setOpen(false)
        setForm({ grid_name: '', imageFile: null })
      } catch (e) {
        console.error('Create grid failed:', e)
      }
    }

    // Archive/unarchive
    const toggleArchive = async (row: AdminGridRow) => {
      const isArchived = row.display === false
      try {
        if (isArchived) {
          await unarchiveGrid(Number(row.id))
          // move to active
          setArchived((arr) => arr.filter((g) => g.id !== row.id))
          setGrids((arr) => [{ ...row, display: true }, ...arr])
          if (view === 'archived') setView('active')
        } else {
          await archiveGrid(Number(row.id))
          // move to archived
          setGrids((arr) => arr.filter((g) => g.id !== row.id))
          setArchived((arr) => [{ ...row, display: false }, ...arr])
        }
      } catch (e) {
        console.error('Toggle archive grid failed:', e)
      }
    }

    const list = view === 'active' ? grids : archived
    const q = (searchTerm || '').trim().toLowerCase()
    const filtered = useMemo(() => {
      if (!q) return list
      return list.filter((g) => (g.grid_name || '').toLowerCase().includes(q))
    }, [list, q])

    const openEditGrid = (row: AdminGridRow) => {
      setEditForm({
        id: Number(row.id),
        grid_name: row.grid_name || '',
        imageFile: null,
        image_url: row.image_url ?? null,
      })
      setEditOpen(true)
    }

    const saveEditedGrid = async () => {
      const id = editForm.id
      if (!id) return
      try {
        const updated = await updateGridAdmin(id, {
          grid_name: editForm.grid_name,
          imageFile: editForm.imageFile ?? undefined,
        })
        // replace in both arrays to avoid desync
        setGrids((arr) => arr.map((g) => (Number(g.id) === id ? updated : g)))
        setArchived((arr) =>
          arr.map((g) => (Number(g.id) === id ? updated : g))
        )
        setEditOpen(false)
      } catch (e) {
        console.error('Save edited grid failed:', e)
      }
    }

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex justify-between border-b-2 border-black items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Grid</h2>
            <div className="flex gap-2 mb-2">
              <TabButton
                active={view === 'active'}
                onClick={() => setView('active')}
              >
                Active
              </TabButton>
              <TabButton
                active={view === 'archived'}
                onClick={() => setView('archived')}
              >
                Archived
              </TabButton>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <div
              className="px-2 py-2 rounded bg-litratoblack text-white font-medium hover:opacity-90"
              onClick={() => setOpen(true)}
            >
              Add Grid
            </div>
            <DialogContent className="sm:max-w-lg">
              <div className="space-y-3">
                <div className="text-lg font-semibold">Add Grid</div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Name</label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={form.grid_name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, grid_name: e.target.value }))
                    }
                    placeholder="Enter grid name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Image</label>
                  <br />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        imageFile: e.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="px-3 py-1 rounded border text-sm"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded bg-litratoblack text-white text-sm"
                    onClick={handleCreateGrid}
                  >
                    Create
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-3">
          {loading ? (
            <div className="text-sm text-gray-500 text-center mt-8">
              Loading grids…
            </div>
          ) : filtered.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((g) => (
                <div
                  key={g.id}
                  className="relative border rounded-lg p-2 bg-gray-50"
                >
                  {/* Overlay icons top-right: update (archive/unarchive) then edit */}
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    {/* Edit first */}
                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-7 w-7 rounded bg-white/90 border shadow-sm hover:bg-white"
                      onClick={() => openEditGrid(g)}
                      title="Edit grid"
                      aria-label="Edit grid"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {/* Then archive/unarchive toggle */}
                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-7 w-7 rounded bg-white/90 border shadow-sm hover:bg-white"
                      onClick={() => toggleArchive(g)}
                      title={g.display === false ? 'Unarchive' : 'Archive'}
                      aria-label={g.display === false ? 'Unarchive' : 'Archive'}
                    >
                      {g.display === false ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {g.image_url ? (
                    <Image
                      src={g.image_url}
                      alt={g.grid_name}
                      width={400}
                      height={144}
                      className="w-full h-36 object-cover rounded"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      unoptimized
                    />
                  ) : null}
                  <div className="mt-2">
                    <div className="font-medium">{g.grid_name}</div>
                    <div className="text-xs text-gray-500">
                      {g.display === false
                        ? 'Archived'
                        : g.status
                        ? 'Active'
                        : 'Inactive'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center mt-8">
              No grids found.
            </div>
          )}
        </div>

        {/* Edit Grid Dialog */}
        <Dialog
          open={editOpen}
          onOpenChange={(o) => {
            if (!o) setEditOpen(false)
          }}
        >
          <DialogContent className="sm:max-w-[640px] max-h-[70vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit Grid</DialogTitle>
              <DialogDescription>Update grid details.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium">Name</label>
                  <Input
                    className="h-9 rounded-md border px-3 text-sm outline-none"
                    value={editForm.grid_name}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, grid_name: e.target.value }))
                    }
                    placeholder="Enter grid name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium">Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        imageFile: e.target.files?.[0] || null,
                      }))
                    }
                  />
                  {editForm.image_url ? (
                    <div className="text-xs text-gray-500 truncate">
                      Current image: {editForm.image_url}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <DialogClose asChild>
                <Button
                  type="button"
                  className="px-4 py-2 rounded border"
                  variant="outline"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                className="px-4 py-2 rounded bg-litratoblack text-white"
                onClick={saveEditedGrid}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  function CreatePackagePanel({ searchTerm }: { searchTerm?: string }) {
    type PackageItem = {
      id: string
      name: string
      price: number
      imageUrl: string
      features: string[]
      durationHours?: number | null
      display?: boolean // ADDED: visibility flag
    }

    const [open, setOpen] = useState(false)
    const [packages, setPackages] = useState<PackageItem[]>([]) // active (display=true)
    const [archivedPackages, setArchivedPackages] = useState<PackageItem[]>([]) // archived (display=false)
    const [pkgView, setPkgView] = useState<'active' | 'archived'>('active')
    const [editPkgOpen, setEditPkgOpen] = useState(false)
    const [editPkgForm, setEditPkgForm] = useState<{
      id: string
      name: string
      price: number
      imageUrl: string
      features: string[]
      durationHours?: number | null
    }>({
      id: '',
      name: '',
      price: 0,
      imageUrl: '',
      features: [],
      durationHours: undefined,
    })
    const [pkgForm, setPkgForm] = useState<{
      name: string
      price: number
      imageUrl: string
      imageName: string
      features: string[]
      durationHours?: number | null
    }>({
      name: '',
      price: 0,
      imageUrl: '',
      imageName: '',
      features: [''],
      durationHours: undefined,
    })

    const fileInputRef = useRef<HTMLInputElement | null>(null)

    // ADD: API + auth helpers reused from equipment panel
    const API_ORIGIN =
      process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
    const API_BASE = `${API_ORIGIN}/api/admin`
    const getCookie = (name: string) =>
      typeof document === 'undefined'
        ? ''
        : document.cookie
            .split('; ')
            .find((r) => r.startsWith(name + '='))
            ?.split('=')[1] || ''
    const getAuthHeaderString = () => {
      const raw =
        (typeof window !== 'undefined' &&
          localStorage.getItem('access_token')) ||
        getCookie('access_token')
      if (!raw) return ''
      return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`
    }
    const getAuthHeaders = useCallback((): Record<string, string> => {
      const auth = getAuthHeaderString()
      return auth ? { Authorization: auth } : {}
    }, [])

    // ADD: load inventory to pick items for the package
    type InvPick = {
      id: string
      name: string
    }
    const [inventory, setInventory] = useState<InvPick[]>([])
    const [selected, setSelected] = useState<Record<string, number>>({}) // inventory_id -> qty

    // NEW: edit selection map (inventory_id -> qty)
    const [editSelected, setEditSelected] = useState<Record<string, number>>({})

    useEffect(() => {
      let ignore = false
      ;(async () => {
        try {
          const res = await fetch(`${API_BASE}/inventory`, {
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
          })
          if (!res.ok) throw new Error(`GET /inventory ${res.status}`)
          const data = await res.json()
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data.items)
            ? data.items
            : []
          const items = list.map((it: unknown) => {
            const rec = it as Record<string, unknown>
            return {
              id: String(rec.id ?? ''),
              name: String(
                (rec as { material_name?: unknown }).material_name ?? ''
              ),
              // quantities removed from schema
            }
          })
          if (!ignore) setInventory(items)
        } catch (e) {
          console.error('Load inventory for packages failed:', e)
        }
      })()
      return () => {
        ignore = true
      }
    }, [API_BASE, getAuthHeaders])

    const toggleItem = (id: string, on: boolean) =>
      setSelected((prev) => {
        const next = { ...prev }
        if (on) next[id] = 1
        else delete next[id]
        return next
      })

    const handleCreatePackage = async () => {
      const name = pkgForm.name.trim()
      if (!name) return

      try {
        // 1) Create the package
        const pRes = await fetch(`${API_BASE}/package`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            package_name: name,
            description: pkgForm.features
              .map((f) => f.trim())
              .filter(Boolean)
              .join('\n'),
            price: Number(pkgForm.price) || 0,
            duration_hours:
              pkgForm.durationHours == null
                ? null
                : Number(pkgForm.durationHours) || 0,
            status: true,
            display: true,
            image_url: pkgForm.imageUrl,
          }),
        })
        if (!pRes.ok) throw new Error(await pRes.text())
        const pData = await pRes.json()
        const created = pData?.package ?? pData
        const pkgId = created?.id
        if (!pkgId) throw new Error('Package created but id missing')

        // 2) Create junction rows for selected inventory items
        const ids = Object.keys(selected)
        if (ids.length) {
          await Promise.all(
            ids.map((inventory_id) =>
              fetch(`${API_BASE}/package-inventory-item`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...getAuthHeaders(),
                },
                body: JSON.stringify({
                  package_id: Number(pkgId),
                  inventory_id: Number(inventory_id),
                  quantity: 1,
                }),
              }).then(async (r) => {
                if (!r.ok) throw new Error(await r.text())
              })
            )
          )
        }

        // 3) Update local UI list using the same mapper
        const newPkg = mapPackageFromApi({
          ...(created || {}),
          package_name: name,
          price: Number(pkgForm.price) || 0,
          image_url: pkgForm.imageUrl,
          description: pkgForm.features.join('\n'),
          duration_hours:
            pkgForm.durationHours == null
              ? null
              : Number(pkgForm.durationHours) || 0,
        })
        setPackages((prev) => [newPkg, ...prev])
      } catch (e) {
        console.error('Create package (with items) failed:', e)
      }

      // reset & close
      setPkgForm({
        name: '',
        price: 0,
        imageUrl: '',
        imageName: '',
        features: [''],
        durationHours: undefined,
      })
      setSelected({})
      if (fileInputRef.current) fileInputRef.current.value = ''
      setOpen(false)
    }

    // Map API -> UI model (memoized)
    const mapPackageFromApi = useCallback(
      (it: Record<string, unknown>): PackageItem => {
        const description = (it as { description?: unknown }).description
        const features =
          typeof description === 'string'
            ? description
                .split(/\r?\n/)
                .map((s: string) => s.trim())
                .filter(Boolean)
            : Array.isArray((it as { features?: unknown }).features)
            ? ((it as { features?: unknown }).features as string[])
            : []
        return {
          id: String(
            (it as { id?: unknown }).id ??
              (it as { package_id?: unknown }).package_id ??
              ''
          ),
          name: String(
            (it as { package_name?: unknown }).package_name ??
              (it as { name?: unknown }).name ??
              ''
          ),
          price: Number((it as { price?: unknown }).price ?? 0),
          imageUrl: String(
            (it as { image_url?: unknown }).image_url ??
              (it as { imageUrl?: unknown }).imageUrl ??
              ''
          ),
          features,
          durationHours:
            (it as { duration_hours?: unknown }).duration_hours == null
              ? null
              : Number((it as { duration_hours?: unknown }).duration_hours) ||
                0,
          // ADDED: try common keys, default to true
          display:
            typeof (it as { display?: unknown }).display === 'boolean'
              ? ((it as { display?: unknown }).display as boolean)
              : typeof (it as { visible?: unknown }).visible === 'boolean'
              ? ((it as { visible?: unknown }).visible as boolean)
              : typeof (it as { is_visible?: unknown }).is_visible === 'boolean'
              ? ((it as { is_visible?: unknown }).is_visible as boolean)
              : typeof (it as { is_displayed?: unknown }).is_displayed ===
                'boolean'
              ? ((it as { is_displayed?: unknown }).is_displayed as boolean)
              : true,
        }
      },
      []
    )

    // Fetch existing packages (active) on mount
    useEffect(() => {
      let ignore = false
      ;(async () => {
        try {
          const res = await fetch(`${API_BASE}/package`, {
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
          })
          if (!res.ok) throw new Error(`GET /package ${res.status}`)
          const data = await res.json()
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data.packages)
            ? data.packages
            : Array.isArray(data.items)
            ? data.items
            : []
          if (!ignore) setPackages(list.map(mapPackageFromApi))
        } catch (e) {
          console.error('Load packages failed:', e)
        }
      })()
      return () => {
        ignore = true
      }
    }, [API_BASE, getAuthHeaders, mapPackageFromApi])

    // Fetch archived packages when panel first opens OR when switching to archived view and we haven't loaded yet
    useEffect(() => {
      if (pkgView !== 'archived') return
      // if we already loaded once skip
      if (archivedPackages.length) return
      let ignore = false
      ;(async () => {
        try {
          const res = await fetch(`${API_BASE}/package/archived`, {
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
          })
          if (!res.ok) throw new Error(`GET /package/archived ${res.status}`)
          const data = await res.json()
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data.packages)
            ? data.packages
            : []
          if (!ignore) setArchivedPackages(list.map(mapPackageFromApi))
        } catch (e) {
          console.error('Load archived packages failed:', e)
        }
      })()
      return () => {
        ignore = true
      }
    }, [
      pkgView,
      archivedPackages.length,
      API_BASE,
      getAuthHeaders,
      mapPackageFromApi,
    ])

    // Removed PromoCard-based rendering; using internal SimplePackageCard instead

    // Format PHP currency like the existing cards (e.g., ₱8,000)
    // Removed formatPrice (unused)

    // Removed buildPromoProps (unused)

    // NEW: Error boundary + safe fallback card to avoid `.map` on undefined inside PromoCard
    // Removed CardErrorBoundary used for PromoCard

    function SimplePackageCard({
      pkg,
      onToggleDisplay,
      onEdit,
    }: {
      pkg: PackageItem
      onToggleDisplay?: (pkg: PackageItem) => void
      onEdit?: (pkg: PackageItem) => void
    }) {
      const features = Array.isArray(pkg.features) ? pkg.features : []
      const hidden = pkg.display === false
      return (
        <div
          className={`relative border rounded-lg p-2 bg-gray-200 shadow-sm transition ${
            hidden ? 'opacity-60' : ''
          }`}
        >
          {pkg.imageUrl ? (
            <Image
              src={pkg.imageUrl}
              alt={pkg.name}
              width={600}
              height={160}
              className="w-full h-40 object-cover rounded"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized
            />
          ) : null}
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{pkg.name}</h3>
              {hidden ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 border">
                  Hidden
                </span>
              ) : null}
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit?.(pkg)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-300 hover:bg-slate-400"
                  title="Edit package"
                  aria-label="Edit package"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleDisplay?.(pkg)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-300 hover:bg-slate-400"
                  title={hidden ? 'Unhide package' : 'Hide package'}
                  aria-label={hidden ? 'Unhide package' : 'Hide package'}
                >
                  {hidden ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {new Intl.NumberFormat('en-PH', {
                style: 'currency',
                currency: 'PHP',
                maximumFractionDigits: 0,
              }).format(pkg.price)}
            </p>
            {features.length > 0 ? (
              <ul className="mt-2 list-disc list-inside text-sm">
                {features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )
    }

    // Removed SafePromoCard wrapper

    // Upload file then set pkgForm.imageUrl to the returned URL
    const uploadPackageImage = async (file: File): Promise<string> => {
      const fd = new FormData()
      fd.append('image', file) // must match upload.single('image')
      const res = await fetch(`${API_BASE}/package-image`, {
        method: 'POST',
        headers: { ...getAuthHeaders() }, // do NOT set Content-Type
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      return String(data.url || '')
    }

    // File change handler
    const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
      e
    ) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const url = await uploadPackageImage(file)
        setPkgForm((p) => ({ ...p, imageUrl: url, imageName: file.name }))
      } catch (err) {
        console.error('Upload failed:', err)
      }
    }

    // Clear selected image
    const handleClearImage = () => {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setPkgForm((p) => ({ ...p, imageUrl: '', imageName: '' }))
    }

    // Update name/price with proper React event types
    const updateField =
      (key: 'name' | 'price') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value =
          key === 'price' ? Number(e.target.value || 0) : e.target.value
        setPkgForm((prev) => ({ ...prev, [key]: value } as typeof prev))
      }

    // Features helpers
    const addFeature = () =>
      setPkgForm((p) => ({ ...p, features: [...p.features, ''] }))

    const removeFeature = (idx: number) =>
      setPkgForm((p) => ({
        ...p,
        features: p.features.filter((_, i) => i !== idx),
      }))

    const updateFeature =
      (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setPkgForm((p) => ({
          ...p,
          features: p.features.map((f, i) => (i === idx ? e.target.value : f)),
        }))

    // Toggle package visibility (display flag) with optimistic UI update
    const togglePackageDisplay = async (pkg: PackageItem) => {
      const nextDisplay = pkg.display === false ? true : false
      const prevView = pkgView

      if (nextDisplay) {
        // move from archived -> active
        setArchivedPackages((arr) => arr.filter((p) => p.id !== pkg.id))
        setPackages((arr) => [{ ...pkg, display: true }, ...arr])

        // If currently on Archived, switch to Active so the item is visible there
        if (prevView === 'archived') {
          setPkgView('active')
          setPkgPage(1)
        }
      } else {
        // move from active -> archived
        setPackages((arr) => arr.filter((p) => p.id !== pkg.id))
        setArchivedPackages((arr) => [{ ...pkg, display: false }, ...arr])
      }

      try {
        const res = await fetch(`${API_BASE}/package/${pkg.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ display: nextDisplay }),
        })
        if (!res.ok) throw new Error(await res.text())
      } catch (e) {
        console.error('Toggle package display failed:', e)
        // rollback lists
        if (nextDisplay) {
          setPackages((arr) => arr.filter((p) => p.id !== pkg.id))
          setArchivedPackages((arr) => [{ ...pkg }, ...arr])
        } else {
          setArchivedPackages((arr) => arr.filter((p) => p.id !== pkg.id))
          setPackages((arr) => [{ ...pkg }, ...arr])
        }
        // rollback view if it was changed
        setPkgView(prevView)
      }
    }

    // Apply search filter by package name (case-insensitive)
    const normalizedPkgSearch = (searchTerm || '').trim().toLowerCase()
    const filteredActive = useMemo(() => {
      if (!normalizedPkgSearch) return packages
      return packages.filter((p) =>
        (p.name || '').toLowerCase().includes(normalizedPkgSearch)
      )
    }, [packages, normalizedPkgSearch])
    const filteredArchived = useMemo(() => {
      if (!normalizedPkgSearch) return archivedPackages
      return archivedPackages.filter((p) =>
        (p.name || '').toLowerCase().includes(normalizedPkgSearch)
      )
    }, [archivedPackages, normalizedPkgSearch])
    const activeList = pkgView === 'active' ? filteredActive : filteredArchived

    // NEW: pagination for packages (3 per page)
    const PKG_PER_PAGE = 3
    const [pkgPage, setPkgPage] = useState(1)
    const pkgTotalPages = Math.max(
      1,
      Math.ceil(activeList.length / PKG_PER_PAGE)
    )
    useEffect(() => {
      setPkgPage((p) => Math.min(Math.max(1, p), pkgTotalPages))
    }, [pkgTotalPages])
    const paginatedPackages = useMemo(() => {
      const start = (pkgPage - 1) * PKG_PER_PAGE
      return activeList.slice(start, start + PKG_PER_PAGE)
    }, [activeList, pkgPage])

    const openEditPackage = (pkg: PackageItem) => {
      setEditPkgForm({
        id: pkg.id,
        name: pkg.name,
        price: pkg.price,
        imageUrl: pkg.imageUrl,
        features: [...pkg.features],
        durationHours: pkg.durationHours ?? undefined,
      })
      setEditSelected({}) // reset
      setEditPkgOpen(true)
      // load package's current items
      ;(async () => {
        try {
          const res = await fetch(`${API_BASE}/package/${pkg.id}/items`, {
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
          })
          if (!res.ok) throw new Error(await res.text())
          const data = await res.json()
          const map: Record<string, number> = {}
          for (const it of data.items || []) {
            map[String(it.inventory_id)] = Number(it.quantity) || 1
          }
          setEditSelected(map)
        } catch (e) {
          console.error('Load package items for edit failed:', e)
        }
      })()
    }

    const handleEditFileChange: React.ChangeEventHandler<
      HTMLInputElement
    > = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const url = await uploadPackageImage(file)
        setEditPkgForm((p) => ({ ...p, imageUrl: url }))
      } catch (err) {
        console.error('Edit package image upload failed:', err)
      }
    }

    const saveEditedPackage = async () => {
      const id = editPkgForm.id
      if (!id) return
      try {
        const res = await fetch(`${API_BASE}/package/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            package_name: editPkgForm.name.trim(),
            price: editPkgForm.price,
            image_url: editPkgForm.imageUrl,
            description: editPkgForm.features
              .map((f) => f.trim())
              .filter(Boolean)
              .join('\n'),
            duration_hours:
              editPkgForm.durationHours == null
                ? null
                : Number(editPkgForm.durationHours) || 0,
          }),
        })
        if (!res.ok) throw new Error(await res.text())

        // sync package items (add/remove/update); backend logs diffs
        const items = Object.entries(editSelected).map(
          ([inventory_id, quantity]) => ({
            inventory_id: Number(inventory_id),
            quantity: Number(quantity) || 1,
          })
        )
        const resItems = await fetch(`${API_BASE}/package/${id}/items`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ items }),
        })
        if (!resItems.ok) throw new Error(await resItems.text())

        // reflect meta changes locally
        setPackages((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  name: editPkgForm.name,
                  price: editPkgForm.price,
                  imageUrl: editPkgForm.imageUrl,
                  features: [...editPkgForm.features],
                  durationHours:
                    editPkgForm.durationHours == null
                      ? null
                      : Number(editPkgForm.durationHours) || 0,
                }
              : p
          )
        )
        setEditPkgOpen(false)
      } catch (e) {
        console.error('Save edited package failed:', e)
      }
    }
    const pkgWindowPages = useMemo(
      () => pageWindow(pkgPage, pkgTotalPages, 3),
      [pkgPage, pkgTotalPages]
    )

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex justify-between border-b-2 border-black items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">Create Package</h2>
            {/* Active / Archived toggle using shared TabButton for consistent styling */}
            <div className="flex gap-2 mb-2">
              <TabButton
                active={pkgView === 'active'}
                onClick={() => setPkgView('active')}
              >
                Active
              </TabButton>
              <TabButton
                active={pkgView === 'archived'}
                onClick={() => setPkgView('archived')}
              >
                Archived
              </TabButton>
            </div>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="bg-litratoblack text-white p-2 mb-2 rounded"
                onClick={() => setOpen(true)}
              >
                Add Package
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[640px] max-h-[70vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Add Package</DialogTitle>
                <DialogDescription>
                  Provide the details for the new package.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto p-2">
                <form
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Package Name</label>
                    <Input
                      className="h-9 rounded-md border px-3 text-sm outline-none"
                      placeholder="e.g. Wedding Package"
                      value={pkgForm.name}
                      onChange={updateField('name')}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Package Price</label>
                    <Input
                      type="number"
                      min={0}
                      className="h-9 rounded-md border px-3 text-sm outline-none"
                      value={pkgForm.price}
                      onChange={updateField('price')}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                      Duration (hours)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      className="h-9 rounded-md border px-3 text-sm outline-none"
                      value={pkgForm.durationHours ?? ''}
                      onChange={(e) =>
                        setPkgForm((p) => ({
                          ...p,
                          durationHours:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>

                  {/* Package Image upload */}
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-sm font-medium">Package Image</label>
                    {pkgForm.imageUrl ? (
                      <div className="space-y-2">
                        <Image
                          src={pkgForm.imageUrl}
                          alt="preview"
                          width={600}
                          height={160}
                          className="w-full h-40 object-cover rounded border"
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          unoptimized
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9"
                            onClick={handleClearImage}
                          >
                            Clear
                          </Button>
                        </div>
                        {pkgForm.imageName ? (
                          <div className="text-xs text-gray-500 truncate">
                            {pkgForm.imageName}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <Input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                      />
                    )}
                  </div>

                  {/* NEW: Include inventory items */}
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium">
                      Include Inventory Items
                    </label>
                    <div className="mt-2 flex flex-col gap-2 max-h-48 overflow-y-auto border rounded p-2">
                      {inventory.length === 0 ? (
                        <div className="text-sm text-gray-500">
                          No inventory available
                        </div>
                      ) : (
                        inventory.map((it) => {
                          const checked = it.id in selected
                          return (
                            <div
                              key={it.id}
                              className="flex items-center gap-3"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  toggleItem(it.id, e.target.checked)
                                }
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium">
                                  {it.name}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Features</label>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8  rounded px-3"
                        onClick={addFeature}
                      >
                        Add Feature
                      </Button>
                    </div>

                    <div className="flex flex-col gap-2">
                      {pkgForm.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            className="h-9 rounded-md border px-3 text-sm outline-none"
                            placeholder={`Feature ${idx + 1}`}
                            value={feat}
                            onChange={updateFeature(idx)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded"
                            onClick={() => removeFeature(idx)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    className="px-4 py-2 rounded border"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  className="px-4 py-2 rounded bg-litratoblack text-white"
                  onClick={handleCreatePackage}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Package Dialog */}
        {editPkgOpen && (
          <Dialog
            open={editPkgOpen}
            onOpenChange={(o) => {
              if (!o) setEditPkgOpen(false)
            }}
          >
            <DialogContent className="sm:max-w-lg max-h=[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Package</DialogTitle>
                <DialogDescription>
                  Update package details, image, and items.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Meta fields */}
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={editPkgForm.name}
                    onChange={(e) =>
                      setEditPkgForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Package name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Price (PHP)</label>
                  <Input
                    type="number"
                    value={editPkgForm.price}
                    onChange={(e) =>
                      setEditPkgForm((p) => ({
                        ...p,
                        price: Number(e.target.value) || 0,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Duration (hours)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={editPkgForm.durationHours ?? ''}
                    onChange={(e) =>
                      setEditPkgForm((p) => ({
                        ...p,
                        durationHours:
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value) || 0,
                      }))
                    }
                    placeholder="e.g., 2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Image
                  </label>
                  {editPkgForm.imageUrl ? (
                    <Image
                      src={editPkgForm.imageUrl}
                      alt="preview"
                      width={600}
                      height={160}
                      className="w-full h-40 object-cover rounded mb-2"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      unoptimized
                    />
                  ) : null}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleEditFileChange}
                  />
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Features</label>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded px-3"
                      onClick={() =>
                        setEditPkgForm((p) => ({
                          ...p,
                          features: [...p.features, ''],
                        }))
                      }
                    >
                      Add Feature
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {editPkgForm.features.map((feat, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          value={feat}
                          onChange={(e) =>
                            setEditPkgForm((p) => ({
                              ...p,
                              features: p.features.map((f, i) =>
                                i === idx ? e.target.value : f
                              ),
                            }))
                          }
                          placeholder={`Feature #${idx + 1}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9"
                          onClick={() =>
                            setEditPkgForm((p) => ({
                              ...p,
                              features: p.features.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NEW: Inventory items for this package */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Inventory Items{' '}
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={() => {
                          // select all with qty  1 (or keep existing qty)
                          const map: Record<string, number> = {}
                          for (const it of inventory) {
                            map[it.id] = editSelected[it.id] || 1
                          }
                          setEditSelected(map)
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={() => setEditSelected({})}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-auto border rounded p-2">
                    {inventory.length === 0 ? (
                      <div className="text-sm text-gray-500">
                        No inventory items available.
                      </div>
                    ) : (
                      inventory.map((it) => {
                        const checked = editSelected[it.id] != null
                        return (
                          <div
                            key={it.id}
                            className="flex items-center gap-2 py-1"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={checked}
                              onChange={(e) => {
                                const on = e.target.checked
                                setEditSelected((prev) => {
                                  const next = { ...prev }
                                  if (on) {
                                    next[it.id] = next[it.id] || 1
                                  } else {
                                    delete next[it.id]
                                  }
                                  return next
                                })
                              }}
                            />
                            <span className="flex-1 text-sm">{it.name}</span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  className="bg-litratoblack text-white"
                  onClick={saveEditedPackage}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-auto">
          {paginatedPackages.length ? (
            paginatedPackages.map((pkg) => (
              <SimplePackageCard
                key={pkg.id}
                pkg={pkg}
                onToggleDisplay={() => togglePackageDisplay(pkg)}
                onEdit={() => openEditPackage(pkg)}
              />
            ))
          ) : (
            <div className="col-span-full text-center text-sm text-gray-500 py-6">
              {pkgView === 'active'
                ? 'No active packages found.'
                : 'No archived packages.'}
            </div>
          )}
        </div>

        {/* Pagination pinned at bottom */}
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
                    setPkgPage((p) => Math.max(1, p - 1))
                  }}
                />
              </PaginationItem>

              {pkgWindowPages.map((n) => (
                <PaginationItem key={n}>
                  <PaginationLink
                    href="#"
                    isActive={n === pkgPage}
                    className="text-black no-underline hover:no-underline hover:text-black"
                    style={{ textDecoration: 'none' }}
                    onClick={(e) => {
                      e.preventDefault()
                      setPkgPage(n)
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
                    setPkgPage((p) => Math.min(pkgTotalPages, p + 1))
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    )
  }

  function ItemLogsPanel({ searchTerm }: { searchTerm?: string }) {
    type LogRow = {
      log_id: number
      entity_type: string
      entity_id: number
      status: string
      notes: string | null
      additional_notes?: string | null
      updated_by: number | null
      updated_by_name?: string
      updated_by_username?: string
      updated_at: string
    }

    const [logs, setLogs] = useState<LogRow[]>([])
    const [editNotesOpen, setEditNotesOpen] = useState(false)
    const [editingLog, setEditingLog] = useState<LogRow | null>(null)
    const [editAdditionalNotes, setEditAdditionalNotes] = useState('')
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState<{
      entity_type: 'Inventory' | 'Package'
      entity_id: string
      status: string
      notes: string
    }>({
      entity_type: 'Inventory',
      entity_id: '',
      status: 'available',
      notes: '',
    })

    const API_ORIGIN =
      process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
    const API_BASE = `${API_ORIGIN}/api/admin`
    const getCookie = (name: string) =>
      typeof document === 'undefined'
        ? ''
        : document.cookie
            .split('; ')
            .find((r) => r.startsWith(name + '='))
            ?.split('=')[1] || ''
    const getAuthHeaderString = () => {
      const raw =
        (typeof window !== 'undefined' &&
          localStorage.getItem('access_token')) ||
        getCookie('access_token')
      if (!raw) return ''
      return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`
    }
    const getAuthHeaders = useCallback((): Record<string, string> => {
      const auth = getAuthHeaderString()
      return auth ? { Authorization: auth } : {}
    }, [])

    // Map of inventory id -> equipment name for displaying names in logs
    const [inventoryNames, setInventoryNames] = useState<
      Record<string, string>
    >({})
    useEffect(() => {
      let ignore = false
      ;(async () => {
        try {
          const res = await fetch(`${API_BASE}/inventory`, {
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
          })
          if (!res.ok) return // non-blocking
          const data = await res.json()
          const itemsCandidate = (data as { items?: unknown }).items
          const list = Array.isArray(data)
            ? data
            : Array.isArray(itemsCandidate)
            ? itemsCandidate
            : []
          const map: Record<string, string> = {}
          for (const it of list) {
            const rec = it as Record<string, unknown>
            const id = String(rec.id ?? '')
            if (!id) continue
            const name = String(
              (rec as { material_name?: unknown }).material_name ??
                (rec as { name?: unknown }).name ??
                `#${id}`
            )
            map[id] = name
          }
          if (!ignore) {
            setInventoryNames(map)
          }
        } catch (e) {
          // best-effort only
          console.error('Load inventory names failed:', e)
        }
      })()
      return () => {
        ignore = true
      }
    }, [API_BASE, getAuthHeaders])

    // Map of package id -> package name
    const [packageNames, setPackageNames] = useState<Record<string, string>>({})
    useEffect(() => {
      let ignore = false
      ;(async () => {
        try {
          const res = await fetch(`${API_BASE}/package`, {
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
          })
          if (!res.ok) return // non-blocking
          const data = await res.json()
          const packagesCandidate = (data as { packages?: unknown }).packages
          const itemsCandidate = (data as { items?: unknown }).items
          const list = Array.isArray(data)
            ? data
            : Array.isArray(packagesCandidate)
            ? packagesCandidate
            : Array.isArray(itemsCandidate)
            ? itemsCandidate
            : []
          const map: Record<string, string> = {}
          for (const it of list) {
            const rec = it as Record<string, unknown>
            const id = String(
              (rec.id as unknown) ??
                (rec as { package_id?: unknown }).package_id ??
                ''
            )
            if (!id) continue
            const name = String(
              (rec as { package_name?: unknown }).package_name ??
                (rec as { name?: unknown }).name ??
                `#${id}`
            )
            map[id] = name
          }
          if (!ignore) {
            setPackageNames(map)
          }
        } catch (e) {
          console.error('Load package names failed:', e)
        }
      })()
      return () => {
        ignore = true
      }
    }, [API_BASE, getAuthHeaders])

    // Fetch archived packages too so names are available even when hidden
    useEffect(() => {
      let ignore = false
      ;(async () => {
        try {
          const res = await fetch(`${API_BASE}/package/archived`, {
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
          })
          if (!res.ok) return
          const data = await res.json()
          const packagesCandidate = (data as { packages?: unknown }).packages
          const list = Array.isArray(data)
            ? data
            : Array.isArray(packagesCandidate)
            ? packagesCandidate
            : []
          if (!list.length) return
          const add: Record<string, string> = {}
          for (const it of list) {
            const rec = it as Record<string, unknown>
            const id = String(
              (rec.id as unknown) ??
                (rec as { package_id?: unknown }).package_id ??
                ''
            )
            if (!id) continue
            const name = String(
              (rec as { package_name?: unknown }).package_name ??
                (rec as { name?: unknown }).name ??
                `#${id}`
            )
            add[id] = name
          }
          if (!ignore && Object.keys(add).length) {
            setPackageNames((prev) => ({ ...add, ...prev }))
          }
        } catch (e) {
          console.error('Load archived package names failed:', e)
        }
      })()
      return () => {
        ignore = true
      }
    }, [API_BASE, getAuthHeaders])

    const load = useCallback(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/inventory-status-log`, {
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        const list = Array.isArray(data?.inventoryStatusLogs)
          ? data.inventoryStatusLogs
          : Array.isArray(data)
          ? data
          : []
        setLogs(list)
      } catch (e) {
        console.error('Load logs failed:', e)
      } finally {
        setLoading(false)
      }
    }, [API_BASE, getAuthHeaders])

    useEffect(() => {
      load()
    }, [load])

    // removed unused createLog (logs are read-only in this panel)

    // NEW: filters (entity, status) — search is unified via top search bar
    const [filterEntity, setFilterEntity] = useState<
      'all' | 'Inventory' | 'Package'
    >('all')
    const [filterStatus, setFilterStatus] = useState<
      | 'all'
      | 'available'
      | 'unavailable'
      | 'maintenance'
      | 'damaged'
      | 'hidden'
      | 'unhidden'
    >('all')
    // removed local filterSearch; using unified top search

    const STATUS_OPTIONS_ALL = useMemo(
      () => [
        { label: 'All statuses', value: 'all' as const },
        { label: 'Available', value: 'available' as const },
        { label: 'Unavailable', value: 'unavailable' as const },
        { label: 'Maintenance', value: 'maintenance' as const },
        { label: 'Damaged', value: 'damaged' as const },
        { label: 'Unhidden', value: 'unhidden' as const },
        { label: 'Hidden', value: 'hidden' as const },
      ],
      []
    )
    const STATUS_OPTIONS_INV = useMemo(
      () =>
        STATUS_OPTIONS_ALL.filter((o) =>
          [
            'all',
            'available',
            'unavailable',
            'maintenance',
            'damaged',
          ].includes(o.value)
        ),
      [STATUS_OPTIONS_ALL]
    )
    const STATUS_OPTIONS_PKG = useMemo(
      () =>
        STATUS_OPTIONS_ALL.filter((o) =>
          ['all', 'hidden', 'unhidden'].includes(o.value)
        ),
      [STATUS_OPTIONS_ALL]
    )
    const currentStatusOptions = useMemo(() => {
      if (filterEntity === 'Inventory') return STATUS_OPTIONS_INV
      if (filterEntity === 'Package') return STATUS_OPTIONS_PKG
      return STATUS_OPTIONS_ALL
    }, [
      filterEntity,
      STATUS_OPTIONS_INV,
      STATUS_OPTIONS_PKG,
      STATUS_OPTIONS_ALL,
    ])

    type EnrichedLog = LogRow & {
      _changes: Record<string, [unknown, unknown]> | null
      _logType: string
      _statusDisplay: string
      _conditionDisplay: string | null
    }
    const enrichedLogs = useMemo<EnrichedLog[]>(() => {
      return logs
        .map((l) => {
          let changes: Record<string, [unknown, unknown]> | null = null
          if (l.notes) {
            try {
              const parsed: unknown = JSON.parse(l.notes)
              if (
                parsed &&
                typeof parsed === 'object' &&
                (parsed as { changes?: unknown }).changes
              ) {
                const ch = (parsed as { changes?: unknown }).changes
                if (ch && typeof ch === 'object') {
                  changes = ch as Record<string, [unknown, unknown]>
                }
              }
            } catch {}
          }
          // Determine log type and display status/condition based on entity type and changes
          let logType = 'Updated'
          if (l.status === 'created') logType = 'Created'
          else if (l.status === 'unarchived') logType = 'Unarchived'
          else if (l.status === 'archived') logType = 'Archived'
          let statusDisplay = ''
          let conditionDisplay: string | null = null
          if (l.entity_type === 'Inventory') {
            if (changes?.status) {
              statusDisplay = String(changes.status[1]) // already 'available'|'unavailable'
            } else {
              // fallback: if initial log (created) assume available unless explicitly different
              statusDisplay = 'available'
            }
            if (changes?.condition) {
              conditionDisplay = String(changes.condition[1])
            }
          } else if (l.entity_type === 'Package') {
            if (changes?.display) {
              statusDisplay =
                changes.display[1] === 'visible' ? 'unhidden' : 'hidden'
            } else {
              statusDisplay = 'unhidden'
            }
            conditionDisplay = null
          } else {
            statusDisplay = l.status
          }
          return {
            ...l,
            _changes: changes,
            _logType: logType,
            _statusDisplay: statusDisplay,
            _conditionDisplay: conditionDisplay,
          } as EnrichedLog
        })
        .sort((a, b) => {
          // Sort by updated_at in descending order (latest first)
          const dateA = new Date(a.updated_at).getTime()
          const dateB = new Date(b.updated_at).getTime()
          return dateB - dateA
        })
    }, [logs])

    // NEW: apply filters and unified search (by resolved entity name)
    const filteredLogs = useMemo(() => {
      const q = (searchTerm || '').trim().toLowerCase()
      return enrichedLogs.filter((l) => {
        if (filterEntity !== 'all' && l.entity_type !== filterEntity)
          return false
        if (
          filterStatus !== 'all' &&
          (l._statusDisplay || '').toLowerCase() !== filterStatus
        ) {
          return false
        }
        if (q) {
          const name =
            l.entity_type === 'Inventory'
              ? inventoryNames[String(l.entity_id)] ?? ''
              : l.entity_type === 'Package'
              ? packageNames[String(l.entity_id)] ?? ''
              : ''
          const hay = (name || `#${l.entity_id}`).toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
    }, [
      enrichedLogs,
      filterEntity,
      filterStatus,
      searchTerm, // <-- use unified search term
      inventoryNames,
      packageNames,
    ])

    // UPDATED: pagination for filtered logs (5 per page)
    const LOGS_PER_PAGE = 5
    const [logsPage, setLogsPage] = useState(1)
    const logsTotalPages = Math.max(
      1,
      Math.ceil(filteredLogs.length / LOGS_PER_PAGE)
    )
    useEffect(() => {
      setLogsPage((p) => Math.min(Math.max(1, p), logsTotalPages))
    }, [logsTotalPages, filteredLogs.length])
    const paginatedLogs = useMemo(() => {
      const start = (logsPage - 1) * LOGS_PER_PAGE
      return filteredLogs.slice(start, start + LOGS_PER_PAGE)
    }, [filteredLogs, logsPage])
    const logsWindowPages = useMemo(
      () => pageWindow(logsPage, logsTotalPages, 3),
      [logsPage, logsTotalPages]
    )

    return (
      <>
        <div className="flex h-full min-h-0 flex-col gap-4">
          {/* Filters toolbar: entity + status (search removed; uses unified search bar) */}
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Filter: Entity</label>
              <Select
                value={filterEntity}
                onValueChange={(v) => {
                  setFilterEntity(v as 'all' | 'Inventory' | 'Package')
                  setFilterStatus('all')
                }}
              >
                <SelectTrigger className="h-9 text-sm rounded">
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Inventory">Inventory</SelectItem>
                  <SelectItem value="Package">Package</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Filter: Status</label>
              <Select
                value={filterStatus}
                onValueChange={(v) =>
                  setFilterStatus(
                    v as
                      | 'all'
                      | 'available'
                      | 'unavailable'
                      | 'maintenance'
                      | 'damaged'
                      | 'hidden'
                      | 'unhidden'
                  )
                }
              >
                <SelectTrigger className="h-9 text-sm rounded">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  {currentStatusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Removed local "Search by name" input; unified search bar is used */}
          </div>

          {/* Table area scrolls; pagination stays at bottom */}
          <div className="flex-1 min-h-0 overflow-auto rounded border">
            <Table className="w-full table-auto">
              <TableHeader>
                <TableRow className="bg-gray-200 hover:not-enabled:bg-gray-200">
                  <TableHead className="px-4 py-2">Entity</TableHead>
                  <TableHead className="px-4 py-2">Name</TableHead>
                  <TableHead className="px-4 py-2">Log Type</TableHead>
                  <TableHead className="px-4 py-2">Status</TableHead>
                  <TableHead className="px-4 py-2">Condition</TableHead>
                  <TableHead className="px-4 py-2">More Details</TableHead>
                  <TableHead className="px-4 py-2">Updated By</TableHead>
                  <TableHead className="px-4 py-2">Updated At</TableHead>
                  <TableHead className="px-4 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell className="px-4 py-3" colSpan={9}>
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : paginatedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell className="px-4 py-3" colSpan={9}>
                      No logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs.map((l) => (
                    <TableRow key={l.log_id} className="even:bg-gray-50">
                      <TableCell className="px-4 py-2">
                        {l.entity_type}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        {l.entity_type === 'Inventory'
                          ? inventoryNames[String(l.entity_id)] ??
                            `#${l.entity_id}`
                          : l.entity_type === 'Package'
                          ? packageNames[String(l.entity_id)] ??
                            `#${l.entity_id}`
                          : `#${l.entity_id}`}
                      </TableCell>
                      <TableCell className="px-4 py-2">{l._logType}</TableCell>
                      <TableCell className="px-4 py-2 capitalize">
                        {l._statusDisplay}
                      </TableCell>
                      <TableCell className="px-4 py-2 capitalize">
                        {l._conditionDisplay ??
                          (l.entity_type === 'Package' ? '' : '—')}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label="More details"
                              className="inline-flex items-center justify-center rounded border px-2 py-1 bg-gray-100 hover:bg-gray-200"
                            >
                              <Ellipsis className="h-4 w-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-64 text-xs">
                            <div className="space-y-1">
                              {l._changes ? (
                                <div className="mt-2">
                                  <div className="font-medium mb-1">
                                    Changes:
                                  </div>
                                  <ul className="list-disc list-inside space-y-0.5">
                                    {Object.entries(
                                      l._changes as Record<
                                        string,
                                        [unknown, unknown]
                                      >
                                    ).map(([field, pair]) => {
                                      if (field === 'image_url') {
                                        return (
                                          <li key={field}>
                                            <span className="font-medium">
                                              Image:
                                            </span>{' '}
                                            changed
                                          </li>
                                        )
                                      }
                                      const [oldV, newV] = pair
                                      return (
                                        <li key={field}>
                                          <span className="font-medium capitalize">
                                            {field.replace(/_/g, ' ')}:
                                          </span>{' '}
                                          {oldV === null ||
                                          oldV === undefined ||
                                          oldV === ''
                                            ? '—'
                                            : String(oldV)}{' '}
                                          {'->'}{' '}
                                          {newV === null ||
                                          newV === undefined ||
                                          newV === ''
                                            ? '—'
                                            : String(newV)}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                  {/* Additional Notes display */}
                                  <div className="mt-2">
                                    <div className="font-medium mb-0.5">
                                      Additional Notes:
                                    </div>
                                    <div className="whitespace-pre-wrap break-words text-gray-700 text-[11px] leading-snug min-h-[0.75rem]">
                                      {l.additional_notes &&
                                      l.additional_notes.trim() !== '' ? (
                                        l.additional_notes
                                      ) : (
                                        <span className="text-gray-400">
                                          (none)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2 text-gray-500">
                                  No field changes
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        {(() => {
                          const name =
                            (l.updated_by_name && l.updated_by_name.trim()) ||
                            l.updated_by_username
                          if (name) return name
                          return l.updated_by != null ? `#${l.updated_by}` : '—'
                        })()}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        {new Date(l.updated_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <button
                          type="button"
                          title="Edit additional notes"
                          onClick={() => {
                            setEditingLog(l)
                            setEditAdditionalNotes(l.additional_notes || '')
                            setEditNotesOpen(true)
                          }}
                          className="inline-flex items-center justify-center rounded-full hover:text-black text-litratoblack"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination pinned at bottom */}
          <div className="mt-auto pt-2">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    className="text-black no-underline hover:no-underline hover:text-black"
                    style={{ textDecoration: 'none' }}
                    onClick={(e) => {
                      e.preventDefault()
                      setLogsPage((p) => Math.max(1, p - 1))
                    }}
                  />
                </PaginationItem>

                {logsWindowPages.map((n) => (
                  <PaginationItem key={n}>
                    <PaginationLink
                      href="#"
                      isActive={n === logsPage}
                      className="text-black no-underline hover:no-underline hover:text-black"
                      style={{ textDecoration: 'none' }}
                      onClick={(e) => {
                        e.preventDefault()
                        setLogsPage(n)
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
                      setLogsPage((p) => Math.min(logsTotalPages, p + 1))
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
        {/* Edit Additional Notes Dialog */}
        <Dialog
          open={editNotesOpen}
          onOpenChange={(o) => {
            if (!o) {
              setEditNotesOpen(false)
              setEditingLog(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Additional Notes</DialogTitle>
              <DialogDescription>
                Add or update contextual notes for this log entry.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="text-xs text-gray-500">
                Log ID: {editingLog?.log_id}
              </div>
              <Textarea
                rows={5}
                value={editAdditionalNotes}
                onChange={(e) => setEditAdditionalNotes(e.target.value)}
                placeholder="Enter additional notes..."
                className="text-sm"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                className="bg-litratoblack text-white"
                onClick={async () => {
                  if (!editingLog) return
                  try {
                    const res = await fetch(
                      `${API_BASE}/inventory-status-log/${editingLog.log_id}`,
                      {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          ...getAuthHeaders(),
                        },
                        body: JSON.stringify({
                          entity_type: editingLog.entity_type,
                          entity_id: editingLog.entity_id,
                          status: editingLog.status,
                          notes: editingLog.notes, // keep original structured JSON in notes
                          additional_notes: editAdditionalNotes || null,
                        }),
                      }
                    )
                    if (!res.ok) throw new Error(await res.text())
                    // optimistic local update
                    setLogs((prev) =>
                      prev.map((log) =>
                        log.log_id === editingLog.log_id
                          ? {
                              ...log,
                              additional_notes: editAdditionalNotes || null,
                            }
                          : log
                      )
                    )
                    setEditNotesOpen(false)
                    setEditingLog(null)
                  } catch (e) {
                    console.error('Update additional notes failed:', e)
                  }
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Helper components
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
}
