import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { encryptPayload } from './generate-qr.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const inputPath = path.join(__dirname, '../weekly_items_import_template.csv')
const outputPath = path.join(__dirname, '../weekly_items_import_ready.csv')

const content = readFileSync(inputPath, 'utf-8').trim()
const lines = content.split('\n')
const header = lines[0]

const outLines = [header]
for (let i = 1; i < lines.length; i++) {
  const line = lines[i]
  if (!line.trim()) continue
  const cols = line.split(',')
  // expected: area_id, area_name, item_code, item_name, encrypted_qr_payload
  const [areaId, areaName, itemCode, itemName, encrypted] = cols
  if (encrypted && encrypted.trim()) {
    outLines.push(line)
  } else {
    const generated = encryptPayload(itemCode.trim())
    const finalAreaId = areaId ? areaId.trim() : ''
    const finalAreaName = areaName ? areaName.trim() : ''
    outLines.push([finalAreaId, finalAreaName, itemCode.trim(), itemName.trim(), generated].join(','))
  }
}

writeFileSync(outputPath, outLines.join('\n') + '\n', 'utf-8')
console.log('Generated:', outputPath)
