import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { getReports, updateReportStatus } from "../lib/supabaseDb"
import type { Report, ReportStatus } from "../types"
import { motion, AnimatePresence } from "framer-motion"

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

export default function AdminDashboard() {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<ReportStatus | "all">("all")
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", filter],
    queryFn: () => (filter === "all" ? getReports(undefined) : getReports(filter)),
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

  const filtered =
    filter === "all" ? reports : reports.filter((r) => r.status === filter)

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <header className="border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-400 mt-0.5">Welcome, {appUser?.displayName}</p>
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
        <section className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: reports.length },
            { label: "Pending", value: reports.filter((r) => r.status === "pending").length },
            { label: "Resolved", value: reports.filter((r) => r.status === "resolved").length },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
              <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </section>

        <section className="flex gap-2">
          {(["all", "pending", "in_progress", "resolved"] as const).map((f) => (
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
          ))}
        </section>

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
          <section className="space-y-3">
            {filtered.map((report) => {
              const issuePhoto =
                report.checklistData?.items &&
                Object.values(report.checklistData.items).some((item: any) =>
                  item.checks.some((c: any) => c.issuePhotoUrl),
                )
                  ? Object.values(report.checklistData.items)
                      .flatMap((item: any) => item.checks)
                      .find((c: any) => c.issuePhotoUrl)?.issuePhotoUrl
                  : null

              const issueCount =
                report.checklistData?.items
                  ? Object.values(report.checklistData.items).reduce((count: number, item: any) => {
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
                    }, 0)
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
                        <p className="text-sm font-medium truncate">{report.areaName || report.areaId}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(report.status)}`}>
                          {getStatusLabel(report.status)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        {issueCount > 0 ? `${issueCount} issue(s) found` : "No issues"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{timeAgo(report.timestamp)}</p>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </section>
        )}
      </main>

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
                    <p className="mt-0.5 font-medium">{selectedReport.areaName || selectedReport.areaId}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Status</p>
                    <span className={`mt-0.5 inline-block text-xs px-2 py-0.5 rounded-full border ${getStatusColor(selectedReport.status)}`}>
                      {getStatusLabel(selectedReport.status)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400 text-xs">Time</p>
                    <p className="mt-0.5">{new Date(selectedReport.timestamp).toLocaleString()}</p>
                  </div>
                  {selectedReport.gpsLat !== undefined && selectedReport.gpsLng !== undefined && (
                    <div className="col-span-2">
                      <p className="text-slate-400 text-xs">GPS</p>
                      <p className="mt-0.5">{selectedReport.gpsLat.toFixed(5)}, {selectedReport.gpsLng.toFixed(5)}</p>
                    </div>
                  )}
                </div>

                {selectedReport.checklistData?.items && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Checklist</p>
                    {Object.values(selectedReport.checklistData.items).map((item: any) => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                        <p className="text-sm font-medium text-[#0d9488]">{item.name}</p>
                        {item.checks.map((check: any) => {
                          const options = check.options || []
                          const selectedOption = check.selectedOption
                          const index = selectedOption ? options.indexOf(selectedOption) : -1

                          const getBadge = () => {
                            if (!selectedOption || index === -1) return "bg-white/10 text-slate-400"
                            if (options.length === 2) {
                              return index === 0 ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"
                            }
                            if (options.length === 3) {
                              if (index === 0) return "bg-emerald-900/40 text-emerald-300"
                              if (index === 1) return "bg-amber-900/40 text-amber-300"
                              return "bg-red-900/40 text-red-300"
                            }
                            return index === options.length - 1 ? "bg-red-900/40 text-red-300" : "bg-emerald-900/40 text-emerald-300"
                          }

                          return (
                            <div key={check.id} className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-200">{check.label}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getBadge()}`}>
                                {selectedOption || "-"}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {selectedReport.status !== "in_progress" && (
                    <button
                      onClick={() => mutation.mutate({ id: selectedReport.reportId, status: "in_progress" })}
                      disabled={mutation.isPending}
                      className="flex-1 px-3 py-2.5 text-sm font-medium rounded-xl bg-teal-900/40 text-teal-200 border border-teal-700/50 hover:bg-teal-900/60 disabled:opacity-50 transition-colors"
                    >
                      Mark In Progress
                    </button>
                  )}
                  {selectedReport.status !== "resolved" && (
                    <button
                      onClick={() => mutation.mutate({ id: selectedReport.reportId, status: "resolved" })}
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
