import * as z from 'zod'
import { requestvalidation } from '../types/validation.type'

export const requestSchema: z.ZodSchema<requestvalidation> = z.object({
  Email: z.string().min(1, 'Email is required'),
  Facebook: z.string().min(1, 'Facebook is required'),
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
