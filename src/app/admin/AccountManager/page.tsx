"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { type createUserData } from "../../../../schemas/schema/requestvalidation";
import { FilterIcon, SearchIcon } from "lucide-react";

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
  password: any;
  email: string;
  contact: string;
};
type TabKey = "createusers" | "customers" | "staff" | "admin";

export default function AdminAccountManagementPage() {
  const [active, setActive] = useState<TabKey>("customers");
  // controlled search input and applied search term
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Debounce: when user types, wait 500ms after last keystroke to apply searchTerm
  useEffect(() => {
    const trimmed = searchInput.trim();
    // If input equals applied term, do nothing
    if (trimmed === searchTerm) return;
    const id = setTimeout(() => {
      setSearchTerm(trimmed);
    }, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]); // intentionally only depends on searchInput

  // Manual immediate search (icon click)

  // Clear search input & applied search

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
        <div className="flex-grow flex">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearchTerm(searchInput.trim());
            }}
            className="w-1/4 bg-gray-200 rounded-full items-center flex px-1 py-1"
          >
            <input
              type="text"
              placeholder="Search User..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-transparent outline-none w-full px-2"
            />
            <div className="rounded-full bg-gray-300 p-2 ml-2 items-center flex cursor-pointer">
              <FilterIcon className="w-4 h-4 text-black" />
            </div>
          </form>
        </div>
      </nav>
      <section className="bg-white h-120  rounded-xl shadow p-4">
        {active === "createusers" && <CreateUserPanel />}
        {active === "customers" && (
          <UserListPanel
            role="customer"
            title="Customer Accounts"
            searchTerm={searchTerm}
          />
        )}
        {active === "staff" && (
          <UserListPanel
            role="employee"
            title="Staff (Employee) Accounts"
            searchTerm={searchTerm}
          />
        )}
        {active === "admin" && (
          <UserListPanel
            role="admin"
            title="Admin Accounts"
            searchTerm={searchTerm}
          />
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
  // added: incoming search term to filter by last name (server-side query)
  searchTerm,
}: {
  role: "customer" | "employee" | "admin";
  title: string;
  searchTerm?: string;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // animateIn toggles opacity for a smooth load transition
  const [animateIn, setAnimateIn] = useState(false);

  // minimum spinner/skeleton time to avoid flicker when backend is very fast
  const MIN_LOADING_MS = 240;
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  useEffect(() => {
    let cancelled = false;
    const fetchUsers = async () => {
      // start loading, keep skeleton visible and prepare to animate new rows in
      const start = Date.now();
      setLoading(true);
      setAnimateIn(false);
      setError(null);
      try {
        const raw =
          typeof window !== "undefined"
            ? localStorage.getItem("access_token")
            : null;
        const authHeader =
          raw && raw.startsWith("Bearer ") ? raw : raw ? `Bearer ${raw}` : "";
        // include lastname query when searchTerm is present
        const url =
          `http://localhost:5000/api/admin/list?role=${role}` +
          (searchTerm ? `&lastname=${encodeURIComponent(searchTerm)}` : "");
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
        });
        if (res.status === 401)
          throw new Error("Unauthorized. Please log in again.");
        if (res.status === 403)
          throw new Error("Forbidden: Admin role required.");
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || `Failed to load ${role} list (${res.status})`);
        }
        const data = await res.json();
        // ensure a minimum loading time to avoid flicker
        const elapsed = Date.now() - start;
        if (elapsed < MIN_LOADING_MS) await sleep(MIN_LOADING_MS - elapsed);
        if (!cancelled) {
          setUsers(Array.isArray(data.users) ? data.users : []);
          // tiny delay to allow DOM update, then fade-in the new rows
          setTimeout(() => {
            if (!cancelled) setAnimateIn(true);
          }, 20);
        }
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
  }, [role, searchTerm]); // re-run when searchTerm changes

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
    // similar controlled refresh: show skeletons, ensure min loading time, then animate in
    const start = Date.now();
    try {
      setLoading(true);
      setAnimateIn(false);
      setError(null);
      const authHeader = getAuthHeader();
      const url =
        `http://localhost:5000/api/admin/list?role=${role}` +
        (searchTerm ? `&lastname=${encodeURIComponent(searchTerm)}` : "");
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const elapsed = Date.now() - start;
      if (elapsed < MIN_LOADING_MS) await sleep(MIN_LOADING_MS - elapsed);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setTimeout(() => setAnimateIn(true), 20);
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
        // Prefer backend toast message when available
        const msg =
          data?.toast?.message || data?.message || `Failed to ${action} user`;
        if (data?.toast?.type === "error") {
        } else {
          toast.error(msg);
        }
        throw new Error(msg);
      }

      // Show backend toast (success / error) if present, fallback to generic
      if (data?.toast?.message) {
        if (data.toast.type === "success") toast.success(data.toast.message);
        else toast.error(data.toast.message);
      } else {
        toast.success(
          `User ${action === "block" ? "blocked" : "unblocked"} successfully`
        );
      }

      // Use the backend response to update the toggled user's status
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isactive: !!data.isactive } : u))
      );
      // No need to refresh; the UI already reflects the new state
    } catch (e: any) {
      // Use sonner toast for errors instead of alert
      toast.error(e?.message || `Failed to ${action} user`);
    }
  };

  const block = (id: string) => callAdminAction(id, "block");
  const unblock = (id: string) => callAdminAction(id, "unblock");

  // Client-side fallback filter so matched users always display in the table
  const normalizedSearch = (searchTerm || "").trim().toLowerCase();
  const displayedUsers = users.filter((u) =>
    normalizedSearch
      ? u.firstname.toLowerCase().includes(normalizedSearch) ||
        u.lastname.toLowerCase().includes(normalizedSearch) ||
        u.email.toLowerCase().includes(normalizedSearch) ||
        u.contact.toLowerCase().includes(normalizedSearch)
      : true
  );

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {loading && <p className="text-gray-500 mb-2">Loading…</p>}
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <div className="overflow-auto ">
        <table className="w-full text-left border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-200">
            <tr>
              <Th>First Name</Th>
              <Th>Last Name</Th>
              <Th>Email</Th>
              <Th>Contact</Th>
              <Th>Status</Th>
              <Th>Last Logged In</Th>
              <Th>Last Udpated</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody
            // skeletons remain visible while loading; when not loading fade real rows in
            className={`transition-opacity duration-300 ease-out ${
              loading ? "opacity-100" : animateIn ? "opacity-100" : "opacity-0"
            }`}
          >
            {loading
              ? // show skeleton rows while loading for smooth UX
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-t">
                    <Td>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
                    </Td>
                    <Td>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
                    </Td>
                    <Td>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-36" />
                    </Td>
                    <Td>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
                    </Td>
                    <Td>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-12" />
                    </Td>
                    <Td>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
                    </Td>
                    <Td>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
                    </Td>
                    <Td>
                      <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
                    </Td>
                  </tr>
                ))
              : displayedUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t transition-opacity duration-300"
                  >
                    <Td>{u.firstname}</Td>
                    <Td>{u.lastname}</Td>
                    <Td>{u.email}</Td>
                    <Td>{u.contact}</Td>

                    <Td>
                      <div className="flex w-20">
                        {u.isactive ? "Active" : "Inactive"}
                      </div>
                    </Td>
                    <Td>04/02/25</Td>
                    <Td>08/02/25</Td>
                    <Td>
                      <div className="flex w-52 gap-2">
                        {u.isactive ? (
                          <div
                            onClick={() => block(u.id)}
                            className="px-3 py-1 rounded-full bg-red-500 text-white hover:bg-red-600  cursor-pointer"
                          >
                            Block
                          </div>
                        ) : (
                          <div
                            onClick={() => unblock(u.id)}
                            className="px-3 py-1 rounded-full bg-green-500 text-white hover:bg-green-600  cursor-pointer"
                          >
                            Unblock
                          </div>
                        )}
                        <div className="px-3 py-1 rounded-full bg-gray-200 text-black cursor-pointer hover:bg-gray-300">
                          Change Role
                        </div>
                      </div>
                    </Td>
                  </tr>
                ))}
            {displayedUsers.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-gray-500">
                  {searchTerm ? "No available users" : `No ${role}s found`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Create User Panel (local state only)
function CreateUserPanel() {
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<
    Omit<Customer, "id"> | createUserData
  >({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    contact: "",
  });

  const reset = () => {
    setFormData({
      firstname: "",
      lastname: "",
      email: "",
      password: "",
      contact: "",
    });
  };

  const [formErrors, _setFormErrors] = useState<
    Partial<Record<keyof createUserData, string>>
  >({});

  const save = async () => {
    if (!formData.firstname || !formData.lastname || !formData.email) return;
    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("User Creation successful! Please verify your email.");
      } else {
        setError(data.message || "User creation failed");
      }
    } catch (err) {
      setError("An error occurred");
    }
    reset();
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold mb-3"></h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="grid gap-3"
        >
          <Input
            label="First name"
            value={formData.firstname}
            onChange={(v) => setFormData((s) => ({ ...s, firstname: v }))}
          />
          {formErrors.firstname && (
            <p className="text-red-500">{formErrors.firstname}</p>
          )}
          <Input
            label="Last name"
            value={formData.lastname}
            onChange={(v) => setFormData((s) => ({ ...s, lastname: v }))}
          />
          {formErrors.lastname && (
            <p className="text-red-500">{formErrors.lastname}</p>
          )}
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(v) => setFormData((s) => ({ ...s, email: v }))}
          />
          {formErrors.email && (
            <p className="text-red-500">{formErrors.email}</p>
          )}
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(v) => setFormData((s) => ({ ...s, password: v }))}
          />
          {formErrors.password && (
            <p className="text-red-500">{formErrors.password}</p>
          )}
          <Input
            label="Contact"
            value={formData.contact}
            onChange={(v) => setFormData((s) => ({ ...s, contact: v }))}
          />
          {formErrors.contact && (
            <p className="text-red-500">{formErrors.contact}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-litratoblack text-white px-4 py-2 rounded-lg font-bold"
            >
              Save
            </button>
          </div>
        </form>
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
