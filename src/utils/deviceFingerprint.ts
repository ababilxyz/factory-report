/**
 * Generate a semi-stable device fingerprint from available browser signals.
 * Not perfect (can be spoofed) but adds a layer to fraud detection.
 * Does NOT use any third-party fingerprinting libraries.
 */
export async function getDeviceFingerprint(): Promise<string> {
  const signals = [
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency?.toString() ?? '',
    screen.width + 'x' + screen.height,
    screen.colorDepth?.toString() ?? '',
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform ?? ''
  ]

  const combined = signals.join('|')

  // Use SubtleCrypto for hashing (available in all modern browsers)
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(combined)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  } catch {
    // Fallback: simple hash without SubtleCrypto
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).padStart(16, '0')
  }
}
