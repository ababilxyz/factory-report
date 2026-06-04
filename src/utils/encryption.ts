import CryptoJS from 'crypto-js'
import type { QrPayload } from '../types'

const SECRET_KEY = import.meta.env.VITE_QR_SECRET_KEY as string

if (!SECRET_KEY || SECRET_KEY.length < 32) {
  console.error('[Security] VITE_QR_SECRET_KEY is missing or too short. QR encryption will fail.')
}

/**
 * Encrypt a QR payload using AES-256.
 * Generates reusable QR codes per item (itemId = itemId for same value).
 */
export function encryptQrPayload(itemId: string): string {
  // Deterministic nonce (reusable) - can be regenerated from itemId
  const payload: QrPayload = {
    areaId: itemId,
    nonce: itemId
  }
  const json = JSON.stringify(payload)
  const encrypted = CryptoJS.AES.encrypt(json, SECRET_KEY).toString()
  return encrypted
}

/**
 * Decrypt and validate a QR code string.
 * Returns the payload or throws a typed error.
 */
export function decryptQrPayload(encryptedString: string): QrPayload {
  // Trim whitespace that may be captured during scanning
  const cleanInput = encryptedString?.trim()
  if (!cleanInput) {
    throw new DecryptionError('DECRYPT_FAILED', 'No QR code content provided.')
  }

  let decrypted: string
  try {
    const bytes = CryptoJS.AES.decrypt(cleanInput, SECRET_KEY)
    decrypted = bytes.toString(CryptoJS.enc.Utf8)
    if (!decrypted) throw new Error('Empty decryption result')
  } catch {
    throw new DecryptionError('DECRYPT_FAILED', 'QR code is invalid or tampered.')
  }

  let payload: QrPayload
  try {
    const parsed = JSON.parse(decrypted) as Partial<QrPayload>
    // Validate we have the required fields
    if (!parsed.areaId) {
      throw new Error('Missing areaId')
    }
    // Use existing nonce or fallback for backward compatibility
    payload = {
      areaId: parsed.areaId,
      nonce: parsed.nonce || decrypted
    }
  } catch (parseError) {
    // Log for debugging
    console.error('[QR] Parse error:', parseError, 'decrypted:', decrypted)
    throw new DecryptionError('DECRYPT_FAILED', 'QR payload is malformed.')
  }

  return payload
}

export class DecryptionError extends Error {
  constructor(
    public readonly code: 'DECRYPT_FAILED',
    message: string
  ) {
    super(message)
    this.name = 'DecryptionError'
  }
}
