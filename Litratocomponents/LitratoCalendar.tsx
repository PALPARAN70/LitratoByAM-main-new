'use client'
import { useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import {
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  startOfDay,
  isBefore,
} from 'date-fns'

type CalendarProps = {
  markedDate?: Date | null
  initialMonth?: Date | null
  value?: Date | null
  onDateChangeAction?: (date: Date) => void
  onDateClickAction?: (
    date: Date,
    meta: {
      boundingRect: DOMRect
    }
  ) => void
  // Optional: per-date markers for custom highlighting (key = 'YYYY-MM-DD')
  // Use 'yellow' for single approved booking, 'red' for 2 or more
  markers?: Record<string, 'yellow' | 'red'>
  // Optional: dates that have pending requests; these get a blue outline ring
  pendingOutline?: Record<string, boolean>
}

export default function Calendar({
  markedDate = null,
  initialMonth = null,
  value = null,
  onDateChangeAction,
  onDateClickAction,
  markers = {},
  pendingOutline = {},
}: CalendarProps) {
  const initial = value ?? initialMonth ?? new Date()
  const [currentMonth, setCurrentMonth] = useState(initial)
  const [selectedDate, setSelectedDate] = useState(initial)

  // Keep internal state in sync if parent controls the value
  useEffect(() => {
    if (value) {
      setSelectedDate(value)
      // If month changed significantly, center currentMonth on the selected value
      setCurrentMonth(value)
    }
  }, [value])

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-4 ">
        <button
          onClick={prevMonth}
          className="text-xl hover:cursor-pointer"
        >{`<`}</button>
        <h2 className="text-lg font-medium">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={nextMonth}
          className="text-xl hover:cursor-pointer"
        >{`>`}</button>
      </div>
    )
  }

  const renderDays = () => {
    const days = []
    const dateFormat = 'E'
    const startDate = startOfWeek(currentMonth, { weekStartsOn: 0 })

    for (let i = 0; i < 7; i++) {
      days.push(
        <div className="text-center text-sm font-medium text-gray-700" key={i}>
          {format(addDays(startDate, i), dateFormat).charAt(0)}
        </div>
      )
    }
    return <div className="grid grid-cols-7 mb-2 px-2">{days}</div>
  }

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
    const todayStart = startOfDay(new Date())

    const rows = []
    let day = startDate

    for (let week = 0; week < 6; week++) {
      const days = []
      for (let i = 0; i < 7; i++) {
        const cloneDay = day
        const formattedDate = format(day, 'd')
        const isoKey = format(day, 'yyyy-MM-dd')

        const isCurrentMonth = isSameMonth(day, monthStart)
        const isToday = isSameDay(day, new Date())
        const isSelected = isSameDay(day, selectedDate)
        const isMarked = markedDate ? isSameDay(day, markedDate) : false
        const hasPending = isCurrentMonth && !!pendingOutline[isoKey]
        const isPast = isBefore(day, todayStart)
        const isClickable = isCurrentMonth && !isPast

        const commonClass = `flex justify-center items-center h-12 w-12 mx-auto rounded-full transition duration-150 ease-in-out`

        let cellClass = commonClass
        if (!isCurrentMonth) {
          cellClass += ' text-gray-400 cursor-default'
        } else if (isCurrentMonth && markers[isoKey] === 'red') {
          // Two or more approved bookings
          cellClass += ' bg-red-500 text-white cursor-pointer'
        } else if (isCurrentMonth && markers[isoKey] === 'yellow') {
          // One approved booking
          cellClass += ' bg-yellow-400 text-black cursor-pointer'
        } else if (isMarked) {
          // Legacy single marked date (e.g., selected request)
          cellClass += ' bg-red-500 text-white cursor-pointer'
        } else if (isToday) {
          cellClass += ' bg-litratoblack text-white cursor-pointer'
        } else if (isSelected) {
          cellClass +=
            ' border-2 border-litratoblack text-litratoblack cursor-pointer'
        } else {
          cellClass +=
            ' text-litratoblack hover:bg-litratoblack hover:text-white cursor-pointer'
        }

        // Overlay a blue ring if there are pending requests on this date
        if (hasPending) {
          cellClass +=
            ' ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-300'
        }

        // Always show a strong selection ring, even on colored days
        if (isSelected) {
          cellClass +=
            ' ring-2 ring-litratoblack ring-offset-2 ring-offset-gray-300'
        }

        if (!isClickable && !isSelected) {
          cellClass += ' cursor-not-allowed opacity-60'
        }

        days.push(
          <div
            className={cellClass}
            key={isoKey}
            aria-disabled={!isClickable}
            onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
              if (!isClickable) return
              const rect = event.currentTarget.getBoundingClientRect()
              onDateClick(cloneDay, rect)
            }}
          >
            {formattedDate}
          </div>
        )
        day = addDays(day, 1)
      }

      rows.push(
        <div className="grid grid-cols-7 px-2" key={`week-${week}`}>
          {days}
        </div>
      )
    }

    return <div className="space-y-2">{rows}</div>
  }

  const onDateClick = (day: Date, rect?: DOMRect) => {
    setSelectedDate(day)
    onDateChangeAction?.(day)
    if (onDateClickAction) {
      const metaRect = rect ?? new DOMRect()
      onDateClickAction(day, { boundingRect: metaRect })
    }
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  return (
    <div className="bg-gray-300 w-full max-w-[640px] rounded p-6 shadow-lg text-litratoblack">
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  )
}
