import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import {
  getReports,
  updateReportStatus,
  getUserProfile,
  getAllAreas,
  getItemsByAreaId,
  getWeeklyItemsByAreaId,
  getMonthlyItemsByAreaId,
  getWeeklyReports,
  getMonthlyReports,
} from "../lib/supabaseDb"
import type { Report, ReportStatus, Area, Item, ChecklistData } from "../types"
import { motion, AnimatePresence } from "framer-motion"
import AdminScheduleManager from "../components/AdminScheduleManager"
import AdminScheduleDesktop from "../components/AdminScheduleDesktop"
import AdminSummaryDesktop from "../components/AdminSummaryDesktop"
import { getScheduleForMonth } from "../lib/supabaseDb"
import { reportStatusTone } from "../lib/reportStatus"

// ==================
// Helpers
// ==================



function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** Returns the start-of-day timestamp in milliseconds for a given ms timestamp */
function getStartOfDay(ts: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Format a date range for display: start → end */
function formatDateRange(startTs: number, endTs: number): string {
  const s = new Date(startTs)
  const e = new Date(endTs)
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate()
  if (sameDay) return s.toLocaleDateString("en-US", opts)
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`
}

// ==================
// Component
// ==================

export default function AdminDashboard() {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [reportMode, setReportMode] = useState<"daily" | "weekly" | "monthly">("daily")
  const [activeTab, setActiveTab] = useState<"reports" | "schedule">("reports")
  const [filter, setFilter] = useState<ReportStatus | "all">("all")
  const [areaFilter, setAreaFilter] = useState<string | "all">("all")
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Daily reset state
  const todayStart = useMemo(() => getStartOfDay(Date.now()), [])
  const [resetDate, setResetDate] = useState<number>(todayStart)

  // Weekly window state (defaults to current week)
  const weekStart = useMemo(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).setHours(0, 0, 0, 0)
  }, [])
  const monthStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(1)
    return d.getTime()
  }, [])
  const [weekStartOverride, setWeekStartOverride] = useState<number | null>(null)
  const activeWeekStart = weekStartOverride ?? weekStart
  const weekEnd = activeWeekStart + 86_400_000 * 7

  // Reset at day/week/month boundaries
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const newDay = getStartOfDay(now)
      setResetDate((prev) => (prev !== newDay ? newDay : prev))
      // Invalidate report data when any boundary might have crossed
      queryClient.invalidateQueries({ queryKey: ["reports"] })
    }, 60_000)
    return () => clearInterval(interval)
  }, [queryClient])

  const workerUid = selectedReport?.workerUid
  const { data: resolvedWorker } = useQuery({
    queryKey: ["worker-name", workerUid],
    enabled: !!workerUid && !selectedReport?.workerName,
    queryFn: () => getUserProfile(workerUid!),
  })

  const workerDisplayName = selectedReport?.workerName || resolvedWorker?.displayName || null

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", filter, reportMode, resetDate, activeWeekStart, monthStart],
    queryFn: async () => {
      if (reportMode === "weekly") {
        return getWeeklyReports(activeWeekStart)
      }
      if (reportMode === "monthly") {
        return getMonthlyReports(monthStart)
      }
      if (filter === "all") {
        return getReports(undefined, undefined, "daily")
      }
      return getReports(filter, undefined, "daily")
    },
  })

  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: getAllAreas,
  })

  const currentYearMonth = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [])
  const scheduleMonth = currentYearMonth

  const { data: scheduleSlots = [] } = useQuery({
    queryKey: ["schedules", scheduleMonth],
    queryFn: () => getScheduleForMonth(scheduleMonth),
  })

  const { data: dailyItemsByArea = {} } = useQuery({
    queryKey: ["itemsByArea"],
    queryFn: async () => {
      const map: Record<string, Item[]> = {}
      await Promise.all(
        areas.map(async (area) => {
          map[area.areaId] = await getItemsByAreaId(area.areaId)
        })
      )
      return map
    },
    enabled: areas.length > 0 && reportMode === "daily",
  })

  const { data: weeklyItemsByArea = {} } = useQuery({
    queryKey: ["weeklyItemsByArea"],
    queryFn: async () => {
      const map: Record<string, Item[]> = {}
      await Promise.all(
        areas.map(async (area) => {
          const items = await getWeeklyItemsByAreaId(area.areaId)
          map[area.areaId] = items
        })
      )
      return map
    },
    enabled: areas.length > 0 && reportMode === "weekly",
  })

  const { data: monthlyItemsByArea = {} } = useQuery({
    queryKey: ["monthlyItemsByArea"],
    queryFn: async () => {
      const map: Record<string, Item[]> = {}
      await Promise.all(
        areas.map(async (area) => {
          map[area.areaId] = await getMonthlyItemsByAreaId(area.areaId)
        })
      )
      return map
    },
    enabled: areas.length > 0 && reportMode === "monthly",
  })

  const itemsByArea =
    reportMode === "weekly" ? weeklyItemsByArea : reportMode === "monthly" ? monthlyItemsByArea : dailyItemsByArea

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReportStatus }) =>
      updateReportStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] })
      setSelectedReport((prev) => {
        if (!prev) return prev
        return { ...prev, status: prev.status }
      })
    },
  })

  // Compute "not reported" items for the current window
  const unreportedItems = useMemo(() => {
    if (reportMode === "daily") {
      const dayEnd = resetDate + 86_400_000
      const todayReports = reports.filter((r: Report) => r.timestamp >= resetDate && r.timestamp < dayEnd)
      const results: { area: Area; item: Item }[] = []
      for (const area of areas) {
        const items = itemsByArea[area.areaId] || []
        for (const item of items) {
          const wasReported = todayReports.some((r: Report) => {
            const checklist = r.checklistData as ChecklistData | undefined
            if (!checklist?.items) return false
            return Object.values(checklist.items).some(
              (i: any) => (i as any).id === item.id || i.code === item.code
            )
          })
          if (!wasReported) {
            results.push({ area, item })
          }
        }
      }
      return results
    }

    const windowStart = reportMode === "weekly" ? activeWeekStart : monthStart
    const windowEnd = reportMode === "weekly" ? weekEnd : windowStart + 86_400_000 * 31
    const windowReports = (reports as Report[]).filter((r: Report) => r.timestamp >= windowStart && r.timestamp < windowEnd)
    const results: { area: Area; item: Item }[] = []
    for (const area of areas) {
      const items = itemsByArea[area.areaId] || []
      for (const item of items) {
        const wasReported = windowReports.some((r) => {
          const checklist = r.checklistData as ChecklistData | undefined
          if (!checklist?.items) return false
          return Object.values(checklist.items).some(
            (i: any) => (i as any).id === item.id || i.code === item.code
          )
        })
        if (!wasReported) {
          results.push({ area, item })
        }
      }
    }
    return results
  }, [reportMode, areas, itemsByArea, reports, resetDate, activeWeekStart, monthStart, weekEnd])

  const filtered =
    filter === "all" ? reports : reports.filter((r) => r.status === filter)

  const areaFiltered =
    areaFilter === "all"
      ? filtered
      : filtered.filter((r) => r.areaId === areaFilter)

  // Group reports by date for the "date separated" list view
  const reportsByDate: Record<number, Report[]> = useMemo(() => {
    const map: Record<number, Report[]> = {}
    const source = areaFiltered
    for (const report of source) {
      const isWeekly = reportMode === "weekly" && (report as any).reportType === "weekly" && (report as any).weekStart
      const isMonthly = reportMode === "monthly" && (report as any).reportType === "monthly" && (report as any).monthStart

      if (isWeekly) {
        const dayKey = (report as any).weekStart
        if (!map[dayKey]) map[dayKey] = []
        map[dayKey].push(report)
        continue
      }

      if (isMonthly) {
        const dayKey = (report as any).monthStart
        if (!map[dayKey]) map[dayKey] = []
        map[dayKey].push(report)
        continue
      }

      const dayKey = getStartOfDay(report.timestamp)
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(report)
    }
    return map
  }, [areaFiltered, reportMode])

  const sortedDateKeys = Object.keys(reportsByDate)
    .map(Number)
    .sort((a, b) => b - a)

  const resetDateLabel = reportMode === 'weekly'
    ? `Week of ${new Date(activeWeekStart).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`
    : reportMode === 'monthly'
      ? new Date(monthStart).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : new Date(resetDate).toLocaleDateString("en-US", {
          weekday: "long",
          day: "numeric",
          month: "short",
          year: "numeric",
        })

  return (
    <div className="min-h-screen bg-[#18191C] text-[#F4F5F7] overflow-x-hidden">
      {/* ================== Header ================== */}
      <header className="border-b border-white/10 bg-[#18191C]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F4F5F7] flex items-center justify-center text-white">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
              <p className="text-sm text-[#A8AEBC] mt-0.5">
                Welcome, {appUser?.displayName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/qr-generator")}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
            >
              QR Codes
            </button>
            <button
              onClick={() => void signOut()}
              className="px-3 py-2 text-sm text-[#A8AEBC] hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ================== Desktop Layout (>= 1024px) ================== */}
      <div className="hidden lg:flex min-h-[calc(100vh-73px)]">
        {/* Left Sidebar */}
        <aside className="w-[232px] shrink-0 border-r border-[#2F3238] bg-[#222429] p-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-9 h-9 rounded-[10px] bg-[#F4F5F7] flex items-center justify-center font-extrabold text-sm text-[#121417]">
                3P
              </div>
              <div>
                <p className="text-sm font-bold text-[#F4F5F7] leading-tight">3PilarAA</p>
                <p className="text-[10px] text-[#8E929B]">Inspeksi 4S</p>
              </div>
            </div>

            <nav className="space-y-1">
              {[
                ["reports", "Ringkasan"],
                ["schedule", "Jadwal"],
              ].map(([key, label]) => {
                const active = activeTab === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key as "reports" | "schedule")}
                    className={`w-full text-left px-3.5 py-2.5 rounded-[10px] text-xs transition-colors ${
                      active
                        ? "bg-[#1B1D22] text-[#F4F5F7] font-bold border border-[#2F3238]"
                        : "text-[#A8AEBC] hover:text-[#F4F5F7]"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="border-t border-[#2F3238] pt-4 px-2">
            <p className="text-xs font-semibold text-[#F4F5F7] truncate">
              {appUser?.displayName || "Super Admin"}
            </p>
            <p className="text-[10px] text-[#8E929B] mt-0.5">Administrator</p>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0 p-8">
          {activeTab === "schedule" ? (
            <AdminScheduleDesktop
              yearMonth={scheduleMonth}
              slots={scheduleSlots}
              reports={reports}
              areas={areas}
              onOpenReport={(r) => setSelectedReport(r)}
            />
          ) : (
            <AdminSummaryDesktop reports={reports} slots={scheduleSlots} />
          )}
        </div>
      </div>

      {/* ================== Mobile Layout (< 1024px) ================== */}
      <main className="lg:hidden w-full max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* ================== Top View Tabs ================== */}
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === "reports"
                ? "bg-[#F4F5F7] text-white shadow-sm"
                : "text-[#A8AEBC] hover:text-white"
            }`}
          >
            Daftar Laporan
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === "schedule"
                ? "bg-[#F4F5F7] text-white shadow-sm"
                : "text-[#A8AEBC] hover:text-white"
            }`}
          >
            Kelola Jadwal 4S
          </button>
        </div>

        {activeTab === "schedule" ? (
          <AdminScheduleManager areas={areas} />
        ) : (
          <>
        {/* ================== Report Mode + Date / Reset Banner ================== */}
        <section className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#A8AEBC] uppercase tracking-wide">Reporting mode</p>
            <div className="flex rounded-full border border-white/10 overflow-hidden">
              <button
                onClick={() => setReportMode("daily")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  reportMode === "daily"
                    ? "bg-[#F4F5F7] text-white"
                    : "text-[#DCDDE1] hover:bg-white/5"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setReportMode("weekly")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  reportMode === "weekly"
                    ? "bg-[#F4F5F7] text-white"
                    : "text-[#DCDDE1] hover:bg-white/5"
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setReportMode("monthly")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  reportMode === "monthly"
                    ? "bg-[#F4F5F7] text-white"
                    : "text-[#DCDDE1] hover:bg-white/5"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-[#A8AEBC] uppercase tracking-wide">
              {reportMode === "weekly" ? "Reporting week" : "Reporting window"}
            </p>
            {reportMode === "weekly" ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="date"
                  value={new Date(activeWeekStart).toISOString().slice(0, 10)}
                  onChange={(e) => {
                    const d = new Date(`${e.target.value}T00:00:00`)
                    if (!Number.isNaN(d.getTime())) setWeekStartOverride(d.getTime())
                  }}
                  className="text-sm rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[#F4F5F7]"
                />
                <span className="text-xs text-[#A8AEBC]">
                  to {new Date(weekEnd - 1).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            ) : (
              <p className="text-sm font-medium mt-0.5">{resetDateLabel}</p>
            )}
          </div>
        </section>

        {/* ================== Daily Summary Stat Cards ================== */}
        <section className="grid grid-cols-3 gap-3">
          {(() => {
            const windowedReports = (() => {
              if (reportMode === "weekly") {
                return areaFiltered.filter((r) => r.timestamp >= activeWeekStart && r.timestamp < weekEnd)
              }
              if (reportMode === "monthly") {
                return areaFiltered.filter((r) => r.timestamp >= monthStart)
              }
              const dayEnd = resetDate + 86_400_000
              return areaFiltered.filter((r) => r.timestamp >= resetDate && r.timestamp < dayEnd)
            })()
            return [
              { label: reportMode === "weekly" ? "Minggu Ini" : reportMode === "monthly" ? "Bulan Ini" : "Dilaporkan Hari Ini", value: windowedReports.length },
              {
                label: "Menunggu",
                value: windowedReports.filter((r) => r.status === "pending").length,
              },
              {
                label: "Selesai",
                value: windowedReports.filter((r) => r.status === "resolved").length,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
              >
                <p className="text-2xl font-semibold tracking-tight">
                  {stat.value}
                </p>
                <p className="text-sm text-[#A8AEBC] mt-1">{stat.label}</p>
              </div>
            ))
          })()}
        </section>

        {/* ================== Not Reported Today ================== */}
        {(() => {
          const candidates =
            areaFilter === "all" ? unreportedItems : unreportedItems.filter((e) => e.area.areaId === areaFilter)

          const grouped: Record<string, { area: Area; item: Item }[]> = {}
          for (const entry of candidates) {
            if (!grouped[entry.area.areaId]) grouped[entry.area.areaId] = []
            grouped[entry.area.areaId].push(entry)
          }

          return (
            <section className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
            {reportMode === "weekly"
              ? `Not reported this week (${candidates.length})`
              : reportMode === "monthly"
                ? `Not reported this month (${candidates.length})`
                : `Not reported today (${candidates.length})`}
                </h2>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-[#F4F5F7] animate-spin" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[#A8AEBC]">
                    {areaFilter === "all"
                      ? reportMode === "weekly"
                        ? "All zones and items have been reported this week."
                        : reportMode === "monthly"
                          ? "All zones and items have been reported this month."
                          : "All zones and items have been reported today."
                      : reportMode === "weekly"
                        ? "All items in this zone have been reported this week."
                        : reportMode === "monthly"
                          ? "All items in this zone have been reported this month."
                          : `All items in this zone have been reported today.`}
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-[320px] overflow-y-auto">
                  {Object.values(grouped).map((group) => {
                    const area = group[0].area
                    return (
                      <div key={area.areaId}>
                        <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5">
                          <p className="text-xs font-semibold text-[#DCDDE1] uppercase tracking-wide">
                            {area.name}
                          </p>
                          <p className="text-[11px] text-[#8E929B] mt-0.5">
                            {group.length} item{group.length > 1 ? "s" : ""} unreported
                          </p>
                        </div>
                        <div className="divide-y divide-white/5">
                          {group.map(({ item }) => (
                            <div
                              key={item.id}
                              className="px-4 py-2.5 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-sm text-[#F4F5F7] truncate">
                                  {item.name}
                                </p>
                                <p className="text-[11px] text-[#8E929B] mt-0.5">
                                  {item.code}
                                </p>
                              </div>
                              <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#C4623F]/60 bg-[#C4623F]/15 text-[#E08462] whitespace-nowrap">
                                Not reported
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })()}

        {/* ================== Zone Filter + Status Filters ================== */}
        <section className="space-y-2">
          {/* Zone filter chips */}
          <section className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setAreaFilter("all")}
              className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
                areaFilter === "all"
                  ? "bg-[#F4F5F7] text-white border-[#F4F5F7]"
                  : "border-white/10 text-[#DCDDE1] hover:border-white/20"
              }`}
            >
              Semua Area
            </button>
            {areas.map((area) => (
              <button
                key={area.areaId}
                onClick={() => setAreaFilter(area.areaId)}
                className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
                  areaFilter === area.areaId
                    ? "bg-[#F4F5F7] text-white border-[#F4F5F7]"
                    : "border-white/10 text-[#DCDDE1] hover:border-white/20"
                }`}
              >
                {area.name}
              </button>
            ))}
          </section>

          {/* Status filter chips */}
          <section className="flex gap-2 overflow-x-auto pb-1">
            {(["all", "pending", "in_progress", "resolved"] as const).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
                    filter === f
                      ? "bg-[#F4F5F7] text-white border-[#F4F5F7]"
                      : "border-white/10 text-[#DCDDE1] hover:border-white/20"
                  }`}
                >
                  {f === "all" ? "Semua Status" : reportStatusTone(f).label}
                </button>
              )
            )}
          </section>
        </section>

        {/* ================== Report List (date separated) ================== */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#F4F5F7] animate-spin" />
          </div>
        ) : areaFiltered.length === 0 ? (
          <div className="text-center py-16 text-[#A8AEBC]">
            <div className="w-10 h-10 rounded-full bg-white/5 mx-auto mb-3" />
            <p className="text-sm">No reports found</p>
          </div>
        ) : (
          <section className="space-y-4">
            {sortedDateKeys.map((dayKey) => {
              const dayReports = reportsByDate[dayKey]
              const filteredDayReports =
                filter === "all"
                  ? dayReports
                  : dayReports.filter((r) => r.status === filter)
              if (filteredDayReports.length === 0) return null

              return (
                <div key={dayKey}>
                  {/* Date separator header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-px flex-1 bg-white/10" />
                    <time className="text-[11px] font-medium text-[#A8AEBC] uppercase tracking-widest">
                      {formatDateRange(dayKey, dayKey + 86_399_999)}
                    </time>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  {/* Report cards for this date */}
                  <div className="space-y-3">
                    {filteredDayReports.map((report) => {
                      const issuePhoto =
                        report.checklistData?.items &&
                        Object.values(report.checklistData.items).some(
                          (item: any) => item.checks.some((c: any) => c.issuePhotoUrl)
                        )
                          ? Object.values(report.checklistData.items)
                              .flatMap((item: any) => item.checks)
                              .find((c: any) => c.issuePhotoUrl)?.issuePhotoUrl
                          : null

                      const issueCount =
                        report.checklistData?.items
                          ? Object.values(report.checklistData.items).reduce(
                              (count: number, item: any) => {
                                return (
                                  count +
                                  item.checks.filter((c: any) => {
                                    const options = c.options || []
                                    const idx = options.indexOf(c.selectedOption)
                                    if (idx === -1) return false
                                    if (options.length === 2) return idx === 1
                                    if (options.length === 3) return idx >= 1
                                    return idx === options.length - 1
                                  }).length
                                )
                              },
                              0
                            )
                          : 0

                      return (
                        <motion.button
                          key={report.reportId}
                          onClick={() => setSelectedReport(report)}
                          className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-4 hover:border-[#F4F5F7]/50 transition-colors"
                        >
                          <div className="flex gap-3">
                            {issuePhoto && (
                              <img
                                src={issuePhoto}
                                alt="issue"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPreviewImage(issuePhoto)
                                }}
                                className="w-14 h-14 rounded-lg object-cover bg-white/5 cursor-pointer"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium truncate">
                                  {report.areaName || report.areaId}
                                </p>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full border ${reportStatusTone(report.status, report.checklistData?.hasIssues).className}`}
                                >
                                  {reportStatusTone(report.status, report.checklistData?.hasIssues).label}
                                </span>
                              </div>
                              {(() => {
                                const items = report.checklistData?.items
                                if (!items) return null
                                const names = Object.values(items)
                                  .map((i: any) => i.name)
                                  .filter(Boolean)
                                if (names.length === 0) return null
                                return (
                                  <p className="text-xs text-[#A8AEBC] mt-1 truncate">
                                    {names.join(", ")}
                                  </p>
                                )
                              })()}
                              <p className="text-sm text-[#A8AEBC] mt-1">
                                {issueCount > 0
                                  ? `${issueCount} masalah ditemukan`
                                  : "Semua normal"}
                              </p>
                              <p className="text-xs text-[#8E929B] mt-1">
                                {timeAgo(report.timestamp)}
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>
        )}
          </>
        )}
      </main>

      {/* ================== Detail Modal ================== */}
      <AnimatePresence>
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
            onClick={() => setSelectedReport(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#222429] max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-sm font-semibold">Rincian Laporan</h2>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[#A8AEBC]"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#A8AEBC] text-xs">Area</p>
                    <p className="mt-0.5 font-medium">
                      {selectedReport.areaName || selectedReport.areaId}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#A8AEBC] text-xs">Status</p>
                    <span
                      className={`mt-0.5 inline-block text-xs px-2 py-0.5 rounded-full border ${reportStatusTone(selectedReport.status, selectedReport.checklistData?.hasIssues).className}`}
                    >
                      {reportStatusTone(selectedReport.status, selectedReport.checklistData?.hasIssues).label}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[#A8AEBC] text-xs">Time</p>
                    <p className="mt-0.5">
                      {new Date(selectedReport.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {workerUid && (
                    <div className="col-span-2">
                      <p className="text-[#A8AEBC] text-xs">Sent by</p>
                      <p className="mt-0.5 font-medium">
                        {workerDisplayName || workerUid}
                      </p>
                    </div>
                  )}
                  {selectedReport.gpsLat !== undefined &&
                    selectedReport.gpsLng !== undefined && (
                      <div className="col-span-2">
                        <p className="text-[#A8AEBC] text-xs">GPS</p>
                        <p className="mt-0.5">
                          {selectedReport.gpsLat.toFixed(5)},{" "}
                          {selectedReport.gpsLng.toFixed(5)}
                        </p>
                      </div>
                    )}
                </div>

                {selectedReport.checklistData?.items && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#A8AEBC] font-medium uppercase tracking-wide">
                      Checklist
                    </p>
                    {Object.values(selectedReport.checklistData.items).map(
                      (item: any) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2"
                        >
                          <p className="text-sm font-medium text-[#F4F5F7]">
                            {item.name}
                          </p>
                          {item.checks.map((check: any) => {
                            const options = check.options || []
                            const selectedOption = check.selectedOption
                            const index = selectedOption
                              ? options.indexOf(selectedOption)
                              : -1

                            const getBadge = () => {
                              if (!selectedOption || index === -1)
                                return "bg-white/10 text-[#A8AEBC]"
                              if (options.length === 2) {
                                return index === 0
                                  ? "bg-white/5 text-[#F4F5F7]"
                                  : "bg-[#C4623F]/15 text-[#E08462]"
                              }
                              if (options.length === 3) {
                                if (index === 0)
                                  return "bg-white/5 text-[#F4F5F7]"
                                if (index === 1)
                                  return "bg-[#A8AEBC]/10 text-[#A8AEBC]"
                                return "bg-[#C4623F]/15 text-[#E08462]"
                              }
                              return index === options.length - 1
                                ? "bg-[#C4623F]/15 text-[#E08462]"
                                : "bg-white/5 text-[#F4F5F7]"
                            }

                            if (check.issueDescription) {
                              return (
                                <div
                                  key={check.id}
                                  className="rounded-lg bg-[#C4623F]/15 border border-[#C4623F]/40 p-3 space-y-2"
                                >
                                  <p className="text-sm font-medium text-[#E08462]">
                                    {check.label}
                                  </p>
                                  <div className="space-y-1.5 text-xs">
                                    <div>
                                      <span className="text-[#E08462] font-medium">
                                        Abnormality
                                      </span>
                                      <p className="text-[#E08462] mt-0.5 whitespace-pre-wrap">
                                        {check.issueDescription}
                                      </p>
                                    </div>
                                    {check.issuePhotoUrl && (
                                      <img
                                        src={check.issuePhotoUrl}
                                        alt="Issue"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setPreviewImage(check.issuePhotoUrl)
                                        }}
                                        className="max-h-40 rounded border border-[#C4623F]/40 mt-1 cursor-pointer"
                                      />
                                    )}
                                    {check.afterDescription && (
                                      <div>
                                        <span className="text-[#F4F5F7] font-medium">
                                          Action Taken
                                        </span>
                                        <p className="text-[#F4F5F7] mt-0.5 whitespace-pre-wrap">
                                          {check.afterDescription}
                                        </p>
                                      </div>
                                    )}
                                    {check.afterPhotoUrl && (
                                      <img
                                        src={check.afterPhotoUrl}
                                        alt="After"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setPreviewImage(check.afterPhotoUrl)
                                        }}
                                        className="max-h-40 rounded border border-white/15 mt-1 cursor-pointer"
                                      />
                                    )}
                                  </div>
                                </div>
                              )
                            }

                            if (check.afterDescription) {
                              return (
                                <div
                                  key={check.id}
                                  className="rounded-lg bg-white/5 border border-white/15 p-3 space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-[#F4F5F7]">
                                      {check.label}
                                    </p>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full ${getBadge()}`}
                                    >
                                      {selectedOption || "-"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[#F4F5F7] font-medium text-xs">
                                      Action Taken
                                    </span>
                                    <p className="text-[#F4F5F7] mt-0.5 whitespace-pre-wrap text-xs">
                                      {check.afterDescription}
                                    </p>
                                  </div>
                                </div>
                              )
                            }

                            return (
                              <div
                                key={check.id}
                                className="flex items-start justify-between gap-2 text-sm"
                              >
                                <span className="text-[#F4F5F7]">
                                  {check.label}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full ${getBadge()}`}
                                >
                                  {selectedOption || "-"}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {selectedReport.status !== "in_progress" && (
                    <button
                      onClick={() =>
                        mutation.mutate({
                          id: selectedReport.reportId,
                          status: "in_progress",
                        })
                      }
                      disabled={mutation.isPending}
                      className="flex-1 px-3 py-2.5 text-sm font-medium rounded-xl bg-white/5 text-[#F4F5F7] border border-white/20 hover:bg-white/5 disabled:opacity-50 transition-colors"
                    >
                      Mark In Progress
                    </button>
                  )}
                  {selectedReport.status !== "resolved" && (
                    <button
                      onClick={() =>
                        mutation.mutate({
                          id: selectedReport.reportId,
                          status: "resolved",
                        })
                      }
                      disabled={mutation.isPending}
                      className="flex-1 px-3 py-2.5 text-sm font-medium rounded-xl bg-white/5 text-[#F4F5F7] border border-white/20 hover:bg-white/5 disabled:opacity-50 transition-colors"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image preview modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg relative"
            >
              <button
                type="button"
                                onClick={async () => {
                                  if (!previewImage) return
                                  try {
                                    const response = await fetch(previewImage)
                                    const blob = await response.blob()
                                    const url = URL.createObjectURL(blob)
                                    const link = document.createElement('a')
                                    link.href = url
                                    link.download = 'photo.jpg'
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                    URL.revokeObjectURL(url)
                                  } catch (error) {
                                    console.error('Failed to download image', error)
                                  }
                                }}
                className="absolute top-3 right-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs backdrop-blur-sm border border-white/10"
              >
                Download
              </button>
              <img
                src={previewImage}
                alt="Preview"
                className="w-full rounded-xl border border-white/10"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
