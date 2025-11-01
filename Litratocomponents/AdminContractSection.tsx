'use client'
import React from 'react'
import { toast } from 'sonner'
import {
  getAdminContract,
  uploadAdminContractOriginal,
  verifyAdminContract,
  type BookingContract,
} from '../schemas/functions/Contracts/api'

export default function AdminContractSection({
  bookingId,
}: {
  bookingId: number | string
}) {
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [verifying, setVerifying] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [ctr, setCtr] = React.useState<BookingContract | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true)
      const c = await getAdminContract(bookingId)
      setCtr(c)
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const onUpload = async () => {
    if (!file) return
    try {
      setSaving(true)
      const up = await uploadAdminContractOriginal(bookingId, file)
      if (up) {
        toast.success('Contract uploaded')
        setFile(null)
        await refresh()
      } else {
        toast.error('Upload failed')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const onVerify = async () => {
    try {
      setVerifying(true)
      const ok = await verifyAdminContract(bookingId)
      if (ok) {
        toast.success('Marked as Signed & Verified')
        await refresh()
      } else {
        toast.error('Failed to verify')
      }
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="font-semibold">Contract</div>
      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : ctr ? (
        <div className="text-sm space-y-2">
          <div>
            <span className="font-medium">Status:</span> {ctr.status}
          </div>
          <div className="flex flex-col gap-1">
            <div className="font-medium">Original</div>
            {ctr.original_url ? (
              <a
                href={ctr.original_url}
                target="_blank"
                className="text-blue-600 underline"
              >
                View / Download
              </a>
            ) : (
              <div className="text-gray-600">No original uploaded</div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="font-medium">Signed by Customer</div>
            {ctr.signed_url ? (
              <a
                href={ctr.signed_url}
                target="_blank"
                className="text-blue-600 underline"
              >
                View signed file
              </a>
            ) : (
              <div className="text-gray-600">Not yet provided</div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">No contract yet.</div>
      )}

      <div className="border-t pt-3">
        <div className="text-sm font-medium mb-1">
          Upload/Replace Original Contract
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={onUpload}
            disabled={!file || saving}
            className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
          >
            {saving ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={
            !ctr || !ctr.signed_url || ctr.status === 'Verified' || verifying
          }
          onClick={onVerify}
          className="px-3 py-2 rounded bg-green-700 text-white text-sm disabled:opacity-50"
        >
          {verifying ? 'Verifying…' : 'Mark as Signed & Verified'}
        </button>
      </div>
    </div>
  )
}
