import { useState, useRef, useCallback, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { decryptQrPayload, DecryptionError } from '../utils/encryption'
import { getCurrentPosition, haversineDistance } from '../utils/geolocation'
import { getItem, getWeeklyItem, getArea } from '../lib/supabaseDb'
import type { ScanState, ScanResult, ScanError } from '../types'

const SCANNER_ELEMENT_ID = 'qr-reader'

export function useQrScanner() {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<ScanError | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isProcessingRef = useRef(false)
  const startingRef = useRef(false)

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2) {
          await scannerRef.current.stop()
        }
      } catch { /* ignore stop errors */ }
      scannerRef.current = null
    }
  }, [])

  const startScanner = useCallback(async () => {
    if (startingRef.current) return
    startingRef.current = true

    setScanState('scanning')
    setError(null)
    setResult(null)
    isProcessingRef.current = false

    try {
      await stopScanner()
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        async (decodedText) => {
          if (isProcessingRef.current) return
          isProcessingRef.current = true

          await stopScanner()
          await processQrCode(decodedText)
        },
        () => { /* quiet scan failures */ }
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('permission')) {
        setError({ code: 'PERMISSION_DENIED', message: 'Camera permission denied. Please allow camera access in your browser settings.' })
        setScanState('error')
      } else {
        setError({ code: 'CAMERA_ERROR', message: 'Could not start camera. Ensure no other app is using it.' })
        setScanState('error')
      }
    } finally {
      startingRef.current = false
    }
  }, [stopScanner])

  async function processQrCode(rawText: string) {
    try {
      // Step 1: Decrypt
      setScanState('decrypting')
      setStatusMessage('Verifying QR code...')

      let payload
      try {
        payload = decryptQrPayload(rawText)
      } catch (e) {
        if (e instanceof DecryptionError) {
          throw { code: e.code, message: e.message }
        }
        throw { code: 'DECRYPT_FAILED', message: 'Invalid QR code.' }
      }

      // Step 2: Load item from database (try daily, then weekly)
      setStatusMessage('Loading item data...')
      console.log('[QR Scanner] Looking up itemId:', payload.areaId)
      let item = await getItem(payload.areaId)
      let reportType: 'daily' | 'weekly' = 'daily'
      if (!item) {
        console.log('[QR Scanner] Not found in daily items, trying weekly_items...')
        item = await getWeeklyItem(payload.areaId)
        reportType = 'weekly'
        console.log('[QR Scanner] weekly_items result:', item)
      } else {
        console.log('[QR Scanner] Found in daily items:', item)
      }
      if (!item) {
        console.error('[QR Scanner] Item NOT found in either table:', payload.areaId)
        throw { code: 'AREA_NOT_FOUND', message: `Item "${payload.areaId}" not found in the system. Contact your supervisor.` }
      }

      // Step 3: Get area for GPS validation
      setStatusMessage('Loading area data...')
      const area = await getArea(item.areaId || payload.areaId)
      if (!area) {
        throw { code: 'AREA_NOT_FOUND', message: 'Area not found in the system. Contact your supervisor.' }
      }

      // Step 4: Verify GPS location
      setScanState('verifying_location')
      setStatusMessage('Verifying your location...')

      let coords
      try {
        coords = await getCurrentPosition(12000)
      } catch (e: unknown) {
        const err = e as { code: string; message: string }
        // Map GeolocationError codes to ScanError codes
        if (err.code === 'UNAVAILABLE' || err.code === 'TIMEOUT') {
          throw { code: 'PERMISSION_DENIED', message: err.message }
        }
        throw { code: (err.code as ScanError['code']) || 'PERMISSION_DENIED', message: err.message }
      }

      const distance = haversineDistance(coords.lat, coords.lng, area.allowedLat, area.allowedLng)
      if (distance > area.radiusMeters) {
        throw {
          code: 'LOCATION_MISMATCH',
          message: `You are ${Math.round(distance)}m away from "${area.name}". Must be within ${area.radiusMeters}m.`
        }
      }

      // All checks passed - return area info with item context
      setScanState('success')
      setResult({
        areaId: payload.areaId, // itemId is passed for checklist lookup
        areaName: area.name,
        sessionId: payload.nonce,
        gpsLat: coords.lat,
        gpsLng: coords.lng,
        examplePhotoUrl: item.examplePhotoUrl,
        reportType
      })

    } catch (e: unknown) {
      const err = e as ScanError
      setScanState('error')
      setError({ code: err.code ?? 'DECRYPT_FAILED', message: err.message ?? 'An unknown error occurred.' })
      isProcessingRef.current = false
    }
  }

  const reset = useCallback(async () => {
    await stopScanner()
    setScanState('idle')
    setError(null)
    setResult(null)
    setStatusMessage('')
    isProcessingRef.current = false
  }, [stopScanner])

  // Cleanup on unmount
  useEffect(() => {
    return () => { void stopScanner() }
  }, [stopScanner])

  return {
    scanState,
    result,
    error,
    statusMessage,
    startScanner,
    stopScanner,
    reset,
    SCANNER_ELEMENT_ID
  }
}