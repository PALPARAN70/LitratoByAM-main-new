'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { jwtDecode } from 'jwt-decode'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'

type Role = 'admin' | 'employee' | 'customer'

export default function AuthGuard({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole?: Role
}) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null
    if (!token) {
      router.replace('/login')
      setAuthorized(false)
      setChecking(false)
      return
    }

    // Validate token against the correct protected endpoint and format header properly
    fetch(`${API_BASE}/api/auth/getProfile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 401) {
          try {
            localStorage.removeItem('access_token')
          } catch {}
          setAuthorized(false)
          router.replace('/login')
          return
        }
        const data = await res.json().catch(() => ({}))
        const userRole: Role | undefined = data?.role

        if (requiredRole && userRole && userRole !== requiredRole) {
          // Redirect users who don't have permission to a sensible destination
          const byRole: Record<string, string> = {
            admin: '/admin',
            employee: '/employee',
            customer: '/customer/dashboard',
          }
          router.replace(byRole[userRole] || '/')
          setAuthorized(false)
          return
        }
        setAuthorized(true)
      })
      .catch(() => {
        if (cancelled) return
        setAuthorized(false)
        router.replace('/login')
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [router, requiredRole])

  // Proactively detect token expiry and redirect without needing a reload
  useEffect(() => {
    if (!authorized) return

    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null
    if (!token) return

    type Decoded = { exp?: number }
    let expMs = 0
    try {
      const decoded = jwtDecode<Decoded>(token)
      if (decoded?.exp) expMs = decoded.exp * 1000
    } catch {
      // malformed token -> force immediate redirect
      expMs = Date.now()
    }

    let timedOut = false
    const handleExpired = async () => {
      if (timedOut) return
      timedOut = true
      try {
        // Ping a protected endpoint so middleware updates last_login on expired token
        await fetch(`${API_BASE}/api/auth/getProfile`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
      } catch {}
      try {
        localStorage.removeItem('access_token')
      } catch {}
      router.replace('/login')
    }

    const now = Date.now()
    const delay = expMs - now
    if (!expMs || delay <= 0) {
      handleExpired()
      return
    }
    const id = window.setTimeout(handleExpired, delay)
    return () => window.clearTimeout(id)
  }, [authorized, router])

  // While checking or not authorized, avoid flashing protected UI
  if (checking || !authorized) return null
  return <>{children}</>
}
