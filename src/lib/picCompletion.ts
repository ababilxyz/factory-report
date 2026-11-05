import type { Report, ScheduleSlot } from '../types'
import { reportItemIds } from './reportItems.ts'

/** Progres satu PIC: berapa tugas dijadwalkan, berapa sudah dikerjakan. */
export interface PicCompletion {
  done: number
  total: number
  /** 0-4, jumlah kuadran terisi di indikator evaluasi. */
  quarters: number
}

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Progres tiap PIC: berapa slot yang ditugaskan kepadanya sudah ada laporannya.
 *
 * Dipakai kolom Evaluasi di Ringkasan. Ini ukuran beban kerja yang tuntas,
 * bukan penilaian mutu perbaikan — nilai 0-4 hanya memetakan rasio 0-100%
 * ke empat kuadran supaya bisa dibaca sekilas.
 *
 * Slot tanpa PIC dilewati: tidak ada yang bisa dinilai, dan menghitungnya
 * sebagai 0% akan menuduh pekerja yang tidak pernah ditugaskan.
 */
export function buildPicCompletion(
  slots: ScheduleSlot[],
  reports: Report[]
): Map<string, PicCompletion> {
  const doneKeys = new Set<string>()
  for (const r of reports) {
    if (!r.workerUid) continue
    for (const itemId of reportItemIds(r)) {
      doneKeys.add(`${r.workerUid}@${itemId}@${startOfDay(r.timestamp)}`)
    }
  }

  const totals = new Map<string, number>()
  const dones = new Map<string, number>()

  for (const s of slots) {
    if (!s.picUid) continue
    totals.set(s.picUid, (totals.get(s.picUid) ?? 0) + 1)

    const [ys, ms] = s.yearMonth.split('-')
    const dayStart = new Date(Number(ys), Number(ms) - 1, s.dayOfMonth).getTime()
    if (doneKeys.has(`${s.picUid}@${s.itemId}@${dayStart}`)) {
      dones.set(s.picUid, (dones.get(s.picUid) ?? 0) + 1)
    }
  }

  const result = new Map<string, PicCompletion>()
  for (const [uid, total] of totals) {
    const done = dones.get(uid) ?? 0
    const ratio = total === 0 ? 0 : done / total
    const quarters = Math.min(4, Math.max(0, Math.round(ratio * 4)))
    result.set(uid, { done, total, quarters })
  }
  return result
}