import { useState, useRef, useCallback, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { decryptQrPayload, DecryptionError } from '../utils/encryption'
import { getCurrentPosition, haversineDistance } from '../utils/geolocation'
import { getItem, getArea, getWeeklyItem, getMonthlyItem } from '../lib/supabaseDb'
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
  const lastStartErrorRef = useRef<string | null>(null)

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2) {
          await scannerRef.current.stop()
        }
      } catch { /* ignore stop errors */ }
      try {
        scannerRef.current.clear()
      } catch { /* ignore clear errors */ }
      scannerRef.current = null
    }
  }, [])

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const startScanner = useCallback(async () => {
    if (startingRef.current) return
    startingRef.current = true
    lastStartErrorRef.current = null

    setScanState('scanning')
    setError(null)
    setResult(null)
    isProcessingRef.current = false

    try {
      await stopScanner()
      await wait(150)

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID)
      scannerRef.current = scanner

      let cameraId: string | undefined

      try {
        const cameras = await scanner.getCameras()
        const back = cameras.find((c) => (c.label || '').toLowerCase().includes('back') || (c.label || '').toLowerCase().includes('rear'))
        cameraId = back?.id || cameras[0]?.id
      } catch {
        cameraId = undefined
      }

      let cameraConstraint: { deviceId?: { exact: string } } | { facingMode: string } | undefined
      if (cameraId) {
        cameraConstraint = { deviceId: { exact: cameraId } }
      } else {
        cameraConstraint = { facingMode: 'environment' }
      }

      await scanner.start(
        cameraConstraint,
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
      lastStartErrorRef.current = msg

      let friendly = 'Could not start camera. Ensure no other app is using it.'
      if (/permission|not allowed|denied/i.test(msg)) {
        friendly = 'Camera permission denied. Please allow camera access in your browser settings.'
      } else if (/https|secure context|only secure origins/i.test(msg)) {
        friendly = 'Camera requires HTTPS. Please use https:// to access this app when deployed.'
      } else if (/not found|no camera|camera/i.test(msg)) {
        friendly = 'No camera found on this device.'
      }

      setError({ code: 'CAMERA_ERROR', message: friendly })
      setScanState('error')
    } finally {
      startingRef.current = false
    }
  }, [stopScanner])

  async function processQrCode(rawText: string) {
    try {
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

      setStatusMessage('Loading item data...')

      const payloadReportType = (payload as any).reportType as 'daily' | 'weekly' | 'monthly' | undefined

      let item: any = null
      let reportType: 'daily' | 'weekly' | 'monthly' = 'daily'

      if (payloadReportType === 'weekly') {
        const weeklyItem = await getWeeklyItem(payload.areaId)
        if (weeklyItem) {
          item = weeklyItem
          reportType = 'weekly'
        }
      }

      if (!item && payloadReportType === 'monthly') {
        const monthlyItem = await getMonthlyItem(payload.areaId)
        if (monthlyItem) {
          item = monthlyItem
          reportType = 'monthly'
        }
      }

      if (!item) {
        item = await getItem(payload.areaId)
        reportType = 'daily'
      }

      if (!item) {
        throw { code: 'AREA_NOT_FOUND', message: 'Item not found in the system. Contact your supervisor.' }
      }

      setStatusMessage('Loading area data...')
      const area = await getArea(item.areaId || payload.areaId)
      if (!area) {
        throw { code: 'AREA_NOT_FOUND', message: 'Area not found in the system. Contact your supervisor.' }
      }

      setScanState('verifying_location')
      setStatusMessage('Verifying your location...')

      let coords
      try {
        coords = await getCurrentPosition(12000)
      } catch (e: unknown) {
        const err = e as { code: string; message: string }
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

      setScanState('success')
      setResult({
        areaId: payload.areaId,
        areaName: area.name,
        sessionId: payload.nonce,
        gpsLat: coords.lat,
        gpsLng: coords.lng,
        examplePhotoUrl: item.examplePhotoUrl,
        reportType,
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
    startingRef.current = false
    lastStartErrorRef.current = null
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
    SCANNER_ELEMENT_ID,
  }
}
