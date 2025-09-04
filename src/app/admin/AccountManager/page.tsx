"use client";
import { useEffect, useState } from "react";

type User = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  isactive: boolean;
  role?: string;
};
type Customer = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
};
type TabKey = "createusers" | "customers" | "staff" | "admin";

export default function AdminAccountManagementPage() {
  const [active, setActive] = useState<TabKey>("customers");

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Account Management</h1>
      </header>

      <nav className="flex gap-2 mb-6">
        <TabButton
          active={active === "createusers"}
          onClick={() => setActive("createusers")}
        >
          Create User
        </TabButton>

        <TabButton
          active={active === "customers"}
          onClick={() => setActive("customers")}
        >
          Customers
        </TabButton>
        <TabButton
          active={active === "staff"}
          onClick={() => setActive("staff")}
        >
          Staff
        </TabButton>
        <TabButton
          active={active === "admin"}
          onClick={() => setActive("admin")}
        >
          Admin
        </TabButton>
      </nav>

      <section className="bg-white rounded-xl shadow p-4">
        {active === "createusers" && <CreateUserPanel />}
        {active === "customers" && (
          <UserListPanel role="customer" title="Customer Accounts" />
        )}
        {active === "staff" && (
          <UserListPanel role="employee" title="Staff (Employee) Accounts" />
        )}
        {active === "admin" && (
          <UserListPanel role="admin" title="Admin Accounts" />
        )}
      </section>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`px-4 py-2 rounded-full cursor-pointer border font-semibold transition
        ${
          active
            ? "bg-litratoblack text-white border-litratoblack"
            : "bg-white text-litratoblack border-gray-300 hover:bg-gray-100"
        }`}
    >
      {children}
    </div>
  );
}

/* Unified User List Panel */
function UserListPanel({
  role,
  title,
}: {
  role: "customer" | "employee" | "admin";
  title: string;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const raw =
          typeof window !== "undefined"
            ? localStorage.getItem("access_token")
            : null;
        const authHeader =
          raw && raw.startsWith("Bearer ") ? raw : raw ? `Bearer ${raw}` : "";
        const res = await fetch(
          `http://localhost:5000/api/admin/list?role=${role}`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(authHeader ? { Authorization: authHeader } : {}),
            },
          }
        );
        if (res.status === 401)
          throw new Error("Unauthorized. Please log in again.");
        if (res.status === 403)
          throw new Error("Forbidden: Admin role required.");
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || `Failed to load ${role} list (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) setUsers(Array.isArray(data.users) ? data.users : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [role]);

  // Helper to normalize Authorization header
  const getAuthHeader = () => {
    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;
    return raw ? (raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`) : "";
  };

  // Re-fetch list after an action
  const refreshUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const authHeader = getAuthHeader();
      const res = await fetch(
        `http://localhost:5000/api/admin/list?role=${role}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (e: any) {
      setError(e?.message || "Failed to refresh users");
    } finally {
      setLoading(false);
    }
  };

  // Connect to backend block/unblock
  const callAdminAction = async (id: string, action: "block" | "unblock") => {
    try {
      const authHeader = getAuthHeader();
      const res = await fetch(
        `http://localhost:5000/api/admin/user/${id}/${action}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.toast?.message || data?.message;
        throw new Error(msg || `Failed to ${action} user`);
      }
      // Use the backend response to update the toggled user's status
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isactive: !!data.isactive } : u))
      );
      // No need to refresh; the UI already reflects the new state
    } catch (e: any) {
      alert(e?.message || `Failed to ${action} user`);
    }
  };

  const block = (id: string) => callAdminAction(id, "block");
  const unblock = (id: string) => callAdminAction(id, "unblock");

  return (
    <div>
      Search Bar Filter Dropdown Update Role Button
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {loading && <p className="text-gray-500 mb-2">Loading…</p>}
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <div className="overflow-auto">
        <table className="w-full text-left border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-200">
            <tr>
              <Th>First</Th>
              <Th>Last</Th>
              <Th>Email</Th>
              <Th>Contact</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <Td>{u.firstname}</Td>
                <Td>{u.lastname}</Td>
                <Td>{u.email}</Td>
                <Td>{u.contact}</Td>

                <Td>
                  <div className="flex w-20">
                    {u.isactive ? "Active" : "Inactive"}
                  </div>
                </Td>

                <Td>
                  <div className="flex w-40">
                    {u.isactive ? (
                      <div
                        onClick={() => block(u.id)}
                        className="px-3 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 cursor-pointer"
                      >
                        Block
                      </div>
                    ) : (
                      <div
                        onClick={() => unblock(u.id)}
                        className="px-3 py-1 rounded-full bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                      >
                        Unblock
                      </div>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-500">
                  No {role}s found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function CreateUserPanel() {
  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: "c1",
      firstname: "Juan",
      lastname: "Dela Cruz",
      email: "juan@example.com",
      contact: "09123456789",
    },
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Customer, "id">>({
    firstname: "",
    lastname: "",
    email: "",
    contact: "",
  });

  const startEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      firstname: c.firstname,
      lastname: c.lastname,
      email: c.email,
      contact: c.contact,
    });
  };

  const reset = () => {
    setEditingId(null);
    setForm({ firstname: "", lastname: "", email: "", contact: "" });
  };

  const save = () => {
    if (!form.firstname || !form.lastname || !form.email) return;
    if (editingId) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === editingId ? { id: editingId, ...form } : c))
      );
    } else {
      setCustomers((prev) => [{ id: `c_${Date.now()}`, ...form }, ...prev]);
    }
    reset();
  };

  const remove = (id: string) => {
    if (!confirm("Delete this customer?")) return;
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) reset();
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold mb-3">
          {editingId ? "Edit Customer" : "Add Customer"}
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
              className="bg-litratoblack text-white px-4 py-2 rounded-lg font-bold"
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
          <table className="w-full table-fixed text-left border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <Th className="w-32">First</Th>
                <Th className="w-32">Last</Th>
                <Th className="w-64">Email</Th>
                <Th className="w-40">Contact</Th>
                <Th className="w-40 text-right pr-3">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t">
                  <Td>
                    <div className="truncate" title={c.firstname}>
                      {c.firstname}
                    </div>
                  </Td>
                  <Td>
                    <div className="truncate" title={c.lastname}>
                      {c.lastname}
                    </div>
                  </Td>
                  <Td>
                    <div className="truncate" title={c.email}>
                      {c.email}
                    </div>
                  </Td>
                  <Td>
                    <div className="truncate" title={c.contact}>
                      {c.contact}
                    </div>
                  </Td>
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
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 outline-none"
      />
    </label>
  );
}
/* UI table helpers (pruned unused components) */
function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2 text-sm font-semibold ${className}`}>
      {children}
    </th>
  );
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 text-sm ${className}`}>{children}</td>;
}
