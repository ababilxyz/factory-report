/** Satu kelompok laporan untuk satu hari kalender lokal. */
export interface DayGroup<T> {
  /** Kunci stabil untuk React: awal hari dalam epoch ms. */
  key: number
  /** Label panjang Indonesia, mis. "Minggu, 25 Oktober 2026". */
  label: string
  items: T[]
}

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Kelompokkan laporan per hari. Cermin `HistoryScreen.kt`: laporan diurutkan
 * dari yang terbaru, lalu dipotong setiap kali tanggal kalender berubah.
 */
export function groupByDay<T extends { timestamp: number }>(rows: T[]): DayGroup<T>[] {
  const sorted = [...rows].sort((a, b) => b.timestamp - a.timestamp)
  const buckets = new Map<number, DayGroup<T>>()
  for (const row of sorted) {
    const key = startOfDay(row.timestamp)
    const existing = buckets.get(key)
    if (existing) {
      existing.items.push(row)
      continue
    }
    buckets.set(key, {
      key,
      label: new Date(key).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      items: [row],
    })
  }
  return [...buckets.values()]
}
