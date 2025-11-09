'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Rescheduling page deprecated. Redirect to booking page.
export default function DeprecatedReschedulingRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/customer/booking')
  }, [router])
  return null
}
