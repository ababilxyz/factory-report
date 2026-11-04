import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPicCompletion } from './picCompletion.ts'

const nov = (day: number, hour = 9) => new Date(2026, 10, day, hour, 0, 0).getTime()

const slot = (id: string, itemId: string, day: number, picUid: string | null) => ({
  scheduleId: id,
  yearMonth: '2026-11',
  dayOfMonth: day,
  itemId,
  itemCode: 'D-1.04',
  itemName: 'Stamping',
  areaId: 'a1',
  reportType: 'daily' as const,
  durationMinutes: 10,
  picNameRaw: 'Aldi',
  picUid,
})

const report = (workerUid: string, itemId: string, ts: number) => ({
  reportId: `r-${workerUid}-${itemId}-${ts}`,
  areaId: 'a1',
  workerUid,
  workerName: 'Aldi',
  description: '',
  status: 'resolved' as const,
  timestamp: ts,
  deviceId: 'd',
  sessionId: 's',
  reportType: 'daily' as const,
  checklistData: {
    areaId: 'a1',
    hasIssues: false,
    items: { [itemId]: { id: itemId, code: 'D-1.04', name: 'Stamping', order: 0, checks: [] } },
  },
})

test('half the slots done fills two quarters', () => {
  const map = buildPicCompletion(
    [slot('s1', 'i1', 4, 'u1'), slot('s2', 'i1', 5, 'u1')] as any,
    [report('u1', 'i1', nov(4))] as any
  )
  assert.equal(map.get('u1')!.done, 1)
  assert.equal(map.get('u1')!.total, 2)
  assert.equal(map.get('u1')!.quarters, 2)
})

test('all slots done fills four quarters', () => {
  const map = buildPicCompletion(
    [slot('s1', 'i1', 4, 'u1'), slot('s2', 'i2', 4, 'u1')] as any,
    [report('u1', 'i1', nov(4)), report('u1', 'i2', nov(4))] as any
  )
  assert.equal(map.get('u1')!.quarters, 4)
})

test('a report by a different worker does not count', () => {
  const map = buildPicCompletion([slot('s1', 'i1', 4, 'u1')] as any, [report('u2', 'i1', nov(4))] as any)
  assert.equal(map.get('u1')!.done, 0)
  assert.equal(map.get('u1')!.quarters, 0)
})

test('a report on the wrong day does not count', () => {
  const map = buildPicCompletion([slot('s1', 'i1', 4, 'u1')] as any, [report('u1', 'i1', nov(9))] as any)
  assert.equal(map.get('u1')!.done, 0)
})

test('unassigned slots are ignored, not counted as zero progress', () => {
  const map = buildPicCompletion([slot('s1', 'i1', 4, null)] as any, [])
  assert.equal(map.size, 0)
})

test('quarters round to nearest, never out of 0..4', () => {
  const oneOfThree = buildPicCompletion(
    [slot('a', 'i1', 4, 'u1'), slot('b', 'i2', 4, 'u1'), slot('c', 'i3', 4, 'u1')] as any,
    [report('u1', 'i1', nov(4))] as any
  )
  assert.equal(oneOfThree.get('u1')!.quarters, 1)

  const twoOfThree = buildPicCompletion(
    [slot('a', 'i1', 4, 'u1'), slot('b', 'i2', 4, 'u1'), slot('c', 'i3', 4, 'u1')] as any,
    [report('u1', 'i1', nov(4)), report('u1', 'i2', nov(4))] as any
  )
  assert.equal(twoOfThree.get('u1')!.quarters, 3)
})