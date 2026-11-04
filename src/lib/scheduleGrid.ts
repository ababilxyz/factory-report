import type { Report, ScheduleSlot } from '../types'

export type CellState = 'empty' | 'done' | 'issue'

export interface GridCell {
  scheduleId: string
  itemId: string
  itemCode: string
  itemName: string
  state: CellState
  report: Report | null
}

export interface GridRow {
  itemId: string
  itemCode: string
  itemName: string
  areaId: string
  total: number
  done: number
  issue: number
}

export interface GridDay {
  day: number
  cells: GridCell[]
}

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function reportItemId(report: Report): string | null {
  const items = report.checklistData?.items
  if (!items) return null
  return Object.values(items)[0]?.id ?? null
}

export function daysInMonth(yearMonth: string): number {
  const [ys, ms] = yearMonth.split('-')
  return new Date(Number(ys), Number(ms), 0).getDate()
}

export function buildScheduleGrid(
  slots: ScheduleSlot[],
  reports: Report[],
  total: number
): { rows: GridRow[]; days: GridDay[] } {
  const byItemDay = new Map<string, Report>()
  for (const r of reports) {
    const itemId = reportItemId(r)
    if (!itemId) continue
    const key = `${itemId}@${startOfDay(r.timestamp)}`
    const prev = byItemDay.get(key)
    if (!prev || r.timestamp > prev.timestamp) byItemDay.set(key, r)
  }

  const [ys, ms] = (slots[0]?.yearMonth ?? '1970-01').split('-')
  const dayStarts: number[] = []
  for (let day = 1; day <= total; day += 1) {
    dayStarts[day] = new Date(Number(ys), Number(ms) - 1, day).getTime()
  }

  const rowMap = new Map<string, GridRow>()
  const days: GridDay[] = Array.from({ length: total }, (_, i) => ({ day: i + 1, cells: [] }))

  for (const s of slots) {
    const row = rowMap.get(s.itemId) ?? {
      itemId: s.itemId,
      itemCode: s.itemCode,
      itemName: s.itemName,
      areaId: s.areaId,
      total: 0,
      done: 0,
      issue: 0,
    }
    row.total += 1
    rowMap.set(s.itemId, row)

    const dayStart = dayStarts[s.dayOfMonth]
    if (dayStart === undefined) continue

    const report = byItemDay.get(`${s.itemId}@${dayStart}`) ?? null
    const state: CellState = !report
      ? 'empty'
      : report.status === 'pending' && report.checklistData?.hasIssues === true
        ? 'issue'
        : 'done'

    if (state === 'done') row.done += 1
    if (state === 'issue') row.issue += 1

    days[s.dayOfMonth - 1].cells.push({
      scheduleId: s.scheduleId,
      itemId: s.itemId,
      itemCode: s.itemCode,
      itemName: s.itemName,
      state,
      report,
    })
  }

  return {
    rows: [...rowMap.values()].sort((a, b) => a.itemCode.localeCompare(b.itemCode)),
    days,
  }
}