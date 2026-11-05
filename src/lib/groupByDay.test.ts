import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupByDay } from './groupByDay.ts'

const DAY = 86_400_000
const base = new Date(2026, 9, 25, 9, 0, 0).getTime() // 25 Oct 2026, local

test('groups reports into day buckets in order', () => {
  const rows = [
    { reportId: 'a', timestamp: base },
    { reportId: 'b', timestamp: base + 3_600_000 },
    { reportId: 'c', timestamp: base - DAY },
  ]
  const groups = groupByDay(rows)
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].items.map((r) => r.reportId), ['b', 'a'])
  assert.deepEqual(groups[1].items.map((r) => r.reportId), ['c'])
})

test('label uses long Indonesian date', () => {
  const groups = groupByDay([{ reportId: 'a', timestamp: base }])
  assert.ok(groups[0].label.includes('25') && groups[0].label.toLowerCase().includes('okt'))
})