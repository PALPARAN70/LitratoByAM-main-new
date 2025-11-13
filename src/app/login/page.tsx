'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import LitratoBranding from '../../../Litratocomponents/Branding'
import LitratoFooter from '../../../Litratocomponents/Footer'
import { toast } from 'sonner'
import { jwtDecode } from 'jwt-decode'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResendModal, setShowResendModal] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    try {
      const trimmedUsername = username.trim()
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: trimmedUsername, password }),
      })

      const data = await res.json().catch(() => null)

      if (res.ok && data) {
        console.log('Login response:', data)

        if (!data.token || typeof data.token !== 'string') {
          toast.error('Unexpected login response.')
          return
        }

        // If backend sends "Bearer <token>", strip the prefix
        const token = data.token.startsWith('Bearer ')
          ? data.token.split(' ')[1]
          : data.token

        try {
          localStorage.setItem('access_token', token)
        } catch {
          toast.error('Failed to save access token. Please try again.')
        }

        // Either use data.role (if backend sends it) OR decode from token
        let role: string | undefined = data.role
        if (!role) {
          try {
            const decoded = jwtDecode<{ role?: string }>(token)
            role = decoded?.role
          } catch {
            toast.error('Invalid token received.')
            return
          }
        }

        if (role === 'admin') {
          router.push('/admin/AdminDashboard')
          toast.success('Welcome Admin!')
        } else if (role === 'customer') {
          router.push('/customer/dashboard')
          toast.success('Welcome Customer!')
        } else {
          router.push('/staff/staffdashboard')
          toast.success('Welcome Employee!')
        }
      } else {
        let message = 'Login failed'
        const reason =
          data && typeof data === 'object' && 'reason' in data
            ? (data.reason as string | undefined)
            : undefined

        if (res.status === 401) {
          message = 'Invalid username or password'
        } else if (data && typeof data === 'object' && 'message' in data) {
          message = String(data.message)
        }

        if (res.status === 403 && reason === 'verification_expired') {
          setVerificationMessage(message)
          setResendEmail(trimmedUsername || username)
          setShowResendModal(true)
          toast.error(message)
          return
        }

        if (res.status === 403 && reason === 'verification_pending') {
          toast.info(message)
          return
        }

        toast.error(message)
      }
    } catch {
      toast.error('Unable to connect to server. Please try again later.')
    }
  }
  //forgot password
  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      toast.error('Please enter your email.')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('http://localhost:5000/api/auth/forgotPassword', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotEmail }),
      })
      if (res.ok) {
        toast.success('Verification email sent. Please check your inbox.')
        setShowForgotModal(false)
        setForgotEmail('')
      } else {
        let message = 'Failed to send verification email.'
        try {
          const errorData = await res.json()
          if (errorData?.message) message = errorData.message
        } catch {}
        toast.error(message)
      }
    } catch {
      toast.error('Failed to send verification email.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendVerification = async () => {
    if (!resendEmail) return
    setIsResendingVerification(true)
    try {
      const res = await fetch(
        'http://localhost:5000/api/auth/resendVerification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: resendEmail }),
        }
      )
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const message =
          data && typeof data === 'object' && 'message' in data
            ? String(data.message)
            : 'Failed to resend verification email.'
        throw new Error(message)
      }

      toast.success('Verification email sent. Please check your inbox.')
      setShowResendModal(false)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to resend verification email.'
      toast.error(message)
    } finally {
      setIsResendingVerification(false)
    }
  }

  return (
    <div>
      {showResendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[360px] relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
              onClick={() => {
                setShowResendModal(false)
                setVerificationMessage('')
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-3 text-center">
              Verify Your Email
            </h2>
            <p className="text-sm text-gray-600 mb-5 text-center">
              {verificationMessage ||
                `Your verification link has expired. Resend a new email to ${
                  resendEmail || 'this email address'
                }.`}
            </p>
            <button
              onClick={handleResendVerification}
              className="bg-litratoblack text-white px-4 py-2 rounded w-full font-bold hover:bg-black transition-all disabled:opacity-60"
              disabled={isResendingVerification}
            >
              {isResendingVerification
                ? 'Sending...'
                : 'Resend Verification Email'}
            </button>
          </div>
        </div>
      )}
      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[350px] relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
              onClick={() => setShowForgotModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-center">
              Forgot Password
            </h2>
            <label className="block mb-2">
              Enter your email for verification:
            </label>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="w-full bg-gray-200 rounded-md p-2 mb-4 focus:outline-none"
              placeholder="Email address"
              disabled={isSubmitting}
            />
            <button
              onClick={handleForgotPassword}
              className="bg-litratoblack text-white px-4 py-2 rounded w-full font-bold hover:bg-black transition-all"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Verify Email'}
            </button>
          </div>
        </div>
      )}

      <section>
        <div className="relative h-56 w-full mb-6">
          <Image
            src="/Images/litratobg.jpg"
            alt="background_img"
            fill
            className="object-cover bg-no-repeat"
            priority
          />
        </div>
        <LitratoBranding />
      </section>

      <section className="flex flex-col items-center justify-center mt-8 gap-y-4 mb-12">
        {/* Forms */}
        <div className="flex flex-col w-[30%]">
          <div>
            <label className="block text-lg mb-1">Username:</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md p-2 text-sm mb-2 focus:outline-none"
            />
            <label className="block text-lg mb-1">Password:</label>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={passwordVisible ? 'text' : 'password'}
                placeholder="Enter here:"
                className="w-full bg-gray-200 rounded-md p-2 pr-10 text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((prev) => !prev)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-600"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              >
                {passwordVisible ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          <div className="text-right mt-2">
            <button
              type="button"
              style={{ textDecoration: 'none' }}
              className="text-litratoblack hover bg-transparent border-none p-0 m-0 cursor-pointer"
              onClick={() => setShowForgotModal(true)}
            >
              Forgot Password
            </button>
          </div>
        </div>
        {/* Login Button */}
        <div
          onClick={handleLogin}
          className="bg-litratoblack select-none text-white px-6 py-2 rounded-lg hover:cursor-pointer font-bold transition-all duration-200 hover:bg-black"
        >
          LOGIN
        </div>
        <div>
          Don&apos;t have an account?{' '}
          <a
            href="/registration"
            style={{ textDecoration: 'none' }}
            className="text-blue-600"
          >
            Register
          </a>
        </div>
      </section>

      <LitratoFooter />
    </div>
  )
}
