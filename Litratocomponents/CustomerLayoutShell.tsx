'use client'
import { useState, useEffect } from 'react'
import LitratoSidebar from './sidebar'

export default function CustomerLayoutShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Prevent hydration mismatch while keeping page background
    return <div className="min-h-screen bg-gray-100" />
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full z-20">
        <LitratoSidebar isOpen={open} onToggleAction={setOpen} />
      </div>

      {/* Main content: animate margin-left as sidebar width changes */}
      <main
        className={`flex-1 pl-4 overflow-y-auto transition-[margin] duration-500 ease-in-out select-none`}
        style={{ marginLeft: open ? 256 : 64 }}
      >
        {children}
      </main>
    </div>
  )
}
