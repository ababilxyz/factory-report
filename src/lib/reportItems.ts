import type { Report } from '../types'

/** Semua itemId di satu laporan, bukan hanya item pertama. */
export function reportItemIds(report: Report): string[] {
  const items = report.checklistData?.items
  if (!items) return []
  return Object.values(items)
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id))
}
