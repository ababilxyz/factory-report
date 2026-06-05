// ==================
// User & Auth Types
// ==================
export type UserRole = 'admin' | 'worker'

export interface AppUser {
  uid: string
  email: string
  role: UserRole
  displayName: string
  createdAt: number
}

// ==================
// Area Types
// ==================
export interface Area {
  areaId: string
  name: string
  encryptedQrPayload: string | null  // Items have QR payloads now
  allowedLat: number
  allowedLng: number
  radiusMeters: number
}

export interface AreaWithItems {
  areaId: string
  name: string
  encryptedQrPayload: string | null
  allowedLat: number
  allowedLng: number
  radiusMeters: number
  items: Item[]
}

// ==================
// QR Payload (decrypted)
// ==================
export interface QrPayload {
  areaId: string  // Now represents itemId, but kept for backward compatibility
  nonce: string
  // Legacy fields - ignored but accepted for backward compatibility
  timestamp?: number
}

// ==================
// Report Types
// ==================
export type ReportStatus = 'pending' | 'in_progress' | 'resolved'

export interface CheckItem {
    id: string  // Format: "label(code)" e.g., "identitas(D-1.01)"
    label: string
    code: string  // Check-specific code suffix
    options: string[]  // Dynamic options like "Baik", "Rusak", "Sesuai", "Tidak Sesuai"
    selectedOption?: string  // The selected option label
    order?: number  // Display order
    // Before/Issue evidence (for negative/neutral)
    issuePhotoUrl?: string  // Photo for issue (negative/neutral option)
    issueDescription?: string  // Description for issue
    issuePhotoFile?: File  // Photo file for upload (transient)
    issuePhotoPreview?: string  // Photo preview URL (transient)
    // After/Fix evidence (for after the issue is fixed)
    afterPhotoUrl?: string  // Photo showing the fix/cleanup
    afterPhotoFile?: File  // After photo file for upload (transient)
    afterPhotoPreview?: string  // After photo preview URL (transient)
    afterDescription?: string  // Description of action taken to fix the issue
}

export interface Item {
    id: string  // Format: "itemid" e.g., "item-1"
    areaId?: string
    code: string
    name: string
    order: number
    checks: CheckItem[]
    examplePhotoUrl?: string  // Optional example photo URL for reference
}

export interface AreaItems {
    [areaId: string]: {
        [itemId: string]: Item
    }
}

export interface ChecklistData {
    areaId: string
    items: Record<string, Item>  // keyed by itemid
    hasIssues: boolean
}

export interface Report {
    reportId: string
    areaId: string
    areaName?: string
    workerUid: string
    workerName?: string
    status: ReportStatus
    gpsLat?: number
    gpsLng?: number
    timestamp: number
    deviceId: string
    sessionId: string
    checklistData?: ChecklistData  // New field for structured checklist
}

export interface CreateReportInput {
    areaId: string
    gpsLat?: number
    gpsLng?: number
    sessionId: string
    checklistData?: ChecklistData
}

// ==================
// Scanner State
// ==================
export type ScanState =
  | 'idle'
  | 'scanning'
  | 'decrypting'
  | 'verifying_location'
  | 'success'
  | 'error'

export interface ScanResult {
  areaId: string
  areaName: string
  sessionId: string
  gpsLat: number
  gpsLng: number
  examplePhotoUrl?: string  // Optional example photo from scanned item
}

export interface ScanError {
  code: 'DECRYPT_FAILED' | 'LOCATION_MISMATCH' | 'PERMISSION_DENIED' | 'CAMERA_ERROR' | 'AREA_NOT_FOUND'
  message: string
}

// ==================
// GPS Types
// ==================
export interface GpsCoordinates {
  lat: number
  lng: number
  accuracy: number
}