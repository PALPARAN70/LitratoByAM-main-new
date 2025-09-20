'use client'
import { useMemo, useState } from 'react'

type Customer = {
  id: string
  firstname: string
  lastname: string
  email: string
  contact: string
}
type Package = { id: string; name: string; price: number; features: string[] }
type InventoryItem = {
  id: string
  name: string
  quantity: number
  status: 'in-stock' | 'low' | 'out'
}

type TabKey = 'customers' | 'packages' | 'inventory'

export default function AdminDashboardPage() {
  const [active, setActive] = useState<TabKey>('customers')

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </header>

      <nav className="flex gap-2 mb-6">
        <TabButton
          active={active === 'customers'}
          onClick={() => setActive('customers')}
        >
          Customers
        </TabButton>
        <TabButton
          active={active === 'packages'}
          onClick={() => setActive('packages')}
        >
          Packages
        </TabButton>
        <TabButton
          active={active === 'inventory'}
          onClick={() => setActive('inventory')}
        >
          Inventory
        </TabButton>
      </nav>

      <section className="bg-white rounded-xl shadow p-4">
        {active === 'customers' && <CustomersPanel />}
        {active === 'packages' && <PackagesPanel />}
        {active === 'inventory' && <InventoryPanel />}
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

/* Customers */
function CustomersPanel() {
  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: 'c1',
      firstname: 'Juan',
      lastname: 'Dela Cruz',
      email: 'juan@example.com',
      contact: '09123456789',
    },
  ])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Customer, 'id'>>({
    firstname: '',
    lastname: '',
    email: '',
    contact: '',
  })

  const startEdit = (c: Customer) => {
    setEditingId(c.id)
    setForm({
      firstname: c.firstname,
      lastname: c.lastname,
      email: c.email,
      contact: c.contact,
    })
  }

  const reset = () => {
    setEditingId(null)
    setForm({ firstname: '', lastname: '', email: '', contact: '' })
  }

  const save = () => {
    if (!form.firstname || !form.lastname || !form.email) return
    if (editingId) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === editingId ? { id: editingId, ...form } : c))
      )
    } else {
      setCustomers((prev) => [{ id: `c_${Date.now()}`, ...form }, ...prev])
    }
    reset()
  }

  const remove = (id: string) => {
    if (!confirm('Delete this customer?')) return
    setCustomers((prev) => prev.filter((c) => c.id !== id))
    if (editingId === id) reset()
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold mb-3">
          {editingId ? 'Edit Customer' : 'Add Customer'}
        </h2>
        <div className="grid gap-3">
          <Input
            label="First name"
            value={form.firstname}
            onChange={(v) => setForm((s) => ({ ...s, firstname: v }))}
          />
          <Input
            label="Last name"
            value={form.lastname}
            onChange={(v) => setForm((s) => ({ ...s, lastname: v }))}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm((s) => ({ ...s, email: v }))}
          />
          <Input
            label="Contact"
            value={form.contact}
            onChange={(v) => setForm((s) => ({ ...s, contact: v }))}
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              className="bg-litratoblack text-white px-4 py-2 rounded font-bold"
            >
              Save
            </button>
            {editingId && (
              <button
                onClick={reset}
                className="bg-gray-200 text-litratoblack px-4 py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-3">Customer Accounts</h2>
        <div className="overflow-auto">
          <table className="w-full text-left border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <Th>First</Th>
                <Th>Last</Th>
                <Th>Email</Th>
                <Th>Contact</Th>
                <Th className="text-right pr-3">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t">
                  <Td>{c.firstname}</Td>
                  <Td>{c.lastname}</Td>
                  <Td>{c.email}</Td>
                  <Td>{c.contact}</Td>
                  <Td>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => startEdit(c)}
                        className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        className="px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-500">
                    No customers yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* Packages */
function PackagesPanel() {
  const [packages, setPackages] = useState<Package[]>([
    {
      id: 'p1',
      name: 'The OG',
      price: 8000,
      features: ['2 hours', 'Unlimited shots'],
    },
  ])
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [featureInput, setFeatureInput] = useState('')
  const [features, setFeatures] = useState<string[]>([])

  const addFeature = () => {
    const f = featureInput.trim()
    if (!f) return
    setFeatures((prev) => [...prev, f])
    setFeatureInput('')
  }
  const removeFeature = (i: number) =>
    setFeatures((prev) => prev.filter((_, idx) => idx !== i))

  const create = () => {
    if (!name || price === '' || Number(price) < 0) return
    setPackages((prev) => [
      { id: `p_${Date.now()}`, name, price: Number(price), features },
      ...prev,
    ])
    setName('')
    setPrice('')
    setFeatures([])
  }

  const del = (id: string) => {
    if (!confirm('Delete this package?')) return
    setPackages((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold mb-3">Create Package</h2>
        <div className="grid gap-3">
          <Input label="Name" value={name} onChange={setName} />
          <Input
            label="Price (₱)"
            type="number"
            value={String(price)}
            onChange={(v) => setPrice(v === '' ? '' : Number(v))}
          />
          <div>
            <label className="block text-sm font-medium mb-1">Features</label>
            <div className="flex gap-2">
              <input
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 outline-none"
                placeholder="e.g., High quality photo strips"
              />
              <button
                type="button"
                onClick={addFeature}
                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {features.map((f, i) => (
                <li
                  key={i}
                  className="px-2 py-1 bg-gray-100 rounded-full text-sm flex items-center gap-2"
                >
                  {f}
                  <button
                    onClick={() => removeFeature(i)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={create}
            className="bg-litratoblack text-white px-4 py-2 rounded font-bold"
          >
            Create
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-3">Packages</h2>
        <div className="grid gap-3">
          {packages.map((p) => (
            <div
              key={p.id}
              className="border rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            >
              <div>
                <p className="font-bold">{p.name}</p>
                <p className="text-sm text-gray-600">
                  ₱{p.price.toLocaleString()}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  Features: {p.features.join(', ') || 'None'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => del(p.id)}
                  className="px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {packages.length === 0 && (
            <p className="text-center py-6 text-gray-500">No packages yet</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* Inventory */
function InventoryPanel() {
  const [items, setItems] = useState<InventoryItem[]>([
    {
      id: 'i1',
      name: 'Vintage Camera',
      quantity: 4,
      status: 'in-stock',
    },
    {
      id: 'i2',
      name: 'Film Pack',
      quantity: 1,
      status: 'low',
    },
  ])
  const [form, setForm] = useState<{ name: string; quantity: number }>({
    name: '',
    quantity: 0,
  })

  const statusOf = (q: number): InventoryItem['status'] =>
    q <= 0 ? 'out' : q <= 2 ? 'low' : 'in-stock'

  const add = () => {
    if (!form.name) return
    const q = Number(form.quantity) || 0
    setItems((prev) => [
      {
        id: `i_${Date.now()}`,
        name: form.name,
        quantity: q,
        status: statusOf(q),
      },
      ...prev,
    ])
    setForm({ name: '', quantity: 0 })
  }

  const adjust = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              quantity: Math.max(0, it.quantity + delta),
              status: statusOf(Math.max(0, it.quantity + delta)),
            }
          : it
      )
    )
  }

  const remove = (id: string) => {
    if (!confirm('Delete this item?')) return
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const totals = useMemo(
    () => ({
      count: items.length,
      qty: items.reduce((s, i) => s + i.quantity, 0),
      low: items.filter((i) => i.status === 'low').length,
      out: items.filter((i) => i.status === 'out').length,
    }),
    [items]
  )

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Items" value={totals.count} />
        <Stat label="Total Qty" value={totals.qty} />
        <Stat label="Low Stock" value={totals.low} />
        <Stat label="Out of Stock" value={totals.out} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold mb-3">Add Inventory</h2>
          <div className="grid gap-3">
            <Input
              label="Item name"
              value={form.name}
              onChange={(v) => setForm((s) => ({ ...s, name: v }))}
            />
            {/* SKU field removed */}
            <Input
              label="Quantity"
              type="number"
              value={String(form.quantity)}
              onChange={(v) =>
                setForm((s) => ({ ...s, quantity: Number(v || 0) }))
              }
            />
            <button
              onClick={add}
              className="bg-litratoblack text-white px-4 py-2 rounded font-bold"
            >
              Add
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">Inventory</h2>
          <div className="grid gap-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="border rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              >
                <div>
                  <p className="font-bold">{it.name}</p>
                  <p className="text-sm">
                    Qty: {it.quantity} •
                    <span
                      className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                        it.status === 'in-stock'
                          ? 'bg-green-100 text-green-700'
                          : it.status === 'low'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {it.status}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => adjust(it.id, 1)}
                    className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => adjust(it.id, -1)}
                    className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => remove(it.id)}
                    className="px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-center py-6 text-gray-500">No inventory yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* UI helpers */
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
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 outline-none "
      />
    </label>
  )
}

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
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-sm">{children}</td>
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-xl p-3 bg-white">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
