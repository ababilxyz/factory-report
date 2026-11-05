import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getReportsByWorkerId } from '../lib/supabaseDb'
import type { Report } from '../types'
import { reportStatusTone, reportSummaryLabel } from '../lib/reportStatus'
import WorkerBottomBar from '../components/WorkerBottomBar'
import FilterDropdown from '../components/FilterDropdown'
import DateSeparator from '../components/DateSeparator'
import { groupByDay } from '../lib/groupByDay'

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistoryPage() {
  const { appUser } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState<Report[]>([])
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!appUser) {
      navigate('/login', { replace: true })
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
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat')
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  const visible =
    statusFilter === null ? reports : reports.filter((r) => r.status === statusFilter)

  return (
    <div className="min-h-screen bg-[#18191C] text-[#F4F5F7]">
      <header className="border-b border-white/10 bg-[#18191C]/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Riwayat</h1>
            <p className="mt-0.5 text-xs text-[#A8AEBC]">Laporan yang Anda kirimkan</p>
          </div>
          <button
            onClick={() => navigate('/home')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A8AEBC] hover:bg-white/10"
            aria-label="Kembali ke Beranda"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-3 space-y-3">
        <FilterDropdown<string | null>
          title="Status"
          selectedLabel={
            statusFilter === null
              ? 'Semua Status'
              : statusFilter === 'pending'
                ? 'Tertunda'
                : 'Selesai'
          }
          options={[
            { value: null, label: 'Semua Status' },
            { value: 'pending', label: 'Tertunda' },
            { value: 'resolved', label: 'Selesai' },
          ]}
          onSelect={setStatusFilter}
          isHighlighted={statusFilter !== null}
        />

        {error && (
          <div className="rounded-[8px] border border-[#C4623F]/60 bg-[#C4623F]/15 px-3 py-2 text-xs text-[#E08462]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#F4F5F7]" />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-[#A8AEBC]">
            <p className="text-sm font-bold text-[#F4F5F7]">Belum ada laporan</p>
            <p className="mt-1 text-xs text-[#8E929B]">
              Kirim laporan inspeksi untuk melihat riwayat di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupByDay(visible).map((group) => (
              <div key={group.key} className="space-y-2.5">
                <DateSeparator label={group.label} />
                {group.items.map((report) => (
                  <HistoryReportCard key={report.reportId} report={report} />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      <WorkerBottomBar active="riwayat" />
    </div>
  )
}

function HistoryReportCard({ report }: { report: Report }) {
  const [expanded, setExpanded] = useState(false)
  const hasIssues = report.checklistData?.hasIssues === true
  const isOpenIssue = hasIssues && report.status === 'pending'
  const tone = reportStatusTone(report.status, hasIssues)

  const checks = Object.values(report.checklistData?.items ?? {}).reduce(
    (n: number, it: any) => n + (it.checks?.length ?? 0),
    0
  )

  const itemCode =
    report.checklistData?.items &&
    Object.values(report.checklistData.items)[0]?.code

  return (
    <div
      className={`relative overflow-hidden rounded-[20px] border border-[#2F3238] bg-[#222429] p-4 ${
        isOpenIssue ? 'pl-5' : ''
      }`}
    >
      {isOpenIssue && <span className="absolute inset-y-0 left-0 w-1 bg-[#C4623F]" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2.5">
          {itemCode && (
            <span className="shrink-0 rounded-[8px] bg-[#1B1D22] px-2 py-1 text-[11px] font-extrabold text-[#F4F5F7]">
              {itemCode}
            </span>
          )}
          <div>
            <p className="truncate text-sm font-bold text-[#F4F5F7]">
              {report.areaName || report.areaId}
            </p>
            <p className="mt-0.5 text-xs text-[#8E929B]">
              Dikirim {formatDate(report.timestamp)}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${tone.className}`}
        >
          {tone.label}
        </span>
      </div>

      {checks > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-[8px] bg-[#1B1D22] px-3 py-2 text-[11px]">
          <span
            className={
              isOpenIssue
                ? 'font-bold text-[#E08462]'
                : hasIssues
                  ? 'text-[#F4F5F7]'
                  : 'text-[#A8AEBC]'
            }
          >
            {reportSummaryLabel(hasIssues, isOpenIssue, checks)}
          </span>
          {report.checklistData?.items && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="font-bold text-[#F4F5F7] hover:text-[#A8AEBC]"
            >
              {expanded ? 'Tutup ▴' : 'Rincian ▾'}
            </button>
          )}
        </div>
      )}

      {isOpenIssue && report.description && (
        <div className="mt-2 rounded-[8px] border border-[#C4623F]/40 bg-[#C4623F]/10 px-3 py-2 text-[11px] text-[#F4F5F7]">
          Masalah: {report.description}
        </div>
      )}

      {expanded && report.checklistData?.items && (
        <div className="mt-3 space-y-2 border-t border-[#2F3238] pt-3">
          {Object.values(report.checklistData.items).map((item: any) => (
            <div
              key={item.id}
              className="space-y-1.5 rounded-[10px] border border-[#2F3238] bg-[#18191C] p-3"
            >
              <p className="text-xs font-semibold text-[#F4F5F7]">
                {item.name} ({item.code})
              </p>
              {item.checks.map((c: any) => {
                const isBad =
                  c.selectedOption &&
                  c.options &&
                  c.selectedOption === c.options[c.options.length - 1] &&
                  c.options.length > 1
                return (
                  <div
                    key={c.id}
                    className="flex items-start justify-between gap-2 text-xs"
                  >
                    <span className="text-[#A8AEBC]">{c.label}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        isBad
                          ? 'border border-[#C4623F]/60 bg-[#C4623F]/20 text-[#E08462]'
                          : 'bg-white/5 text-[#F4F5F7]'
                      }`}
                    >
                      {c.selectedOption || '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
