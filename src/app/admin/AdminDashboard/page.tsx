'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  FiArrowDownRight,
  FiArrowUpRight,
  FiDownload,
  FiFileText,
} from 'react-icons/fi'
import { LuSparkles } from 'react-icons/lu'

type BookingAnalyticsRow = {
  month: string
  successful: number
  cancelled: number
  declined: number
  year?: number
}

type RevenueAnalyticsRow = {
  month: string
  revenue: number
  refunds: number
  net: number
  year?: number
}

type RevenueBreakdownItem = {
  packageId?: number
  name: string
  value: number
  revenue: number
  refunds: number
  net: number
  color: string
}

type MonthRange = { start: number; end: number }
type TabKey = 'bookings' | 'revenue'

const MONTHS = [
  { value: 1, label: 'January', short: 'Jan' },
  { value: 2, label: 'February', short: 'Feb' },
  { value: 3, label: 'March', short: 'Mar' },
  { value: 4, label: 'April', short: 'Apr' },
  { value: 5, label: 'May', short: 'May' },
  { value: 6, label: 'June', short: 'Jun' },
  { value: 7, label: 'July', short: 'Jul' },
  { value: 8, label: 'August', short: 'Aug' },
  { value: 9, label: 'September', short: 'Sep' },
  { value: 10, label: 'October', short: 'Oct' },
  { value: 11, label: 'November', short: 'Nov' },
  { value: 12, label: 'December', short: 'Dec' },
]

const MONTH_LOOKUP = new Map(MONTHS.map((item) => [item.label, item.value]))
const currentYear = new Date().getFullYear()

const REVENUE_COLOR_PALETTE = [
  '#38bdf8',
  '#22c55e',
  '#a855f7',
  '#f97316',
  '#facc15',
  '#14b8a6',
  '#f472b6',
  '#60a5fa',
  '#fb7185',
  '#c084fc',
]

const BOOKING_COLORS = {
  successful: '#22c55e',
  cancelled: '#fb923c',
  declined: '#ef4444',
}

