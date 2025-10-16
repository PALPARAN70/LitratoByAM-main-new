export interface requestvalidation {
  Email: string
  Completename: string
  ContactNumber: number
  ContactPersonandNumber: string
  Eventname: string
  Eventlocation: string
  BoothPlacement: string
  Signal: string
}

// New: booking form interface used by bookingFormSchema
export interface BookingForm {
  email: string
  completeName: string
  contactNumber: string
  contactPersonAndNumber: string
  eventName: string
  eventLocation: string
  extensionHours: number
  boothPlacement: 'Indoor' | 'Outdoor'
  signal: string
  package: 'The Hanz' | 'The Corrupt' | 'The AI' | 'The OG'
  selectedGrids: number[] // indexes 0..7, length 1..2
  eventDate: Date
  eventTime: string // HH:mm
  eventEndTime: string // HH:mm
}
