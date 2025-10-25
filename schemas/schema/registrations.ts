import { z } from "zod";

export type CheckEmailUnique = (email: string) => Promise<boolean>;

export const makeRegistrationSchema = (checkEmailUnique?: CheckEmailUnique) =>
  z
    .object({
      firstname: z.string().trim().min(1, "Firstname is required"),
      lastname: z.string().trim().min(1, "Lastname is required"),
      birthdate: z.string().trim().min(1, "Birthdate is required"),
      sex: z.string().trim().min(1, "Sex is required"),
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
      contact: z.string().trim().min(1, "Contact Number is required"),
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
