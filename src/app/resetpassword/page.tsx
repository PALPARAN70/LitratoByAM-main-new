'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export default function ResetPasswordPage() {
  const router = useRouter()
  const search = useSearchParams()
  const token = search.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [visibility, setVisibility] = useState({
    password: false,
    confirmPassword: false,
  })

  useEffect(() => {
    if (!token) {
      toast.error('Missing reset token.')
      router.push('/login')
    }
  }, [token, router])

  const handleCancel = () => {
    toast.error('Password reset cancelled.')
    router.push('/login')
  }

  const handleResetClick = () => {
    if (!password || !confirmPwd) {
      toast.error('Fill both fields.')
      return
    }
    if (password !== confirmPwd) {
      toast.error('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    setConfirmReset(true)
  }

  const handleDialogCancel = () => setConfirmReset(false)

  const toggleVisibility = (key: 'password' | 'confirmPassword') => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleConfirmReset = async () => {
    setSubmitting(true)
    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
      const res = await fetch(`${apiBase}/api/auth/resetPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Reset failed')
      }

      toast.success('Password reset successfully.')
      setVisibility({ password: false, confirmPassword: false })
      router.push('/login')
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: unknown }).message || '')
          : ''
      toast.error(message || 'Error resetting password.')
    } finally {
      setSubmitting(false)
      setConfirmReset(false)
      setVisibility({ password: false, confirmPassword: false })
    }
  }

  return (
    <div className="flex flex-col h-screen justify-center">
      <h1 className="text-3xl font-bold text-center">Reset Password</h1>
      <section className="flex flex-col items-center justify-center mt-8 gap-y-4 mb-12 w-full">
        <div className="flex flex-col w-full max-w-md">
          <label className="block text-lg mb-1">Enter New Password:</label>
          <div className="relative mb-3">
            <input
              type={visibility.password ? 'text' : 'password'}
              placeholder="New password"
              className="w-full bg-gray-200 rounded-md p-2 pr-10 text-sm focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => toggleVisibility('password')}
              disabled={submitting}
              className="absolute inset-y-0 right-2 flex items-center text-gray-600 disabled:text-gray-400"
              aria-label={
                visibility.password ? 'Hide password' : 'Show password'
              }
            >
              {visibility.password ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          <label className="block text-lg mb-1">Confirm New Password:</label>
          <div className="relative">
            <input
              type={visibility.confirmPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              className="w-full bg-gray-200 rounded-md p-2 pr-10 text-sm focus:outline-none"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => toggleVisibility('confirmPassword')}
              disabled={submitting}
              className="absolute inset-y-0 right-2 flex items-center text-gray-600 disabled:text-gray-400"
              aria-label={
                visibility.confirmPassword ? 'Hide password' : 'Show password'
              }
            >
              {visibility.confirmPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-row justify-between w-full max-w-md">
          <button
            onClick={handleCancel}
            disabled={submitting}
            className="bg-gray-500 hover:bg-gray-600 disabled:opacity-50 rounded text-white px-6 py-2 font-bold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleResetClick}
            disabled={submitting || !token}
            className="bg-litratoblack hover:bg-black disabled:opacity-50 rounded text-white px-6 py-2 font-bold transition-all"
          >
            {submitting ? 'Processing...' : 'Reset Password'}
          </button>
        </div>

        {confirmReset && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-[350px] flex flex-col items-center">
              <p className="text-lg mb-4 text-center">
                Confirm resetting your password?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleDialogCancel}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 font-bold"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="bg-litratoblack text-white px-4 py-2 rounded hover:bg-black font-bold disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Yes, Reset'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
