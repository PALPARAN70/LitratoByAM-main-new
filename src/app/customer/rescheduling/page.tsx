"use client";
import Image from "next/image";
import PromoCard from "../../../../Litratocomponents/Service_Card";
import Calendar from "../../../../Litratocomponents/LitratoCalendar";
import Timepicker from "../../../../Litratocomponents/Timepicker";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PhotoGrids from "../../../../Litratocomponents/PhotoGrids";
import { toast } from "sonner";
import MotionDiv from "../../../../Litratocomponents/MotionDiv";
import {
  bookingFormSchema,
  type BookingForm,
} from "../../../../schemas/schema/requestvalidation";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
    "http://localhost:5000") + "/api/auth/getProfile";

export default function ReschedulingPage() {
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

  // Controlled booking form state + errors
  const initialForm: BookingForm = {
    email: "",
    facebook: "",
    completeName: "",
    contactNumber: "",
    contactPersonAndNumber: "",
    eventName: "",
    eventLocation: "",
    extensionHours: 0,
    boothPlacement: "Indoor",
    signal: "",
    package: "The Hanz",
    selectedGrids: [],
    eventDate: new Date(),
    eventTime: "12:00",
    eventEndTime: "14:00",
  };
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof BookingForm, string>>
  >({});

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
        // Prefill booking form with user profile
        setForm((prev) => ({
          ...prev,
          email: data.email || prev.email,
          completeName:
            `${data.firstname ?? ""} ${data.lastname ?? ""}`.trim() ||
            prev.completeName,
        }));
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        toast.error("Error fetching profile");
      }
    })();

    return () => ac.abort();
  }, [router]);

  // Helpers
  const setField = <K extends keyof BookingForm>(
    key: K,
    value: BookingForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (
      [
        "email",
        "contactNumber",
        "eventTime",
        "eventEndTime",
        "extensionHours",
      ].includes(key as string)
    ) {
      const parsed = bookingFormSchema.safeParse({ ...form, [key]: value });
      const fieldIssues = parsed.success
        ? []
        : parsed.error.issues.filter((i) => i.path[0] === key);
      setErrors((e) => ({ ...e, [key]: fieldIssues[0]?.message }));
    }
  };

  const handleSubmit = () => {
    setErrors({});
    const result = bookingFormSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof BookingForm, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof BookingForm;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Please fill in all required fields.");
      return;
    }
    // Add: persist to dashboard table with default status
    try {
      const row = {
        name: form.eventName,
        date: fmtDate(form.eventDate),
        startTime: to12h(form.eventTime),
        endTime: to12h(form.eventEndTime),
        package: form.package,
        place: form.eventLocation,
        paymentStatus: "Pending",
        status: "Pending" as "Approved" | "Declined" | "Pending",
        action: ["Cancel", "Reschedule"] as string[],
      };
      const raw =
        (typeof window !== "undefined" &&
          localStorage.getItem(DASHBOARD_KEY)) ||
        "[]";
      const arr = Array.isArray(JSON.parse(raw))
        ? (JSON.parse(raw) as any[])
        : [];
      arr.unshift(row);
      localStorage.setItem(DASHBOARD_KEY, JSON.stringify(arr));
    } catch {}
    // You can send result.data to your backend here
    toast.success("Form submitted! Please wait for the admin's response.");
  };

  const handleClear = () => {
    setForm(initialForm);
    setErrors({});
    toast.message("Form cleared.");
  };

  const formFields = [
    "Email:",
    "Facebook:",
    "Complete name:",
    "Contact #:",
    "Contact Person & Number:",
    "Name of event (Ex. Maria & Jose Wedding):",
    "Location of event:",
    "Extension? (Our Minimum is 2hrs. Additional hour is Php2000):",
    "Placement of booth (Indoor/Outdoor):",
    "What signal is currently strong in the event area?:",
  ];

  // Add: dashboard storage key and formatters
  const DASHBOARD_KEY = "litrato_dashboard_table";
  const to12h = (t: string) => {
    const [HH, MM] = t.split(":").map((n) => parseInt(n || "0", 10));
    const ampm = HH >= 12 ? "pm" : "am";
    const h12 = (HH % 12 || 12).toString().padStart(2, "0");
    return `${h12}:${String(MM || 0).padStart(2, "0")} ${ampm}`;
  };
  const fmtDate = (d: Date) => {
    try {
      return new Date(d).toISOString().substring(0, 10);
    } catch {
      return "";
    }
  };

  return (
    <MotionDiv>
      <div className="min-h-screen w-full overflow-y-auto">
        <div className="w-full">
          <div className="relative h-[160px]">
            <Image
              src={"/Images/litratobg.jpg"}
              alt="Booking Header"
              fill
              className="object-cover rounded-b-lg"
              priority
            />
          </div>
          <p className="text-litratoblack text-center text-4xl font-semibold font-didone pt-4">
            Welcome, {personalForm.Firstname} {personalForm.Lastname}!<br />
            Reschedule a photobooth session with us!
          </p>
        </div>

        <div className=" p-4 rounded-lg shadow-md space-y-3">
          <p className="font-semibold text-xl">Please Fill In The Following:</p>

          {/* Email */}
          <div>
            <label className="block text-lg mb-1">Email:</label>
            <input
              type="email"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              onBlur={(e) => setField("email", e.target.value)}
            />
            {errors.email && (
              <p className="text-red-600 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Facebook */}
          <div>
            <label className="block text-lg mb-1">Facebook:</label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.facebook}
              onChange={(e) => setField("facebook", e.target.value)}
            />
            {errors.facebook && (
              <p className="text-red-600 text-sm mt-1">{errors.facebook}</p>
            )}
          </div>

          {/* Complete name */}
          <div>
            <label className="block text-lg mb-1">Complete name:</label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.completeName}
              onChange={(e) => setField("completeName", e.target.value)}
            />
            {errors.completeName && (
              <p className="text-red-600 text-sm mt-1">{errors.completeName}</p>
            )}
          </div>

          {/* Contact #: */}
          <div>
            <label className="block text-lg mb-1">Contact #:</label>
            <input
              type="tel"
              placeholder="e.g. +639171234567"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.contactNumber}
              onChange={(e) => setField("contactNumber", e.target.value)}
              onBlur={(e) => setField("contactNumber", e.target.value)}
            />
            {errors.contactNumber && (
              <p className="text-red-600 text-sm mt-1">
                {errors.contactNumber}
              </p>
            )}
          </div>

          {/* Contact Person & Number */}
          <div>
            <label className="block text-lg mb-1">
              Contact Person & Number:
            </label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.contactPersonAndNumber}
              onChange={(e) =>
                setField("contactPersonAndNumber", e.target.value)
              }
            />
            {errors.contactPersonAndNumber && (
              <p className="text-red-600 text-sm mt-1">
                {errors.contactPersonAndNumber}
              </p>
            )}
          </div>

          {/* Event name */}
          <div>
            <label className="block text-lg mb-1">
              Name of event (Ex. Maria & Jose Wedding):
            </label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.eventName}
              onChange={(e) => setField("eventName", e.target.value)}
            />
            {errors.eventName && (
              <p className="text-red-600 text-sm mt-1">{errors.eventName}</p>
            )}
          </div>

          {/* Event location */}
          <div>
            <label className="block text-lg mb-1">Location of event:</label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.eventLocation}
              onChange={(e) => setField("eventLocation", e.target.value)}
            />
            {errors.eventLocation && (
              <p className="text-red-600 text-sm mt-1">
                {errors.eventLocation}
              </p>
            )}
          </div>

          {/* Extension hours */}
          <div>
            <label className="block text-lg mb-1">
              Extension? (Our Minimum is 2hrs. Additional hour is Php2000):
            </label>
            <input
              type="number"
              min={0}
              max={12}
              step={1}
              placeholder="0"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.extensionHours}
              onChange={(e) =>
                setField("extensionHours", Number(e.target.value))
              }
              onBlur={(e) => setField("extensionHours", Number(e.target.value))}
            />
            {errors.extensionHours && (
              <p className="text-red-600 text-sm mt-1">
                {errors.extensionHours}
              </p>
            )}
          </div>

          {/* Booth placement */}
          <div>
            <label className="block text-lg mb-1">Placement of booth:</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="boothPlacement"
                  checked={form.boothPlacement === "Indoor"}
                  onChange={() => setField("boothPlacement", "Indoor")}
                />
                Indoor
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="boothPlacement"
                  checked={form.boothPlacement === "Outdoor"}
                  onChange={() => setField("boothPlacement", "Outdoor")}
                />
                Outdoor
              </label>
            </div>
            {errors.boothPlacement && (
              <p className="text-red-600 text-sm mt-1">
                {errors.boothPlacement}
              </p>
            )}
          </div>

          {/* Signal */}
          <div>
            <label className="block text-lg mb-1">
              What signal is currently strong in the event area?:
            </label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
              value={form.signal}
              onChange={(e) => setField("signal", e.target.value)}
            />
            {errors.signal && (
              <p className="text-red-600 text-sm mt-1">{errors.signal}</p>
            )}
          </div>

          {/* Packages */}
          <div className="flex flex-col justify-center mt-8">
            <p className="font-semibold text-xl">Select A Package:</p>
            <div className="flex flex-row gap-4 justify-center">
              <PromoCard
                imageSrc="/Images/hanz.png"
                title="The Hanz"
                price="₱8,000"
                descriptions={[
                  "2 hours photo booth operation",
                  "Vintage TV with video camera",
                  "Unlimited shots",
                  "High quality photo strips",
                  "High quality of real time digital copy & GIFs",
                  "Compiled soft copies of picture & GIF (via Gdrive)",
                  "Customized welcome layout & photo strip",
                  "6 photo grids to choose from (two free grids)",
                  "Free transportation within DVO City",
                  "On-site staff",
                ]}
                selected={form.package === "The Hanz"}
                onSelect={() => setField("package", "The Hanz")}
              />
              <PromoCard
                imageSrc="/Images/Gallery6.jpg"
                title="The Corrupt"
                price="₱8,000"
                descriptions={[
                  "2 hours photo booth operation",
                  "Vintage TV with video camera",
                  "Unlimited shots",
                  "High quality photo strips",
                  "High quality of real time digital copy & GIFs",
                  "Compiled soft copies of picture & GIF (via Gdrive)",
                  "Customized welcome layout & photo strip",
                  "6 photo grids to choose from (two free grids)",
                  "Free transportation within DVO City",
                  "On-site staff",
                ]}
                selected={form.package === "The Corrupt"}
                onSelect={() => setField("package", "The Corrupt")}
              />
              <PromoCard
                imageSrc="/Images/gallery1.jpg"
                title="The AI"
                price="₱8,000"
                descriptions={[
                  "2 hours photo booth operation",
                  "Vintage TV with video camera",
                  "Unlimited shots",
                  "High quality photo strips",
                  "High quality of real time digital copy & GIFs",
                  "Compiled soft copies of picture & GIF (via Gdrive)",
                  "Customized welcome layout & photo strip",
                  "6 photo grids to choose from (two free grids)",
                  "Free transportation within DVO City",
                  "On-site staff",
                ]}
                selected={form.package === "The AI"}
                onSelect={() => setField("package", "The AI")}
              />
              <PromoCard
                imageSrc="/Images/litratobg.jpg"
                title="The OG"
                price="₱8,000"
                descriptions={[
                  "2 hours photo booth operation",
                  "Vintage TV with video camera",
                  "Unlimited shots",
                  "High quality photo strips",
                  "High quality of real time digital copy & GIFs",
                  "Compiled soft copies of picture & GIF (via Gdrive)",
                  "Customized welcome layout & photo strip",
                  "6 photo grids to choose from (two free grids)",
                  "Free transportation within DVO City",
                  "On-site staff",
                ]}
                selected={form.package === "The OG"}
                onSelect={() => setField("package", "The OG")}
              />
            </div>
            {errors.package && (
              <p className="text-red-600 text-sm mt-1 text-center">
                {errors.package}
              </p>
            )}
          </div>

          {/* Grids */}
          <div className="flex flex-col justify-center mt-8">
            <p className="font-semibold text-xl">
              Select the Type of Grids you want for your Photos (max of 2) :
            </p>
            <div>
              <PhotoGrids
                value={form.selectedGrids}
                onChange={(arr) => setField("selectedGrids", arr)}
              />
            </div>
            {errors.selectedGrids && (
              <p className="text-red-600 text-sm mt-1">
                {errors.selectedGrids}
              </p>
            )}
          </div>

          {/* Date & Time */}
          <div className="flex flex-col justify-center mt-12">
            <p className="font-semibold text-xl">
              Select the date and time for your event:
            </p>
            <div className="flex flex-row justify-center gap-24 ">
              <div>
                <Calendar />
                {errors.eventDate && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.eventDate}
                  </p>
                )}
              </div>
              <div className="mt-8 ">
                <Timepicker
                  start={form.eventTime}
                  end={form.eventEndTime}
                  onChange={({ start, end }) => {
                    setField("eventTime", start);
                    setField("eventEndTime", end);
                  }}
                />
                {errors.eventTime && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.eventTime}
                  </p>
                )}
                {errors.eventEndTime && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.eventEndTime}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClear}
              type="button"
              className="bg-gray-200 text-litratoblack px-4 py-2 hover:bg-gray-300 rounded"
            >
              Clear
            </button>
            <button
              onClick={handleSubmit}
              type="button"
              className="bg-litratoblack text-white px-4 py-2 hover:bg-black rounded"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </MotionDiv>
  );
}
