import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRepairRows } from './repairRows.ts'

const t = (d: number) => new Date(2026, 10, d, 9, 0, 0).getTime()

const check = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  label: 'Tekanan oli',
  code: 'K-01',
  options: ['Normal', 'Perhatian', 'Masalah'],
  selectedOption: 'Masalah',
  issueDescription: 'Tekanan oli rantai transmisi rendah',
  afterDescription: 'Rantai dilumasi ulang, tekanan normal',
  ...over,
})

const report = (over: Record<string, unknown> = {}) => ({
  reportId: 'r1',
  areaId: 'a1',
  areaName: 'Zone 1',
  workerUid: 'u1',
  workerName: 'Aldi',
  description: '',
  status: 'resolved',
  timestamp: t(15),
  deviceId: 'd',
  sessionId: 's',
  reportType: 'daily',
  checklistData: {
    areaId: 'a1',
    hasIssues: true,
    items: {
      i1: { id: 'i1', code: 'D-1.05', name: 'Conveyor Belt Jalur B', order: 0, checks: [check()] },
    },
  },
  ...over,
})

test('one row per finding, not per report', () => {
  const rows = buildRepairRows([report()] as any)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].finding, 'Tekanan oli rantai transmisi rendah')
  assert.equal(rows[0].repair, 'Rantai dilumasi ulang, tekanan normal')
})

test('several findings in one report produce several rows', () => {
  const two = report({
    checklistData: {
      areaId: 'a1',
      hasIssues: true,
      items: {
        i1: {
          id: 'i1',
          code: 'D-1.05',
          name: 'Conveyor',
          order: 0,
          checks: [check(), check({ id: 'c2', issueDescription: 'Belt retak' })],
        },
      },
    },
  })
  assert.equal(buildRepairRows([two] as any).length, 2)
})

test('checks without an issue description produce no row', () => {
  const normal = report({
    checklistData: {
      areaId: 'a1',
      hasIssues: false,
      items: {
        i1: {
          id: 'i1',
          code: 'D-1.05',
          name: 'Conveyor',
          order: 0,
          checks: [check({ issueDescription: '' })],
        },
      },
    },
  })
  assert.equal(buildRepairRows([normal] as any).length, 0)
})

test('machine and pic identity travel with the row', () => {
  const rows = buildRepairRows([report()] as any)
  assert.equal(rows[0].machineCode, 'D-1.05')
  assert.equal(rows[0].machineName, 'Conveyor Belt Jalur B')
  assert.equal(rows[0].pic, 'Aldi')
  assert.equal(rows[0].picUid, 'u1')
})

test('missing repair text becomes a dash, not an empty cell', () => {
  const rows = buildRepairRows([
    report({
      checklistData: {
        areaId: 'a1',
        hasIssues: true,
        items: {
          i1: {
            id: 'i1',
            code: 'D-1.05',
            name: 'Conveyor',
            order: 0,
            checks: [check({ afterDescription: '' })],
          },
        },
      },
    }),
  ] as any)
  assert.equal(rows[0].repair, '—')
})

test('rows are newest finding first', () => {
  const rows = buildRepairRows([
    report({ timestamp: t(10) }),
    report({ timestamp: t(20), reportId: 'r2' }),
  ] as any)
  assert.equal(rows[0].foundAt, t(20))
})