"use client";
import Image from "next/image";
import PromoCard from "../../../../Litratocomponents/Service_Card";
import Calendar from "../../../../Litratocomponents/LitratoCalendar";
import Timepicker from "../../../../Litratocomponents/Timepicker";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PhotoGrids from "../../../../Litratocomponents/PhotoGrids";
import MotionDiv from "../../../../Litratocomponents/MotionDiv";
import {
  bookingFormSchema,
  type BookingForm,
} from "../../../../schemas/schema/requestvalidation";
import {
  loadPackages,
  type PackageDto,
} from "../../../../schemas/functions/BookingRequest/loadPackages";
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
    "http://localhost:5000") + "/api/auth/getProfile";

export default function BookingPage() {
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

  // Packages (dynamic from DB)
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
    null
  );

  // BookingForm['package'] is a union; guard before setting from DB names
  type PkgName = BookingForm["package"];
  const KNOWN_PKG_NAMES: readonly PkgName[] = [
    "The Hanz",
    "The Corrupt",
    "The AI",
    "The OG",
  ] as const;
  const isPkgName = (v: string): v is PkgName =>
    (KNOWN_PKG_NAMES as readonly string[]).includes(v);

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

  // Load packages visible to admin (display=true via API)
  useEffect(() => {
    (async () => {
      try {
        const list = await loadPackages();
        // Ensure only display=true packages are shown
        setPackages(Array.isArray(list) ? list.filter((p) => p.display) : []);
        if (!selectedPackageId && list.length) {
          const first = list[0];
          setSelectedPackageId(first.id);
          setForm((p) => ({
            ...p,
            package: first.package_name as BookingForm["package"],
          }));
        }
      } catch (e) {
        // Optional: show a toast, but avoid spamming admin
        // toast.error('Failed to load packages');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackageId]);

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
            Schedule a photobooth session with us!
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

          {/* Packages (dynamic) */}
          <div className="flex flex-col justify-center mt-8">
            <p className="font-semibold text-xl">Select A Package:</p>
            <div className="flex flex-row gap-4 justify-center flex-wrap">
              {packages.length === 0 && (
                <p className="text-sm text-gray-500">No packages to display.</p>
              )}
              {packages.map((pkg) => (
                <PromoCard
                  key={pkg.id}
                  imageSrc={pkg.image_url || "/Images/litratobg.jpg"}
                  title={pkg.package_name}
                  price={`₱${Number(pkg.price).toLocaleString()}`}
                  descriptions={[pkg.description || "Package"]}
                  selected={selectedPackageId === pkg.id}
                  onSelect={() => {
                    setSelectedPackageId(pkg.id);
                    setField(
                      "package",
                      pkg.package_name as BookingForm["package"]
                    );
                  }}
                />
              ))}
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
