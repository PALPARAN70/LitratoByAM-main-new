'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import LitratoBranding from '../../../Litratocomponents/Branding'
import LitratoFooter from '../../../Litratocomponents/Footer'
import { toast } from 'sonner'
import { jwtDecode } from 'jwt-decode'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        const data = await res.json()
        console.log('Login response:', data)

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
        try {
          const errorData = await res.json()
          if (res.status === 401) {
            message = 'Invalid username or password'
          } else if (errorData?.message) {
            message = errorData.message
          }
        } catch {}
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

  return (
    <div>
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
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md p-2 text-sm focus:outline-none"
            />
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
