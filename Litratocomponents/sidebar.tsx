'use client'
import { useState, useCallback, useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import Image from 'next/image'
import { HiMenu } from 'react-icons/hi'
import {
  FiGrid,
  FiCalendar,
  FiRefreshCcw,
  FiUser,
  FiLogOut,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { useRouter, usePathname } from 'next/navigation'

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://localhost:5000') + '/api/auth/getProfile'

// Small utility for composing classes
const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

type SidebarProps = {
  isOpen?: boolean
  onToggleAction?: (open: boolean) => void
}

// Define NavItem type and hoist static items for stability
type NavItem = { label: string; Icon: IconType; path: string }
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', Icon: FiGrid, path: '/customer/dashboard' },
  { label: 'Booking', Icon: FiCalendar, path: '/customer/booking' },
  { label: 'Payments', Icon: FiCalendar, path: '/customer/payments' },
]

export default function LitratoSidebar({
  isOpen: controlledOpen,
  onToggleAction,
}: SidebarProps) {
  // fetch admin profile
  const [User, setUser] = useState<{
    firstname?: string
    lastname?: string
  } | null>(null)
  const [internalOpen, setInternalOpen] = useState(true)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = controlledOpen ?? internalOpen

  const toggleOpen = useCallback(() => {
    if (onToggleAction) onToggleAction(!isOpen)
    else setInternalOpen((prev) => !prev)
  }, [onToggleAction, isOpen])

  const handleNavigation = useCallback(
    (path: string) => {
      if (pathname !== path) router.push(path)
    },
    [router, pathname]
  )
  const handleProfileCheck = () => {
    router.push('/customer/accountmanager')
  }
  const getNavKeyDown = useCallback(
    (path: string) => (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleNavigation(path)
      }
    },
    [handleNavigation]
  )

  const handleLogout = useCallback(() => setShowLogoutModal(true), [])
  const confirmLogout = useCallback(() => {
    localStorage.removeItem('access_token')
    router.push('/home')
    setShowLogoutModal(false)
  }, [router])
  const cancelLogout = useCallback(() => setShowLogoutModal(false), [])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    fetch(API_BASE, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.firstname) {
          setUser({ firstname: data.firstname })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div
      className={cx(
        'h-screen',
        isOpen ? 'w-64' : 'w-16',
        'bg-white flex flex-col transition-[width] duration-500 ease-in-out overflow-hidden'
      )}
    >
      <div className="flex flex-col">
        {/* Brand name or icon depending on sidebar state */}
        <div className="relative border-b-2 font-semibold text-2xl pl-4 border-litratoblack bg-white font-serif flex items-center h-[60px]">
          {/* Crossfade icon and title for stable transition */}
          <Image
            src="/Icons/litratoicon.png"
            alt="Litrato Icon"
            fill
            priority
            className={cx(
              'mr-2 transition-all duration-300 ease-in-out',
              isOpen
                ? 'opacity-0 scale-95 pointer-events-none'
                : 'opacity-100 scale-100'
            )}
          />
          <span
            className={cx(
              'transition-all ml-10 duration-300 ease-in-out',
              isOpen
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-1 pointer-events-none'
            )}
          >
            LitratoByAM
          </span>
        </div>
        {/* Admin name display */}

        <button
          type="button"
          className="flex pl-[17px] py-2 w-fit"
          onClick={toggleOpen}
          aria-label="Toggle Sidebar"
          aria-expanded={isOpen}
        >
          <HiMenu
            className="text-3xl text-litratoblack hover:text-litratored"
            aria-hidden
          />
        </button>

        {/* Navigation Items */}
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.path)
          return (
            <div
              key={item.label}
              role="button"
              tabIndex={0}
              onClick={() => handleNavigation(item.path)}
              onKeyDown={getNavKeyDown(item.path)}
              className={cx(
                'flex items-center py-2 font-bold rounded-lg cursor-pointer transition-all duration-300 ease-in-out relative group',
                isOpen ? 'gap-2 pl-[18px]' : 'gap-0 pl-[17.5px]',
                active
                  ? 'bg-litratored text-white'
                  : 'text-litratoblack hover:bg-gray-200 hover:text-litratored'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <item.Icon
                size={28}
                className="text-current shrink-0"
                aria-hidden
              />
              <span
                aria-hidden={!isOpen}
                className={cx(
                  'whitespace-nowrap transition-all duration-300 ease-in-out',
                  isOpen
                    ? 'opacity-100 w-auto'
                    : 'opacity-0 w-0 overflow-hidden pointer-events-none'
                )}
              >
                {item.label}
              </span>
              {!isOpen && (
                <span className="absolute left-14 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {item.label}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal wrapper no longer affects layout */}
      <div className="contents">
        {showLogoutModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
          >
            <div className="bg-white rounded-lg shadow-lg p-6 w-80 flex flex-col items-center">
              <h2 id="logout-title" className="text-lg font-bold mb-2">
                Confirm Logout
              </h2>
              <p className="mb-4 text-center">
                Are you sure you want to logout?
              </p>
              <div className="flex gap-4">
                <div
                  onClick={confirmLogout}
                  className="bg-litratoblack cursor-pointer duration-500 text-white px-4 py-2 rounded-full hover:bg-red-600"
                >
                  Logout
                </div>
                <div
                  onClick={cancelLogout}
                  className="bg-gray-300 duration-500 cursor-pointer text-gray-800 px-4 py-2 rounded-full hover:bg-gray-400"
                >
                  Cancel
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Anchor profile + logout to the bottom */}
      <div className="mt-auto">
        {User && (
          <div
            onClick={handleProfileCheck}
            className="pl-2 h-16 flex cursor-pointer flex-row items-center text-litratoblack font-medium text-base min-w-0"
          >
            <div className="relative w-12 rounded-full h-12 shrink-0">
              <Image
                src="/Images/me.jpg"
                alt="Profile Picture"
                fill
                priority
                className="object-cover rounded-full"
              />
            </div>
            <div
              className={cx(
                // Animate width + position + opacity for smooth/stable reveal
                'flex flex-col ml-2 min-w-0 overflow-hidden transition-all duration-300 ease-in-out',
                isOpen
                  ? 'opacity-100 translate-y-0 duration-300 max-w-[180px]'
                  : 'opacity-0 -translate-y-2 duration-300 transition-all max-w-0 pointer-events-none'
              )}
            >
              {User.firstname} <br />
            </div>
          </div>
        )}

        <div
          onClick={handleLogout}
          className={`relative ${
            isOpen ? 'w-[50%]' : 'w-10'
          } h-14 bg-litratoblack cursor-pointer self-center  font-semibold w-full text-center flex items-center justify-center group
            transition-[width,background-color,transform,opacity] duration-300 ease-in-out
           hover:bg-red-600 text-white`}
        >
          {isOpen ? (
            'Logout'
          ) : (
            <FiLogOut
              className="text-xl transition-transform duration-300 ease-in-out"
              aria-hidden
            />
          )}
          {!isOpen && (
            <span className="absolute left-12 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 translate-y-1 group-hover:opacity-100 transition-all ease-out">
              Logout
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