const REVENUE_COLORS = {
  revenue: '#38bdf8',
  refunds: '#f97316',
  net: '#14b8a6',
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('bookings')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [monthRange, setMonthRange] = useState<MonthRange>({
    start: 1,
    end: 12,
  })
  const [bookingData, setBookingData] = useState<BookingAnalyticsRow[]>([])
  const [revenueData, setRevenueData] = useState<RevenueAnalyticsRow[]>([])
  const [revenueBreakdown, setRevenueBreakdown] = useState<
    RevenueBreakdownItem[]
  >([])
  const [showBookingTrend, setShowBookingTrend] = useState(true)
  const [showBookingComposition, setShowBookingComposition] = useState(true)
  const [showRevenueTrend, setShowRevenueTrend] = useState(true)
  const [showRevenueBreakdown, setShowRevenueBreakdown] = useState(true)
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null

    if (!token) return

    const searchParams = new URLSearchParams({
      year: String(selectedYear),
      startMonth: String(monthRange.start),
      endMonth: String(monthRange.end),
    }).toString()

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'

    const fetchAnalytics = async () => {
      setIsFetching(true)
      try {
        const [bookingRes, revenueRes] = await Promise.all([
          fetch(`${baseUrl}/api/admin/analytics/bookings?${searchParams}`, {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${baseUrl}/api/admin/analytics/revenue?${searchParams}`, {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (bookingRes.ok) {
          const payload = await bookingRes.json().catch(() => null)
          if (Array.isArray(payload?.data)) {
            const mapped: BookingAnalyticsRow[] = (payload.data as any[])
              .map((row: any) => ({
                month: String(row.month ?? ''),
                successful: Number(row.successful ?? 0),
                cancelled: Number(row.cancelled ?? 0),
                declined: Number(row.declined ?? 0),
                year: Number(row.year ?? selectedYear),
              }))
              .filter((row: BookingAnalyticsRow) => row.month)
            setBookingData(mapped)
          } else {
            setBookingData([])
          }
        }

        if (revenueRes.ok) {
          const payload = await revenueRes.json().catch(() => null)
          if (Array.isArray(payload?.data)) {
            const mapped: RevenueAnalyticsRow[] = (payload.data as any[])
              .map((row: any) => {
                const revenue = Number(row.revenue ?? 0)
                const refunds = Number(row.refunds ?? 0)
                const net = Number(row.net ?? revenue - refunds)
                return {
                  month: String(row.month ?? ''),
                  revenue,
                  refunds,
                  net,
                  year: Number(row.year ?? selectedYear),
                }
              })
              .filter((row: RevenueAnalyticsRow) => row.month)
            setRevenueData(mapped)
          } else {
            setRevenueData([])
          }

          if (Array.isArray(payload?.breakdown)) {
            const mappedBreakdown: RevenueBreakdownItem[] = (
              payload.breakdown as any[]
            )
              .map((row: any, index: number) => {
                const revenue = Number(row.revenue ?? 0)
                const refunds = Number(row.refunds ?? 0)
                const net = Number(row.net ?? revenue - refunds)
                return {
                  packageId: row.packageId ?? row.package_id ?? undefined,
                  name: String(
                    row.packageName ?? row.package_name ?? 'Unknown'
                  ),
                  revenue,
                  refunds,
                  net,
                  value: Math.max(revenue, 0),
                  color:
                    REVENUE_COLOR_PALETTE[index % REVENUE_COLOR_PALETTE.length],
                }
              })
              .filter((entry: RevenueBreakdownItem) => entry.name)
            setRevenueBreakdown(mappedBreakdown)
          } else {
            setRevenueBreakdown([])
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Analytics fetch failed', error)
        }
      } finally {
        setIsFetching(false)
      }
    }

    fetchAnalytics()
    return () => controller.abort()
  }, [selectedYear, monthRange.start, monthRange.end])

  const filteredBookingData = useMemo(() => {
    return bookingData
      .filter((row) => (row.year ?? selectedYear) === selectedYear)
      .filter((row) => {
        const monthIndex = MONTH_LOOKUP.get(row.month) ?? 1
        return monthIndex >= monthRange.start && monthIndex <= monthRange.end
      })
      .map((row) => ({
        ...row,
        monthShort:
          MONTHS.find((item) => item.label === row.month)?.short ?? row.month,
      }))
  }, [bookingData, selectedYear, monthRange])

  const filteredRevenueData = useMemo(() => {
    return revenueData
      .filter((row) => (row.year ?? selectedYear) === selectedYear)
      .filter((row) => {
        const monthIndex = MONTH_LOOKUP.get(row.month) ?? 1
        return monthIndex >= monthRange.start && monthIndex <= monthRange.end
      })
      .map((row) => ({
        ...row,
        monthShort:
          MONTHS.find((item) => item.label === row.month)?.short ?? row.month,
      }))
  }, [revenueData, selectedYear, monthRange])

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/80 px-4 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300">
            <LuSparkles className="h-3.5 w-3.5 text-amber-500" />
            Executive Analytics Overview
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Admin Analytics Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor bookings, revenue, and overall performance for{' '}
            {selectedYear}. Adjust filters to hone in on seasonal trends.
          </p>
        </div>
        <FilterBar
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          monthRange={monthRange}
          onMonthRangeChange={setMonthRange}
          isFetching={isFetching}
        />
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabKey)}
        className="space-y-5"
      >
        <TabsList className="w-full justify-start gap-2 rounded bg-slate-100/70 p-1 shadow-inner dark:bg-slate-800/70 md:w-auto">
          <TabsTrigger
            value="bookings"
            className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900/90 dark:data-[state=active]:text-white"
          >
            📸 Bookings
          </TabsTrigger>
          <TabsTrigger
            value="revenue"
            className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900/90 dark:data-[state=active]:text-white"
          >
            💰 Revenue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-6">
          <BookingsTab
            data={filteredBookingData}
            selectedYear={selectedYear}
            monthRange={monthRange}
            showTrend={showBookingTrend}
            onToggleTrend={setShowBookingTrend}
            showComposition={showBookingComposition}
            onToggleComposition={setShowBookingComposition}
          />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <RevenueTab
            data={filteredRevenueData}
            selectedYear={selectedYear}
            monthRange={monthRange}
            showTrend={showRevenueTrend}
            onToggleTrend={setShowRevenueTrend}
            showBreakdown={showRevenueBreakdown}
            onToggleBreakdown={setShowRevenueBreakdown}
            breakdown={revenueBreakdown}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

type FilterBarProps = {
  selectedYear: number
  onYearChange: (value: number) => void
  monthRange: MonthRange
  onMonthRangeChange: (range: MonthRange) => void
  isFetching: boolean
}

function FilterBar({
  selectedYear,
  onYearChange,
  monthRange,
  onMonthRangeChange,
  isFetching,
}: FilterBarProps) {
  const years = useMemo(
    () => [currentYear, currentYear - 1, currentYear - 2],
    []
  )

  const handleStartMonth = (value: string) => {
    const start = Number(value)
    if (start > monthRange.end) {
      onMonthRangeChange({ start, end: start })
    } else {
      onMonthRangeChange({ start, end: monthRange.end })
    }
  }

  const handleEndMonth = (value: string) => {
    const end = Number(value)
    if (end < monthRange.start) {
      onMonthRangeChange({ start: end, end })
    } else {
      onMonthRangeChange({ start: monthRange.start, end })
    }
  }

  return (
    <Card className="w-full max-w-xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-300">
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
          >
            {isFetching ? 'Refreshing' : 'Live'}
          </Badge>
          <span>Filters</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label
              htmlFor="year-select"
              className="text-xs uppercase tracking-wide"
            >
              Year
            </Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(value) => onYearChange(Number(value))}
            >
              <SelectTrigger
                id="year-select"
                className="h-10 rounded-xl border-slate-200 bg-white/90 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="start-month"
              className="text-xs uppercase tracking-wide"
            >
              Start Month
            </Label>
            <Select
              value={String(monthRange.start)}
              onValueChange={handleStartMonth}
            >
              <SelectTrigger
                id="start-month"
                className="h-10 rounded-xl border-slate-200 bg-white/90 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={String(month.value)}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="end-month"
              className="text-xs uppercase tracking-wide"
            >
              End Month
            </Label>
            <Select
              value={String(monthRange.end)}
              onValueChange={handleEndMonth}
            >
              <SelectTrigger
                id="end-month"
                className="h-10 rounded-xl border-slate-200 bg-white/90 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={String(month.value)}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type BookingsTabProps = {
  data: (BookingAnalyticsRow & { monthShort: string })[]
  selectedYear: number
  monthRange: MonthRange
  showTrend: boolean
  onToggleTrend: (value: boolean) => void
  showComposition: boolean
  onToggleComposition: (value: boolean) => void
}

function BookingsTab({
  data,
  selectedYear,
  monthRange,
  showTrend,
  onToggleTrend,
  showComposition,
  onToggleComposition,
}: BookingsTabProps) {
  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => {
        acc.successful += row.successful
        acc.cancelled += row.cancelled
        acc.declined += row.declined
        return acc
      },
      { successful: 0, cancelled: 0, declined: 0 }
    )
  }, [data])

  const bookingTotal = totals.successful + totals.cancelled + totals.declined
  const successRate = bookingTotal
    ? Math.round((totals.successful / bookingTotal) * 1000) / 10
    : 0

  const trendData = useMemo(() => {
    return data.map((row, index, array) => ({
      month: row.monthShort,
      successful: row.successful,
      total: row.successful + row.cancelled + row.declined,
      growth: index === 0 ? 0 : row.successful - array[index - 1].successful,
    }))
  }, [data])

  const compositionData = useMemo(() => {
    return [
      {
        name: 'Successful',
        value: totals.successful,
        color: BOOKING_COLORS.successful,
      },
      {
        name: 'Cancelled',
        value: totals.cancelled,
        color: BOOKING_COLORS.cancelled,
      },
      {
        name: 'Declined',
        value: totals.declined,
        color: BOOKING_COLORS.declined,
      },
    ]
  }, [totals])

  return (
    <>
      <Card className="border-none bg-gradient-to-br from-white via-white to-slate-50 shadow-xl dark:from-slate-950 dark:via-slate-950/90 dark:to-slate-950">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold text-slate-900 dark:text-white">
              Booking Performance
            </CardTitle>
            <CardDescription>
              Monthly breakdown of successful, cancelled, and declined bookings
              for {selectedYear}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <ToggleRow
              id="booking-trend"
              label="Monthly Growth Trend"
              value={showTrend}
              onValueChange={onToggleTrend}
            />
            <ToggleRow
              id="booking-composition"
              label="Booking Composition"
              value={showComposition}
              onValueChange={onToggleComposition}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-inner dark:border-slate-800 dark:bg-slate-950/70">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={data}
                margin={{ top: 24, right: 24, left: 0, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--muted)/0.4)"
                />
                <XAxis dataKey="monthShort" tickLine={false} axisLine={false} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 12 }}
                />
                <RechartsTooltip
                  content={<BookingTooltip />}
                  cursor={{ fill: 'rgba(15, 118, 110, 0.05)' }}
                />
                <Bar
                  dataKey="successful"
                  name="Successful"
                  stackId="bookings"
                  fill={BOOKING_COLORS.successful}
                  radius={[8, 8, 0, 0]}
                  barSize={28}
                />
                <Bar
                  dataKey="cancelled"
                  name="Cancelled"
                  stackId="bookings"
                  fill={BOOKING_COLORS.cancelled}
                  radius={[8, 8, 0, 0]}
                  barSize={28}
                />
                <Bar
                  dataKey="declined"
                  name="Declined"
                  stackId="bookings"
                  fill={BOOKING_COLORS.declined}
                  radius={[8, 8, 0, 0]}
                  barSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Total Successful"
              primary={`${totals.successful.toLocaleString()} bookings`}
              helper="Confirmed Bookings this season"
              accent="from-emerald-500/10 to-emerald-500/0"
              icon="✅"
            />
            <SummaryCard
              title="Total Cancelled"
              primary={`${totals.cancelled.toLocaleString()} bookings`}
              helper="Cancelled events"
              accent="from-orange-500/10 to-orange-500/0"
              icon="⚠️"
            />
            <SummaryCard
              title="Total Declined"
              primary={`${totals.declined.toLocaleString()} requests`}
              helper="Declined Bookings"
              accent="from-red-500/10 to-red-500/0"
              icon="🚫"
            />
            <SummaryCard
              title="Booking Success Rate"
              primary={`${successRate.toFixed(1)}%`}
              helper="Share of successful bookings"
              accent="from-sky-500/10 to-sky-500/0"
              icon="📈"
            />
          </div>

          {(showTrend || showComposition) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {showTrend && (
                <Card className="border border-slate-200/70 bg-white/80 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">
                      Monthly Growth Trend
                    </CardTitle>
                    <CardDescription>
                      Successful bookings momentum within the selected range.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart
                        data={trendData}
                        margin={{ top: 16, right: 20, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--muted)/0.4)"
                        />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <RechartsTooltip content={<GrowthTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="successful"
                          name="Successful"
                          stroke="#22c55e"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          name="Total Requests"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {showComposition && (
                <Card className="border border-slate-200/70 bg-white/80 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">
                      Booking Composition
                    </CardTitle>
                    <CardDescription>
                      Successful vs cancelled vs declined bookings.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="h-56 w-full md:w-1/2">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={compositionData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                          >
                            {compositionData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip content={<CompositionTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-1 flex-col gap-3">
                      {compositionData.map((entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
                        >
                          <span className="font-medium text-slate-600 dark:text-slate-200">
                            {entry.name}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {entry.value.toLocaleString()} (
                            {bookingTotal
                              ? Math.round((entry.value / bookingTotal) * 100)
                              : 0}
                            %)
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

type RevenueTabProps = {
  data: (RevenueAnalyticsRow & { monthShort: string })[]
  selectedYear: number
  monthRange: MonthRange
  showTrend: boolean
  onToggleTrend: (value: boolean) => void
  showBreakdown: boolean
  onToggleBreakdown: (value: boolean) => void
  breakdown: RevenueBreakdownItem[]
}

function RevenueTab({
  data,
  selectedYear,
  monthRange,
  showTrend,
  onToggleTrend,
  showBreakdown,
  onToggleBreakdown,
  breakdown,
}: RevenueTabProps) {
  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => {
        acc.revenue += row.revenue
        acc.refunds += row.refunds
        acc.net += row.net
        return acc
      },
      { revenue: 0, refunds: 0, net: 0 }
    )
  }, [data])

  const avgMonthlyRevenue = data.length ? totals.revenue / data.length : 0
  const lastTwo = data.slice(-2)
  const netDelta =
    lastTwo.length === 2 ? lastTwo[1].net - lastTwo[0].net : totals.net
  const netChangePercent =
    lastTwo.length === 2 && lastTwo[0].net
      ? (netDelta / lastTwo[0].net) * 100
      : 0

  const breakdownData = useMemo<RevenueBreakdownItem[]>(() => {
    if (breakdown.length) return breakdown
    if (!totals.revenue) return []
    return [
      {
        packageId: undefined,
        name: 'All Packages',
        revenue: totals.revenue,
        refunds: totals.refunds,
        net: totals.net,
        value: Math.max(totals.revenue, 0),
        color: REVENUE_COLOR_PALETTE[0],
      },
    ]
  }, [breakdown, totals.net, totals.refunds, totals.revenue])

  const breakdownTotal = useMemo(() => {
    return breakdownData.reduce((sum, entry) => sum + entry.value, 0)
  }, [breakdownData])

  return (
    <Card className="border-none bg-gradient-to-br from-white via-white to-slate-50 shadow-xl dark:from-slate-950 dark:via-slate-950/90 dark:to-slate-950">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-2xl font-semibold text-slate-900 dark:text-white">
            Revenue Intelligence
          </CardTitle>
          <CardDescription>
            Track monthly revenue, refunds, and net performance for{' '}
            {selectedYear}.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ToggleRow
            id="revenue-trend"
            label="Net Trendline"
            value={showTrend}
            onValueChange={onToggleTrend}
          />
          <ToggleRow
            id="revenue-breakdown"
            label="Revenue Breakdown"
            value={showBreakdown}
            onValueChange={onToggleBreakdown}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-inner dark:border-slate-800 dark:bg-slate-950/70">
          <ResponsiveContainer width="100%" height={360}>
            <ComposedRevenueChart data={data} showTrend={showTrend} />
          </ResponsiveContainer>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Revenue"
            primary={`₱${totals.revenue.toLocaleString()}`}
            helper="Gross revenue this year"
            accent="from-sky-500/10 to-sky-500/0"
            icon="💼"
          />
          <SummaryCard
            title="Total Refunds"
            primary={`₱${totals.refunds.toLocaleString()}`}
            helper="Issued to clients"
            accent="from-rose-500/10 to-rose-500/0"
            icon="🔁"
          />
          <SummaryCard
            title="Net Profit"
            primary={`₱${totals.net.toLocaleString()}`}
            helper="After refunds"
            accent="from-emerald-500/10 to-emerald-500/0"
            icon="💹"
          />
          <SummaryCard
            title="Avg Monthly Revenue"
            primary={`₱${Math.round(avgMonthlyRevenue).toLocaleString()}`}
            helper="Across selected months"
            accent="from-violet-500/10 to-violet-500/0"
            icon="📊"
            trend={netChangePercent}
            trendDirection={netDelta >= 0 ? 'up' : 'down'}
          />
        </div>

        {showBreakdown && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border border-slate-200/70 bg-white/80 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Revenue Breakdown
                </CardTitle>
                <CardDescription>Earnings per Event Packages.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
                {breakdownData.length ? (
                  <>
                    <div className="h-56 w-full md:w-1/2">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={breakdownData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                          >
                            {breakdownData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            content={
                              <RevenueBreakdownTooltip total={breakdownTotal} />
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-1 flex-col gap-3">
                      {breakdownData.map((entry) => {
                        const share =
                          breakdownTotal > 0
                            ? Math.round(
                                (entry.value / breakdownTotal) * 1000
                              ) / 10
                            : 0
                        return (
                          <div
                            key={entry.name}
                            className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-600 dark:text-slate-200">
                                {entry.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {share}% of gross revenue
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Gross ₱{entry.revenue.toLocaleString()} ·
                                Refunds ₱{entry.refunds.toLocaleString()}
                              </span>
                            </div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              ₱{entry.net.toLocaleString()}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex h-56 w-full items-center justify-center rounded-2xl border border-dashed border-slate-200/70 bg-slate-50/60 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-950/40">
                    No revenue data available for the selected range.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-200/70 bg-white/80 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Performance Snapshot
                </CardTitle>
                <CardDescription>
                  Comparing net revenue vs previous month.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full',
                      netDelta >= 0
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                    )}
                  >
                    {netDelta >= 0 ? (
                      <FiArrowUpRight className="h-5 w-5" />
                    ) : (
                      <FiArrowDownRight className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {netDelta >= 0
                        ? 'Net revenue is growing'
                        : 'Net revenue dipped'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.abs(netDelta)
                        ? `₱${Math.abs(
                            netDelta
                          ).toLocaleString()} (${netChangePercent.toFixed(1)}%)`
                        : 'No change vs last month.'}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-100/80 via-white to-white p-4 text-xs text-muted-foreground shadow-inner dark:border-slate-800 dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-900">
                  Insights consider data between{' '}
                  {MONTHS.find((m) => m.value === monthRange.start)?.label ??
                    ''}{' '}
                  and{' '}
                  {MONTHS.find((m) => m.value === monthRange.end)?.label ?? ''}.
                  Export the report for executive review.
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type ToggleRowProps = {
  id: string
  label: string
  value: boolean
  onValueChange: (value: boolean) => void
}

function ToggleRow({ id, label, value, onValueChange }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70">
      <Switch id={id} checked={value} onCheckedChange={onValueChange} />
      <Label
        htmlFor={id}
        className="cursor-pointer  text-slate-600 dark:text-slate-200"
      >
        {label}
      </Label>
    </div>
  )
}

type SummaryCardProps = {
  title: string
  primary: string
  helper: string
  accent: string
  icon: string
  trend?: number
  trendDirection?: 'up' | 'down'
}

function SummaryCard({
  title,
  primary,
  helper,
  accent,
  icon,
  trend,
  trendDirection,
}: SummaryCardProps) {
  const showTrend = typeof trend === 'number' && !Number.isNaN(trend)
  return (
    <Card className="relative overflow-hidden border border-slate-200/70 bg-white/80 shadow-lg transition-shadow hover:shadow-xl dark:border-slate-800 dark:bg-slate-950/70">
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br',
          accent
        )}
      />
      <CardContent className="relative space-y-3 px-5 py-6">
        <span className="text-2xl" aria-hidden>
          {icon}
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">
            {primary}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{helper}</p>
        {showTrend && trendDirection && (
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
              trendDirection === 'up'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
            )}
          >
            {trendDirection === 'up' ? (
              <FiArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <FiArrowDownRight className="h-3.5 w-3.5" />
            )}
            {`${trend?.toFixed(1)}% vs last month`}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BookingTooltip({
  active,
  label,
  payload,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as BookingAnalyticsRow
  return (
    <div className="rounded-xl border border-slate-800/40 bg-slate-900/90 p-3 text-sm text-white shadow-xl">
      <p className="text-xs uppercase tracking-wide text-slate-300">{label}</p>
      <div className="mt-2 space-y-1">
        <div>
          Successful:{' '}
          <span className="font-semibold text-emerald-300">
            {row.successful.toLocaleString()}
          </span>
        </div>
        <div>
          Cancelled:{' '}
          <span className="font-semibold text-amber-200">
            {row.cancelled.toLocaleString()}
          </span>
        </div>
        <div>
          Declined:{' '}
          <span className="font-semibold text-rose-200">
            {row.declined.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}

function GrowthTooltip({
  active,
  label,
  payload,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as {
    successful: number
    total: number
    growth: number
  }
  return (
    <div className="rounded-xl border border-slate-800/40 bg-slate-900/90 p-3 text-sm text-white shadow-xl">
      <p className="text-xs uppercase tracking-wide text-slate-300">{label}</p>
      <div className="mt-2 space-y-1">
        <div>
          Successful bookings:{' '}
          <span className="font-semibold text-emerald-300">
            {row.successful.toLocaleString()}
          </span>
        </div>
        <div>
          Total requests:{' '}
          <span className="font-semibold text-sky-200">
            {row.total.toLocaleString()}
          </span>
        </div>
        <div>
          Growth vs prior month: {row.growth >= 0 ? '+' : ''}
          {row.growth.toLocaleString()} bookings
        </div>
      </div>
    </div>
  )
}

function CompositionTooltip({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-xl border border-slate-800/40 bg-slate-900/90 p-3 text-sm text-white shadow-xl">
      <p className="text-sm font-semibold">{entry.name}</p>
      <p className="text-xs text-slate-300">
        {Number(entry.value).toLocaleString()} bookings
      </p>
    </div>
  )
}

function RevenueBreakdownTooltip({
  active,
  payload,
  total,
}: TooltipProps<ValueType, NameType> & { total?: number }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const value = Number(entry.value)
  const share = total ? Math.round(((value || 0) / total) * 1000) / 10 : null
  const detail = (entry.payload ?? {}) as Partial<RevenueBreakdownItem>
  const gross = Number(detail.revenue ?? value)
  const refunds = Number(detail.refunds ?? 0)
  const net = Number(detail.net ?? value)
  return (
    <div className="rounded-xl border border-slate-800/40 bg-slate-900/90 p-3 text-sm text-white shadow-xl">
      <p className="text-sm font-semibold">{entry.name}</p>
      <p className="text-xs text-slate-300">
        Net ₱{net.toLocaleString()}
        {share != null ? ` · ${share}% of gross` : ''}
      </p>
      <p className="text-[11px] text-slate-400">
        Gross ₱{gross.toLocaleString()} · Refunds ₱{refunds.toLocaleString()}
      </p>
    </div>
  )
}

type ComposedRevenueChartProps = {
  data: (RevenueAnalyticsRow & { monthShort: string })[]
  showTrend: boolean
}

function ComposedRevenueChart({ data, showTrend }: ComposedRevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 24, right: 24, left: 0, bottom: 8 }}
      >
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted)/0.4)" />
        <XAxis dataKey="monthShort" tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(value: number) => `₱${(value / 1000).toFixed(0)}k`}
          tickLine={false}
          axisLine={false}
        />
        <Legend
          verticalAlign="top"
          height={36}
          iconType="circle"
          wrapperStyle={{ paddingBottom: 12 }}
        />
        <RechartsTooltip
          content={<RevenueTooltip />}
          cursor={{ fill: 'rgba(56, 189, 248, 0.08)' }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#38bdf8"
          strokeWidth={2.5}
          fill="url(#revenueGradient)"
        />
        <Bar
          dataKey="refunds"
          name="Refunds"
          fill="#fb7185"
          barSize={24}
          radius={[6, 6, 0, 0]}
        />
        {showTrend && (
          <Line
            type="monotone"
            dataKey="net"
            name="Net"
            stroke="#14b8a6"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

function RevenueTooltip({
  active,
  label,
  payload,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as RevenueAnalyticsRow
  return (
    <div className="rounded-xl border border-slate-800/40 bg-slate-900/90 p-3 text-sm text-white shadow-xl">
      <p className="text-xs uppercase tracking-wide text-slate-300">{label}</p>
      <div className="mt-2 space-y-1">
        <div>
          Total revenue:{' '}
          <span className="font-semibold text-sky-200">
            ₱{row.revenue.toLocaleString()}
          </span>
        </div>
        <div>
          Refunds issued:{' '}
          <span className="font-semibold text-rose-200">
            ₱{row.refunds.toLocaleString()}
          </span>
        </div>
        <div>
          Net revenue:{' '}
          <span className="font-semibold text-teal-200">
            ₱{row.net.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
