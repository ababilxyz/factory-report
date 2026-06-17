import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { Factory, QrCode, Home, User, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getReportsByWorkerId, getAllAreas } from '../lib/supabaseDb'
import type { Report, Area } from '../types'

export default function WorkerHomePage() {
  const { appUser } = useAuth()
  const navigate = useNavigate()

  const [reports, setReports] = useState<Report[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [reportsData, areasData] = await Promise.all([
          getReportsByWorkerId(appUser?.uid || ''),
          getAllAreas()
        ])
        setReports(reportsData)
        setAreas(areasData)
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    if (appUser) {
      loadData()
    }
  }, [appUser])

  const openCount = reports.filter(r => r.status === 'pending').length
  const inProgressCount = reports.filter(r => r.status === 'in_progress').length
  const resolvedCount = reports.filter(r => r.status === 'resolved').length

  const recentIssues = reports
    .filter(r => r.status === 'pending' || r.status === 'in_progress')
    .slice(0, 3)

  const getAreaName = (areaId: string) => {
    const area = areas.find(a => a.areaId === areaId)
    return area?.name || areaId
  }

  const getItemLabel = (report: Report) => {
    const items = report.checklistData?.items
      ? Object.values(report.checklistData.items)
      : []
    const first = items[0]
    if (!first) return report.reportId.slice(0, 6).toUpperCase()
    const name = first.name || first.code
    const code = first.code
    return code ? `${name} · ${code}` : name
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      default:
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress'
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const getStatusColor = (status: Report['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-900/50 text-amber-300 border-amber-800'
      case 'in_progress':
        return 'bg-teal-900/50 text-teal-300 border-teal-800'
      case 'resolved':
        return 'bg-emerald-900/50 text-emerald-300 border-emerald-800'
      default:
        return 'bg-white/10 text-white/70 border-white/20'
    }
  }

  const getCheckBadge = (options: string[], selectedOption?: string) => {
    if (!selectedOption) return 'bg-white/10 text-slate-400'
    const optionIndex = options.indexOf(selectedOption)
    if (optionIndex === -1) return 'bg-white/10 text-slate-400'
    if (options.length === 2) return optionIndex === 0 ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'
    if (options.length === 3) {
      if (optionIndex === 0) return 'bg-emerald-900/40 text-emerald-300'
      if (optionIndex === 1) return 'bg-amber-900/40 text-amber-300'
      return 'bg-red-900/40 text-red-300'
    }
    return optionIndex === options.length - 1 ? 'bg-red-900/40 text-red-300' : 'bg-emerald-900/40 text-emerald-300'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className='min-h-screen bg-[#0b1121] flex flex-col'
    >
      {/* Header */}
      <header className='bg-[#0b1121] px-5 pt-5 pb-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='relative'>
              <div className='w-9 h-9 rounded-lg bg-[#0d9488] flex items-center justify-center'>
                <Factory className='w-4 h-4 text-white' />
              </div>
              <div className='absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#0d9488] border-2 border-[#0b1121]' />
            </div>
            <div>
              <h1 className='text-[#f1f5f9] font-semibold text-base leading-tight'>
                {appUser?.displayName || 'Operator'}
              </h1>
              <p className='text-[#64748b] text-xs'>Good shift, Operator</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className='w-8 h-8 flex items-center justify-center rounded-lg border border-[#1e293b] text-[#64748b] hover:text-white hover:border-[#334155] transition-all'
            aria-label='Profile'
          >
            <User className='w-4 h-4' />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className='flex-1 flex flex-col items-center justify-center px-5 py-6 gap-6'>
        {/* Scan QR Card - centered hero */}
        <motion.button
          onClick={() => navigate('/scan')}
          whileTap={{ scale: 0.98 }}
          className='w-full max-w-sm bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8 flex flex-col items-center gap-5 hover:border-[#0d9488]/40 transition-all'
        >
          <div className='w-28 h-28 rounded-2xl bg-[#0d9488]/10 border border-[#0d9488]/25 flex items-center justify-center'>
            <QrCode className='w-14 h-14 text-[#0d9488]' />
          </div>
          <div className='text-center'>
            <p className='text-[#f1f5f9] font-extrabold text-xl tracking-wide uppercase'>
              SCAN QR CODE
            </p>
            <p className='text-[#94a3b8] text-sm mt-2'>
              Scan machine QR to start reporting
            </p>
          </div>
        </motion.button>

        {/* Stats */}
        <div className='w-full max-w-xs grid grid-cols-3 gap-2'>
          <div className='bg-[#0f172a] border border-[#1e293b] rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 text-center min-h-[88px]'>
            <span className='text-[#f1f5f9] text-xl font-bold'>
              {loading ? '-' : openCount}
            </span>
            <span className='text-[#64748b] text-[9px] uppercase tracking-wider font-medium whitespace-nowrap'>
              Open
            </span>
          </div>
          <div className='bg-[#0f172a] border border-[#1e293b] rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 text-center min-h-[88px]'>
            <span className='text-[#f59e0b] text-xl font-bold'>
              {loading ? '-' : inProgressCount}
            </span>
            <span className='text-[#64748b] text-[9px] uppercase tracking-wider font-medium whitespace-nowrap'>
              In Progress
            </span>
          </div>
          <div className='bg-[#0f172a] border border-[#1e293b] rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 text-center min-h-[88px]'>
            <span className='text-[#10b981] text-xl font-bold'>
              {loading ? '-' : resolvedCount}
            </span>
            <span className='text-[#64748b] text-[9px] uppercase tracking-wider font-medium whitespace-nowrap'>
              Resolved
            </span>
          </div>
        </div>

        {/* Recent Issues */}
        <div className='w-full max-w-sm flex-1'>
          <div className='flex items-center justify-between mb-3'>
            <h2 className='text-[#f1f5f9] font-bold text-sm'>
              MY RECENT ISSUES
            </h2>
            <button
              onClick={() => navigate('/history')}
              className='text-[#64748b] text-xs hover:text-[#0d9488] transition-colors font-medium'
            >
              View all
            </button>
          </div>

          <div className='space-y-2.5'>
            {loading ? (
              <div className='flex justify-center py-8'>
                <div className='w-5 h-5 rounded-full border-2 border-[#1e293b] border-t-[#0d9488] animate-spin' />
              </div>
            ) : recentIssues.length === 0 ? (
              <div className='text-center py-10'>
                <p className='text-[#64748b] text-sm'>No active issues</p>
                <p className='text-[#475569] text-xs mt-1'>Scan a QR code to start reporting</p>
              </div>
            ) : (
              recentIssues.map((issue) => (
                <motion.button
                  key={issue.reportId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedReport(issue)}
                  className='w-full text-left bg-[#0f172a] border border-[#1e293b] rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-[#1e293b]/80 active:scale-[0.98] transition-all'
                >
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className='text-[#f1f5f9] font-semibold text-xs uppercase'>
                        {getAreaName(issue.areaId)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusClass(issue.status)}`}>
                        {getStatusLabel(issue.status)}
                      </span>
                    </div>
                    <p className='text-[#64748b] text-[11px] mt-1'>
                      {getItemLabel(issue)}
                    </p>
                  </div>
                  <div className='flex items-center gap-1.5 text-[#64748b]'>
                    <Clock className='w-3.5 h-3.5' />
                    <span className='text-[11px] tabular-nums'>
                      {formatTime(issue.timestamp)}
                    </span>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4'
            onClick={() => setSelectedReport(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className='w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] max-h-[85vh] overflow-y-auto'
            >
              <div className='flex items-center justify-between p-4 border-b border-white/10'>
                <h2 className='text-sm font-semibold text-white'>Report details</h2>
                <button
                  onClick={() => setSelectedReport(null)}
                  className='w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400'
                >
                  ✕
                </button>
              </div>

              <div className='p-4 space-y-4'>
                <div className='grid grid-cols-2 gap-3 text-sm'>
                  <div>
                    <p className='text-slate-400 text-xs'>Area</p>
                    <p className='mt-0.5 font-medium text-white'>
                      {selectedReport.areaName || selectedReport.areaId}
                    </p>
                  </div>
                  <div>
                    <p className='text-slate-400 text-xs'>Status</p>
                    <span
                      className={`mt-0.5 inline-block text-xs px-2 py-0.5 rounded-full border ${getStatusColor(selectedReport.status)}`}
                    >
                      {getStatusLabel(selectedReport.status)}
                    </span>
                  </div>
                  <div className='col-span-2'>
                    <p className='text-slate-400 text-xs'>Time</p>
                    <p className='mt-0.5 text-white'>
                      {new Date(selectedReport.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {selectedReport.gpsLat !== undefined &&
                    selectedReport.gpsLng !== undefined && (
                      <div className='col-span-2'>
                        <p className='text-slate-400 text-xs'>GPS</p>
                        <p className='mt-0.5 text-white'>
                          {selectedReport.gpsLat.toFixed(5)}, {selectedReport.gpsLng.toFixed(5)}
                        </p>
                      </div>
                    )}
                </div>

                {selectedReport.checklistData?.items && (
                  <div className='space-y-3'>
                    <p className='text-xs text-slate-400 font-medium uppercase tracking-wide'>
                      Checklist
                    </p>
                    {Object.values(selectedReport.checklistData.items).map(
                      (item: any) => (
                        <div
                          key={item.id}
                          className='rounded-lg border border-white/10 bg-white/5 p-3 space-y-2'
                        >
                          <p className='text-sm font-medium text-[#0d9488]'>
                            {item.name}
                          </p>
                          {item.checks.map((check: any) => {
                            const options = check.options || []
                            const selectedOption = check.selectedOption

                            if (check.issueDescription) {
                              return (
                                <div
                                  key={check.id}
                                  className='rounded-lg bg-red-950/40 border border-red-900/40 p-3 space-y-2'
                                >
                                  <p className='text-sm font-medium text-red-300'>
                                    {check.label}
                                  </p>
                                  <div className='space-y-1.5 text-xs'>
                                    <div>
                                      <span className='text-red-400 font-medium'>
                                        Abnormality
                                      </span>
                                      <p className='text-red-200 mt-0.5 whitespace-pre-wrap'>
                                        {check.issueDescription}
                                      </p>
                                    </div>
                                    {check.issuePhotoUrl && (
                                      <img
                                        src={check.issuePhotoUrl}
                                        alt='Issue'
                                        className='max-h-40 rounded border border-red-900/50 mt-1'
                                      />
                                    )}
                                    {check.afterDescription && (
                                      <div>
                                        <span className='text-emerald-400 font-medium'>
                                          Action Taken
                                        </span>
                                        <p className='text-emerald-100 mt-0.5 whitespace-pre-wrap'>
                                          {check.afterDescription}
                                        </p>
                                      </div>
                                    )}
                                    {check.afterPhotoUrl && (
                                      <img
                                        src={check.afterPhotoUrl}
                                        alt='After'
                                        className='max-h-40 rounded border border-emerald-900/50 mt-1'
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
                                  className='rounded-lg bg-emerald-950/40 border border-emerald-900/40 p-3 space-y-2'
                                >
                                  <div className='flex items-start justify-between gap-2'>
                                    <p className='text-sm font-medium text-emerald-300'>
                                      {check.label}
                                    </p>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full ${getCheckBadge(options, selectedOption)}`}
                                    >
                                      {selectedOption || '-'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className='text-emerald-400 font-medium text-xs'>
                                      Action Taken
                                    </span>
                                    <p className='text-emerald-100 mt-0.5 whitespace-pre-wrap text-xs'>
                                      {check.afterDescription}
                                    </p>
                                  </div>
                                </div>
                              )
                            }

                            return (
                              <div
                                key={check.id}
                                className='flex items-start justify-between gap-2 text-sm'
                              >
                                <span className='text-slate-200'>{check.label}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getCheckBadge(options, selectedOption)}`}>
                                  {selectedOption || '-'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className='bg-[#0f172a] border-t border-[#1e293b] px-6 py-2 flex justify-around'>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/home')}
          className='flex flex-col items-center gap-1.5 text-sm font-medium text-[#0d9488] pb-1'
        >
          <Home className='w-5 h-5' />
          <span className='text-[10px]'>Home</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/scan')}
          className='flex flex-col items-center gap-1.5 text-sm font-medium text-[#64748b] hover:text-[#94a3b8] pb-1 transition-colors'
        >
          <QrCode className='w-5 h-5' />
          <span className='text-[10px]'>Scan</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/history')}
          className='flex flex-col items-center gap-1.5 text-sm font-medium text-[#64748b] hover:text-[#94a3b8] pb-1 transition-colors'
        >
          <Clock className='w-5 h-5' />
          <span className='text-[10px]'>History</span>
        </motion.button>
      </nav>
    </motion.div>
  )
}
