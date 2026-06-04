import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getReports, updateReportStatus } from '../lib/supabaseDb'
import type { Report, ReportStatus } from '../types'
import { motion, AnimatePresence } from 'framer-motion'

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  in_progress: 'bg-blue-900/50 text-blue-300 border-blue-800',
  resolved: 'bg-green-900/50 text-green-300 border-green-800'
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function AdminDashboard() {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<ReportStatus | undefined>(undefined)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ['reports', statusFilter],
    queryFn: () => getReports(statusFilter),
    refetchInterval: 30_000 // Auto-refresh every 30s
  })

  const updateStatus = useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: ReportStatus }) =>
      updateReportStatus(reportId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] })
      setSelectedReport(null)
    }
  })

  const filters: Array<{ label: string; value: ReportStatus | undefined }> = [
    { label: 'All', value: undefined },
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Resolved', value: 'resolved' }
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-factory-dark"
    >
      {/* Header */}
      <header className="bg-factory-card border-b border-factory-border px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl">Dashboard</h1>
            <p className="text-factory-muted text-xs mt-0.5">Welcome, {appUser?.displayName}</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/qr-generator')}
              className="bg-factory-accent/20 text-factory-accent border border-factory-accent/30 text-sm px-3 py-2 rounded-lg min-h-[44px] font-medium"
            >
              QR Codes
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => void signOut()}
              className="text-factory-muted text-sm px-3 py-2 min-h-[44px]"
            >
              Sign out
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', count: reports.length, color: 'text-white' },
            { label: 'Pending', count: reports.filter(r => r.status === 'pending').length, color: 'text-yellow-400' },
            { label: 'Resolved', count: reports.filter(r => r.status === 'resolved').length, color: 'text-green-400' }
          ].map(stat => (
            <div key={stat.label} className="bg-factory-card border border-factory-border rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
              <p className="text-factory-muted text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.label}
              onClick={() => setStatusFilter(f.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[36px] ${
                statusFilter === f.value
                  ? 'bg-factory-accent text-white'
                  : 'bg-factory-card border border-factory-border text-factory-muted hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Reports list */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-factory-accent/30 border-t-factory-accent animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-xl p-4 text-sm">
            Failed to load reports. Check your internet connection.
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-factory-muted">
            <p className="text-4xl mb-3">📋</p>
            <p>No reports found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(report => (
              <motion.div
                key={report.reportId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedReport(report)}
                className="bg-factory-card border border-factory-border rounded-2xl p-4 cursor-pointer hover:border-factory-accent/50 transition-colors"
              >
                <div className="flex gap-3">
                {report.beforePhotoUrl && (
                    <img
                        src={report.beforePhotoUrl}
                        alt="Issue"
                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-factory-border"
                    />
                )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white font-medium text-sm truncate">{report.areaName || report.areaId}</p>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[report.status]}`}>
                        {STATUS_LABELS[report.status]}
                      </span>
                    </div>
                    <p className="text-factory-muted text-sm mt-1 line-clamp-2">{report.description}</p>
                    <p className="text-factory-muted/60 text-xs mt-1.5">{timeAgo(report.timestamp)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Report detail modal */}
      <AnimatePresence>
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedReport(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-factory-card border border-factory-border rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            >
              <div className="p-4 border-b border-factory-border flex items-center justify-between">
                <h2 className="text-white font-semibold">Report Details</h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedReport(null)}
                  className="text-factory-muted w-8 h-8 flex items-center justify-center"
                >
                  ✕
                </motion.button>
              </div>

              <div className="p-4 space-y-4">
                 <AnimatePresence>
                   {selectedReport.beforePhotoUrl && (
                     <motion.img
                       key="photo"
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       src={selectedReport.beforePhotoUrl}
                       alt="Issue"
                       className="w-full rounded-xl object-cover max-h-48"
                     />
                   )}
                 </AnimatePresence>

                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Area', value: selectedReport.areaName || selectedReport.areaId },
                    { label: 'Time', value: new Date(selectedReport.timestamp).toLocaleString() },
                    ...(selectedReport.gpsLat !== undefined && selectedReport.gpsLng !== undefined
                      ? [{ label: 'GPS', value: `${selectedReport.gpsLat.toFixed(5)}, ${selectedReport.gpsLng.toFixed(5)}` }]
                      : []
                    )
                  ].map(item => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex justify-between"
                    >
                      <span className="text-factory-muted">{item.label}</span>
                      <span className="text-white">{item.value}</span>
                    </motion.div>
                  ))}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex justify-between"
                  >
                    <span className="text-factory-muted">Status</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[selectedReport.status]}`}>
                      {STATUS_LABELS[selectedReport.status]}
                    </span>
                  </motion.div>
                </div>

                <div>
                  <p className="text-factory-muted text-sm mb-1">Description</p>
                  <p className="text-white text-sm bg-factory-dark rounded-xl p-3">{selectedReport.description}</p>
                </div>

                {/* Status update actions */}
                <div className="flex gap-2">
                  {selectedReport.status !== 'in_progress' && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => updateStatus.mutate({ reportId: selectedReport.reportId, status: 'in_progress' })}
                      disabled={updateStatus.isPending}
                      className="flex-1 bg-blue-900/50 border border-blue-700 text-blue-300 py-2.5 rounded-xl text-sm font-medium min-h-[44px] disabled:opacity-50"
                    >
                      Mark In Progress
                    </motion.button>
                  )}
                  {selectedReport.status !== 'resolved' && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => updateStatus.mutate({ reportId: selectedReport.reportId, status: 'resolved' })}
                      disabled={updateStatus.isPending}
                      className="flex-1 bg-green-900/50 border border-green-700 text-green-300 py-2.5 rounded-xl text-sm font-medium min-h-[44px] disabled:opacity-50"
                    >
                      Mark Resolved
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
