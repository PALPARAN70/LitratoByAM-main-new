"use client";
import { HiOutlineExternalLink, HiOutlinePlusCircle } from "react-icons/hi";
import { FaRegFileAlt } from "react-icons/fa";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import MotionDiv from "../../../../Litratocomponents/MotionDiv";
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
  const tabletitles = [
    "Event Name",
    "Date",
    "Start Time",
    "End Time",
    "Package",
    "Place",
    "Payment Status",
    "Actions",
  ];
  const tabledata = [
    {
      name: "Mary & John Wedding",
      date: "2023-10-01",
      startTime: "07:00 am",
      endTime: "09:00 am",
      package: "The Hanz",
      place: "Beach Resort",
      paymentStatus: "Paid",
      action: ["Cancel", "Reschedule"],
    },
    {
      name: "Mary & John Wedding",
      date: "2023-10-01",
      startTime: "07:00 am",
      endTime: "09:00 am",
      package: "The Hanz",
      place: "Beach Resort",
      paymentStatus: "Paid",
      action: ["Cancel", "Reschedule"],
    },
  ];
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
                Quick Actions
              </h5>
              <div className="grid grid-cols-1 w-[80%] sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Carddetails.map((card, i) => (
                  <Card
                    key={i}
                    className="border-black border-2 rounded-2xl bg-gray-300/90 shadow-sm"
                  >
                    <CardHeader className="flex flex-row items-center justify-between text-black text-base sm:text-lg font-medium">
                      {card.name}
                      <a href="" className="shrink-0">
                        <HiOutlineExternalLink className="text-black" />
                      </a>
                    </CardHeader>
                    <CardContent className="text-black text-3xl sm:text-4xl font-semibold -mt-2">
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
                        {tabletitles.map((title, i) => (
                          <th
                            className={`px-3 sm:px-4 py-2 text-left text-xs sm:text-sm md:text-base ${
                              i === 0 ? "rounded-tl-xl" : ""
                            } ${
                              i === tabletitles.length - 1
                                ? "rounded-tr-xl"
                                : ""
                            }`}
                            key={i}
                          >
                            {title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tabledata.map((data, i) => (
                        <tr
                          className="text-left bg-gray-100 even:bg-gray-50"
                          key={i}
                        >
                          <td className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            {data.name}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            {data.date}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            {data.startTime}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            {data.endTime}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            {data.package}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            {data.place}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MotionDiv>
  );
}
