import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reportItemIds } from './reportItems.ts'
import type { Report } from '../types'

const base = { reportId: 'r1', areaId: 'a1', description: '', status: 'pending', deviceId: '', sessionId: '', timestamp: 0 } as unknown as Report

test('laporan dengan dua item mengembalikan dua id', () => {
  const r = {
    ...base,
    checklistData: {
      areaId: 'a1',
      hasIssues: false,
      items: {
        x: { id: 'item-1', code: 'D-1', name: 'A', order: 0, checks: [] },
        y: { id: 'item-2', code: 'D-2', name: 'B', order: 1, checks: [] },
      },
    },
  } as unknown as Report
  assert.deepEqual(reportItemIds(r).sort(), ['item-1', 'item-2'])
})

test('laporan tanpa checklistData mengembalikan array kosong', () => {
  assert.deepEqual(reportItemIds(base), [])
})
