import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { getReportsByWorkerId, getScheduleForDay, getScheduleForMonth } from '../lib/supabaseDb'
import type { Report, ScheduleSlot } from '../types'
import { reportStatusTone } from '../lib/reportStatus'
import WorkerBottomBar from '../components/WorkerBottomBar'
import ParticleField from '../components/ParticleField'

// Setara DateFormatter.formatDate di Android: "dd MMM yyyy" (id-ID).
const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export default function WorkerHomePage() {
  const { appUser } = useAuth()
  const navigate = useNavigate()
  const displayName = appUser?.displayName || 'Operator'

  const [reports, setReports] = useState<Report[]>([])
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      const now = new Date()
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const dayOfMonth = now.getDate()
      const uid = appUser?.uid || ''

      const [reportsData, scheduleData] = await Promise.all([
        getReportsByWorkerId(uid),
        getScheduleForDay(uid, yearMonth, dayOfMonth),
      ])
      setReports(reportsData)
      setSchedule(scheduleData)
      setLastUpdated(Date.now())

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
      setErrorMessage('Gagal memuat data. Periksa koneksi lalu coba lagi.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [appUser])

  useEffect(() => {
    if (appUser) loadData()
  }, [appUser, loadData])

  const handleRefresh = () => {
    setRefreshing(true)
    void loadData()
  }

  // Ringkasan: sama dengan WorkerHomeViewModel (pending, masalah, selesai).
  const pending = reports.filter(r => r.status === 'pending')
  const openCount = pending.length
  const issueCount = pending.filter(r => r.checklistData?.hasIssues === true).length
  const resolvedCount = reports.filter(r => r.status === 'resolved').length
  const recentIssues = pending.slice(0, 4)

  // Tugas hari ini dianggap selesai jika sudah ada laporan hari ini untuk item tsb.
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const doneItemIds = new Set<string>()
  for (const report of reports) {
    if (report.timestamp < todayStart.getTime()) continue
    const id = report.checklistData?.areaId
    if (id) doneItemIds.add(id)
  }
  const isDone = (slot: ScheduleSlot) => doneItemIds.has(slot.itemId)
  const doneCount = schedule.filter(isDone).length
  const remaining = Math.max(schedule.length - doneCount, 0)
  // Android memakai toInt() (dibulatkan ke bawah).
  const percent = schedule.length === 0 ? 0 : Math.floor((doneCount / schedule.length) * 100)
  const firstIncompleteIndex = schedule.findIndex(s => !isDone(s))
  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null

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
      {/* Header: sama dengan HomeHeader di Android */}
      <header className='sticky top-0 z-10 flex items-center gap-1 bg-[#18191C] pb-2 pl-4 pr-2 pt-[calc(env(safe-area-inset-top)+12px)]'>
        <div className='min-w-0 flex-1'>
          <h1 className='text-2xl font-extrabold leading-tight text-[#F4F5F7]'>Beranda</h1>
          <p className='text-xs text-[#A8AEBC]'>
            {updatedLabel ? `${displayName} · ${updatedLabel}` : `${displayName} · Shift hari ini`}
          </p>
        </div>
        <button
          type='button'
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label='Segarkan data laporan'
          className='flex h-12 w-12 items-center justify-center rounded-full disabled:opacity-60'
        >
          {refreshing ? (
            <span className='h-5 w-5 animate-spin rounded-full border-2 border-[#2F3238] border-t-[#F4F5F7]' />
          ) : (
            <RefreshCw className='h-[22px] w-[22px] text-[#A8AEBC]' />
          )}
        </button>
        <button
          type='button'
          onClick={() => navigate('/profile')}
          aria-label='Profil'
          className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F4F5F7]/[0.14] text-[17px] font-bold text-[#F4F5F7]'
        >
          {displayName.charAt(0).toUpperCase()}
        </button>
      </header>

      {/* Konten: jarak antar item 16px, seperti LazyColumn Android */}
      <main className='flex flex-1 flex-col gap-4 px-4 pt-2 pb-[104px]'>
        {errorMessage && (
          <div className='flex items-center justify-between gap-2 rounded-lg border border-[#C4623F]/35 bg-[#C4623F]/[0.08] px-3 py-1'>
            <p className='min-w-0 flex-1 text-[13px] text-[#C4623F]'>{errorMessage}</p>
            <button
              type='button'
              onClick={handleRefresh}
              className='h-12 shrink-0 px-2 text-[13px] font-semibold text-[#C4623F]'
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Kartu progres (glass) */}
        <button
          type='button'
          onClick={() => navigate('/scan')}
          className='glass-rim relative w-full overflow-hidden rounded-[22px] bg-[#222429]/55 p-[18px] text-left transition-transform active:scale-[0.99]'
        >
          <ParticleField count={18} seed={11} />
          <div className='relative'>
            <p className='text-[11px] font-medium text-[#A8AEBC]'>Progres Inspeksi Shift</p>
            <div className='mt-1.5 flex items-center justify-between'>
              <div className='flex items-end'>
                <span className='text-[38px] font-extrabold leading-none text-[#F4F5F7]'>
                  {loading ? '…' : doneCount}
                </span>
                <span className='mb-[7px] ml-1 text-[13px] text-[#A8AEBC]'>
                  / {schedule.length} tugas selesai
                </span>
              </div>
              <span className='rounded-[15px] bg-[#F4F5F7] px-3.5 py-[7px] text-[13px] font-extrabold text-[#121417]'>
                {percent}%
              </span>
            </div>
            <div className='mt-3.5 h-2 w-full overflow-hidden rounded-full bg-[#2F3238]'>
              <div
                className='h-full rounded-full bg-[#F4F5F7] transition-all duration-300'
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className='mt-2.5 text-[11px] text-[#A8AEBC]'>
              {loading
                ? 'Memuat jadwal…'
                : schedule.length === 0
                  ? scheduleMessage || 'Belum ada tugas hari ini'
                  : `${remaining} tugas tersisa • ${todayLabel}`}
            </p>
          </div>
        </button>

        {/* Ringkasan: kotak angka + label di bawah */}
        <div>
          <h2 className='text-[15px] font-bold text-[#F4F5F7]'>Ringkasan</h2>
          <div className='mt-2 grid grid-cols-4 gap-2.5'>
            {[
              { label: 'Tertunda', value: openCount, isIssue: false },
              { label: 'Masalah', value: issueCount, isIssue: true },
              { label: 'Selesai', value: resolvedCount, isIssue: false },
              // PWA belum punya antrian offline; nilai tetap 0 agar layout sama dengan Android.
              { label: 'Offline', value: 0, isIssue: false },
            ].map((tile) => (
              <button
                key={tile.label}
                type='button'
                onClick={() => navigate('/history')}
                className='group flex flex-col'
              >
                <div className='rounded-[18px] border border-[#2F3238] bg-[#222429] px-1 py-3.5 text-center transition-colors group-hover:border-[#F4F5F7]/40'>
                  <span className='text-2xl font-extrabold text-[#F4F5F7]'>{tile.value}</span>
                </div>
                <p
                  className={`mt-1.5 text-center text-[11px] font-medium ${
                    tile.isIssue ? 'text-[#C4623F]' : 'text-[#A8AEBC]'
                  }`}
                >
                  {tile.label}
                </p>
              </button>
            ))}
          </div>
          <p className='mt-2 pl-0.5 text-[10px] text-[#A8AEBC]'>
            {openCount} Tertunda termasuk {issueCount} Masalah. Selesai {resolvedCount} tugas.
          </p>
        </div>

        {/* Header tugas */}
        <div className='flex items-center justify-between'>
          <h2 className='text-[15px] font-bold text-[#F4F5F7]'>
            {schedule.length > 0 ? `Tugas Berikutnya (${remaining} dari ${schedule.length})` : 'Tugas Hari Ini'}
          </h2>
          {schedule.length > 0 && (
            <button
              type='button'
              onClick={() => navigate('/history')}
              className='h-12 px-2 text-[13px] font-semibold text-[#F4F5F7]'
            >
              Lihat semua
            </button>
          )}
        </div>

        {/* Daftar tugas */}
        {loading ? (
          <div className='flex h-24 items-center justify-center'>
            <span className='h-8 w-8 animate-spin rounded-full border-[3px] border-[#2F3238] border-t-[#F4F5F7]' />
          </div>
        ) : schedule.length === 0 ? (
          <div className='flex flex-col items-center rounded-2xl border border-[#2F3238] bg-[#222429] px-5 py-6'>
            <p className='text-center text-xs text-[#8E929B]'>
              {scheduleMessage || 'Tidak ada tugas terjadwal hari ini.'}
            </p>
            <button
              type='button'
              onClick={() => navigate('/scan')}
              className='mt-2.5 flex h-12 items-center gap-1.5 px-3 text-[13px] font-bold text-[#F4F5F7]'
            >
              <QrCode className='h-[18px] w-[18px]' />
              Pindai Mesin
            </button>
          </div>
        ) : (
          schedule.map((slot, index) => {
            const done = isDone(slot)
            const active = !done && index === firstIncompleteIndex
            return (
              <button
                key={slot.scheduleId || slot.itemId}
                type='button'
                onClick={() => navigate('/scan', { state: { expectedItemId: slot.itemId } })}
                disabled={done}
                className={`flex w-full items-center gap-3 rounded-[18px] border bg-[#222429] px-3.5 py-3.5 text-left disabled:cursor-default ${
                  active ? 'border-[#F4F5F7]' : 'border-[#2F3238]'
                }`}
              >
                <span className='shrink-0 rounded-lg bg-[#2C3038] px-2 py-[5px] text-[11px] font-extrabold text-[#F4F5F7]'>
                  {slot.itemCode}
                </span>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-[13px] font-bold text-[#F4F5F7]'>{slot.itemName || slot.itemCode}</p>
                  <p className='mt-0.5 truncate text-[11px] text-[#A8AEBC]'>
                    {slot.itemCode} • {slot.durationMinutes} menit
                  </p>
                </div>
                {done ? (
                  <span className='shrink-0 text-[11px] font-bold text-[#F4F5F7]'>Selesai</span>
                ) : active ? (
                  <span className='shrink-0 rounded-2xl bg-[#F4F5F7] px-3.5 py-2 text-[11px] font-extrabold text-[#121417]'>
                    SCAN
                  </span>
                ) : (
                  <span className='shrink-0 text-[11px] font-medium text-[#8E929B]'>Antrian</span>
                )}
              </button>
            )
          })
        )}

        {/* Tindak lanjut */}
        <div className='flex items-center justify-between'>
          <h2 className='text-[15px] font-bold text-[#F4F5F7]'>Perlu Tindak Lanjut</h2>
          {recentIssues.length > 0 && (
            <button
              type='button'
              onClick={() => navigate('/history')}
              className='h-12 px-2 text-[13px] font-semibold text-[#F4F5F7]'
            >
              Lihat Semua
            </button>
          )}
        </div>

        {loading ? (
          <div className='flex h-[120px] items-center justify-center'>
            <span className='h-8 w-8 animate-spin rounded-full border-[3px] border-[#2F3238] border-t-[#F4F5F7]' />
          </div>
        ) : recentIssues.length === 0 ? (
          <div className='flex flex-col items-center rounded-2xl border border-[#2F3238] bg-[#222429] px-5 py-6'>
            <div className='flex h-12 w-12 items-center justify-center rounded-full bg-[#C9CED6]/[0.12]'>
              <CheckCircle2 className='h-[26px] w-[26px] text-[#C9CED6]' />
            </div>
            <p className='mt-2.5 text-sm font-semibold text-[#F4F5F7]'>Tidak Ada Tindak Lanjut</p>
            <p className='mt-1 text-center text-xs text-[#8E929B]'>
              Semua laporan sudah ditangani. Pindai kode QR mesin untuk memulai inspeksi baru.
            </p>
            <button
              type='button'
              onClick={() => navigate('/scan')}
              className='mt-3 flex h-12 items-center gap-1.5 px-3 text-[13px] font-bold text-[#F4F5F7]'
            >
              <QrCode className='h-[18px] w-[18px]' />
              Pindai Mesin Baru
            </button>
          </div>
        ) : (
          recentIssues.map((report) => (
            <button
              key={report.reportId}
              type='button'
              onClick={() => setSelectedReport(report)}
              className='relative flex w-full items-center overflow-hidden rounded-[18px] border border-[#2F3238] bg-[#222429] text-left'
            >
              <span className='absolute inset-y-0 left-0 w-1 bg-[#C4623F]' />
              <div className='flex w-full items-center gap-2 py-3.5 pl-[18px] pr-3.5'>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-[13px] font-bold text-[#F4F5F7]'>
                    {report.areaName || report.areaId}
                  </p>
                  <p className='mt-0.5 truncate text-[11px] text-[#A8AEBC]'>
                    {report.areaId} • {report.description || 'Ada Masalah'} • {formatDate(report.timestamp)}
                  </p>
                </div>
                <span className='shrink-0 rounded-[13px] border border-[#C4623F] px-2.5 py-[5px] text-[10px] font-extrabold text-[#C4623F]'>
                  MASALAH
                </span>
              </div>
            </button>
          ))
        )}
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
