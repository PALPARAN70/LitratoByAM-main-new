"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";


const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000/api/auth/getProfile";

export default function AccountManagementPage() {
  const router = useRouter();
  const [isEditable, setIsEditable] = useState(false);
  const [profile, setProfile] = useState<{
    username: string;
    email: string;
    role: string;
    url?: string;
  } | null>(null);

  const [personalForm, setPersonalForm] = useState({
    Firstname: "",
    Lastname: "",
    Birthdate: "",
    Sex: "",
    ContactNumber: "",
    Region:"",
    Province:"",
    City:"",
    Barangay:"",
    PostalCode: "",
  });








  const personalData = [personalForm];

  const personalInfo = [
    { label: "First Name", type: "text", key: "Firstname" },
    { label: "Last Name", type: "text", key: "Lastname" },
    { label: "Birthdate", type: "text", key: "Birthdate" },
    { label: "Sex", type: "text", key: "Sex" },
    { label: "Contact Number", type: "text", key: "ContactNumber" },
  ] as const;

  const addressInfo = [
    { label: "Region", type: "text", key: "Region" },
    { label: "Province", type: "text", key: "Province" },
    { label: "City/Town", type: "text", key: "City" },
    { label: "Barangay", type: "text", key: "Barangay" },
    { label: "Postal Code", type: "text", key: "PostalCode" },
  ] as const;

  const accountSettings = [
    { label: "Old Password", type: "password" },
    { label: "New Password", type: "password" },
    { label: "Confirm Password", type: "password" },
  ];

useEffect(() => {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (!token) return; // no token, skip

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/getProfile`, {
        headers: { Authorization: `Bearer ${token}` }, // add Bearer prefix
      });

      if (res.status === 401) {
        try { localStorage.removeItem("access_token"); } catch {}
        router.replace("/login");
        return;
      }

      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error("Profile fetch failed:", err);
    }
  };

  load();
}, [router]);

useEffect(() => {
  const token = localStorage.getItem("access_token");

  fetch("http://localhost:5000/api/auth/getProfile", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`, // ✅ attach token
    },
  })
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    })
    .then((data) => {
      const { firstname, lastname, birthdate, sex, contact, region, province, city, barangay, postal_code } = data;
     
      setPersonalForm({
        Firstname: firstname || "",
        Lastname: lastname || "",
        Birthdate: birthdate || "",
        Sex: sex || "",
        ContactNumber: contact || "",
        Region: region || "",
        Province: province || "",
        City: city || "",
        Barangay: barangay || "",
        PostalCode: postal_code || "",
      });
    })
    .catch((err) => console.error("Error fetching profile:", err));
}, []);


function formatReadableDate(isoString: string): string {
  const date = new Date(isoString);

  // Format: "Aug 18 2003"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}



  return (
    <div className="h-screen p-4">
      <div className="flex flex-col p-4 justify-center gap-4">
        <div className="flex flex-col justify-center gap-2 items-center">
          <div className="flex bg-black h-30 w-30 rounded-full relative">
            <Image
              src={"/Images/hanz.png"}
              alt="profile pic"
              fill
              className="rounded-full"
            />
          </div>
          <p className="text-black text-center text-3xl font-semibold">
            Welcome, {personalForm.Firstname} {personalForm.Lastname ?? "User"}!
          </p>
          {profile?.email ? (
            <p className="text-gray-600 text-sm">{profile.email}</p>
          ) : null}
          <div className="flex flex-row gap-6">
            <button
              onClick={() => setIsEditable((prev) => !prev)}
              className="bg-litratoblack rounded py-2 px-4 text-white"
            >
              {isEditable ? "Cancel Edit" : "Edit Profile"}
            </button>
            <div className="bg-litratoblack rounded-full py-2 px-4 text-white">
              Change Password
            </div>
          </div>
        </div>

        <p className="text-2xl">Manage your account</p>
        <div className="flex flex-row gap-12 ">
          {personalInfo.map((field) => (
  <div key={field.label} className="flex flex-col w-auto">
    <label>{field.label}:</label>
    <input
      type={field.type}
      value={
        field.key === "Birthdate" && personalForm.Birthdate
          ? formatReadableDate(personalForm.Birthdate) // 👈 format only for birthdate
          : (personalForm as any)[field.key] ?? ""
      }
      onChange={(e) =>
        setPersonalForm((prev) => ({ ...prev, [field.key]: e.target.value }))
      }
      disabled={!isEditable}
      className={`w-full rounded-md px-3 py-2 text-sm focus:outline-none ${
        isEditable
          ? "bg-gray-200"
          : "bg-gray-100 text-gray-400 cursor-not-allowed"
      }`}
    />
  </div>
))}

        </div>

       <div className="flex flex-row gap-12">
        {addressInfo.map((field) => (
          <div key={field.label} className="flex flex-col w-auto">
            <label>{field.label}:</label>
            <input
              type={field.type}
              value={personalForm[field.key] ?? ""}
              onChange={(e) =>
                setPersonalForm((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              readOnly={!isEditable}   // 🔑 only read-only, not fully disabled
              className={`w-full rounded-md px-3 py-2 text-sm focus:outline-none ${
                isEditable ? "bg-gray-200" : "bg-gray-100 text-gray-600"
              }`}
            />
          </div>
        ))}
      </div>


        <p className="text-2xl">Account Settings</p>
        <div className="flex flex-col gap-4 w-1/3">
          {accountSettings.map((field) => (
            <div key={field.label} className="flex flex-col">
              <label>{field.label}:</label>
              <input
                type={field.type}
                placeholder="Enter here:"
                disabled={!isEditable}
                className={`w-full rounded-md px-3 py-2 text-sm focus:outline-none ${
                  isEditable
                    ? "bg-gray-200"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
