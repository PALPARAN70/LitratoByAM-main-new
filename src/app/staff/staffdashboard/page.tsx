"use client";
import { useMemo, useState, useEffect } from "react";
import EventCard from "../../../../Litratocomponents/EventCard";
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
// REMOVE unused card imports and icon
// import { Card, CardHeader, CardContent } from "@/components/ui/card";
// import { HiOutlineExternalLink } from "react-icons/hi";
// ADD: select for filters
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = "ongoing" | "standby" | "finished";
// CHANGED: include 'paid' for filter consistency
type Payment = "unpaid" | "partially-paid" | "paid";
type Item = { name: string; qty?: number };
type StaffEvent = {
  title: string;
  dateTime: string;
  location: string;
  status: Status;
  payment: Payment;
  imageUrl?: string;
  damagedItems?: Item[];
  missingItems?: Item[];
};

// shared 3-page window helper
function pageWindow(current: number, total: number, size = 3): number[] {
  if (total <= 0) return [];
  const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1;
  const end = Math.min(total, start + size - 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function DashboardPage() {
  // sample events (replace with API data when available)
  const events: StaffEvent[] = useMemo(
    () => [
      {
        title: "Wedding",
        dateTime: "June 5, 2026 - 3:00PM",
        location: "Davao City",
        status: "ongoing",
        payment: "partially-paid",
        damagedItems: [{ name: "Tripod", qty: 1 }],
        missingItems: [{ name: "Umbrella Light", qty: 2 }],
      },
      {
        title: "Corporate Gala",
        dateTime: "June 6, 2026 - 6:30PM",
        location: "SMX Convention Center",
        status: "standby",
        payment: "unpaid",
      },
      {
        title: "Birthday Party",
        dateTime: "June 7, 2026 - 2:00PM",
        location: "Matina",
        status: "finished",
        payment: "partially-paid",
      },
      {
        title: "Product Launch",
        dateTime: "June 8, 2026 - 10:00AM",
        location: "Abreeza Mall",
        status: "ongoing",
        payment: "unpaid",
      },
      {
        title: "Anniversary",
        dateTime: "June 9, 2026 - 4:00PM",
        location: "Lanang",
        status: "standby",
        payment: "partially-paid",
      },
      {
        title: "Workshop",
        dateTime: "June 10, 2026 - 9:00AM",
        location: "Bajada",
        status: "finished",
        payment: "unpaid",
      },
      {
        title: "Festival",
        dateTime: "June 11, 2026 - 1:00PM",
        location: "Roxas Ave.",
        status: "ongoing",
        payment: "partially-paid",
      },
      {
        title: "Reunion",
        dateTime: "June 12, 2026 - 5:00PM",
        location: "Toril",
        status: "standby",
        payment: "unpaid",
      },
      {
        title: "Conference",
        dateTime: "June 13, 2026 - 8:00AM",
        location: "IT Park",
        status: "finished",
        payment: "partially-paid",
      },
      {
        title: "Charity Ball",
        dateTime: "June 14, 2026 - 7:30PM",
        location: "City Hall",
        status: "ongoing",
        payment: "unpaid",
      },
      {
        title: "Team Building",
        dateTime: "June 15, 2026 - 11:00AM",
        location: "Samal",
        status: "standby",
        payment: "partially-paid",
      },
      {
        title: "Engagement",
        dateTime: "June 16, 2026 - 4:30PM",
        location: "Ecoland",
        status: "finished",
        payment: "unpaid",
      },
    ],
    []
  );

  // REPLACED: standalone status-only filter with 3 filters + search
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [itemsFilter, setItemsFilter] = useState<"all" | "with" | "without">(
    "all"
  );
  const [paymentFilter, setPaymentFilter] = useState<Payment | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setPage(1);
  }, [statusFilter, itemsFilter, paymentFilter, search]);

  // CHANGED: combine all filters + search
  const filteredEvents = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return events.filter((e) => {
      const statusOk =
        statusFilter === "all" ? true : e.status === statusFilter;
      const issues =
        (e.damagedItems?.length || 0) + (e.missingItems?.length || 0);
      const itemsOk =
        itemsFilter === "all"
          ? true
          : itemsFilter === "with"
          ? issues > 0
          : issues === 0;
      const paymentOk =
        paymentFilter === "all" ? true : e.payment === paymentFilter;
      const hay = `${e.title} ${e.location} ${e.dateTime}`.toLowerCase();
      const searchOk = tokens.length
        ? tokens.every((t) => hay.includes(t))
        : true;
      return statusOk && itemsOk && paymentOk && searchOk;
    });
  }, [events, statusFilter, itemsFilter, paymentFilter, search]);

  // CHANGED: pagination uses filtered list
  const PER_PAGE = 5;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PER_PAGE));
  const windowPages = pageWindow(page, totalPages, 3);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages, filteredEvents.length]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filteredEvents.slice(start, start + PER_PAGE);
  }, [filteredEvents, page]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold">
            Hello Staff
          </h1>
          <div className="p-4 bg-white shadow rounded-xl gap-2 flex flex-col">
            {/* NEW: Filters toolbar (replaces status cards) */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as Status | "all")}
              >
                <SelectTrigger className="w-[180px] rounded h-9 focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0">
                  <SelectValue placeholder="Status: All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Statuses: All</SelectItem>
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
                <SelectTrigger className="w-[180px] rounded h-9 focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0">
                  <SelectValue placeholder="Items: All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Items: All</SelectItem>
                  <SelectItem value="with">With issues</SelectItem>
                  <SelectItem value="without">No issues</SelectItem>
                </SelectContent>
              </Select>

              {/* Payment filter */}
              <Select
                value={paymentFilter}
                onValueChange={(v) => setPaymentFilter(v as Payment | "all")}
              >
                <SelectTrigger className="w-[200px] rounded h-9 focus:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0">
                  <SelectValue placeholder="Payment: All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Payments: All</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partially-paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>

              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events…"
                className="h-9 w-64 max-w-[60vw] px-3 rounded-full outline-none bg-gray-400 text-sm"
                aria-label="Search events"
              />
            </div>

            {/* cards grid (unchanged) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {paginated.map((ev, idx) => (
                <EventCard
                  key={`${ev.title}-${idx}`}
                  title={ev.title}
                  dateTime={ev.dateTime}
                  location={ev.location}
                  status={ev.status}
                  imageUrl={ev.imageUrl}
                  damagedItems={ev.damagedItems}
                  missingItems={ev.missingItems}
                />
              ))}
            </div>

            {/* pagination (unchanged) */}
            <div className="mt-2">
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
        </div>
      </div>
    </div>
  );
}
