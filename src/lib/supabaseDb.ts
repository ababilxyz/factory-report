import { supabase } from './supabase'

import type { AppUser, Area, Report, CreateReportInput, ReportStatus, Item, ReportType, ItemCheck } from '../types'
import { uploadImage } from './storage'
import { compressImage } from '../utils/imageUtils'
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
    .select('area_id, name, allowed_lat, allowed_lng, radius_meters, display_order')
    .eq('area_id', areaId)
    .single()

  if (error || !data) return null
  return {
    areaId: data.area_id,
    name: data.name,
    encryptedQrPayload: null,
    allowedLat: data.allowed_lat,
    allowedLng: data.allowed_lng,
    radiusMeters: data.radius_meters,
    displayOrder: data.display_order
  } as Area
}

export async function getAllAreas(): Promise<Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('area_id, name, allowed_lat, allowed_lng, radius_meters, display_order')
    .order('display_order', { ascending: true })

  if (error) throw error
  return (data || []).map((d: any) => ({
    areaId: d.area_id,
    name: d.name,
    encryptedQrPayload: null,
    allowedLat: d.allowed_lat,
    allowedLng: d.allowed_lng,
    radiusMeters: d.radius_meters,
    displayOrder: d.display_order
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
  onProgress?: (percent: number) => void
): Promise<string> {
  const reportId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const deviceId = await getDeviceFingerprint()

  // Fetch item to get areaId for area name lookup
  const item = await getItem(input.areaId)
  const area = item ? await getArea(item.areaId || '') : null

  // Compress and upload images (optional)
  let beforePhotoUrl: string | undefined
  let afterPhotoUrl: string | undefined

  // Track total progress for both photos
  let totalProgress = 0

  if (input.beforePhotoFile) {
    const compressed = await compressImage(input.beforePhotoFile)
    const result = await uploadImage(compressed, (percent) => {
      totalProgress = Math.round(percent * 0.5)
      if (onProgress) onProgress(totalProgress)
    })
    beforePhotoUrl = result.url
  }

  if (input.afterPhotoFile) {
    const compressed = await compressImage(input.afterPhotoFile)
    const result = await uploadImage(compressed, (percent) => {
      totalProgress = 50 + Math.round(percent * 0.5)
      if (onProgress) onProgress(totalProgress)
    })
    afterPhotoUrl = result.url
  }

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
    worker_name: (await getUserProfile(workerUid))?.displayName || null,
    description: input.description,
    status: 'pending',
    gps_lat: input.gpsLat,
    gps_lng: input.gpsLng,
    timestamp: Date.now(),
    device_id: deviceId,
    session_id: input.sessionId
  }

  if (beforePhotoUrl) report.before_photo_url = beforePhotoUrl
  if (afterPhotoUrl) report.after_photo_url = afterPhotoUrl
  if (input.checklistData) report.checklist_data = input.checklistData

  const { error } = await supabase
    .from('reports')
    .insert(report)

  if (error) throw error
  return reportId
}

export async function getReports(
  statusFilter?: ReportStatus,
  limitCount = 50,
  reportType?: ReportType
): Promise<Report[]> {
  let query = supabase
    .from('reports')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limitCount)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  if (reportType) {
    query = query.eq('report_type', reportType)
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []).map((d: any) => ({
    reportId: d.report_id,
    areaId: d.area_id,
    areaName: d.area_name,
    workerUid: d.worker_uid,
    workerName: d.worker_name,
    beforePhotoUrl: d.before_photo_url,
    afterPhotoUrl: d.after_photo_url,
    description: d.description,
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
    beforePhotoUrl: d.before_photo_url,
    afterPhotoUrl: d.after_photo_url,
    description: d.description,
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
  const { error } = await supabase
    .from('reports')
    .update({ status, updated_at: Date.now() })
    .eq('report_id', reportId)

  if (error) throw error
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

// ==================
// Weekly Items & Checks
// ==================
export async function getWeeklyItemsByAreaId(areaId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('weekly_items')
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
    checks: [],
    examplePhotoUrl: d.example_photo_url,
    reportType: 'weekly'
  }))
}

export async function getWeeklyItem(itemId: string): Promise<Item | null> {
  const { data, error } = await supabase
    .from('weekly_items')
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
    checks: [],
    examplePhotoUrl: data.example_photo_url,
    reportType: 'weekly'
  }
}

