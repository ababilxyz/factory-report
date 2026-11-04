import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { getReportsByWorkerId } from "../lib/supabaseDb"
import type { Report } from "../types"
import { motion, AnimatePresence } from "framer-motion"
import { reportStatusTone, reportSummaryLabel } from "../lib/reportStatus"
import WorkerBottomBar from "../components/WorkerBottomBar"



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
    <div className="min-h-screen bg-[#18191C] text-[#F4F5F7]">
      <header className="border-b border-white/10 bg-[#18191C]/90">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Riwayat</h1>
            <p className="text-sm text-[#A8AEBC] mt-0.5">Laporan yang Anda kirimkan</p>
          </div>
          <button
            onClick={() => navigate("/home")}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-[#A8AEBC]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-5 pb-32 space-y-3">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-[#C4623F]/60 bg-[#C4623F]/15 text-[#E08462] text-xs px-3 py-2"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#F4F5F7] animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 text-[#A8AEBC]">
            <div className="w-10 h-10 rounded-full bg-white/5 mx-auto mb-3" />
            <p className="text-sm font-medium text-[#F4F5F7]">No reports yet</p>
            <p className="text-xs text-[#8E929B] mt-1">Submit your first inspection to see it here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <motion.div
                key={report.reportId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 ${
                  report.status === "pending" && report.checklistData?.hasIssues ? "pl-5" : ""
                }`}
              >
                {report.status === "pending" && report.checklistData?.hasIssues && (
                  <span className="absolute inset-y-0 left-0 w-1 bg-[#C4623F]" />
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{report.areaName || report.areaId}</p>
                    <p className="text-xs text-[#8E929B] mt-1">Dikirim {formatDate(report.timestamp)}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${reportStatusTone(report.status, report.checklistData?.hasIssues).className}`}>
                    {reportStatusTone(report.status, report.checklistData?.hasIssues).label}
                  </span>
                </div>

                {(() => {
                  const checks = Object.values(report.checklistData?.items ?? {}).reduce(
                    (n: number, it: any) => n + (it.checks?.length ?? 0), 0
                  )
                  const hasIssues = report.checklistData?.hasIssues === true
                  const isOpenIssue = hasIssues && report.status === "pending"
                  return (
                    <>
                      {checks > 0 && (
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
                          <span className={`text-[11px] ${isOpenIssue ? "font-bold text-[#E08462]" : "text-[#A8AEBC]"}`}>
                            {reportSummaryLabel(hasIssues, isOpenIssue, checks)}
                          </span>
                        </div>
                      )}
                      {isOpenIssue && report.description && (
                        <div className="mt-2 rounded-lg border border-[#C4623F]/40 bg-[#C4623F]/10 px-3 py-2">
                          <p className="text-[11px] text-[#F4F5F7]">Masalah: {report.description}</p>
                        </div>
                      )}
                    </>
                  )
                })()}

                {report.checklistData?.items && (
                  <div className="mt-3 space-y-2">
                    {Object.values(report.checklistData.items).map((item: any) => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                        <p className="text-xs font-medium text-[#F4F5F7]">{item.name} ({item.code})</p>
                        {item.checks.map((check: any) => {
                          const options = check.options || []
                          const index = options.indexOf(check.selectedOption)
                          let badge = "bg-white/10 text-[#A8AEBC]"
                          if (check.selectedOption && index !== -1) {
                            if (options.length === 2) badge = index === 0 ? "bg-white/5 text-[#F4F5F7]" : "bg-[#C4623F]/15 text-[#E08462]"
                            else if (options.length === 3) {
                              if (index === 0) badge = "bg-white/5 text-[#F4F5F7]"
                              else if (index === 1) badge = "bg-[#A8AEBC]/10 text-[#A8AEBC]"
                              else badge = "bg-[#C4623F]/15 text-[#E08462]"
                            } else {
                              badge = index === options.length - 1 ? "bg-[#C4623F]/15 text-[#E08462]" : "bg-white/5 text-[#F4F5F7]"
                            }
                          }
                          return (
                            <div key={check.id} className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-[#F4F5F7]">{check.label}</span>
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

      <WorkerBottomBar active="riwayat" />
    </div>
  )
}
