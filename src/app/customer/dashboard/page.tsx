"use client";
import { HiOutlineExternalLink, HiOutlinePlusCircle } from "react-icons/hi";
import { FaRegFileAlt } from "react-icons/fa";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import MotionDiv from "../../../../Litratocomponents/MotionDiv";
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
    "http://localhost:5000") + "/api/auth/getProfile";

export default function DashboardPage() {
  const router = useRouter();
  const [isEditable, setIsEditable] = useState(false);
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

  const Carddetails = [
    { name: "Approved", content: "7" },
    { name: "Declined", content: "3" },
    { name: "Pending", content: "5" },
  ];
  const QuickActions = [
    {
      name: "Add Organization",
      icon: (
        <HiOutlinePlusCircle className="mr-2 text-base sm:text-lg md:text-xl" />
      ),
    },
    {
      name: "View Logs",
      icon: <FaRegFileAlt className="mr-2 text-base sm:text-lg md:text-xl" />,
    },
  ];
  // Add: dashboard rows + pagination
  type Row = {
    name: string;
    date: string;
    startTime: string;
    endTime: string;
    package: string;
    place: string;
    paymentStatus: string;
    status?: "Approved" | "Declined" | "Pending";
    action: string[];
  };
  const DASHBOARD_KEY = "litrato_dashboard_table";
  const [rows, setRows] = useState<Row[]>([]);
  const PER_PAGE = 5;
  const [page, setPage] = useState(1);
  const pageWindow = (current: number, total: number, size = 3) => {
    if (total <= 0) return [];
    const start = Math.floor((Math.max(1, current) - 1) / size) * size + 1;
    const end = Math.min(total, start + size - 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };
  const loadRows = () => {
    try {
      const raw =
        (typeof window !== "undefined" &&
          localStorage.getItem(DASHBOARD_KEY)) ||
        "[]";
      const arr = Array.isArray(JSON.parse(raw))
        ? (JSON.parse(raw) as Row[])
        : [];
      // Backfill missing status to "Pending"
      const normalized = arr.map((r) => ({
        ...r,
        status: (r.status ?? "Pending") as "Approved" | "Declined" | "Pending",
      }));
      setRows(normalized);
      setPage(1);
    } catch {
      setRows([]);
      setPage(1);
    }
  };
  useEffect(() => {
    loadRows();
    const onStorage = (e: StorageEvent) => {
      if (e.key === DASHBOARD_KEY) loadRows();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const windowPages = pageWindow(page, totalPages, 3);
  const paginated = rows.slice(
    (page - 1) * PER_PAGE,
    (page - 1) * PER_PAGE + PER_PAGE
  );

  // Derive counts per status and card colors
  const counts = {
    Approved: rows.filter((r) => r.status === "Approved").length,
    Declined: rows.filter((r) => r.status === "Declined").length,
    Pending: rows.filter((r) => (r.status ?? "Pending") === "Pending").length,
  };
  const statusCards = [
    { name: "Approved", content: String(counts.Approved), bg: "bg-green-800" },
    { name: "Declined", content: String(counts.Declined), bg: "bg-litratored" },
    { name: "Pending", content: String(counts.Pending), bg: "bg-gray-600" },
  ];

  const badgeClass = (s: Row["status"]) => {
    if (s === "Approved")
      return "bg-green-100 text-white border border-green-300";
    if (s === "Declined") return "bg-red-100 text-white border border-red-300";
    return "bg-gray-600 text-white border border-gray-300";
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
                Quick Actions
              </h5>
              <div className="grid w-[90%] grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {QuickActions.map((action, i) => (
                  <div
                    key={i}
                    className="bg-[#2563EB] text-center rounded-xl w-full px-4 py-3 sm:py-3 md:py-4"
                  >
                    <div className="flex flex-row justify-center items-center text-white">
                      {action.icon}
                      <span className="text-sm sm:text-base md:text-lg">
                        {action.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <h5 className="text-base sm:text-lg md:text-xl font-medium mb-3">
                Booking Requests Status
              </h5>
              <div className="grid grid-cols-1 w-[80%] sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {statusCards.map((card, i) => (
                  <Card
                    key={i}
                    className={`rounded-2xl shadow-sm ${card.bg} text-white border-none`}
                  >
                    <CardHeader className="flex flex-row items-center justify-between text-base sm:text-lg font-medium">
                      {card.name}
                      <a href="" className="shrink-0">
                        <HiOutlineExternalLink className="text-white" />
                      </a>
                    </CardHeader>
                    <CardContent className="text-3xl sm:text-4xl font-semibold -mt-2">
                      {card.content}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <h5 className="text-base sm:text-lg md:text-xl font-medium mb-3">
                Dashboard
              </h5>
              <div className="overflow-x-auto rounded-t-xl border border-gray-200">
                <div className="max-h-[60vh] md:max-h-72 overflow-y-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="bg-gray-300">
                        {[
                          "Event Name",
                          "Date",
                          "Start Time",
                          "End Time",
                          "Package",
                          "Place",
                          "Status", // NEW
                          "Payment Status",
                          "Actions",
                        ].map((title, i, arr) => (
                          <th
                            key={i}
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
                            colSpan={9}
                          >
                            No bookings yet.
                          </td>
                        </tr>
                      ) : (
                        paginated.map((data, i) => (
                          <tr
                            className="text-left bg-gray-100 even:bg-gray-50"
                            key={i}
                          >
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.name}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.date}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.startTime}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.endTime}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.package}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.place}
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 rounded-full text-xs sm:text-sm ${badgeClass(
                                  data.status ?? "Pending"
                                )}`}
                              >
                                {data.status ?? "Pending"}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {data.paymentStatus}
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              {Array.isArray(data.action) && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <button className="bg-litratoblack text-white rounded px-2 py-1 text-xs sm:text-sm">
                                    {data.action[0]}
                                  </button>
                                  <button className="bg-litratored hover:bg-red-500 text-white rounded px-2 py-1 text-xs sm:text-sm">
                                    {data.action[1]}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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
    </MotionDiv>
  );
}
