import * as z from 'zod'
import { requestvalidation } from '../types/validation.type'

export const requestSchema: z.ZodSchema<requestvalidation> = z.object({
  Email: z.string().min(1, 'Email is required'),
  Completename: z.string().min(1, 'Complete name is required'),
  ContactNumber: z.number().int().positive(),
  ContactPersonandNumber: z
    .string()
    .min(1, 'Contact Person & Number is required'),
  Eventname: z.string().min(1, 'Event name is required'),
  Eventlocation: z.string().min(1, 'Event location is required'),
  BoothPlacement: z.string().min(1, 'Booth placement is required'),
  Signal: z.string().min(1, 'Signal is required'),
})

// New: validation that matches the booking forms (package, grids, date/time, etc.)
export const bookingFormSchema = z
  .object({
    email: z.string().trim().email('Invalid email address'),
    completeName: z.string().trim().min(1, 'Complete name is required'),
    contactNumber: z
      .string()
      .regex(/^\+?\d{10,15}$/, 'Contact number must be 10-15 digits'),
    // New split fields
    contactPersonName: z.string().trim().optional(),
    contactPersonNumber: z
      .string()
      .regex(/^\+?\d{10,15}$/i, 'Contact person number must be 10-15 digits')
      .optional(),
    // Backward compatibility: legacy combined field (optional)
    contactPersonAndNumber: z.string().trim().optional(),
    eventName: z.string().trim().min(1, 'Event name is required'),
    eventLocation: z.string().trim().min(1, 'Event location is required'),
    extensionHours: z.coerce
      .number()
      .int()
      .min(0, 'Must be 0 or more')
      .max(12, 'Too many hours')
      .default(0),
    boothPlacement: z.enum(['Indoor', 'Outdoor']),
    signal: z.enum(['SMART', 'DITO', 'Globe', 'TM'], {
      message: 'Signal is required',
    }),
    // Accept any package name coming from the DB/API
    package: z.string().trim().min(1, 'Package is required'),
    // Dynamic grids selected by name (admin-defined). Keep 1-2 selections.
    selectedGrids: z
      .array(z.string().min(1))
      .min(1, 'Pick at least 1 grid')
      .max(2, 'Pick at most 2 grids'),
    eventDate: z.coerce.date(),
    eventTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:mm 24h format'),
    eventEndTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:mm 24h format'),
  })
  .superRefine((data, ctx) => {
    // compare HH:mm strings
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return (h || 0) * 60 + (m || 0)
    }
    const startMinutes = toMinutes(data.eventTime)
    const earliestStart = 8 * 60 // 8:00 AM
    const latestStart = 22 * 60 // 10:00 PM boundary (exclusive)
    if (startMinutes < earliestStart || startMinutes >= latestStart) {
      ctx.addIssue({
        path: ['eventTime'],
        code: z.ZodIssueCode.custom,
        message: 'Start time must be between 8:00 AM and 9:59 PM',
      })
    }

    // Ensure we have either the new split fields (both) or the legacy combined
    const contactPersonName = ((data as any).contactPersonName || '').trim()
    const contactPersonNumber = ((data as any).contactPersonNumber || '').trim()
    const contactPersonAndNumber = (
      (data as any).contactPersonAndNumber || ''
    ).trim()

    const hasLegacy = contactPersonAndNumber.length > 0
    const hasName = contactPersonName.length > 0
    const hasNumber = contactPersonNumber.length > 0

    if (!hasLegacy) {
      if (!hasName) {
        ctx.addIssue({
          path: ['contactPersonName'],
          code: z.ZodIssueCode.custom,
          message: 'Provide contact person name.',
        })
      }
      if (!hasNumber) {
        ctx.addIssue({
          path: ['contactPersonNumber'],
          code: z.ZodIssueCode.custom,
          message: 'Provide contact person number.',
        })
      }
    }
  })

export type BookingForm = z.infer<typeof bookingFormSchema>

export const createUserSchema = z.object({
  firstname: z.string().min(1, 'First name is required'),
  lastname: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  contact: z
    .string()
    .min(11, 'Contact number must be at least 11 characters long'),
})

export type createUserData = z.infer<typeof createUserSchema>
