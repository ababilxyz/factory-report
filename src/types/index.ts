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
  encryptedQrPayload: string | null
  allowedLat: number
  allowedLng: number
  radiusMeters: number
  displayOrder?: number
}

// ==================
// QR Payload (decrypted)
// ==================
export interface QrPayload {
  areaId: string  // Now represents itemId, but kept for backward compatibility
  nonce: string
  reportType?: 'daily' | 'weekly' | 'monthly'
  // Legacy fields - ignored but accepted for backward compatibility
  timestamp?: number
}

// ==================
// Report Types
// ==================
// ==================
// Item Check Types (DB)
// ==================

/** Matches the `item_checks` / `weekly_item_checks` / `monthly_item_checks` table rows */
export interface ItemCheck {
  id: string
  itemId: string
  checkLabel: string
  checkOptions: string[]
  displayOrder: number
}

// ==================
// Report Types
// ==================
export type ReportStatus = 'pending' | 'in_progress' | 'resolved'
export type ReportType = 'daily' | 'weekly' | 'monthly'

/** Check item in the UI form (selected option, photo previews, etc.) */
export interface CheckItem {
    id: string
    label: string
    code: string
    options: string[]
    selectedOption?: string
    order?: number
    issuePhotoPreview?: string
    afterPhotoPreview?: string
    issuePhotoFile?: File
    afterPhotoFile?: File
    issuePhotoUrl?: string
    afterPhotoUrl?: string
    issueDescription?: string
    afterDescription?: string
}

export interface Item {
    id: string
    areaId?: string
    code: string
    name: string
    order: number
    checks: CheckItem[]
    examplePhotoUrl?: string
    reportType?: ReportType
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
    beforePhotoUrl?: string
    afterPhotoUrl?: string
    description: string
    status: ReportStatus
    gpsLat?: number
    gpsLng?: number
    timestamp: number
    deviceId: string
    sessionId: string
    checklistData?: ChecklistData  // New field for structured checklist
    reportType?: ReportType
    weekStart?: number
    monthStart?: number
    updatedAt?: number
}

export interface CreateReportInput {
    areaId: string
    beforePhotoFile?: File
    afterPhotoFile?: File
    description: string
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
  reportType?: 'daily' | 'weekly' | 'monthly'
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

// ==================
// 4S Schedule Types
// ==================
export interface ScheduleSlot {
  scheduleId: string
  yearMonth: string
  dayOfMonth: number
  itemId: string
  itemCode: string
  itemName: string
  areaId: string
  reportType: ReportType
  durationMinutes: number
  picNameRaw: string
  picUid?: string | null
  source?: 'excel' | 'manual'
}

export interface ParsedScheduleRow {
  itemCode: string
  itemName: string
  reportType: ReportType
  durationMinutes: number
  picRaw: string
  days: number[]
}
