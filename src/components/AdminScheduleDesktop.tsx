import { useState } from 'react'
import type { Area, Report, ScheduleSlot } from '../types'
import { buildScheduleGrid, daysInMonth } from '../lib/scheduleGrid'
import { buildPicCompletion } from '../lib/picCompletion'
import { reportStatusTone } from '../lib/reportStatus'
import EvaluationQuarters from './EvaluationQuarters'

interface Props {
  yearMonth: string
  slots: ScheduleSlot[]
  reports: Report[]
  areas: Area[]
  onOpenReport: (report: Report) => void
}

export default function AdminScheduleDesktop({
  yearMonth,
  slots,
  reports,
  areas,
  onOpenReport,
}: Props) {
  const [selected, setSelected] = useState<{ itemId: string; day: number } | null>(null)
  const total = daysInMonth(yearMonth)
  const { rows, days } = buildScheduleGrid(slots, reports, total)
  const completion = buildPicCompletion(slots, reports)

  const row = selected ? rows.find((r) => r.itemId === selected.itemId) ?? null : null
  const cell =
    selected && row
      ? days[selected.day - 1]?.cells.find((c) => c.itemId === row.itemId) ?? null
      : null
  const zoneName = row ? areas.find((a) => a.areaId === row.areaId)?.name ?? row.areaId : ''
  const tone = cell
    ? reportStatusTone(cell.report?.status ?? 'pending', cell.report?.checklistData?.hasIssues)
    : null
  const pic = cell?.report?.workerUid ? completion.get(cell.report.workerUid) : undefined
  const finding = cell?.report
    ? Object.values(cell.report.checklistData?.items ?? {})
        .flatMap((i) => i.checks ?? [])
        .map((c) => c.issueDescription)
        .find((s) => !!s)
    : null

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 overflow-x-auto rounded-card border border-factory-border bg-factory-surface p-4">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-factory-surface px-2 py-2 text-left text-[11px] font-semibold text-factory-muted">
                Mesin
              </th>
              {Array.from({ length: total }, (_, i) => i + 1).map((d) => (
                <th
                  key={d}
                  className="px-0 py-2 text-center text-[10px] font-medium text-factory-muted"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.itemId} className="border-t border-factory-border/60">
                <td className="sticky left-0 bg-factory-surface px-2 py-2">
                  <p className="text-xs font-bold text-factory-text">{r.itemCode}</p>
                  <p className="text-[10px] text-factory-muted">{r.itemName}</p>
                </td>
                {Array.from({ length: total }, (_, i) => i + 1).map((d) => {
                  const c = days[d - 1]?.cells.find((x) => x.itemId === r.itemId)
                  if (!c) return <td key={d} className="p-0" />
                  const cls =
                    c.state === 'empty'
                      ? 'border-factory-border'
                      : c.state === 'issue'
                        ? 'border-factory-danger bg-factory-danger'
                        : 'border-factory-text bg-factory-text'
                  return (
                    <td key={d} className="p-0 text-center">
                      <button
                        type="button"
                        aria-label={`${r.itemCode} hari ${d}`}
                        onClick={() => setSelected({ itemId: r.itemId, day: d })}
                        className={`mx-auto my-2 h-3.5 w-3.5 rounded-full border-[1.5px] transition-transform hover:scale-125 ${cls}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="w-[340px] shrink-0 rounded-card border border-factory-border bg-factory-surface p-5">
        {!cell || !row ? (
          <p className="text-xs text-factory-muted">Klik satu titik untuk melihat detail laporan.</p>
        ) : (
          <>
            <h3 className="text-sm font-bold text-factory-text">Detail Inspeksi</h3>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-chip bg-factory-inset px-2 py-1 text-[10px] font-extrabold text-factory-text">
                {row.itemCode}
              </span>
              {tone && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold ${tone.className}`}
                >
                  {tone.label}
                </span>
              )}
            </div>
            <dl className="mt-4 space-y-3">
              {[
                ['Zona', zoneName],
                ['Mesin', row.itemName],
                ['Tanggal', `${selected!.day} ${yearMonth}`],
                ['Petugas', cell.report?.workerName ?? '—'],
                ['Temuan', finding ?? 'Tidak ada masalah'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3">
                  <dt className="text-[10px] font-semibold tracking-wide text-factory-muted">
                    {k.toUpperCase()}
                  </dt>
                  <dd className="text-right text-xs text-factory-text">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-factory-border pt-4">
              <span className="text-[10px] font-semibold tracking-wide text-factory-muted">
                EVALUASI PIC
              </span>
              <div className="flex items-center gap-2">
                <EvaluationQuarters value={pic?.quarters ?? 0} size={20} />
                <span className="text-[10px] tabular-nums text-factory-muted">
                  {pic ? `${pic.done}/${pic.total} tugas` : '—'}
                </span>
              </div>
            </div>

            {cell.report && (
              <button
                type="button"
                onClick={() => onOpenReport(cell.report!)}
                className="mt-5 w-full rounded-field bg-factory-accent py-2.5 text-xs font-extrabold text-[#121417]"
              >
                Buka laporan lengkap
              </button>
            )}
          </>
        )}
      </aside>
    </div>
  )
}