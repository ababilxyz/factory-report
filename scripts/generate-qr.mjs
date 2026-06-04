import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

let secretKey
try {
  const envContent = readFileSync(path.join(__dirname, '../.env'), 'utf-8')
  const match = envContent.match(/VITE_QR_SECRET_KEY=(.+)/)
  secretKey = match?.[1]?.trim()
} catch {
  console.error('Cannot read .env')
  process.exit(1)
}

const CryptoJS = require('crypto-js')
const { v4: uuidv4 } = require('uuid')

const AREAS = [
  { areaId: 'LxTigDXUecm2SAQusEPc', name: 'Nama Area 1' },
]

function encryptPayload(areaId) {
   const payload = {
     areaId
   }
   const json = JSON.stringify(payload)
   // Generate deterministic salt from areaId to ensure same QR code each time
   const saltHex = CryptoJS.SHA256(areaId).toString(CryptoJS.enc.Hex).substr(0, 16) // 8 bytes salt
   const salt = CryptoJS.enc.Hex.parse(saltHex)
   const encrypted = CryptoJS.AES.encrypt(json, secretKey, { salt: salt })
   return encrypted.toString()
 }

AREAS.forEach(area => {
  console.log('\n Area: ' + area.name + ' (' + area.areaId + ')')
  console.log('QR Content: ' + encryptPayload(area.areaId))
})