/**
 * Satu sumber label+warna status, disamakan dengan Compose
 * (`HistoryScreen.kt`, `AdminDashboardScreen.kt`).
 *
 * Masalah hanya aktif selama laporan masih `pending`. Tanpa cek status, kartu
 * laporan yang sudah ditutup tetap tampil "MASALAH" selamanya.
 */
export type StatusTone = { label: string; className: string; isOpenIssue: boolean }

const NEUTRAL = "bg-white/5 text-[#A8AEBC] border-white/15"
const DONE = "bg-white/5 text-[#F4F5F7] border-white/15"
const ISSUE = "bg-[#C4623F]/15 text-[#E08462] border-[#C4623F]/60"

export function reportStatusTone(status: string, hasIssues?: boolean): StatusTone {
  const isOpenIssue = status === "pending" && !!hasIssues
  if (isOpenIssue) return { label: "PERLU DIPERBAIKI", className: ISSUE, isOpenIssue: true }
  if (status === "resolved") return { label: "SELESAI", className: DONE, isOpenIssue: false }
  if (status === "in_progress") return { label: "DIKERJAKAN", className: NEUTRAL, isOpenIssue: false }
  return { label: "MENUNGGU", className: NEUTRAL, isOpenIssue: false }
}

/** Baris ringkasan rincian: normal / masalah aktif / masalah sudah ditangani. */
export function reportSummaryLabel(hasIssues: boolean, isOpenIssue: boolean, checks: number) {
  const head = `${checks} Pemeriksaan \u2022 `
  if (isOpenIssue) return head + "Ada Masalah"
  if (hasIssues) return head + "Masalah sudah ditangani"
  return head + "Semua Normal"
}
