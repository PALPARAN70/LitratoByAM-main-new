"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

// Hoisted static schemas (prevents re-allocations each render)
const PERSONAL_INFO = [
  { label: "First Name", type: "text", key: "Firstname" },
  { label: "Last Name", type: "text", key: "Lastname" },
  { label: "Birthdate", type: "text", key: "Birthdate" },
  { label: "Sex", type: "text", key: "Sex" },
  { label: "Contact Number", type: "text", key: "ContactNumber" },
] as const;

const ADDRESS_INFO = [
  { label: "Region", type: "text", key: "Region" },
  { label: "Province", type: "text", key: "Province" },
  { label: "City/Town", type: "text", key: "City" },
  { label: "Barangay", type: "text", key: "Barangay" },
  { label: "Postal Code", type: "text", key: "PostalCode" },
] as const;

const ACCOUNT_SETTINGS = [
  { label: "Old Password", type: "password" },
  { label: "New Password", type: "password" },
  { label: "Confirm Password", type: "password" },
];

export default function AccountManagementPage() {
  const router = useRouter();

  // ✅ Toggle between read-only and editable profile
  const [isEditable, setIsEditable] = useState(false);

  // ✅ User profile data (basic info)
  const [profile, setProfile] = useState<{
    username: string;
    email: string;
    role: string;
    url?: string;
  } | null>(null);

  // ✅ Default structure for user profile data
  const [originalForm, setOriginalForm] = useState({
    Firstname: "",
    Lastname: "",
    Birthdate: "",
    Sex: "",
    ContactNumber: "",
    Region: "",
    Province: "",
    City: "",
    Barangay: "",
    PostalCode: "",
  });

  // ✅ Form for handling password changes
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordEditMode, setPasswordEditMode] = useState(false);

  // ✅ Editable version of personal data
  const [personalForm, setPersonalForm] = useState(originalForm);

  // ✅ Track when saving profile
  const [saving, setSaving] = useState(false);

  /**
   * ✅ Load profile data when component mounts
   */
  useEffect(() => {
    const controller = new AbortController();
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;

    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/getProfile`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          // If unauthorized, clear token and redirect to login
          localStorage.removeItem("access_token");
          router.replace("/login");
          return;
        }

        const data = await res.json();
        setProfile(data);

        const formData = {
          Firstname: data.firstname ?? "",
          Lastname: data.lastname ?? "",
          Birthdate: data.birthdate ?? "",
          Sex: data.sex ?? "",
          ContactNumber: data.contact ?? "",
          Region: data.region ?? "",
          Province: data.province ?? "",
          City: data.city ?? "",
          Barangay: data.barangay ?? "",
          PostalCode: data.postal_code ?? "",
        };

        setOriginalForm(formData);
        setPersonalForm(formData);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Profile fetch failed:", err);
        }
      }
    })();

    return () => controller.abort();
  }, [router]);

  /**
   * ✅ Helper function to display dates nicely
   */
  function formatReadableDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Memoized dirty detectors (avoid stringify)
  const isPersonalDirty = useMemo(
    () =>
      Object.keys(originalForm).some(
        (k) => (personalForm as any)[k] !== (originalForm as any)[k]
      ),
    [personalForm, originalForm]
  );

  const passwordDirty = useMemo(
    () =>
      Boolean(
        passwordForm.oldPassword ||
          passwordForm.newPassword ||
          passwordForm.confirmPassword
      ),
    [passwordForm]
  );

  // Save profile wrapped in useCallback
  const saveProfile = useCallback(async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("access_token");
      const payload = {
        firstname: personalForm.Firstname,
        lastname: personalForm.Lastname,
        birthdate: personalForm.Birthdate,
        sex: personalForm.Sex,
        contact: personalForm.ContactNumber,
        region: personalForm.Region,
        province: personalForm.Province,
        city: personalForm.City,
        barangay: personalForm.Barangay,
        postal_code: personalForm.PostalCode,
      };

      const res = await fetch(`${API_BASE}/api/auth/updateProfile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();

      const updated = {
        Firstname: data.user?.firstname ?? personalForm.Firstname,
        Lastname: data.user?.lastname ?? personalForm.Lastname,
        Birthdate: data.user?.birthdate ?? personalForm.Birthdate,
        Sex: data.user?.sex ?? personalForm.Sex,
        ContactNumber: data.user?.contact ?? personalForm.ContactNumber,
        Region: data.user?.region ?? personalForm.Region,
        Province: data.user?.province ?? personalForm.Province,
        City: data.user?.city ?? personalForm.City,
        Barangay: data.user?.barangay ?? personalForm.Barangay,
        PostalCode: data.user?.postal_code ?? personalForm.PostalCode,
      };

      setOriginalForm(updated);
      setPersonalForm(updated);
      setIsEditable(false);
      toast.success("Changes have been saved");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }, [personalForm]);

  // Unified profile button handler
  const handleProfileAction = useCallback(async () => {
    if (!isEditable) {
      setIsEditable(true);
      return;
    }
    if (!isPersonalDirty) {
      setPersonalForm(originalForm);
      setIsEditable(false);
      return;
    }
    if (isPersonalDirty && !saving) {
      await saveProfile();
    }
  }, [isEditable, isPersonalDirty, originalForm, saving, saveProfile]);

  // Password button handler
  const handlePasswordAction = useCallback(async () => {
    if (changingPassword) return;

    if (!passwordEditMode) {
      setPasswordEditMode(true);
      return;
    }

    if (passwordEditMode && !passwordDirty) {
      setPasswordEditMode(false);
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      return;
    }

    if (passwordDirty) {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        toast.error("New password and confirmation do not match");
        return;
      }
      setChangingPassword(true);
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`${API_BASE}/api/auth/changePassword`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            oldPassword: passwordForm.oldPassword,
            newPassword: passwordForm.newPassword,
          }),
        });

        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Failed to change password");

        toast.success("Password changed successfully!");
        setPasswordForm({
          oldPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setPasswordEditMode(false);
      } catch (err: any) {
        toast.error(err.message || "Error changing password");
      } finally {
        setChangingPassword(false);
      }
    }
  }, [changingPassword, passwordEditMode, passwordDirty, passwordForm]);

  return (
    <div className="h-screen p-4">
      <div className="flex flex-col p-4 justify-center gap-4">
        {/* ================= Profile Section ================= */}
        <div className="flex flex-col justify-center gap-2 items-center">
          {/* Profile picture */}
          <div className="flex bg-black h-30 w-30 rounded-full relative">
            <Image
              src={"/Images/me.jpg"}
              alt="profile pic"
              fill
              className="rounded-full object-cover "
            />
          </div>

          {/* Welcome text */}
          <p className="text-black text-center text-3xl font-semibold">
            Welcome, {personalForm.Firstname} {personalForm.Lastname ?? "User"}!
          </p>

          {/* Profile action buttons */}
          <div className="flex flex-row gap-6">
            {/* Unified Edit/Cancel/Save button */}
            <div
              onClick={handleProfileAction}
              className={`bg-litratoblack rounded-full cursor-pointer py-2 px-4 text-white ${
                saving ? "opacity-70 pointer-events-none" : ""
              }`}
            >
              {!isEditable
                ? "Edit Profile"
                : saving
                ? "Saving..."
                : isPersonalDirty
                ? "Save Changes"
                : "Cancel Edit"}
            </div>

            {/* Black Change Password button with improved detector */}
            <div
              onClick={handlePasswordAction}
              className={`bg-litratoblack rounded-full py-2 px-4 text-white ${
                changingPassword
                  ? "bg-gray-500 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
            >
              {changingPassword
                ? "Saving..."
                : passwordEditMode
                ? passwordDirty
                  ? "Save Password "
                  : "Cancel Edit"
                : "Change Password"}
            </div>
          </div>
        </div>

        {/* ================= Personal Info Section ================= */}
        <p className="text-2xl font-semibold">Manage your account</p>
        <div className="flex flex-row gap-12 ">
          {PERSONAL_INFO.map((field) => (
            <div key={field.label} className="flex flex-col w-auto">
              <label>{field.label}:</label>
              <input
                type={field.type}
                value={
                  field.key === "Birthdate" && personalForm.Birthdate
                    ? isEditable
                      ? personalForm.Birthdate
                      : formatReadableDate(personalForm.Birthdate)
                    : (personalForm as any)[field.key] ?? ""
                }
                onChange={(e) =>
                  setPersonalForm((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
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

        {/* ================= Address Info Section ================= */}
        <div className="flex flex-row gap-12">
          {ADDRESS_INFO.map((field) => (
            <div key={field.label} className="flex flex-col w-auto">
              <label>{field.label}:</label>
              <input
                type={field.type}
                value={personalForm[field.key] ?? ""}
                onChange={(e) =>
                  setPersonalForm((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
                readOnly={!isEditable}
                className={`w-full rounded-md px-3 py-2 text-sm focus:outline-none ${
                  isEditable
                    ? "bg-gray-200"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              />
            </div>
          ))}
        </div>

        <p className="text-2xl font-semibold">Account Settings</p>
        <div className="flex flex-col gap-4 w-1/3">
          {ACCOUNT_SETTINGS.map((field) => (
            <div key={field.label} className="flex flex-col">
              <label>{field.label}:</label>
              <input
                type={field.type}
                placeholder="Enter here:"
                value={
                  field.label === "Old Password"
                    ? passwordForm.oldPassword
                    : field.label === "New Password"
                    ? passwordForm.newPassword
                    : passwordForm.confirmPassword
                }
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    [field.label === "Old Password"
                      ? "oldPassword"
                      : field.label === "New Password"
                      ? "newPassword"
                      : "confirmPassword"]: e.target.value,
                  }))
                }
                disabled={!passwordEditMode || changingPassword}
                className={`w-full rounded-md px-3 py-2 text-sm focus:outline-none ${
                  !passwordEditMode || changingPassword
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-200"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
//
