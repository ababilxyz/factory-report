import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScheduleGrid, daysInMonth } from './scheduleGrid.ts'

const slot = (id: string, itemId: string, day: number, code = 'D-1.04', name = 'Stamping') => ({
  scheduleId: id,
  yearMonth: '2026-11',
  dayOfMonth: day,
  itemId,
  itemCode: code,
  itemName: name,
  areaId: 'a1',
  reportType: 'daily' as const,
  durationMinutes: 10,
  picNameRaw: 'Aldi',
})

const report = (itemId: string, ts: number, status: 'pending' | 'resolved', hasIssues = false) => ({
  reportId: 'r-' + itemId + ts,
  areaId: 'a1',
  workerUid: 'u1',
  workerName: 'Aldi',
  description: '',
  status,
  timestamp: ts,
  deviceId: 'd1',
  sessionId: 's1',
  reportType: 'daily' as const,
  checklistData: {
    areaId: 'a1',
    hasIssues,
    items: { [itemId]: { id: itemId, code: 'D-1.04', name: 'Stamping', order: 0, checks: [] } },
  },
})

const nov = (day: number, hour = 9) => new Date(2026, 10, day, hour, 0, 0).getTime()

test('cell is empty when the slot has no report', () => {
  const grid = buildScheduleGrid([slot('s1', 'i1', 4)] as any, [], 30)
  const cell = grid.days[3].cells[0]
  assert.equal(cell.state, 'empty')
  assert.equal(cell.report, null)
})

test('cell is done when a report for that item exists on that day', () => {
  const grid = buildScheduleGrid([slot('s1', 'i1', 4)] as any, [report('i1', nov(4), 'resolved')] as any, 30)
  assert.equal(grid.days[3].cells[0].state, 'done')
})

test('cell is issue when the report still has an open problem', () => {
  const grid = buildScheduleGrid(
    [slot('s1', 'i1', 4)] as any,
    [report('i1', nov(4), 'pending', true)] as any,
    30
  )
  assert.equal(grid.days[3].cells[0].state, 'issue')
})

test('a report on the wrong day does not fill the dot', () => {
  const grid = buildScheduleGrid([slot('s1', 'i1', 4)] as any, [report('i1', nov(5), 'resolved')] as any, 30)
  assert.equal(grid.days[3].cells[0].state, 'empty')
})

test('rows are one per machine, columns one per scheduled day', () => {
  const grid = buildScheduleGrid(
    [
      slot('s1', 'i1', 4),
      slot('s2', 'i1', 6),
      slot('s3', 'i2', 4, 'D-2.01', 'Kompresor'),
    ] as any,
    [],
    30
  )
  assert.deepEqual(grid.rows.map((r) => r.itemId).sort(), ['i1', 'i2'])
  assert.deepEqual(grid.days.filter((d) => d.cells.length > 0).map((d) => d.day), [4, 6])
})

test('daysInMonth handles february', () => {
  assert.equal(daysInMonth('2026-02'), 28)
  assert.equal(daysInMonth('2028-02'), 29)
})