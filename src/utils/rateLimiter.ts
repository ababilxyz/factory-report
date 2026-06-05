const STORAGE_KEY_PREFIX = 'factory_report_rate_limit_';
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

function getStoredTimestamps(key: string): number[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as number[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((ts): ts is number => typeof ts === 'number' && Number.isFinite(ts));
  } catch {
    return [];
  }
}

function persistTimestamps(key: string, timestamps: number[]) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, JSON.stringify(timestamps));
  } catch {
    // ignore storage quota or privacy mode errors
  }
}

export function checkRateLimit(
  key: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  const timestamps = getStoredTimestamps(key).filter((ts) => now - ts < windowMs);

  if (timestamps.length >= maxAttempts) {
    const oldest = timestamps[timestamps.length - 1] ?? now;
    const retryAfterMs = Math.max(windowMs - (now - oldest), 0);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining: maxAttempts - timestamps.length, retryAfterMs: 0 };
}

export function recordAttempt(key: string) {
  const now = Date.now();
  const timestamps = getStoredTimestamps(key).filter((ts) => now - ts < DEFAULT_WINDOW_MS);
  timestamps.push(now);
  persistTimestamps(key, timestamps);
}

export function clearRateLimitRecord(key: string) {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
  } catch {
    // ignore
  }
}
