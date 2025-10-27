'use client'

import { getAuthHeadersInit } from './createPayment'

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:5000'
const API_BASE = `${API_ORIGIN}/api`

async function safeText(res: Response, fallback: string) {
  try {
    const t = await res.text()
    return t || fallback
  } catch {
    return fallback
  }
}

// Fetch the admin sales report PDF as a Blob. Throws an Error with status=501 when
// the backend lacks a PDF generator, so callers can present a specific message.
export async function fetchAdminSalesReport(): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/payments/report`, {
    headers: { ...getAuthHeadersInit() },
  })
  if (res.status === 501) {
    const msg = await safeText(res, '')
    const err = new Error(
      msg ||
        'PDF generator not installed on server. Please install pdfkit in backend.'
    ) as Error & { status?: number }
    err.status = 501
    throw err
  }
  if (!res.ok) {
    throw new Error(await safeText(res, 'Failed to generate sales report'))
  }
  return await res.blob()
}

// Utility to open a Blob in a new tab and trigger the print dialog.
export function openBlobInNewTabAndPrint(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  setTimeout(() => {
    try {
      w?.print?.()
    } catch {}
  }, 500)
}

const SalesReportAPI = {
  fetchAdminSalesReport,
  openBlobInNewTabAndPrint,
}

export default SalesReportAPI
