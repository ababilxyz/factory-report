import type { GpsCoordinates } from '../types'

/**
 * Calculate the distance in meters between two GPS coordinates
 * using the Haversine formula.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Get current GPS coordinates with a timeout.
 * Throws a typed error if unavailable or denied.
 */
export function getCurrentPosition(timeoutMs = 10000): Promise<GpsCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationError('PERMISSION_DENIED', 'Geolocation is not supported by this device.'))
      return
    }

    const timer = setTimeout(() => {
      reject(new GeolocationError('TIMEOUT', 'GPS timed out. Please ensure location services are enabled.'))
    }, timeoutMs)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        })
      },
      (err) => {
        clearTimeout(timer)
        if (err.code === err.PERMISSION_DENIED) {
          reject(new GeolocationError('PERMISSION_DENIED', 'Location permission denied. Please enable GPS in your browser settings.'))
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new GeolocationError('UNAVAILABLE', 'GPS signal unavailable. Move to an open area and retry.'))
        } else {
          reject(new GeolocationError('TIMEOUT', 'GPS timed out. Please retry.'))
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    )
  })
}

export class GeolocationError extends Error {
  constructor(
    public readonly code: 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'TIMEOUT',
    message: string
  ) {
    super(message)
    this.name = 'GeolocationError'
  }
}
