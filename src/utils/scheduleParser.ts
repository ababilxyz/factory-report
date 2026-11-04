import * as XLSX from 'xlsx'
import type { AppUser, ParsedScheduleRow, ReportType } from '../types'

const ALIASES: Record<string, string> = {
  syahminan: 'syaminan',
  rommy: 'romy',
  ryan: 'riyan',
  saifulf: 'saipul',
  subhany: 'subhan',
  wsidik: 'sidik',
  rikis: 'rici',
  riky: 'rici',
  untungp: 'untung'
}

export function parseScheduleWorkbook(data: ArrayBuffer): ParsedScheduleRow[] {
  const workbook = XLSX.read(data, { type: 'array' })
  const rows: ParsedScheduleRow[] = []

  for (const name of workbook.SheetNames) {
    if (!/^SCHEDULE/i.test(name)) continue
    const sheet = workbook.Sheets[name]
    if (!sheet || !sheet['!ref']) continue

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: true,
      defval: ''
    })

    // Data starts on Excel row 13 (index 12)
    for (let r = 12; r < matrix.length; r++) {
      const row = matrix[r] || []
      const rawCode = String(row[7] || '').trim()
      const code = normalizeScheduleCode(rawCode)
      if (!code) continue

      const days: number[] = []
      for (let day = 1; day <= 31; day++) {
        const cell = row[26 + day - 1]
        if (String(cell).trim().toUpperCase() === 'O') days.push(day)
      }
      if (days.length === 0) continue

      const durationRaw = Number(row[18])
      const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : 10

      rows.push({
        itemCode: code,
        itemName: String(row[10] || '').trim(),
        reportType: reportTypeOf(code),
        durationMinutes: duration,
        picRaw: String(row[22] || '').trim(),
        days
      })
    }
  }

  if (rows.length === 0) {
    throw new Error('No schedule rows found. Ensure the workbook has a sheet named SCHEDULE 4S.')
  }
  return rows
}

export async function parseScheduleFile(file: File): Promise<ParsedScheduleRow[]> {
  return parseScheduleWorkbook(await file.arrayBuffer())
}

export function normalizeScheduleCode(raw: string): string | null {
  const match = /^([DWM])-(\d+)-(\d+)$/i.exec(raw.trim())
  if (!match) return null
  const [, prefix, zone, number] = match
  return `${prefix.toUpperCase()}-${zone}.${number}`
}

function reportTypeOf(code: string): ReportType {
  const prefix = code[0]?.toUpperCase()
  if (prefix === 'W') return 'weekly'
  if (prefix === 'M') return 'monthly'
  return 'daily'
}

export function normalizePicName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function matchPicName(raw: string, workers: AppUser[]): AppUser | null {
  const target = normalizePicName(raw)
  if (!target || workers.length === 0) return null

  const direct = workers.find((w) => normalizePicName(w.displayName) === target)
  if (direct) return direct

  const aliasTarget = ALIASES[target]
  const alias = workers.find((w) => normalizePicName(w.displayName) === aliasTarget)
  if (alias) return alias

  const scored = workers
    .map((worker) => {
      const normalized = normalizePicName(worker.displayName)
      return { worker, distance: levenshtein(target, normalized) }
    })
    .sort((a, b) => a.distance - b.distance)

  const best = scored[0]
  const second = scored[1]
  if (best && best.distance <= 2 && (!second || best.distance < second.distance)) {
    return best.worker
  }
  return null
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length]
}
