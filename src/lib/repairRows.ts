import type { Report } from '../types'

/** Satu baris = satu temuan beserta perbaikannya. */
export interface RepairRow {
  reportId: string
  checkId: string
  foundAt: number
  zoneName: string
  machineCode: string
  machineName: string
  finding: string
  repair: string
  pic: string
  /** Untuk mencari indikator evaluasi di buildPicCompletion. */
  picUid: string | null
}

/**
 * Ratakan laporan jadi baris log perbaikan.
 *
 * Satu laporan bisa memuat beberapa temuan, jadi jumlah baris mengikuti jumlah
 * `check` yang punya `issueDescription` — bukan jumlah laporan. Pemeriksaan
 * normal tidak menghasilkan baris: tabel ini khusus tindak lanjut.
 */
export function buildRepairRows(reports: Report[]): RepairRow[] {
  const rows: RepairRow[] = []

  for (const r of reports) {
    const items = r.checklistData?.items
    if (!items) continue

    for (const item of Object.values(items)) {
      for (const check of item.checks ?? []) {
        const finding = (check.issueDescription ?? '').trim()
        if (!finding) continue

        rows.push({
          reportId: r.reportId,
          checkId: check.id,
          foundAt: r.timestamp,
          zoneName: r.areaName || r.areaId,
          machineCode: item.code,
          machineName: item.name,
          finding,
          repair: (check.afterDescription ?? '').trim() || '—',
          pic: r.workerName || '—',
          picUid: r.workerUid ?? null,
        })
      }
    }
  }

  return rows.sort((a, b) => b.foundAt - a.foundAt)
}