export async function getWeeklyChecksByItemId(itemId: string): Promise<ItemCheck[]> {
  const { data, error } = await supabase
    .from('weekly_item_checks')
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
// Monthly Items & Checks
// ==================

export async function getMonthlyItemsByAreaId(areaId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('monthly_items')
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
    checks: [],
    examplePhotoUrl: d.example_photo_url,
    reportType: 'monthly'
  }))
}

export async function getMonthlyItem(itemId: string): Promise<Item | null> {
  const { data, error } = await supabase
    .from('monthly_items')
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
    checks: [],
    examplePhotoUrl: data.example_photo_url,
    reportType: 'monthly'
  }
}

export async function getMonthlyChecksByItemId(itemId: string): Promise<ItemCheck[]> {
  const { data, error } = await supabase
    .from('monthly_item_checks')
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
// Monthly Reports
// ==================

export async function createMonthlyReport(
  input: CreateReportInput & { reportType?: ReportType; monthStart?: number },
  workerUid: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const reportId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const deviceId = await getDeviceFingerprint()

  const item = await getMonthlyItem(input.areaId)
  const area = item ? await getArea(item.areaId || '') : null

  let beforePhotoUrl: string | undefined
  let afterPhotoUrl: string | undefined
  let totalProgress = 0

  if (input.beforePhotoFile) {
    const compressed = await compressImage(input.beforePhotoFile)
    const result = await uploadImage(compressed, (percent) => {
      totalProgress = Math.round(percent * 0.5)
      if (onProgress) onProgress(totalProgress)
    })
    beforePhotoUrl = result.url
  }

  if (input.afterPhotoFile) {
    const compressed = await compressImage(input.afterPhotoFile)
    const result = await uploadImage(compressed, (percent) => {
      totalProgress = 50 + Math.round(percent * 0.5)
      if (onProgress) onProgress(totalProgress)
    })
    afterPhotoUrl = result.url
  }

  let actualAreaId = input.areaId
  if (item && item.areaId) {
    actualAreaId = item.areaId
  }

  const report: any = {
    report_id: reportId,
    area_id: actualAreaId,
    area_name: area?.name,
    worker_uid: workerUid,
    worker_name: (await getUserProfile(workerUid))?.displayName || null,
    description: input.description,
    status: 'pending',
    gps_lat: input.gpsLat,
    gps_lng: input.gpsLng,
    timestamp: Date.now(),
    device_id: deviceId,
    session_id: input.sessionId,
    report_type: 'monthly',
    month_start: input.monthStart || null
  }

  if (beforePhotoUrl) report.before_photo_url = beforePhotoUrl
  if (afterPhotoUrl) report.after_photo_url = afterPhotoUrl
  if (input.checklistData) report.checklist_data = input.checklistData

  const { error } = await supabase
    .from('reports')
    .insert(report)

  if (error) throw error
  return reportId
}

export async function createWeeklyReport(
  input: CreateReportInput & { reportType?: ReportType; weekStart?: number },
  workerUid: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const reportId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const deviceId = await getDeviceFingerprint()

  const item = await getWeeklyItem(input.areaId)
  const area = item ? await getArea(item.areaId || '') : null

  let beforePhotoUrl: string | undefined
  let afterPhotoUrl: string | undefined
  let totalProgress = 0

  if (input.beforePhotoFile) {
    const compressed = await compressImage(input.beforePhotoFile)
    const result = await uploadImage(compressed, (percent) => {
      totalProgress = Math.round(percent * 0.5)
      if (onProgress) onProgress(totalProgress)
    })
    beforePhotoUrl = result.url
  }

  if (input.afterPhotoFile) {
    const compressed = await compressImage(input.afterPhotoFile)
    const result = await uploadImage(compressed, (percent) => {
      totalProgress = 50 + Math.round(percent * 0.5)
      if (onProgress) onProgress(totalProgress)
    })
    afterPhotoUrl = result.url
  }

  let actualAreaId = input.areaId
  if (item && item.areaId) {
    actualAreaId = item.areaId
  }

  const report: any = {
    report_id: reportId,
    area_id: actualAreaId,
    area_name: area?.name,
    worker_uid: workerUid,
    worker_name: (await getUserProfile(workerUid))?.displayName || null,
    description: input.description,
    status: 'pending',
    gps_lat: input.gpsLat,
    gps_lng: input.gpsLng,
    timestamp: Date.now(),
    device_id: deviceId,
    session_id: input.sessionId,
    report_type: 'weekly',
    week_start: input.weekStart || null,
    month_start: null
  }

  if (beforePhotoUrl) report.before_photo_url = beforePhotoUrl
  if (afterPhotoUrl) report.after_photo_url = afterPhotoUrl
  if (input.checklistData) report.checklist_data = input.checklistData

  const { error } = await supabase
    .from('reports')
    .insert(report)

  if (error) throw error
  return reportId
}

export async function getWeeklyReports(weekStart: number): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('report_type', 'weekly')
    .eq('week_start', weekStart)
    .order('timestamp', { ascending: false })

  if (error) throw error
  return (data || []).map((d: any) => ({
    reportId: d.report_id,
    areaId: d.area_id,
    areaName: d.area_name,
    workerUid: d.worker_uid,
    workerName: d.worker_name,
    beforePhotoUrl: d.before_photo_url,
    afterPhotoUrl: d.after_photo_url,
    description: d.description,
    status: d.status,
    gpsLat: d.gps_lat,
    gpsLng: d.gps_lng,
    timestamp: d.timestamp,
    deviceId: d.device_id,
    sessionId: d.session_id,
    reportType: d.report_type,
    weekStart: d.week_start,
    checklistData: d.checklist_data
  })) as Report[]
}

