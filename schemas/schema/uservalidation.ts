import { z } from "zod";

export type CheckEmailUnique = (email: string) => Promise<boolean>;

export const makeRegistrationSchema = (checkEmailUnique?: CheckEmailUnique) =>
  z
    .object({
      firstname: z.string().trim().min(1, "Firstname is required"),
      lastname: z.string().trim().min(1, "Lastname is required"),
      birthdate: z
        .string()
        .trim()
        .min(1, "Birthdate is required")
        .refine((s) => {
          // allow only past dates (not today or future)
          const d = new Date(s);
          if (Number.isNaN(d.getTime())) return false;
          const today = new Date();
          // compare dates only (ignore time)
          const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const tt = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
          );
          return dd < tt;
        }, "Birthdate cannot be today or a future date"),
      sex: z.enum(["Male", "Female", "Prefer not to say"], {
        message: "Sex is required",
      }),
      username: z
        .string()
        .trim()
        .toLowerCase()
        .email("Enter a valid email address"),
      password: z.string().min(8, "Password must be at least 8 characters"),
      confirmPassword: z
        .string()
        .min(8, "Confirm Password must be at least 8 characters"),
      region: z.string().trim().min(1, "Region is required"),
      province: z.string().trim().min(1, "Province is required"),
      city: z.string().trim().min(1, "City/Town is required"),
      barangay: z.string().trim().min(1, "Barangay is required"),
      postalCode: z.string().trim().min(1, "Postal Code is required"),
      contact: z
        .string()
        .trim()
        .regex(/^\d{11}$/, "Contact Number must be exactly 11 digits"),
    })
    .superRefine(async (val, ctx) => {
      if (val.password !== val.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmPassword"],
          message: "Passwords do not match",
        });
      }
      if (checkEmailUnique) {
        try {
          const unique = await checkEmailUnique(val.username);
          if (!unique) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["username"],
              message: "Email already registered",
            });
          }
        } catch {
          // network error -> let server enforce uniqueness
        }
      }
    });

export const profileUpdateSchema = z.object({
  firstname: z.string().trim().min(1, "Firstname is required"),
  lastname: z.string().trim().min(1, "Lastname is required"),
  birthdate: z
    .string()
    .trim()
    .min(1, "Birthdate is required")
    .refine((s) => {
      const date = new Date(s);
      if (Number.isNaN(date.getTime())) return false;
      const today = new Date();
      const normalizedSelected = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const normalizedToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      return normalizedSelected < normalizedToday;
    }, "Birthdate cannot be today or a future date"),
  sex: z.enum(["Male", "Female", "Prefer not to say"], {
    message: "Sex is required",
  }),
  contact: z
    .string()
    .trim()
    .regex(/^[0-9]{11}$/u, "Contact Number must be exactly 11 digits"),
  region: z.string().trim().min(1, "Region is required"),
  province: z.string().trim().min(1, "Province is required"),
  city: z.string().trim().min(1, "City/Town is required"),
  barangay: z.string().trim().min(1, "Barangay is required"),
  postalCode: z.string().trim().min(1, "Postal Code is required"),
});
