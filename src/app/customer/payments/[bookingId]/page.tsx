'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import {
  getLatestPaymentQR,
  uploadPaymentProof,
  createCustomerPayment,
} from '../../../../../schemas/functions/Payment/createPayment'
import { toast } from 'sonner'

export default function CustomerPaymentPage() {
  const params = useParams()
  const bookingId = useMemo(() => Number(params?.bookingId), [params])
  const [qrUrl, setQrUrl] = useState<string>('')
  const [amountPaid, setAmountPaid] = useState<string>('')
  const [referenceNo, setReferenceNo] = useState<string>('')
  const [proofUrl, setProofUrl] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    ;(async () => {
      const url = await getLatestPaymentQR()
      if (url) setQrUrl(url)
    })()
  }, [])

  const handleUploadProof: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { url } = await uploadPaymentProof(file)
      setProofUrl(url)
    } catch (err) {
      console.error('Upload proof failed:', err)
    }
  }

  const handleSubmit = async () => {
    if (!bookingId || !amountPaid || !referenceNo) return
    setSubmitting(true)
    try {
      await createCustomerPayment({
        bookingId,
        amountPaid: Number(amountPaid),
        referenceNo,
        proofImageUrl: proofUrl || null,
        paymentMethod: 'gcash',
      })
      // you could redirect or show success
      setAmountPaid('')
      setReferenceNo('')
      setProofUrl('')
      toast.success('Payment submitted. Awaiting verification.')
    } catch (err) {
      console.error('Submit payment failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Pay Booking #{bookingId}</h1>
      {qrUrl ? (
        <div>
          <div className="text-sm text-gray-600 mb-2">
            Scan this QR with GCash:
          </div>
          <Image
            src={qrUrl}
            alt="Payment QR code"
            width={600}
            height={600}
            sizes="(max-width: 768px) 100vw, 600px"
            className="w-full max-h-80 object-contain border rounded"
            unoptimized
          />
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          QR code not available. Please contact support.
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Amount Paid (PHP)</label>
        <input
          type="number"
          min={0}
          className="w-full rounded border px-3 py-2"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Reference No.</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={referenceNo}
          onChange={(e) => setReferenceNo(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Upload Proof (Screenshot)
        </label>
        <input type="file" accept="image/*" onChange={handleUploadProof} />
        {proofUrl ? (
          <div className="text-xs text-gray-600">Uploaded: {proofUrl}</div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="px-4 py-2 rounded bg-black text-white"
      >
        {submitting ? 'Submitting...' : 'Submit Payment'}
      </button>
    </div>
  )
}
