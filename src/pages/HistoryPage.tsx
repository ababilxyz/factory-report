import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { getReportsByWorkerId } from "../lib/supabaseDb"
import type { Report } from "../types"
import { motion, AnimatePresence } from "framer-motion"

function getStatusColor(status: string, hasIssues?: boolean) {
  if (status === "pending" && hasIssues) return "bg-red-900/40 text-red-300 border-red-800"
  switch (status) {
    case "pending":
      return "bg-amber-900/40 text-amber-300 border-amber-800"
    case "in_progress":
      return "bg-teal-900/40 text-teal-300 border-teal-800"
    case "resolved":
      return "bg-emerald-900/40 text-emerald-300 border-emerald-800"
    default:
      return "bg-white/10 text-slate-300 border-white/20"
  }
}

function getStatusLabel(status: string) {
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

function formatDate(ts: number) {
  return new Date(ts).toLocaleString()
}

export default function HistoryPage() {
  const { appUser } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!appUser) {
      navigate("/login", { replace: true })
      return
    }
    loadReports()
  }, [appUser, navigate])

  async function loadReports() {
    try {
      setLoading(true)
      setError(null)
      const data = await getReportsByWorkerId(appUser!.uid)
      setReports(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history")
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <header className="border-b border-white/10 bg-[#0f172a]/80">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">History</h1>
            <p className="text-sm text-slate-400 mt-0.5">Your submitted reports</p>
          </div>
          <button
            onClick={() => navigate("/home")}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-red-800 bg-red-950/50 text-red-200 text-xs px-3 py-2"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#0d9488] animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="w-10 h-10 rounded-full bg-white/5 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-200">No reports yet</p>
            <p className="text-xs text-slate-500 mt-1">Submit your first inspection to see it here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <motion.div
                key={report.reportId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{report.areaName || report.areaId}</p>
                    <p className="text-xs text-slate-500 mt-1">Submitted {formatDate(report.timestamp)}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${getStatusColor(report.status, report.checklistData?.hasIssues)}`}>
                    {getStatusLabel(report.status)}
                  </span>
                </div>

                {report.checklistData?.items && (
                  <div className="mt-3 space-y-2">
                    {Object.values(report.checklistData.items).map((item: any) => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                        <p className="text-xs font-medium text-[#0d9488]">{item.name} ({item.code})</p>
                        {item.checks.map((check: any) => {
                          const options = check.options || []
                          const index = options.indexOf(check.selectedOption)
                          let badge = "bg-white/10 text-slate-400"
                          if (check.selectedOption && index !== -1) {
                            if (options.length === 2) badge = index === 0 ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"
                            else if (options.length === 3) {
                              if (index === 0) badge = "bg-emerald-900/40 text-emerald-300"
                              else if (index === 1) badge = "bg-amber-900/40 text-amber-300"
                              else badge = "bg-red-900/40 text-red-300"
                            } else {
                              badge = index === options.length - 1 ? "bg-red-900/40 text-red-300" : "bg-emerald-900/40 text-emerald-300"
                            }
                          }
                          return (
                            <div key={check.id} className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-200">{check.label}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${badge}`}>
                                {check.selectedOption || "-"}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
