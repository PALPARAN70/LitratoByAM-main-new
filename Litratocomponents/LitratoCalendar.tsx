'use client'
import { useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
} from 'date-fns'

type CalendarProps = {
  markedDate?: Date | null
  initialMonth?: Date | null
}

export default function Calendar({
  markedDate = null,
  initialMonth = null,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth ?? new Date())
  const [selectedDate, setSelectedDate] = useState(initialMonth ?? new Date())

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
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })

    const rows = []
    let days = []
    let day = startDate

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day
        const formattedDate = format(day, 'd')

        const isCurrentMonth = isSameMonth(day, monthStart)
        const isToday = isSameDay(day, new Date())
        const isSelected = isSameDay(day, selectedDate)
        const isMarked = markedDate ? isSameDay(day, markedDate) : false

        const commonClass = `flex justify-center items-center h-12 w-12 mx-auto rounded-full transition duration-150 ease-in-out`

        let cellClass = commonClass
        if (!isCurrentMonth) {
          cellClass += ' text-gray-400 cursor-default'
        } else if (isMarked) {
          // Mark requested booking date in red
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

        days.push(
          <div
            className={cellClass}
            key={day.toString()}
            onClick={() => isCurrentMonth && onDateClick(cloneDay)}
          >
            {formattedDate}
          </div>
        )
        day = addDays(day, 1)
      }

      rows.push(
        <div className="grid grid-cols-7 px-2" key={day.toString()}>
          {days}
        </div>
      )
      days = []
    }

    return <div className="space-y-2">{rows}</div>
  }

  const onDateClick = (day: Date) => {
    setSelectedDate(day)
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
