import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://vkgmkxtcqpeouecsseab.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZ21reHRjcXBlb3VlY3NzZWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MDY1MTUsImV4cCI6MjA5NTk4MjUxNX0.sX9zcR8EdDTK_KnS0B5SiElY69FpYlcPCV7cIoxX3OM'

let secretKey
try {
  const envContent = readFileSync(path.join(__dirname, '../.env'), 'utf-8')
  const match = envContent.match(/VITE_QR_SECRET_KEY=(.+)/)
  secretKey = match?.[1]?.trim()
} catch {
  console.error('Cannot read .env')
  process.exit(1)
}

if (!secretKey || secretKey.length < 32) {
  console.error('[Security] VITE_QR_SECRET_KEY is missing or too short.')
  process.exit(1)
}

const CryptoJS = require('crypto-js')

function encryptPayload(itemId) {
  const payload = {
    areaId: itemId,  // Matches app's encryptQrPayload
    nonce: itemId    // Matches app's encryptQrPayload
  }
  const json = JSON.stringify(payload)
  const encrypted = CryptoJS.AES.encrypt(json, secretKey).toString()
  return encrypted
}

async function fetchAll(supabaseUrl, supabaseKey, query) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${query}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.json()
}

async function getAreas() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/areas?select=area_id,name`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function getItemsByAreaId(areaId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/items?area_id=eq.${encodeURIComponent(areaId)}&select=item_id,code,name,display_order`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function main() {
  console.log('Fetching areas from Supabase...\n')
  const areas = await getAreas()

  if (!areas || areas.length === 0) {
    console.log('No areas found.')
    return
  }

  for (const area of areas) {
    console.log(`Area: ${area.name} (${area.area_id})\n`)

    const items = await getItemsByAreaId(area.area_id)

    if (!items || items.length === 0) {
      console.log('  No items in this area.\n')
      continue
    }

    for (const item of items) {
      const qrContent = encryptPayload(item.item_id)
      console.log(`  Item: ${item.name} (${item.item_id})`)
      console.log(`    Code: ${item.code}`)
      console.log(`    QR Content (copy this):`)
      console.log(`    ${qrContent}\n`)
    }
    console.log('---')
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
