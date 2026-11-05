import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { Factory, QrCode, User, Clock, CalendarDays, CheckCircle2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getReportsByWorkerId, getAllAreas, getScheduleForDay, getScheduleForMonth } from '../lib/supabaseDb'
import type { Report, Area, ScheduleSlot } from '../types'
import { reportStatusTone } from '../lib/reportStatus'
import WorkerBottomBar from '../components/WorkerBottomBar'
import ParticleField from '../components/ParticleField'

export default function WorkerHomePage() {
  const { appUser } = useAuth()
  const navigate = useNavigate()

  const [reports, setReports] = useState<Report[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const now = new Date()
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const dayOfMonth = now.getDate()

        const [reportsData, areasData, scheduleData] = await Promise.all([
          getReportsByWorkerId(appUser?.uid || ''),
          getAllAreas(),
          getScheduleForDay(appUser?.uid || '', yearMonth, dayOfMonth)
        ])
        setReports(reportsData)
        setAreas(areasData)
        setSchedule(scheduleData)

        if (scheduleData.length === 0) {
          try {
            const monthSchedule = await getScheduleForMonth(yearMonth)
            setScheduleMessage(
              monthSchedule.length === 0
                ? 'Jadwal bulan ini belum diunggah admin.'
                : 'Tidak ada tugas inspeksi untuk Anda hari ini.'
            )
          } catch {
            setScheduleMessage('Tidak ada tugas inspeksi untuk Anda hari ini.')
          }
        } else {
          setScheduleMessage(null)
        }
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
  const resolvedCount = reports.filter(r => r.status === 'resolved').length
  const issueCount = reports.filter(r => r.status === 'pending' && r.checklistData?.hasIssues === true).length

  const recentIssues = reports
    .filter(r => r.status === 'pending' || r.status === 'in_progress')
    .slice(0, 3)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const doneItemIds = new Set<string>()
  for (const report of reports) {
    if (report.timestamp < todayStart.getTime()) continue
    const items = report.checklistData?.items
    if (!items) continue
    for (const item of Object.values(items)) {
      if (item.id) doneItemIds.add(item.id)
      if (item.code) doneItemIds.add(item.code)
    }
  }
  const doneCount = schedule.filter((s) => doneItemIds.has(s.itemId) || doneItemIds.has(s.itemCode)).length
  const totalMinutes = schedule.reduce((acc, s) => acc + s.durationMinutes, 0)
  const percent = schedule.length === 0 ? 0 : Math.round((doneCount / schedule.length) * 100)

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




  const getCheckBadge = (options: string[], selectedOption?: string) => {
    if (!selectedOption) return 'bg-white/10 text-[#A8AEBC]'
    const optionIndex = options.indexOf(selectedOption)
    if (optionIndex === -1) return 'bg-white/10 text-[#A8AEBC]'
    if (options.length === 2) return optionIndex === 0 ? 'bg-white/5 text-[#F4F5F7]' : 'bg-[#C4623F]/15 text-[#E08462]'
    if (options.length === 3) {
      if (optionIndex === 0) return 'bg-white/5 text-[#F4F5F7]'
      if (optionIndex === 1) return 'bg-[#A8AEBC]/10 text-[#A8AEBC]'
      return 'bg-[#C4623F]/15 text-[#E08462]'
    }
    return optionIndex === options.length - 1 ? 'bg-[#C4623F]/15 text-[#E08462]' : 'bg-white/5 text-[#F4F5F7]'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className='min-h-screen bg-[#18191C] flex flex-col'
    >
      {/* Header */}
      <header className='bg-[#18191C] px-5 pt-5 pb-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='relative'>
              <div className='w-9 h-9 rounded-lg bg-[#F4F5F7] flex items-center justify-center'>
                <Factory className='w-4 h-4 text-white' />
              </div>
              <div className='absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#F4F5F7] border-2 border-[#18191C]' />
            </div>
            <div>
              <h1 className='text-[#F4F5F7] font-semibold text-base leading-tight'>
                {appUser?.displayName || 'Operator'}
              </h1>
              <p className='text-[#8E929B] text-xs'>Selamat bertugas</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className='w-8 h-8 flex items-center justify-center rounded-lg border border-[#2F3238] text-[#8E929B] hover:text-white hover:border-[#3A3D44] transition-all'
            aria-label='Profile'
          >
            <User className='w-4 h-4' />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className='flex-1 flex flex-col items-center justify-center px-5 pt-6 pb-32 gap-6'>
        {/* Today Progress Card (glass + particles) */}
        <button
          type='button'
          onClick={() => navigate('/scan')}
          className='glass-rim relative w-full max-w-sm overflow-hidden rounded-[22px] border border-[#2F3238] bg-[#222429]/55 p-5 text-left transition-transform active:scale-[0.99]'
        >
          <ParticleField count={18} seed={11} />
          <p className='relative text-[10px] font-semibold tracking-wider uppercase text-[#8E929B]'>
            Progres Inspeksi Shift
          </p>
          <div className='relative mt-2 flex items-center justify-between'>
            <div className='flex items-baseline'>
              <span className='text-[38px] font-extrabold leading-none text-[#F4F5F7]'>
                {loading ? '…' : doneCount}
              </span>
              <span className='ml-1.5 text-xs text-[#A8AEBC]'>
                / {schedule.length} tugas selesai
              </span>
            </div>
            <span className='rounded-full bg-[#F4F5F7] px-3.5 py-1 text-xs font-extrabold text-[#121417]'>
              {percent}%
            </span>
          </div>
          <div className='relative mt-3.5 h-2 w-full overflow-hidden rounded-full bg-[#2F3238]'>
            <div
              className='h-full rounded-full bg-[#F4F5F7] transition-all duration-300'
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className='relative mt-2.5 text-[11px] text-[#A8AEBC]'>
            {loading
              ? 'Memuat jadwal…'
              : schedule.length === 0
                ? scheduleMessage || 'Belum ada tugas hari ini'
                : `${schedule.length - doneCount} tugas tersisa • ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}`}
          </p>
        </button>

        {/* Ringkasan Tiles (label di bawah, nomor di kotak) */}
        <div className='w-full max-w-sm'>
          <div className='mb-2.5 flex items-center justify-between'>
            <h2 className='text-sm font-bold text-[#F4F5F7]'>Ringkasan</h2>
            <button
              onClick={() => navigate('/history')}
              className='text-xs font-semibold text-[#A8AEBC] hover:text-[#F4F5F7]'
            >
              Lihat semua
            </button>
          </div>
          <div className='grid grid-cols-3 gap-2.5'>
            {[
              { label: 'Tertunda', value: openCount, isIssue: false },
              { label: 'Masalah', value: issueCount, isIssue: true },
              { label: 'Selesai', value: resolvedCount, isIssue: false },
            ].map((tile) => (
              <button
                key={tile.label}
                type='button'
                onClick={() => navigate('/history')}
                className='group text-center'
              >
                <div className='rounded-[16px] border border-[#2F3238] bg-[#222429] py-3.5 px-2 transition-colors group-hover:border-[#F4F5F7]/40'>
                  <span className='text-2xl font-extrabold text-[#F4F5F7]'>
                    {loading ? '—' : tile.value}
                  </span>
                </div>
                <p
                  className={`mt-1.5 text-[11px] font-medium ${
                    tile.isIssue ? 'text-[#C4623F]' : 'text-[#A8AEBC]'
                  }`}
                >
                  {tile.label}
                </p>
              </button>
            ))}
          </div>
          <p className='mt-2.5 text-[10px] text-[#8E929B]'>
            {openCount} Tertunda termasuk {issueCount} Masalah. Selesai {resolvedCount} tugas.
          </p>
        </div>

        {/* Today's Schedule Card */}
        <div className='w-full max-w-sm bg-[#222429] border border-[#2F3238] rounded-2xl p-4 space-y-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <CalendarDays className='w-4 h-4 text-[#F4F5F7]' />
              <div>
                <p className='text-[#F4F5F7] font-bold text-sm'>Jadwal Tugas Hari Ini</p>
                <p className='text-[#8E929B] text-[10px]'>
                  {new Date().toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
            {schedule.length > 0 && (
              <span className='text-[10px] font-bold px-2 py-1 rounded-full bg-[#F4F5F7]/15 text-[#F4F5F7] border border-[#F4F5F7]/30'>
                {doneCount}/{schedule.length} selesai
              </span>
            )}
          </div>

          {loading ? (
            <div className='flex justify-center py-3'>
              <div className='w-4 h-4 rounded-full border-2 border-[#2F3238] border-t-[#F4F5F7] animate-spin' />
            </div>
          ) : schedule.length === 0 ? (
            <p className='text-[#8E929B] text-xs leading-relaxed'>
              {scheduleMessage || 'Tidak ada tugas terjadwal hari ini.'}
            </p>
          ) : (
            <>
              <p className='text-[#8E929B] text-[10px]'>
                Estimasi {totalMinutes} menit • Ketuk tugas untuk pindai QR mesin
              </p>
              <div className='space-y-1.5'>
                {schedule.map((slot) => {
                  const isDone = doneItemIds.has(slot.itemId) || doneItemIds.has(slot.itemCode)
                  return (
                    <button
                      key={slot.scheduleId}
                      onClick={() => navigate('/scan', { state: { expectedItemId: slot.itemId } })}
                      disabled={isDone}
                      className='w-full flex items-center justify-between gap-2 rounded-xl bg-[#18191C] border border-[#2F3238] px-3 py-2 text-left hover:border-[#F4F5F7]/40 disabled:opacity-70 transition-colors'
                    >
                      <div className='flex items-center gap-2 min-w-0'>
                        <span
                          className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isDone
                              ? 'bg-white/5 text-[#F4F5F7]'
                              : 'bg-[#F4F5F7]/15 text-[#F4F5F7]'
                          }`}
                        >
                          {slot.itemCode}
                        </span>
                        <div className='min-w-0'>
                          <p className='text-[#DCDDE1] text-xs font-medium truncate'>{slot.itemName}</p>
                          <p className='text-[#8E929B] text-[10px]'>{slot.durationMinutes} menit</p>
                        </div>
                      </div>
                      {isDone ? (
                        <CheckCircle2 className='w-4 h-4 text-[#F4F5F7] shrink-0' />
                      ) : (
                        <QrCode className='w-4 h-4 text-[#F4F5F7] shrink-0' />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Recent Issues */}
        <div className='w-full max-w-sm flex-1'>
          <div className='flex items-center justify-between mb-3'>
            <h2 className='text-[#F4F5F7] font-bold text-sm'>
              Tindak Lanjut
            </h2>
            <button
              onClick={() => navigate('/history')}
              className='text-[#8E929B] text-xs hover:text-[#F4F5F7] transition-colors font-medium'
            >
              Lihat semua
            </button>
          </div>

          <div className='space-y-2.5'>
            {loading ? (
              <div className='flex justify-center py-8'>
                <div className='w-5 h-5 rounded-full border-2 border-[#2F3238] border-t-[#F4F5F7] animate-spin' />
              </div>
            ) : recentIssues.length === 0 ? (
              <div className='text-center py-10'>
                <p className='text-[#8E929B] text-sm'>Tidak ada masalah aktif</p>
                <p className='text-[#8E929B] text-xs mt-1'>Pindai kode QR mesin untuk memulai inspeksi</p>
              </div>
            ) : (
              recentIssues.map((issue) => (
                <motion.button
                  key={issue.reportId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedReport(issue)}
                  className='w-full text-left bg-[#222429] border border-[#2F3238] rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-[#2F3238]/80 active:scale-[0.98] transition-all'
                >
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className='text-[#F4F5F7] font-semibold text-xs uppercase'>
                        {getAreaName(issue.areaId)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${reportStatusTone(issue.status, issue.checklistData?.hasIssues).className}`}>
                        {reportStatusTone(issue.status, issue.checklistData?.hasIssues).label}
                      </span>
                    </div>
                    <p className='text-[#8E929B] text-[11px] mt-1'>
                      {getItemLabel(issue)}
                    </p>
                  </div>
                  <div className='flex items-center gap-1.5 text-[#8E929B]'>
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
              className='w-full max-w-md rounded-2xl border border-white/10 bg-[#222429] max-h-[85vh] overflow-y-auto'
            >
              <div className='flex items-center justify-between p-4 border-b border-white/10'>
                <h2 className='text-sm font-semibold text-white'>Rincian Laporan</h2>
                <button
                  onClick={() => setSelectedReport(null)}
                  className='w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[#A8AEBC]'
                >
                  ✕
                </button>
              </div>

              <div className='p-4 space-y-4'>
                <div className='grid grid-cols-2 gap-3 text-sm'>
                  <div>
                    <p className='text-[#A8AEBC] text-xs'>Area</p>
                    <p className='mt-0.5 font-medium text-white'>
                      {selectedReport.areaName || selectedReport.areaId}
                    </p>
                  </div>
                  <div>
                    <p className='text-[#A8AEBC] text-xs'>Status</p>
                    <span
                      className={`mt-0.5 inline-block text-xs px-2 py-0.5 rounded-full border ${reportStatusTone(selectedReport.status, selectedReport.checklistData?.hasIssues).className}`}
                    >
                      {reportStatusTone(selectedReport.status, selectedReport.checklistData?.hasIssues).label}
                    </span>
                  </div>
                  <div className='col-span-2'>
                    <p className='text-[#A8AEBC] text-xs'>Time</p>
                    <p className='mt-0.5 text-white'>
                      {new Date(selectedReport.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {selectedReport.gpsLat !== undefined &&
                    selectedReport.gpsLng !== undefined && (
                      <div className='col-span-2'>
                        <p className='text-[#A8AEBC] text-xs'>GPS</p>
                        <p className='mt-0.5 text-white'>
                          {selectedReport.gpsLat.toFixed(5)}, {selectedReport.gpsLng.toFixed(5)}
                        </p>
                      </div>
                    )}
                </div>

                {selectedReport.checklistData?.items && (
                  <div className='space-y-3'>
                    <p className='text-xs text-[#A8AEBC] font-medium uppercase tracking-wide'>
                      Checklist
                    </p>
                    {Object.values(selectedReport.checklistData.items).map(
                      (item: any) => (
                        <div
                          key={item.id}
                          className='rounded-lg border border-white/10 bg-white/5 p-3 space-y-2'
                        >
                          <p className='text-sm font-medium text-[#F4F5F7]'>
                            {item.name}
                          </p>
                          {item.checks.map((check: any) => {
                            const options = check.options || []
                            const selectedOption = check.selectedOption

                            if (check.issueDescription) {
                              return (
                                <div
                                  key={check.id}
                                  className='rounded-lg bg-[#C4623F]/15 border border-[#C4623F]/40 p-3 space-y-2'
                                >
                                  <p className='text-sm font-medium text-[#E08462]'>
                                    {check.label}
                                  </p>
                                  <div className='space-y-1.5 text-xs'>
                                    <div>
                                      <span className='text-[#E08462] font-medium'>
                                        Abnormality
                                      </span>
                                      <p className='text-[#E08462] mt-0.5 whitespace-pre-wrap'>
                                        {check.issueDescription}
                                      </p>
                                    </div>
                                    {check.issuePhotoUrl && (
                                      <img
                                        src={check.issuePhotoUrl}
                                        alt='Issue'
                                        className='max-h-40 rounded border border-[#C4623F]/40 mt-1'
                                      />
                                    )}
                                    {check.afterDescription && (
                                      <div>
                                        <span className='text-[#F4F5F7] font-medium'>
                                          Action Taken
                                        </span>
                                        <p className='text-[#F4F5F7] mt-0.5 whitespace-pre-wrap'>
                                          {check.afterDescription}
                                        </p>
                                      </div>
                                    )}
                                    {check.afterPhotoUrl && (
                                      <img
                                        src={check.afterPhotoUrl}
                                        alt='After'
                                        className='max-h-40 rounded border border-white/15 mt-1'
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
                                  className='rounded-lg bg-white/5 border border-white/15 p-3 space-y-2'
                                >
                                  <div className='flex items-start justify-between gap-2'>
                                    <p className='text-sm font-medium text-[#F4F5F7]'>
                                      {check.label}
                                    </p>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full ${getCheckBadge(options, selectedOption)}`}
                                    >
                                      {selectedOption || '-'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className='text-[#F4F5F7] font-medium text-xs'>
                                      Action Taken
                                    </span>
                                    <p className='text-[#F4F5F7] mt-0.5 whitespace-pre-wrap text-xs'>
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
                                <span className='text-[#F4F5F7]'>{check.label}</span>
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

      <WorkerBottomBar active="beranda" />
    </motion.div>
  )
}
