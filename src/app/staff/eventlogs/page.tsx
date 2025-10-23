"use client";
import { useMemo, useState, useEffect } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Ellipsis } from "lucide-react";

type EventStatus = "ongoing" | "standby" | "finished";
type PaymentStatus = "paid" | "unpaid" | "partially-paid";

type EventLogRow = {
  id: string;
  eventName: string;
  clientName: string;
  location: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  packageName?: string;
  contactPerson?: string;
  contactNumber?: string;
  notes?: string;
  status: EventStatus;
  payment: PaymentStatus;
  items: {
    damaged: Array<{ name: string; qty?: number }>;
    missing: Array<{ name: string; qty?: number }>;
  };
};

// simple pagination window like in ManageBooking master list
function pageWindow(current: number, total: number, size = 3): number[] {
  if (total <= 0) return [];
  const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1;
  const end = Math.min(total, start + size - 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// badge helpers (match customer dashboard look)
const statusLabel = (s: EventStatus) =>
  s === "standby" ? "Standby" : s === "ongoing" ? "Ongoing" : "Finished";
const paymentLabel = (p: PaymentStatus) =>
  p === "paid" ? "Paid" : p === "unpaid" ? "Unpaid" : "Partially Paid";
const statusBadgeClass = (s: EventStatus) => {
  if (s === "ongoing") return "bg-yellow-700 text-white";
  if (s === "finished") return "bg-green-700 text-white";
  return "bg-gray-700 text-white"; // standby
};
const paymentBadgeClass = (p: PaymentStatus) => {
  if (p === "paid") return "bg-green-700 text-white";
  if (p === "partially-paid") return "bg-yellow-700 text-white";
  return "bg-red-700 text-white"; // unpaid
};

export default function StaffEventLogsPage() {
  // Mocked data (replace with API once backend is ready)
  const [rows, setRows] = useState<EventLogRow[]>(() => [
    {
      id: "1",
      eventName: "Acosta Wedding",
      clientName: "Maria Acosta",
      location: "Tagaytay Highlands",
      date: "2025-10-20",
      startTime: "13:00",
      endTime: "17:00",
      packageName: "The Hanz",
      contactPerson: "Coordinator Jane",
      contactNumber: "+63 912 345 6789",
      notes: "Outdoor setup near pavilion",
      status: "ongoing",
      payment: "partially-paid",
      items: {
        damaged: [{ name: "LED Panel", qty: 1 }],
        missing: [],
      },
    },
    {
      id: "2",
      eventName: "Dellara Debut",
      clientName: "Alyssa Dellara",
      location: "Okada Manila",
      date: "2025-10-18",
      startTime: "18:00",
      endTime: "22:00",
      packageName: "The Marco",
      contactPerson: "Mr. Cruz",
      contactNumber: "0917 000 1122",
      notes: "Ballroom B, 2nd floor",
      status: "finished",
      payment: "paid",
      items: {
        damaged: [],
        missing: [{ name: "Tripod Screw", qty: 2 }],
      },
    },
    {
      id: "3",
      eventName: "Corp Year-End Party",
      clientName: "ABC Corp",
      location: "BGC, Taguig",
      date: "2025-10-25",
      startTime: "19:00",
      endTime: "23:00",
      packageName: "The Aed",
      contactPerson: "HR - Leo",
      contactNumber: "0918 222 3344",
      notes: "Requires ethernet for backup",
      status: "standby",
      payment: "unpaid",
      items: {
        damaged: [],
        missing: [],
      },
    },
  ]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
  const [itemsFilter, setItemsFilter] = useState<"all" | "with" | "without">(
    "all"
  );
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "all">(
    "all"
  );
  // NEW: search text
  const [search, setSearch] = useState("");

  // Pagination derived from filtered rows
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const filteredRows = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      const statusOk =
        statusFilter === "all" ? true : r.status === statusFilter;
      const itemsCount =
        (r.items?.damaged?.length || 0) + (r.items?.missing?.length || 0);
      const itemsOk =
        itemsFilter === "all"
          ? true
          : itemsFilter === "with"
          ? itemsCount > 0
          : itemsCount === 0;
      const paymentOk =
        paymentFilter === "all" ? true : r.payment === paymentFilter;

      // NEW: search across key fields (AND across tokens)
      const hay = [
        r.eventName,
        r.clientName,
        r.location,
        r.date,
        r.startTime,
        r.endTime,
        r.packageName,
        r.contactPerson,
        r.contactNumber,
        r.notes,
        statusLabel(r.status),
        paymentLabel(r.payment),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const searchOk = tokens.length
        ? tokens.every((t) => hay.includes(t))
        : true;

      return statusOk && itemsOk && paymentOk && searchOk;
    });
  }, [rows, statusFilter, itemsFilter, paymentFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, itemsFilter, paymentFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageRows = filteredRows.slice(startIdx, startIdx + pageSize);
  const windowPages = useMemo(
    () => pageWindow(page, totalPages, 3),
    [page, totalPages]
  );

  // Items modal state
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemsTarget, setItemsTarget] = useState<EventLogRow | null>(null);

  // Optional: update function if you later wire PATCH to backend
  const updateRow = (id: string, patch: Partial<EventLogRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    // ...existing code... persist via API
  };

  return (
    <div className="p-4 flex flex-col min-h-screen w-full overflow-x-hidden">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Event Logs</h1>
      </header>

      <div className="p-4 bg-white rounded-xl h-123 gap-2 flex flex-col shadow relative">
        {/* Filters + Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Event Status filter */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as EventStatus | "all")}
          >
            <SelectTrigger size="sm" className="w-[180px] rounded">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="standby">Standby</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="finished">Finished</SelectItem>
            </SelectContent>
          </Select>

          {/* Items filter */}
          <Select
            value={itemsFilter}
            onValueChange={(v) =>
              setItemsFilter((v as "all" | "with" | "without") ?? "all")
            }
          >
            <SelectTrigger size="sm" className="w-[180px] rounded">
              <SelectValue placeholder="Items: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Items: All</SelectItem>
              <SelectItem value="with">With issues</SelectItem>
              <SelectItem value="without">No issues</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Status filter */}
          <Select
            value={paymentFilter}
            onValueChange={(v) => setPaymentFilter(v as PaymentStatus | "all")}
          >
            <SelectTrigger size="sm" className="w-[180px] rounded">
              <SelectValue placeholder="Payment: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partially-paid">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          {/* NEW: Search input + clear */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events…"
              className="h-9 w-64 max-w-[60vw] px-3 rounded-full outline-none bg-gray-400 text-sm"
              aria-label="Search events"
            />
          </div>
        </div>

        {/* Table container (customer dashboard style) */}
        <div className="overflow-x-auto rounded-t-xl  bg-white">
          <div className="max-h-[60vh] md:max-h-72 overflow-y-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-gray-300">
                  {[
                    "Event Name",
                    "Client Name",
                    "Event Location",
                    "More Details",
                    "Event Status",
                    "Items",
                    "Payment",
                  ].map((title, i, arr) => (
                    <th
                      key={title}
                      className={`px-3 sm:px-4 py-2 text-left text-xs sm:text-sm md:text-base ${
                        i === 0 ? "rounded-tl-xl" : ""
                      } ${i === arr.length - 1 ? "rounded-tr-xl" : ""}`}
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr className="text-left bg-gray-50">
                    <td
                      className="px-3 sm:px-4 py-6 text-center text-sm"
                      colSpan={7}
                    >
                      No event logs found
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className="text-left bg-gray-100 even:bg-gray-50 border-t"
                    >
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        {row.eventName}
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        {row.clientName}
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        {row.location}
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="p-1 rounded hover:bg-gray-200 transition"
                              aria-label="More details"
                              title="More details"
                            >
                              <Ellipsis />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3" align="end">
                            <div className="text-sm space-y-2">
                              <div className="grid grid-cols-2 gap-x-2">
                                <div className="font-semibold">Date</div>
                                <div className="text-gray-700">
                                  {row.date || "—"}
                                </div>
                                <div className="font-semibold">Time</div>
                                <div className="text-gray-700">
                                  {row.startTime || "—"}
                                  {row.endTime ? ` - ${row.endTime}` : ""}
                                </div>
                                <div className="font-semibold">Package</div>
                                <div className="text-gray-700">
                                  {row.packageName || "—"}
                                </div>
                                <div className="font-semibold">Contact</div>
                                <div className="text-gray-700">
                                  {(row.contactPerson || "").trim() || "—"}
                                  {row.contactNumber
                                    ? ` | ${row.contactNumber}`
                                    : ""}
                                </div>
                              </div>
                              {row.notes ? (
                                <div>
                                  <div className="font-semibold">Notes</div>
                                  <div className="text-gray-700 whitespace-pre-wrap">
                                    {row.notes}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-1 w-18 text-center rounded-full text-xs font-medium ${statusBadgeClass(
                            row.status
                          )}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        <button
                          className="px-2 py-1.5 rounded border text-sm"
                          onClick={() => {
                            setItemsTarget(row);
                            setItemsOpen(true);
                          }}
                        >
                          View
                        </button>
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-1 w-22 text-center rounded-full text-xs font-medium ${paymentBadgeClass(
                            row.payment
                          )}`}
                        >
                          {paymentLabel(row.payment)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-3 py-2 absolute bottom-0 left-0 right-0">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  className="text-black no-underline hover:no-underline hover:text-black"
                  style={{ textDecoration: "none" }}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                />
              </PaginationItem>
              {windowPages.map((n) => (
                <PaginationItem key={n}>
                  <PaginationLink
                    href="#"
                    isActive={n === page}
                    className="text-black no-underline hover:no-underline hover:text-black"
                    style={{ textDecoration: "none" }}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(n);
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
                  style={{ textDecoration: "none" }}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* Items modal (unchanged) */}
      <Dialog
        open={itemsOpen}
        onOpenChange={(o) => {
          if (!o) {
            setItemsOpen(false);
            setItemsTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Items report</DialogTitle>
            <DialogDescription>
              Damaged and missing items for this event
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="font-semibold mb-2">Damaged</div>
              {itemsTarget?.items.damaged?.length ? (
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {itemsTarget.items.damaged.map((it, idx) => (
                    <li key={`d-${idx}`}>
                      {it.name}
                      {it.qty ? ` × ${it.qty}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">None</div>
              )}
            </div>
            <div>
              <div className="font-semibold mb-2">Missing</div>
              {itemsTarget?.items.missing?.length ? (
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {itemsTarget.items.missing.map((it, idx) => (
                    <li key={`m-${idx}`}>
                      {it.name}
                      {it.qty ? ` × ${it.qty}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">None</div>
              )}
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              className="px-4 py-2 rounded border text-sm"
              onClick={() => {
                setItemsOpen(false);
                setItemsTarget(null);
              }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
