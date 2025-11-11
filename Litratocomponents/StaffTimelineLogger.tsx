'use client'
import { useEffect, useState } from 'react'
import { formatDisplayDateTime } from '@/lib/datetime'
import {
  listStaffLogsForBooking,
  patchMyStaffLog,
  type StaffLog,
} from '../schemas/functions/EventCards/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export type TimelineField =
  | 'arrived_at'
  | 'setup_finished_at'
  | 'started_at'
  | 'ended_at'
  | 'picked_up_at'

export default function StaffTimelineLogger({
  bookingId,
}: {
  bookingId: number | string | undefined
}) {
  const [logs, setLogs] = useState<StaffLog[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState<null | {
    field: TimelineField
    action: 'log' | 'undo'
  }>(null)
  const [busy, setBusy] = useState(false)
  // Track which fields were toggled in this session so Undo appears only after Log click
  const [toggled, setToggled] = useState<Record<TimelineField, boolean>>({
    arrived_at: false,
    setup_finished_at: false,
    started_at: false,
    ended_at: false,
    picked_up_at: false,
  })

  const reload = async () => {
    if (!bookingId) return
    setLoading(true)
    try {
      const rows = await listStaffLogsForBooking(bookingId, 'employee')
      setLogs(rows)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  const myLog: StaffLog | undefined = logs.find((l) => l.is_me)

  const labelOf = (f: TimelineField) => {
    switch (f) {
      case 'arrived_at':
        return 'Arrived at'
      case 'setup_finished_at':
        return 'Setup finished'
      case 'started_at':
        return 'Started at'
      case 'ended_at':
        return 'Ended at'
      case 'picked_up_at':
        return 'Picked up at'
    }
  }

  const handleLog = async (field: TimelineField, action: 'log' | 'undo') => {
    if (!bookingId) return
    setBusy(true)
    try {
      await patchMyStaffLog(
        bookingId,
        field,
        action === 'undo' ? null : undefined
      )
      await reload()
      setToggled((prev) => ({ ...prev, [field]: action === 'log' }))
    } finally {
      setBusy(false)
      setConfirmOpen(null)
    }
  }

  const renderTime = (v?: string | null) => (v ? formatDisplayDateTime(v) : '—')

  return (
    <div className="rounded-lg border p-4">
      <div className="font-semibold mb-2">Staff Timeline</div>
      <div className="space-y-2 text-xs">
        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : logs.length ? (
          <ul className="space-y-1">
            {logs.map((l) => (
              <li
                key={l.id || `${l.staff_userid}-${l.bookingid}`}
                className="border rounded p-2 bg-white"
              >
                <div className="font-medium text-gray-900">
                  {`${l.firstname || ''} ${l.lastname || ''}`.trim() ||
                    l.username ||
                    'Staff'}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-1">
                  <div>
                    <span className="text-gray-600">Arrived:</span>{' '}
                    {renderTime(l.arrived_at)}
                  </div>
                  <div>
                    <span className="text-gray-600">Setup finished:</span>{' '}
                    {renderTime(l.setup_finished_at)}
                  </div>
                  <div>
                    <span className="text-gray-600">Started:</span>{' '}
                    {renderTime(l.started_at)}
                  </div>
                  <div>
                    <span className="text-gray-600">Ended:</span>{' '}
                    {renderTime(l.ended_at)}
                  </div>
                  <div>
                    <span className="text-gray-600">Picked up:</span>{' '}
                    {renderTime(l.picked_up_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-gray-600">No staff logs yet.</div>
        )}
      </div>

      {/* Quick action buttons for my log */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {(
          [
            'arrived_at',
            'setup_finished_at',
            'started_at',
            'ended_at',
            'picked_up_at',
          ] as TimelineField[]
        ).map((f) => {
          const hasValue = Boolean((myLog as any)?.[f])
          const canUndo = toggled[f] && hasValue
          const nextAction: 'log' | 'undo' = canUndo ? 'undo' : 'log'
          const label = `${canUndo ? 'Undo' : 'Log'} ${labelOf(f)}`
          return (
            <button
              key={f}
              type="button"
              className="px-2 py-1 rounded border text-xs"
              onClick={() => setConfirmOpen({ field: f, action: nextAction })}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Confirm dialog */}
      <Dialog
        open={!!confirmOpen}
        onOpenChange={(o) => !o && setConfirmOpen(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm log</DialogTitle>
            <DialogDescription>
              {confirmOpen
                ? confirmOpen.action === 'undo'
                  ? `Undo “${labelOf(confirmOpen.field)}”?`
                  : `Set “${labelOf(confirmOpen.field)}” to now?`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="px-4 py-2 rounded border text-sm"
              onClick={() => setConfirmOpen(null)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded bg-litratoblack text-white text-sm disabled:opacity-50"
              disabled={!confirmOpen || busy}
              onClick={() =>
                confirmOpen && handleLog(confirmOpen.field, confirmOpen.action)
              }
            >
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
