"use client";
import {
  HiOutlineExternalLink,
  // HiOutlinePlusCircle,
  // HiOutlineDotsHorizontal,
} from "react-icons/hi";
import { Ellipsis } from "lucide-react";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import type { ChangeEventHandler } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import MotionDiv from "../../../../Litratocomponents/MotionDiv";
import { cancelBookingRequest as cancelReq } from "../../../../schemas/functions/BookingRequest/cancelBookingRequest";
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
    "http://localhost:5000") + "/api/auth/getProfile";

export default function DashboardPage() {
  const router = useRouter();
  const [personalForm, setPersonalForm] = useState({
    Firstname: "",
    Lastname: "",
  });

  const [profile, setProfile] = useState<{
    username: string;
    email: string;
    role: string;
    url?: string;
    firstname?: string;
    lastname?: string;
  } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: ac.signal,
        });

        if (res.status === 401) {
          try {
            localStorage.removeItem("access_token");
          } catch {}
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch profile");

        const data = await res.json();
        setProfile(data);
        setPersonalForm({
          Firstname: data.firstname || "",
          Lastname: data.lastname || "",
        });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        toast.error("Error fetching profile");
      }
    })();

    return () => ac.abort();
  }, [router]);

  // Add: dashboard rows + pagination
  type Row = {
    name: string;
    date: string;
    startTime: string;
    endTime: string;
    package: string;
    grid?: string;
    place: string;
    paymentStatus: string;
    status?: "Approved" | "Declined" | "Pending" | "Cancelled"; // extended
    action: string[];
    requestid?: number; // add: used for update navigation
    contact_info?: string | null;
    contact_person?: string | null;
    contact_person_number?: string | null;
    strongest_signal?: string | null;
    extension_duration?: number | null;
    // NEW: contract status per booking/request
    contractStatus?: "pending" | "finished";
  };
  const [rows, setRows] = useState<Row[]>([]);
  const PER_PAGE = 5;
  const [page, setPage] = useState(1);

  // NEW: status filter state
  const [statusFilter, setStatusFilter] = useState<Row["status"] | null>(null);
  useEffect(() => {
    setPage(1); // reset to first page when filter changes
  }, [statusFilter]);

  const pageWindow = (current: number, total: number, size = 3) => {
    if (total <= 0) return [];
    const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1;
    const end = Math.min(total, start + size - 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  // Convert "hh:mm am/pm" to "HH:MM"
  const to24h = (s: string) => {
    if (!s) return "";
    const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!m) return s;
    let h = parseInt(m[1], 10);
    const mm = m[2];
    const ap = m[3].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${mm}`;
  };

  // Normalize a variety of date strings to YYYY-MM-DD
  const toISODate = (s: string) => {
    if (!s) return "";
    // Already ISO
    const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
    // Common local format MM/DD/YYYY
    const mUs = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mUs) {
      const mm = String(mUs[1]).padStart(2, "0");
      const dd = String(mUs[2]).padStart(2, "0");
      const yyyy = mUs[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    // Fallback: Date parse
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return s;
  };

  // Helper: 24h to 12h
  const to12h = (t: string) => {
    if (!t) return "";
    const [HHs, MMs] = t.split(":");
    const HH = parseInt(HHs || "0", 10);
    const MM = parseInt(MMs || "0", 10);
    const ampm = HH >= 12 ? "pm" : "am";
    const h12 = (HH % 12 || 12).toString().padStart(2, "0");
    return `${h12}:${String(MM || 0).padStart(2, "0")} ${ampm}`;
  };

  // Load rows from server for the current authenticated customer
  const loadRows = async () => {
    try {
      const token =
        (typeof window !== "undefined" &&
          localStorage.getItem("access_token")) ||
        null;
      if (!token) {
        setRows([]);
        setPage(1);
        return;
      }

      const API_URL =
        (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
          "http://localhost:5000") + "/api/customer/bookingRequest";

      const res = await fetch(API_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        setRows([]);
        setPage(1);
        return;
      }

      const data = await res.json().catch(() => ({}));
      const bookings = Array.isArray(data?.bookings) ? data.bookings : [];

      const toTitle = (s: string | null | undefined) => {
        const v = String(s || "").toLowerCase();
        if (v === "accepted" || v === "approved") return "Approved" as const;
        if (v === "rejected" || v === "declined") return "Declined" as const;
        if (v === "cancelled" || v === "canceled") return "Cancelled" as const;
        return "Pending" as const;
      };

      const mapped: Row[] = bookings.map((b: any) => {
        const timeStart = String(b.event_time ?? b.eventtime ?? "").slice(0, 5);
        const timeEnd = String(b.event_end_time ?? "").slice(0, 5);
        const dateISO = toISODate(String(b.event_date ?? b.eventdate ?? ""));
        // Derive grid names from either grid_names array or legacy grid string
        const gridNames: string[] = Array.isArray(b.grid_names)
          ? b.grid_names
              .map((n: any) => String(n || "").trim())
              .filter((s: string) => !!s)
          : String(b.grid || "")
              .split(",")
              .map((s: string) => s.trim())
              .filter((s: string) => !!s);
        const gridString = gridNames.join(", ");
        return {
          name: b.event_name ?? "",
          date: dateISO,
          startTime: to12h(timeStart),
          endTime: timeEnd ? to12h(timeEnd) : "",
          package: (b.package_name ?? "").trim(),
          grid: gridString,
          place: (b.event_address ?? b.eventaddress ?? "").trim(),
          paymentStatus: (b.payment_status ?? "Pending") as string,
          status: toTitle(b.status as string),
          action: ["Cancel", "Reschedule"],
          requestid: b.requestid != null ? Number(b.requestid) : undefined,
          contact_info: b.contact_info ?? null,
          contact_person: b.contact_person ?? null,
          contact_person_number: b.contact_person_number ?? null,
          strongest_signal: b.strongest_signal ?? null,
          extension_duration:
            typeof b.extension_duration === "number"
              ? b.extension_duration
              : b.extension_duration != null
              ? Number(b.extension_duration)
              : null,
          // NEW: default to pending; will refine below
          contractStatus: "pending",
        };
      });

      // Sort by date desc then time desc
      mapped.sort((a, b) => {
        const ta = Date.parse(`${a.date} ${to24h(a.startTime)}`) || 0;
        const tb = Date.parse(`${b.date} ${to24h(b.startTime)}`) || 0;
        return tb - ta;
      });

      setRows(mapped);
      setPage(1);

      // NEW: refine contractStatus by checking each request's contract data
      // Runs after rows are set; non-blocking
      try {
        const results: Array<{
          requestid?: number;
          status: "pending" | "finished";
        }> = [];
        for (const r of mapped) {
          if (!r.requestid) {
            results.push({ requestid: undefined, status: "pending" });
            continue;
          }
          try {
            const res = await fetch(
              `${getApiBase()}/by-request/${encodeURIComponent(
                String(r.requestid)
              )}`,
              { headers: { ...getAuthHeader() }, cache: "no-store" }
            );
            if (!res.ok) {
              results.push({ requestid: r.requestid, status: "pending" });
              continue;
            }
            const data = await res.json().catch(() => ({}));
            // Heuristics: consider finished when a signed contract url is present
            const hasSigned = !!(
              data?.signed_contract?.url ||
              data?.signed_url ||
              data?.signedContractUrl ||
              data?.user_signed_url
            );
            results.push({
              requestid: r.requestid,
              status: hasSigned ? "finished" : "pending",
            });
          } catch {
            results.push({ requestid: r.requestid, status: "pending" });
          }
        }
        setRows((prev) =>
          prev.map((r) => {
            const hit = results.find((x) => x.requestid === r.requestid);
            return hit ? { ...r, contractStatus: hit.status } : r;
          })
        );
      } catch {
        // ignore preload errors
      }
    } catch {
      setRows([]);
      setPage(1);
    }
  };
  useEffect(() => {
    void loadRows();
  }, []);

  // Compute filtered rows based on selected status
  const filteredRows = statusFilter
    ? rows.filter((r) => (r.status ?? "Pending") === statusFilter)
    : rows;

  // Use filtered rows for pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PER_PAGE));
  const windowPages = pageWindow(page, totalPages, 3);
  const paginated = filteredRows.slice(
    (page - 1) * PER_PAGE,
    (page - 1) * PER_PAGE + PER_PAGE
  );

  // Derive counts per status and card colors
  const counts = {
    Approved: rows.filter((r) => r.status === "Approved").length,
    Declined: rows.filter((r) => r.status === "Declined").length,
    Pending: rows.filter((r) => (r.status ?? "Pending") === "Pending").length,
    Cancelled: rows.filter((r) => r.status === "Cancelled").length, // fixed
  };
  const statusCards: { name: Row["status"]; content: string; bg: string }[] = [
    { name: "Pending", content: String(counts.Pending), bg: "bg-gray-700" },
    { name: "Approved", content: String(counts.Approved), bg: "bg-green-700" },
    { name: "Declined", content: String(counts.Declined), bg: "bg-litratored" },

    {
      name: "Cancelled",
      content: String(counts.Cancelled),
      bg: "bg-orange-700",
    },
  ];

  const badgeClass = (s: Row["status"]) => {
    if (s === "Approved") return "bg-green-700 text-white ";
    if (s === "Declined") return "bg-red-700 text-white ";
    if (s === "Cancelled") return "bg-orange-700 text-white";
    return "bg-gray-700 text-white ";
  };

  // ADD: confirmation modal states
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedTarget, setReschedTarget] = useState<Row | null>(null);

  // Contract upload helpers
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Row | null>(null);

  const handleReschedule = (row: Row) => {
    if (!row.requestid) {
      toast.error("Cannot update this entry. Missing request id.");
      return;
    }
    // NEW: block reschedule for cancelled bookings
    if ((row.status ?? "Pending") === "Cancelled") {
      toast.error("Cancelled bookings cannot be rescheduled.");
      return;
    }
    // Prevent edits within 7 days of event
    try {
      const days = daysUntil(row.date);
      if (days <= 7) {
        toast.error("Editing is disabled within 7 days of the event.");
        return;
      }
    } catch {}
    router.push(`/customer/booking?requestid=${row.requestid}`);
  };

  const handleCancel = async (row: Row) => {
    if (!row.requestid) {
      toast.error("Cannot cancel this entry. Missing request id.");
      return;
    }
    // NEW: block cancel for declined or cancelled bookings
    const st = row.status ?? "Pending";
    if (st === "Declined") {
      toast.error("Declined bookings cannot be cancelled.");
      return;
    }
    if (st === "Cancelled") {
      toast.error("This booking is already cancelled.");
      return;
    }
    try {
      await cancelReq(row.requestid);
      // Update local state/status to Declined (or Cancelled) and persist to localStorage
      const updated: Row[] = rows.map((r) =>
        r.requestid === row.requestid
          ? { ...r, status: "Cancelled" as "Cancelled" }
          : r
      );
      setRows(updated);
      toast.success("Booking cancelled");
    } catch (e: any) {
      toast.error(e?.message || "Failed to cancel booking");
    }
  };

  // NEW: handle payment
  const handlePay = (row: Row) => {
    if (!row.requestid) {
      toast.error("Cannot proceed to payment. Missing request id.");
      return;
    }
    if ((row.status ?? "Pending") !== "Approved") {
      toast.error("Payment is only available for approved bookings.");
      return;
    }
    // Resolve confirmed booking id, then navigate to payment page
    (async () => {
      try {
        const token =
          (typeof window !== "undefined" &&
            localStorage.getItem("access_token")) ||
          null;
        if (!token) {
          toast.error("Please login again.");
          return;
        }
        const base =
          (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
            "http://localhost:5000") +
          "/api/customer/confirmed-bookings/by-request/" +
          row.requestid;
        const res = await fetch(base, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        if (!res.ok) {
          toast.error("Unable to resolve booking for payment.");
          return;
        }
        const data = await res.json();
        const bookingId = data?.booking?.id;
        if (!bookingId) {
          toast.error("Booking not found or not ready for payment.");
          return;
        }
        router.push(`/customer/payments/${bookingId}`);
      } catch (e) {
        toast.error("Failed to start payment.");
      }
    })();
  };

  // Payment badge helpers (match Master List)
  type Payment = "paid" | "unpaid" | "partially-paid";
  const mapPaymentStatus = (s?: string): Payment => {
    switch ((s || "").toLowerCase()) {
      case "paid":
        return "paid";
      case "partial":
      case "partially-paid":
        return "partially-paid";
      case "unpaid":
      case "refunded":
      case "failed":
      default:
        return "unpaid";
    }
  };
  const paymentLabel = (p: Payment) =>
    p === "paid" ? "Paid" : p === "unpaid" ? "Unpaid" : "Partially Paid";
  const paymentBadgeClass = (p: Payment) => {
    if (p === "paid") return "bg-green-700 text-white";
    if (p === "partially-paid") return "bg-yellow-700 text-white";
    return "bg-red-700 text-white"; // unpaid
  };
  // NEW: contract status helpers
  const contractLabel = (s: "pending" | "finished") =>
    s === "finished" ? "Finished" : "Pending";
  const contractBadgeClass = (s: "pending" | "finished") =>
    s === "finished" ? "bg-green-700 text-white" : "bg-gray-700 text-white";

  // Contract API helpers
  const getApiBase = () =>
    (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
      "http://localhost:5000") + "/api/customer/contracts";

  const getAuthHeader = () => {
    const token =
      (typeof window !== "undefined" && localStorage.getItem("access_token")) ||
      null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const viewContract = async (row: Row) => {
    if (!row.requestid) {
      toast.error("Missing request id.");
      return;
    }
    try {
      const res = await fetch(
        `${getApiBase()}/by-request/${encodeURIComponent(
          String(row.requestid)
        )}`,
        { headers: { ...getAuthHeader() }, cache: "no-store" }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json().catch(() => ({}));
      const url: string | undefined =
        data?.contract?.url || data?.url || data?.contract_url;
      if (!url) {
        toast.error("No contract available.");
        return;
      }
      window.open(url, "_blank");
    } catch (e) {
      toast.error("Failed to open contract.");
    }
  };

  const onPickUpload = (row: Row) => {
    setUploadTarget(row);
    uploadInputRef.current?.click();
  };

  const onUploadFile: ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file || !uploadTarget?.requestid) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestid", String(uploadTarget.requestid));
      const res = await fetch(`${getApiBase()}/upload-signed`, {
        method: "POST",
        headers: { ...getAuthHeader() },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Signed contract uploaded.");
      // NEW: mark this row as finished
      setRows((prev) =>
        prev.map((r) =>
          r.requestid === uploadTarget.requestid
            ? { ...r, contractStatus: "finished" }
            : r
        )
      );
    } catch (err) {
      toast.error("Upload failed.");
    } finally {
      setUploadTarget(null);
    }
  };

  return (
    <MotionDiv>
      <div className="min-h-screen w-full overflow-x-hidden">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold">
              Hello, {personalForm.Firstname} {personalForm.Lastname}!
            </h1>

            <div className="flex flex-col">
              <h5 className="text-base sm:text-lg md:text-xl font-medium mb-3">
                Booking Requests Status
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {statusCards.map((card, i) => {
                  const active = statusFilter === card.name;
                  return (
                    <Card
                      key={i}
                      onClick={() =>
                        setStatusFilter((prev) =>
                          prev === card.name ? null : card.name
                        )
                      }
                      className={`rounded-2xl hover:shadow-litratored shadow-md ${
                        card.bg
                      } text-white ${
                        active ? "ring-2 ring-litratored" : "border-none"
                      } cursor-pointer transition`}
                    >
                      <CardHeader className="flex flex-row items-center justify-between text-base sm:text-lg font-medium">
                        {card.name}
                        <a
                          href="#"
                          className="shrink-0"
                          onClick={(e) => e.preventDefault()}
                        >
                          <HiOutlineExternalLink className="text-white" />
                        </a>
                      </CardHeader>
                      <CardContent className="text-3xl sm:text-4xl font-semibold -mt-2">
                        {card.content}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col">
              <h5 className="text-base sm:text-lg md:text-xl font-medium mb-3">
                Dashboard{statusFilter ? ` • ${statusFilter}` : ""}
              </h5>
              <div className="rounded-t-xl border border-gray-200">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-300">
                      {[
                        "Event Name",
                        "Client Name",
                        "Event Location",
                        "More Details",
                        "Status",
                        "Payment Status",
                        // CHANGED: keep Contract column but as status badge
                        "Contract",
                        "Actions",
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
                    {paginated.length === 0 ? (
                      <tr className="text-left bg-gray-50">
                        <td
                          className="px-3 sm:px-4 py-6 text-center text-sm"
                          colSpan={8}
                        >
                          {statusFilter
                            ? "No bookings for this status."
                            : "No bookings yet."}
                        </td>
                      </tr>
                    ) : (
                      paginated.map((data, i) => (
                        <tr
                          className="text-left bg-gray-100 even:bg-gray-50"
                          key={i}
                        >
                          {/* Event Name */}
                          <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                            {data.name}
                          </td>
                          {/* Client Name (derive from booking or profile) */}
                          <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                            {(() => {
                              const byField = (
                                data.contact_person || ""
                              ).trim();
                              const byProfile = [
                                profile?.firstname,
                                profile?.lastname,
                              ]
                                .filter(Boolean)
                                .join(" ")
                                .trim();
                              return byField || byProfile || "—";
                            })()}
                          </td>
                          {/* Event Location */}
                          <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                            {data.place}
                          </td>
                          {/* More Details */}
                          <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className="px-2 py-1 rounded hover:bg-gray-200 transition"
                                  aria-label="More details"
                                  title="More details"
                                >
                                  <Ellipsis className="text-2xl" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-64 p-3">
                                {/* Move all other booking details here */}
                                {/* ...existing details content (date, time, package, grids, contact, etc.)... */}
                                <div className="text-sm space-y-2">
                                  {/* Date/Time/Package */}
                                  <div className="grid grid-cols-2 gap-x-2">
                                    <div className="font-semibold">Date</div>
                                    <div className="text-gray-700">
                                      {data.date || "—"}
                                    </div>
                                    <div className="font-semibold">Time</div>
                                    <div className="text-gray-700">
                                      {data.startTime || "—"}
                                      {data.endTime ? ` - ${data.endTime}` : ""}
                                    </div>
                                    <div className="font-semibold">Package</div>
                                    <div className="text-gray-700">
                                      {data.package || "—"}
                                    </div>
                                  </div>
                                  {/* Contact info */}
                                  <div>
                                    <div className="font-semibold">
                                      Contact info
                                    </div>
                                    <div className="text-gray-700 whitespace-pre-wrap">
                                      {data.contact_info || "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-semibold">
                                      Contact person
                                    </div>
                                    <div className="text-gray-700 whitespace-pre-wrap">
                                      <div>
                                        <span className="font-medium">
                                          Name:
                                        </span>{" "}
                                        {(() => {
                                          const byField = (
                                            data.contact_person || ""
                                          ).trim();
                                          const byName = [
                                            profile?.firstname,
                                            profile?.lastname,
                                          ]
                                            .filter(Boolean)
                                            .join(" ")
                                            .trim();
                                          const val = byField || byName;
                                          return val || "—";
                                        })()}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Number:
                                        </span>{" "}
                                        {(() => {
                                          const direct = (
                                            data.contact_person_number || ""
                                          ).trim();
                                          if (direct) return direct;
                                          const info = (
                                            data.contact_info || ""
                                          ).toString();
                                          const m =
                                            info.match(/(\+?\d[\d\s-]{6,}\d)/);
                                          const extracted = (
                                            m?.[1] || ""
                                          ).trim();
                                          return extracted || "—";
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-semibold">
                                      Strongest signal
                                    </div>
                                    <div className="text-gray-700">
                                      {data.strongest_signal || "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-semibold">
                                      Extension duration
                                    </div>
                                    <div className="text-gray-700">
                                      {data.extension_duration ?? "—"}
                                      {data.extension_duration != null
                                        ? " hr"
                                        : ""}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-semibold">Grids</div>
                                    {(() => {
                                      const names = (data.grid || "")
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter((s) => s && s !== "—");
                                      return names.length ? (
                                        <ul className="list-disc list-inside text-gray-700">
                                          {names.map((n) => (
                                            <li key={n}>{n}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <div className="text-gray-700">—</div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </td>
                          {/* Status */}
                          <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-1 w-18 text-center rounded-full text-xs font-medium ${badgeClass(
                                data.status ?? "Pending"
                              )}`}
                            >
                              {data.status ?? "Pending"}
                            </span>
                          </td>
                          {/* Payment Status */}
                          <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-1 w-22 text-center rounded-full text-xs font-medium ${paymentBadgeClass(
                                mapPaymentStatus(data.paymentStatus)
                              )}`}
                            >
                              {paymentLabel(
                                mapPaymentStatus(data.paymentStatus)
                              )}
                            </span>
                          </td>
                          {/* Contract (status badge only) */}
                          <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-1 w-22 text-center rounded-full text-xs font-medium ${contractBadgeClass(
                                data.contractStatus ?? "pending"
                              )}`}
                            >
                              {contractLabel(data.contractStatus ?? "pending")}
                            </span>
                          </td>

                          {/* Actions (add contract actions here) */}
                          <td className="px-3 sm:px-4 py-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className="px-2 py-1 rounded hover:bg-gray-200 transition"
                                  aria-label="Actions"
                                >
                                  <Ellipsis className="text-lg" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-44 p-2">
                                <div className="flex flex-col gap-2 text-center">
                                  Approval is needed for payment.
                                  {/* NEW: Contract actions moved here */}
                                  <button
                                    className="w-full rounded px-2 py-1 text-xs border"
                                    onClick={() => viewContract(data)}
                                  >
                                    View Contract
                                  </button>
                                  <button
                                    className="w-full rounded px-2 py-1 text-xs bg-litratoblack text-white"
                                    onClick={() => onPickUpload(data)}
                                  >
                                    Upload Signed Contract
                                  </button>
                                  {/* CHANGED: cancel disabled for Declined/Cancelled */}
                                  <button
                                    className="w-full bg-litratoblack text-white rounded px-2 py-1 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={
                                      (data.status ?? "Pending") ===
                                        "Declined" ||
                                      (data.status ?? "Pending") === "Cancelled"
                                    }
                                    onClick={() => {
                                      const st = data.status ?? "Pending";
                                      if (st === "Declined") {
                                        toast.error(
                                          "Declined bookings cannot be cancelled."
                                        );
                                        return;
                                      }
                                      if (st === "Cancelled") {
                                        toast.error(
                                          "This booking is already cancelled."
                                        );
                                        return;
                                      }
                                      setCancelTarget(data);
                                      setCancelOpen(true);
                                    }}
                                  >
                                    {data.action[0] ?? "Cancel"}
                                  </button>
                                  {/* CHANGED: reschedule disabled for Cancelled or within 7 days */}
                                  <button
                                    className="w-full bg-litratored text-white rounded px-2 py-1 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => {
                                      const st = data.status ?? "Pending";
                                      const within7 = (() => {
                                        try {
                                          return daysUntil(data.date) <= 7;
                                        } catch {
                                          return false;
                                        }
                                      })();
                                      if (st === "Cancelled") {
                                        toast.error(
                                          "Cancelled bookings cannot be rescheduled."
                                        );
                                        return;
                                      }
                                      if (within7) {
                                        toast.error(
                                          "Editing is disabled within 7 days of the event."
                                        );
                                        return;
                                      }
                                      setReschedTarget(data);
                                      setReschedOpen(true);
                                    }}
                                    disabled={(() => {
                                      const st = data.status ?? "Pending";
                                      try {
                                        return (
                                          st === "Cancelled" ||
                                          daysUntil(data.date) <= 7
                                        );
                                      } catch {
                                        return st === "Cancelled";
                                      }
                                    })()}
                                  >
                                    {data.action[1] ?? "Reschedule"}
                                  </button>
                                  <button
                                    className="w-full bg-green-700 text-white rounded px-2 py-1 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => handlePay(data)}
                                    disabled={
                                      (data.status ?? "Pending") !== "Approved"
                                    }
                                  >
                                    Pay
                                  </button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add: pagination like inventory tables */}
              <div className="mt-3">
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

      {/* ADD: Cancel confirmation dialog */}
      <Dialog
        open={cancelOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCancelOpen(false);
            setCancelTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel booking?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Event:</span>{" "}
              {cancelTarget?.name || "—"}
            </div>
            <div>
              <span className="font-medium">Date:</span>{" "}
              {cancelTarget?.date || "—"}
            </div>
            <div>
              <span className="font-medium">Time:</span>{" "}
              {cancelTarget?.startTime || "—"}
              {cancelTarget?.endTime ? ` - ${cancelTarget.endTime}` : ""}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded border text-sm"
              >
                No, keep booking
              </button>
            </DialogClose>
            <button
              type="button"
              className="px-4 py-2 rounded bg-litratored text-white text-sm"
              onClick={async () => {
                if (cancelTarget) {
                  await handleCancel(cancelTarget);
                }
                setCancelOpen(false);
                setCancelTarget(null);
              }}
            >
              Yes, cancel it
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD: Reschedule confirmation dialog */}
      <Dialog
        open={reschedOpen}
        onOpenChange={(o) => {
          if (!o) {
            setReschedOpen(false);
            setReschedTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule booking?</DialogTitle>
            <DialogDescription>
              You will be redirected to the reschedule page.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Event:</span>{" "}
              {reschedTarget?.name || "—"}
            </div>
            <div>
              <span className="font-medium">Current date:</span>{" "}
              {reschedTarget?.date || "—"}
            </div>
            <div>
              <span className="font-medium">Current time:</span>{" "}
              {reschedTarget?.startTime || "—"}
              {reschedTarget?.endTime ? ` - ${reschedTarget.endTime}` : ""}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded border text-sm"
              >
                No, go back
              </button>
            </DialogClose>
            <button
              type="button"
              className="px-4 py-2 rounded bg-litratoblack text-white text-sm"
              onClick={() => {
                if (reschedTarget) {
                  handleReschedule(reschedTarget);
                }
                setReschedOpen(false);
                setReschedTarget(null);
              }}
            >
              Yes, reschedule
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden input for contract upload */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={onUploadFile}
      />
    </MotionDiv>
  );
}

// Helper: days until date (YYYY-MM-DD)
function daysUntil(dateISO: string): number {
  if (!dateISO) return Infinity;
  const [y, m, d] = dateISO.split("-").map((n) => parseInt(n || "0", 10));
  const event = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const now = new Date();
  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const eventUTC = event.getTime();
  const diffMs = eventUTC - todayUTC;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}
