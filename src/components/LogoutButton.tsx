'use client'
import React from 'react'
import { useRouter } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'

export default function LogoutButton() {
  const router = useRouter()

  const doLogout = async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: '{}',
        }).catch(() => {})
      }
    } catch {}
    try {
      localStorage.removeItem('access_token')
    } catch {}
    router.replace('/login')
  }

  const handleClick = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      doLogout()
    }
  }

  return (
    <button onClick={handleClick} className="btn btn-danger">
      Logout
    </button>
  )
}
