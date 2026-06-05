import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'
import type { AppUser, Area, Report, CreateReportInput, ReportStatus, Item } from '../types'
import { getDeviceFingerprint } from '../utils/deviceFingerprint'

// ==================
// Users
// ==================
export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('uid', uid)
    .single()

  if (error || !data) return null
  // Map snake_case to camelCase for compatibility with AppUser type
  return {
    uid: data.uid,
    email: data.email,
    role: data.role,
    displayName: data.display_name,
    createdAt: data.created_at
  } as AppUser
}

export async function createUserProfile(user: AppUser): Promise<void> {
  const { error } = await supabase
    .from('users')
    .upsert({
      uid: user.uid,
      email: user.email,
      role: user.role,
      display_name: user.displayName,
      created_at: user.createdAt
    })

  if (error) throw error
}

// ==================
// Areas
// ==================
export async function getArea(areaId: string): Promise<Area | null> {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('area_id', areaId)
    .single()

  if (error || !data) return null
  return {
    areaId: data.area_id,
    name: data.name,
    encryptedQrPayload: null, // No longer stored in areas table
    allowedLat: data.allowed_lat,
    allowedLng: data.allowed_lng,
    radiusMeters: data.radius_meters
  } as Area
}

export async function getAllAreas(): Promise<Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return (data || []).map((d: any) => ({
    areaId: d.area_id,
    name: d.name,
    encryptedQrPayload: null,
    allowedLat: d.allowed_lat,
    allowedLng: d.allowed_lng,
    radiusMeters: d.radius_meters
  }))
}

// ==================
// Items (for QR per item)
// ==================
export async function getItem(itemId: string): Promise<Item | null> {
  const { data, error } = await supabase
    .from('items')
    .select('item_id, area_id, code, name, encrypted_qr_payload, display_order, example_photo_url')
    .eq('item_id', itemId)
    .single()

  if (error || !data) return null
  return {
    id: data.item_id,
    areaId: data.area_id,
    code: data.code,
    name: data.name,
    order: data.display_order,
    checks: [], // Will be loaded separately via getChecksByItemId
    examplePhotoUrl: data.example_photo_url
  }
}

export async function getItemsByAreaId(areaId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('item_id, area_id, code, name, encrypted_qr_payload, display_order, example_photo_url')
    .eq('area_id', areaId)
    .order('display_order', { ascending: true })

  if (error) throw error
  return (data || []).map((d: any) => ({
    id: d.item_id,
    areaId: d.area_id,
    code: d.code,
    name: d.name,
    order: d.display_order,
    checks: [], // Will be loaded separately via getChecksByItemId
    examplePhotoUrl: d.example_photo_url
  }))
}

// ==================
// Checks (per item)
// ==================
export interface ItemCheck {
  id: string
  itemId: string
  checkLabel: string
  checkOptions: string[]
  displayOrder: number
}

export async function getChecksByItemId(itemId: string): Promise<ItemCheck[]> {
  const { data, error } = await supabase
    .from('item_checks')
    .select('id, item_id, check_label, check_options, display_order')
    .eq('item_id', itemId)
    .order('display_order', { ascending: true })

  if (error) throw error
  return (data || []).map((d: any) => ({
    id: d.id,
    itemId: d.item_id,
    checkLabel: d.check_label,
    checkOptions: d.check_options,
    displayOrder: d.display_order
  }))
}

// ==================
// Reports
// ==================
export async function createReport(
  input: CreateReportInput,
  workerUid: string,
): Promise<string> {
  const reportId = uuidv4()
  const deviceId = await getDeviceFingerprint()

  // Fetch item to get areaId for area name lookup
  const item = await getItem(input.areaId)
  const area = item ? await getArea(item.areaId || '') : null

  // Fetch worker profile to resolve display name for admin visibility
  const workerProfile = await getUserProfile(workerUid)

  // Store areaId in report (itemId is passed as areaId for backward compatibility)
  // We need to fetch the parent area for the actual area reference
  let actualAreaId = input.areaId
  if (item && item.areaId) {
    actualAreaId = item.areaId
  }

  const report: any = {
    report_id: reportId,
    area_id: actualAreaId,
    area_name: area?.name,
    worker_uid: workerUid,
    worker_name: workerProfile?.displayName || null,
    status: 'pending',
    gps_lat: input.gpsLat,
    gps_lng: input.gpsLng,
    timestamp: Date.now(),
    device_id: deviceId,
    session_id: input.sessionId
  }

  if (input.checklistData) report.checklist_data = input.checklistData

  const { error } = await supabase
    .from('reports')
    .insert(report)

  if (error) throw error
  return reportId
}


export async function getReports(
  statusFilter?: ReportStatus,
  limitCount = 50
): Promise<Report[]> {
  let query = supabase
    .from('reports')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limitCount)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []).map((d: any) => ({
    reportId: d.report_id,
    areaId: d.area_id,
    areaName: d.area_name,
    workerUid: d.worker_uid,
    workerName: d.worker_name,
    status: d.status,
    gpsLat: d.gps_lat,
    gpsLng: d.gps_lng,
    timestamp: d.timestamp,
    deviceId: d.device_id,
    sessionId: d.session_id,
    checklistData: d.checklist_data
  })) as Report[]
}

export async function getReportsByWorkerId(workerUid: string, limitCount = 50): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('worker_uid', workerUid)
    .order('timestamp', { ascending: false })
    .limit(limitCount)

  if (error) throw error
  return (data || []).map((d: any) => ({
    reportId: d.report_id,
    areaId: d.area_id,
    areaName: d.area_name,
    workerUid: d.worker_uid,
    workerName: d.worker_name,
    status: d.status,
    gpsLat: d.gps_lat,
    gpsLng: d.gps_lng,
    timestamp: d.timestamp,
    deviceId: d.device_id,
    sessionId: d.session_id,
    checklistData: d.checklist_data
  })) as Report[]
}

export async function updateReportStatus(reportId: string, status: ReportStatus): Promise<void> {
  console.log('[updateReportStatus] Attempting to update:', { reportId, status });
  const { error } = await supabase
    .from('reports')
    .update({ status, updated_at: Date.now() })
    .eq('report_id', reportId)

  if (error) {
    console.error('[updateReportStatus] Supabase error:', error);
    throw new Error(`Failed to update status: ${error.message} (code: ${error.code})`);
  }
  console.log('[updateReportStatus] Success for:', reportId);
}

export async function updateUserProfile(uid: string, updates: Partial<Omit<AppUser, 'createdAt' | 'uid'>>): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      display_name: updates.displayName,
      email: updates.email,
      updated_at: Date.now()
    })
    .eq('uid', uid)

  if (error) throw error
}