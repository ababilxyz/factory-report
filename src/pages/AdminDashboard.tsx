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
} from "../lib/supabaseDb"
import type { Report, ReportStatus, Area, Item, ChecklistData } from "../types"
import { motion, AnimatePresence } from "framer-motion"

// ==================
// Helpers
// ==================

function getStatusColor(status: Report["status"]) {
  switch (status) {
    case "pending":
      return "bg-amber-900/50 text-amber-300 border-amber-800"
    case "in_progress":
      return "bg-teal-900/50 text-teal-300 border-teal-800"
    case "resolved":
      return "bg-emerald-900/50 text-emerald-300 border-emerald-800"
    default:
      return "bg-white/10 text-white/70 border-white/20"
  }
}

function getStatusLabel(status: Report["status"]) {
  switch (status) {
    case "pending":
      return "Pending"
    case "in_progress":
      return "In Progress"
    case "resolved":
      return "Resolved"
    default:
      return status
  }
}

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
  const [filter, setFilter] = useState<ReportStatus | "all">("all")
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  // Daily reset state: track the "base" date of the current reporting window
  // Defaults to today; used to determine which items are "not reported"
  const todayStart = useMemo(() => getStartOfDay(Date.now()), [])
  const [resetDate, setResetDate] = useState<number>(todayStart)

  // Sync resetDate with real midnight every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const newToday = getStartOfDay(Date.now())
      setResetDate((prev) => (prev !== newToday ? newToday : prev))
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const workerUid = selectedReport?.workerUid
  const { data: resolvedWorker } = useQuery({
    queryKey: ["worker-name", workerUid],
    enabled: !!workerUid && !selectedReport?.workerName,
    queryFn: () => getUserProfile(workerUid!),
  })

  const workerDisplayName = selectedReport?.workerName || resolvedWorker?.displayName || null

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", filter],
    queryFn: () => (filter === "all" ? getReports(undefined) : getReports(filter)),
  })

  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: getAllAreas,
  })

  const { data: itemsByArea = {} } = useQuery({
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
    enabled: areas.length > 0,
  })

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

  // Compute "not reported" items for the current resetDate window
  const notReportedToday = useMemo(() => {
    const dayEnd = resetDate + 86_400_000
    // Only keep reports within the current resetDate window
    const todayReports = reports.filter((r) => r.timestamp >= resetDate && r.timestamp < dayEnd)

    const results: { area: Area; item: Item }[] = []
    for (const area of areas) {
      const items = itemsByArea[area.areaId] || []
      for (const item of items) {
        const wasReported = todayReports.some((r) => {
          const checklist = r.checklistData as ChecklistData | undefined
          if (!checklist?.items) return false
          return Object.values(checklist.items).some(
            (i) => (i as any).id === item.id || i.code === item.code
          )
        })
        if (!wasReported) {
          results.push({ area, item })
        }
      }
    }
    return results
  }, [areas, itemsByArea, reports, resetDate])

  // Group reports by date for the "date separated" list view
  const reportsByDate: Record<number, Report[]> = useMemo(() => {
    const map: Record<number, Report[]> = {}
    // Use the filtered reports in display order (already sorted by timestamp DESC from DB)
    const source = reports
    for (const report of source) {
      const dayKey = getStartOfDay(report.timestamp)
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(report)
    }
    return map
  }, [reports])

  const sortedDateKeys = Object.keys(reportsByDate)
    .map(Number)
    .sort((a, b) => b - a)

  const filtered =
    filter === "all" ? reports : reports.filter((r) => r.status === filter)

  const resetDateLabel = new Date(resetDate).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      {/* ================== Header ================== */}
      <header className="border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0d9488] flex items-center justify-center text-white">
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
              <p className="text-sm text-slate-400 mt-0.5">
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
              className="px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* ================== Date / Reset Banner ================== */}
        <section className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            Reporting window
          </p>
          <p className="text-sm font-medium mt-0.5">{resetDateLabel}</p>
        </section>

        {/* ================== Daily Summary Stat Cards ================== */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { label: "Today Reported", value: reports.length },
            {
              label: "Pending",
              value: reports.filter((r) => r.status === "pending").length,
            },
            {
              label: "Resolved",
              value: reports.filter((r) => r.status === "resolved").length,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
            >
              <p className="text-2xl font-semibold tracking-tight">
                {stat.value}
              </p>
              <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* ================== Not Reported Today ================== */}
        <section className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Not reported today ({notReportedToday.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-[#0d9488] animate-spin" />
            </div>
          ) : notReportedToday.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">
              All zones and items have been reported today.
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[320px] overflow-y-auto">
              {(() => {
                const grouped: Record<string, { area: Area; item: Item }[]> = {}
                for (const entry of notReportedToday) {
                  if (!grouped[entry.area.areaId]) grouped[entry.area.areaId] = []
                  grouped[entry.area.areaId].push(entry)
                }
                return Object.values(grouped).map((group) => {
                  const area = group[0].area
                  return (
                    <div key={area.areaId}>
                      <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5">
                        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                          {area.name}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
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
                              <p className="text-sm text-slate-200 truncate">
                                {item.name}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {item.code}
                              </p>
                            </div>
                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-red-800 bg-red-900/30 text-red-300 whitespace-nowrap">
                              Not reported
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </section>

        {/* ================== Status Filters ================== */}
        <section className="flex gap-2">
          {(["all", "pending", "in_progress", "resolved"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  filter === f
                    ? "bg-[#0d9488] text-white border-[#0d9488]"
                    : "border-white/10 text-slate-300 hover:border-white/20"
                }`}
              >
                {f === "all" ? "All" : getStatusLabel(f)}
              </button>
            )
          )}
        </section>

        {/* ================== Report List (date separated) ================== */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#0d9488] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
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
                    <time className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">
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
                          className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-4 hover:border-[#0d9488]/50 transition-colors"
                        >
                          <div className="flex gap-3">
                            {issuePhoto && (
                              <img
                                src={issuePhoto}
                                alt="issue"
                                className="w-14 h-14 rounded-lg object-cover bg-white/5"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium truncate">
                                  {report.areaName || report.areaId}
                                </p>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(report.status)}`}
                                >
                                  {getStatusLabel(report.status)}
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
                                  <p className="text-xs text-slate-400 mt-1 truncate">
                                    {names.join(", ")}
                                  </p>
                                )
                              })()}
                              <p className="text-sm text-slate-400 mt-1">
                                {issueCount > 0
                                  ? `${issueCount} issue(s) found`
                                  : "No issues"}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
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
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-sm font-semibold">Report details</h2>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs">Area</p>
                    <p className="mt-0.5 font-medium">
                      {selectedReport.areaName || selectedReport.areaId}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Status</p>
                    <span
                      className={`mt-0.5 inline-block text-xs px-2 py-0.5 rounded-full border ${getStatusColor(selectedReport.status)}`}
                    >
                      {getStatusLabel(selectedReport.status)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400 text-xs">Time</p>
                    <p className="mt-0.5">
                      {new Date(selectedReport.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {workerUid && (
                    <div className="col-span-2">
                      <p className="text-slate-400 text-xs">Sent by</p>
                      <p className="mt-0.5 font-medium">
                        {workerDisplayName || workerUid}
                      </p>
                    </div>
                  )}
                  {selectedReport.gpsLat !== undefined &&
                    selectedReport.gpsLng !== undefined && (
                      <div className="col-span-2">
                        <p className="text-slate-400 text-xs">GPS</p>
                        <p className="mt-0.5">
                          {selectedReport.gpsLat.toFixed(5)},{" "}
                          {selectedReport.gpsLng.toFixed(5)}
                        </p>
                      </div>
                    )}
                </div>

                {selectedReport.checklistData?.items && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                      Checklist
                    </p>
                    {Object.values(selectedReport.checklistData.items).map(
                      (item: any) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2"
                        >
                          <p className="text-sm font-medium text-[#0d9488]">
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
                                return "bg-white/10 text-slate-400"
                              if (options.length === 2) {
                                return index === 0
                                  ? "bg-emerald-900/40 text-emerald-300"
                                  : "bg-red-900/40 text-red-300"
                              }
                              if (options.length === 3) {
                                if (index === 0)
                                  return "bg-emerald-900/40 text-emerald-300"
                                if (index === 1)
                                  return "bg-amber-900/40 text-amber-300"
                                return "bg-red-900/40 text-red-300"
                              }
                              return index === options.length - 1
                                ? "bg-red-900/40 text-red-300"
                                : "bg-emerald-900/40 text-emerald-300"
                            }

                            if (check.issueDescription) {
                              return (
                                <div
                                  key={check.id}
                                  className="rounded-lg bg-red-950/40 border border-red-900/40 p-3 space-y-2"
                                >
                                  <p className="text-sm font-medium text-red-300">
                                    {check.label}
                                  </p>
                                  <div className="space-y-1.5 text-xs">
                                    <div>
                                      <span className="text-red-400 font-medium">
                                        Abnormality
                                      </span>
                                      <p className="text-red-200 mt-0.5 whitespace-pre-wrap">
                                        {check.issueDescription}
                                      </p>
                                    </div>
                                    {check.issuePhotoUrl && (
                                      <img
                                        src={check.issuePhotoUrl}
                                        alt="Issue"
                                        className="max-h-40 rounded border border-red-900/50 mt-1"
                                      />
                                    )}
                                    {check.afterDescription && (
                                      <div>
                                        <span className="text-emerald-400 font-medium">
                                          Action Taken
                                        </span>
                                        <p className="text-emerald-100 mt-0.5 whitespace-pre-wrap">
                                          {check.afterDescription}
                                        </p>
                                      </div>
                                    )}
                                    {check.afterPhotoUrl && (
                                      <img
                                        src={check.afterPhotoUrl}
                                        alt="After"
                                        className="max-h-40 rounded border border-emerald-900/50 mt-1"
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
                                  className="rounded-lg bg-emerald-950/40 border border-emerald-900/40 p-3 space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-emerald-300">
                                      {check.label}
                                    </p>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full ${getBadge()}`}
                                    >
                                      {selectedOption || "-"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-emerald-400 font-medium text-xs">
                                      Action Taken
                                    </span>
                                    <p className="text-emerald-100 mt-0.5 whitespace-pre-wrap text-xs">
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
                                <span className="text-slate-200">
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
                      className="flex-1 px-3 py-2.5 text-sm font-medium rounded-xl bg-teal-900/40 text-teal-200 border border-teal-700/50 hover:bg-teal-900/60 disabled:opacity-50 transition-colors"
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
                      className="flex-1 px-3 py-2.5 text-sm font-medium rounded-xl bg-emerald-900/40 text-emerald-200 border border-emerald-700/50 hover:bg-emerald-900/60 disabled:opacity-50 transition-colors"
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
    </div>
  )
}