export async function getWeeklyReportsByWorkerId(workerUid: string, weekStart: number): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('worker_uid', workerUid)
    .eq('report_type', 'weekly')
    .eq('week_start', weekStart)
    .order('timestamp', { ascending: false })

  if (error) throw error
  return (data || []).map((d: any) => ({
    reportId: d.report_id,
    areaId: d.area_id,
    areaName: d.area_name,
    workerUid: d.worker_uid,
    workerName: d.worker_name,
    beforePhotoUrl: d.before_photo_url,
    afterPhotoUrl: d.after_photo_url,
    description: d.description,
    status: d.status,
    gpsLat: d.gps_lat,
    gpsLng: d.gps_lng,
    timestamp: d.timestamp,
    deviceId: d.device_id,
    sessionId: d.session_id,
    reportType: d.report_type,
    weekStart: d.week_start,
    monthStart: d.month_start,
    checklistData: d.checklist_data
  })) as Report[]
}

export async function getMonthlyReports(monthStart: number): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('report_type', 'monthly')
    .eq('month_start', monthStart)
    .order('timestamp', { ascending: false })

  if (error) throw error
  return (data || []).map((d: any) => ({
    reportId: d.report_id,
    areaId: d.area_id,
    areaName: d.area_name,
    workerUid: d.worker_uid,
    workerName: d.worker_name,
    beforePhotoUrl: d.before_photo_url,
    afterPhotoUrl: d.after_photo_url,
    description: d.description,
    status: d.status,
    gpsLat: d.gps_lat,
    gpsLng: d.gps_lng,
    timestamp: d.timestamp,
    deviceId: d.device_id,
    sessionId: d.session_id,
    reportType: d.report_type,
    monthStart: d.month_start,
    checklistData: d.checklist_data
  })) as Report[]
}

export async function getMonthlyReportsByWorkerId(workerUid: string, monthStart: number): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('worker_uid', workerUid)
    .eq('report_type', 'monthly')
    .eq('month_start', monthStart)
    .order('timestamp', { ascending: false })

  if (error) throw error
  return (data || []).map((d: any) => ({
    reportId: d.report_id,
    areaId: d.area_id,
    areaName: d.area_name,
    workerUid: d.worker_uid,
    workerName: d.worker_name,
    beforePhotoUrl: d.before_photo_url,
    afterPhotoUrl: d.after_photo_url,
    description: d.description,
    status: d.status,
    gpsLat: d.gps_lat,
    gpsLng: d.gps_lng,
    timestamp: d.timestamp,
    deviceId: d.device_id,
    sessionId: d.session_id,
    reportType: d.report_type,
    monthStart: d.month_start,
    checklistData: d.checklist_data
  })) as Report[]
}