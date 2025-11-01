'use client'
import React from 'react'
import { toast } from 'sonner'
import {
  getMyContract,
  uploadSignedContract,
  type BookingContract,
} from '../schemas/functions/Contracts/api'

export default function ContractSection({
  bookingId,
}: {
  bookingId: number | string
}) {
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [ctr, setCtr] = React.useState<BookingContract | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true)
      const c = await getMyContract(bookingId)
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
      const up = await uploadSignedContract(bookingId, file)
      if (up) {
        toast.success('Signed contract uploaded')
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
              <div className="text-gray-600">
                Not provided yet. Please wait for admin.
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="font-medium">Your signed copy</div>
            {ctr.signed_url ? (
              <a
                href={ctr.signed_url}
                target="_blank"
                className="text-blue-600 underline"
              >
                View your signed file
              </a>
            ) : (
              <div className="text-gray-600">
                You haven't uploaded a signed copy yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">No contract yet.</div>
      )}

      <div className="border-t pt-3">
        <div className="text-sm font-medium mb-1">Upload Signed Contract</div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={!ctr || !ctr.original_url}
          />
          <button
            type="button"
            onClick={onUpload}
            disabled={!file || saving || !ctr || !ctr.original_url}
            className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
          >
            {saving ? 'Uploading…' : 'Upload Signed'}
          </button>
        </div>
      </div>
    </div>
  )
}
