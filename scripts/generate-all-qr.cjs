const { createClient } = require('@supabase/supabase-js')
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs')
const path = require('path')
const CryptoJS = require('crypto-js')

function loadEnvVar(name) {
  const envPath = path.join(__dirname, '../.env')
  if (!existsSync(envPath)) {
    throw new Error('.env not found')
  }
  const content = readFileSync(envPath, 'utf-8')
  const match = content.match(new RegExp(`^${name}=(.+)$`, 'm'))
  const value = match?.[1]?.trim()
  if (!value) throw new Error(`${name} is missing in .env`)
  return value
}

const SUPABASE_URL = loadEnvVar('VITE_SUPABASE_URL')
const SUPABASE_ANON_KEY = loadEnvVar('VITE_SUPABASE_ANON_KEY')
const SECRET_KEY = loadEnvVar('VITE_QR_SECRET_KEY')

if ((SECRET_KEY?.length ?? 0) < 32) {
  throw new Error('VITE_QR_SECRET_KEY must be at least 32 characters')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function encryptPayload(itemId, reportType = 'daily') {
  const payload = { areaId: itemId, nonce: itemId, reportType }
  const json = JSON.stringify(payload)
  return CryptoJS.AES.encrypt(json, SECRET_KEY).toString()
}

async function fetchAll(table, mark) {
  const rows = []
  const pageSize = 1000
  let from = 0
  let to = pageSize - 1

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('item_id, area_id, code, name')
      .range(from, to)

    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message ?? error}`)
    }

    const page = data ?? []
    if (page.length === 0) break

    for (const row of page) {
      rows.push({
        id: row.item_id,
        area_id: row.area_id,
        code: row.code,
        name: row.name,
        mark,
      })
    }

    if (page.length < pageSize) break
    from = to + 1
    to = from + pageSize - 1
  }

  return rows
}

function buildRows(dailyRows, weeklyRows, monthlyRows) {
  const all = [...dailyRows, ...weeklyRows, ...monthlyRows]
  if (all.length === 0) {
    throw new Error('No items found in tables.')
  }

  const outDir = path.join(__dirname, '../exports')
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true })
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  const csvRows = ['mark,area_id,item_id,code,name,encrypted_qr_payload']
  for (const row of all) {
    csvRows.push([
      row.mark,
      row.area_id,
      row.id,
      row.code,
      row.name,
      encryptPayload(row.id, row.mark),
    ].join(','))
  }
  const csvPath = path.join(outDir, `all-qr-${timestamp}.csv`)
  writeFileSync(csvPath, `${csvRows.join('\n')}\n`, 'utf-8')

  const jsonPath = path.join(outDir, `all-qr-${timestamp}.json`)
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary: { daily: dailyRows.length, weekly: weeklyRows.length, monthly: monthlyRows.length, total: all.length },
        items: dailyRows.map((r) => ({
          mark: 'daily',
          id: r.id,
          areaId: r.area_id,
          code: r.code,
          name: r.name,
          encryptedQrPayload: encryptPayload(r.id, 'daily'),
        })),
        weeklyItems: weeklyRows.map((r) => ({
          mark: 'weekly',
          id: r.id,
          areaId: r.area_id,
          code: r.code,
          name: r.name,
          encryptedQrPayload: encryptPayload(r.id, 'weekly'),
        })),
        monthlyItems: monthlyRows.map((r) => ({
          mark: 'monthly',
          id: r.id,
          areaId: r.area_id,
          code: r.code,
          name: r.name,
          encryptedQrPayload: encryptPayload(r.id, 'monthly'),
        })),
      },
      null,
      2,
    ),
    'utf-8',
  )

  return { all, csvPath, jsonPath }
}

async function main() {
  const dailyRows = await fetchAll('items', 'daily')
  const weeklyRows = await fetchAll('weekly_items', 'weekly')
  const monthlyRows = await fetchAll('monthly_items', 'monthly')

  console.log(`Loaded rows — daily: ${dailyRows.length}, weekly: ${weeklyRows.length}, monthly: ${monthlyRows.length}`)

  const { all, csvPath, jsonPath } = buildRows(dailyRows, weeklyRows, monthlyRows)

  console.log(`Exported ${all.length} QR records.`)
  console.log(`CSV: ${csvPath}`)
  console.log(`JSON: ${jsonPath}`)
}

(async () => {
  try {
    await main()
  } catch (err) {
    console.error('Failed to generate QR exports:', err)
    process.exit(1)
  }
})()
