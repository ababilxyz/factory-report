import type { Report, ScheduleSlot } from '../types'
import { buildRepairRows } from '../lib/repairRows'
import { buildPicCompletion } from '../lib/picCompletion'
import EvaluationQuarters from './EvaluationQuarters'

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function AdminSummaryDesktop({
  reports,
  slots,
}: {
  reports: Report[]
  slots: ScheduleSlot[]
}) {
  const rows = buildRepairRows(reports)
  const completion = buildPicCompletion(slots, reports)
  const repaired = rows.filter((r) => r.repair !== '—').length
  const picsDone = [...completion.values()].filter((c) => c.total > 0 && c.done === c.total).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[
          ['Total Temuan', String(rows.length)],
          ['Sudah Diperbaiki', String(repaired)],
          ['Belum', String(rows.length - repaired)],
          ['PIC Tuntas', `${picsDone} dari ${completion.size}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-tile border border-factory-border bg-factory-surface p-4">
            <p className="text-[26px] font-extrabold text-factory-text">{value}</p>
            <p className="mt-1 text-[10px] font-medium text-factory-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-card border border-factory-border bg-factory-surface">
        <table className="w-full text-left">
          <thead className="bg-factory-inset">
            <tr>
              {['Tanggal', 'Zona', 'Mesin', 'Temuan', 'Perbaikan', 'PIC', 'Evaluasi'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-factory-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-xs text-factory-muted">
                  Belum ada temuan pada periode ini.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const pic = r.picUid ? completion.get(r.picUid) : undefined
                return (
                  <tr key={`${r.reportId}-${r.checkId}`} className="border-t border-factory-border/60">
                    <td className="px-4 py-3 text-xs tabular-nums text-factory-dim">{fmtDate(r.foundAt)}</td>
                    <td className="px-4 py-3 text-xs text-factory-dim">{r.zoneName}</td>
                    <td className="px-4 py-3 text-xs text-factory-text">
                      <span className="font-extrabold">{r.machineCode}</span>
                      <span className="ml-1.5 text-factory-dim">{r.machineName}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-factory-text">{r.finding}</td>
                    <td
                      className={`px-4 py-3 text-xs ${
                        r.repair === '—' ? 'text-factory-danger' : 'text-factory-text'
                      }`}
                    >
                      {r.repair}
                    </td>
                    <td className="px-4 py-3 text-xs text-factory-dim">{r.pic}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <EvaluationQuarters value={pic?.quarters ?? 0} />
                        <span className="text-[10px] tabular-nums text-factory-muted">
                          {pic ? `${pic.done}/${pic.total}` : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}