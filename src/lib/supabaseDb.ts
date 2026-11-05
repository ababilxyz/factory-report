import { supabase } from './supabase'

import type { AppUser, Area, Report, CreateReportInput, ReportStatus, Item, ReportType, ItemCheck, ScheduleSlot } from '../types'
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
  return (data || []).map(mapReport)
}

/** Semua laporan di satu bulan (yyyy-mm), tanpa limit dan tanpa filter status. */
export async function getReportsForMonth(yearMonth: string): Promise<Report[]> {
  const [y, m] = yearMonth.split('-').map(Number)
  const start = new Date(y, m - 1, 1).getTime()
  const end = new Date(y, m, 1).getTime()
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .gte('timestamp', start)
    .lt('timestamp', end)
    .order('timestamp', { ascending: false })
  if (error) throw error
  return (data || []).map(mapReport)
}

function mapReport(d: any): Report {
  return {
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
    checklistData: d.checklist_data,
    updatedAt: d.updated_at,
  } as Report
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

// ==================
// 4S Schedules
// ==================
export async function getScheduleForDay(
  workerUid: string,
  yearMonth: string,
  dayOfMonth: number
): Promise<ScheduleSlot[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('year_month', yearMonth)
    .eq('day_of_month', dayOfMonth)
    .eq('pic_uid', workerUid)
    .order('duration_minutes', { ascending: true })

  if (error) throw error
  return (data || []).map(mapScheduleSlot)
}

export async function getScheduleForMonth(
  yearMonth: string,
  areaId?: string
): Promise<ScheduleSlot[]> {
  let query = supabase
    .from('schedules')
    .select('*')
    .eq('year_month', yearMonth)
    .order('day_of_month', { ascending: true })
    .order('item_code', { ascending: true })

  if (areaId) {
    query = query.eq('area_id', areaId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapScheduleSlot)
}

export async function replaceMonthSchedule(
  yearMonth: string,
  slots: Array<Omit<ScheduleSlot, 'scheduleId'>>
): Promise<number> {
  const { error: delError } = await supabase
    .from('schedules')
    .delete()
    .eq('year_month', yearMonth)

  if (delError) throw delError
  if (slots.length === 0) return 0

  const payload = slots.map((s) => ({
    year_month: s.yearMonth,
    day_of_month: s.dayOfMonth,
    item_id: s.itemId,
    item_code: s.itemCode,
    item_name: s.itemName,
    area_id: s.areaId,
    report_type: s.reportType,
    duration_minutes: s.durationMinutes,
    pic_name_raw: s.picNameRaw,
    pic_uid: s.picUid ?? null,
    source: s.source || 'excel'
  }))

  // Chunk insert to stay safely below payload limits
  for (let i = 0; i < payload.length; i += 200) {
    const chunk = payload.slice(i, i + 200)
    const { error: insError } = await supabase.from('schedules').insert(chunk)
    if (insError) throw insError
  }
  return slots.length
}

export async function updateSchedulePic(
  scheduleId: string,
  picNameRaw: string,
  picUid: string | null
): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({
      pic_name_raw: picNameRaw,
      pic_uid: picUid,
      updated_at: new Date().toISOString()
    })
    .eq('schedule_id', scheduleId)

  if (error) throw error
}

export async function deleteScheduleSlot(scheduleId: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('schedule_id', scheduleId)

  if (error) throw error
}

export async function addScheduleSlot(
  slot: Omit<ScheduleSlot, 'scheduleId'>
): Promise<void> {
  // Idempotent replace if slot exists for same day & item
  await supabase
    .from('schedules')
    .delete()
    .eq('year_month', slot.yearMonth)
    .eq('day_of_month', slot.dayOfMonth)
    .eq('item_id', slot.itemId)

  const { error } = await supabase.from('schedules').insert({
    year_month: slot.yearMonth,
    day_of_month: slot.dayOfMonth,
    item_id: slot.itemId,
    item_code: slot.itemCode,
    item_name: slot.itemName,
    area_id: slot.areaId,
    report_type: slot.reportType,
    duration_minutes: slot.durationMinutes,
    pic_name_raw: slot.picNameRaw,
    pic_uid: slot.picUid ?? null,
    source: 'manual'
  })

  if (error) throw error
}

export async function getAssignableWorkers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'worker')
    .order('display_name', { ascending: true })

  if (error) throw error
  return (data || []).map((d: any) => ({
    uid: d.uid,
    email: d.email,
    role: d.role,
    displayName: d.display_name,
    createdAt: d.created_at
  }))
}

export async function getAllMasterItems(): Promise<Item[]> {
  const [daily, weekly, monthly] = await Promise.all([
    supabase.from('items').select('item_id, area_id, code, name, display_order, example_photo_url'),
    supabase.from('weekly_items').select('item_id, area_id, code, name, display_order, example_photo_url'),
    supabase.from('monthly_items').select('item_id, area_id, code, name, display_order, example_photo_url')
  ])
  const out: Item[] = []
  const add = (rows: any[] | null, type: ReportType) => {
    for (const d of rows || []) {
      out.push({
        id: d.item_id,
        areaId: d.area_id,
        code: d.code,
        name: d.name,
        order: d.display_order ?? 0,
        checks: [],
        examplePhotoUrl: d.example_photo_url,
        reportType: type
      })
    }
  }
  add(daily.data, 'daily')
  add(weekly.data, 'weekly')
  add(monthly.data, 'monthly')
  return out
}

function mapScheduleSlot(d: any): ScheduleSlot {
  return {
    scheduleId: d.schedule_id,
    yearMonth: d.year_month,
    dayOfMonth: d.day_of_month,
    itemId: d.item_id,
    itemCode: d.item_code,
    itemName: d.item_name,
    areaId: d.area_id,
    reportType: d.report_type,
    durationMinutes: d.duration_minutes ?? 10,
    picNameRaw: d.pic_name_raw,
    picUid: d.pic_uid,
    source: d.source || 'excel'
  }
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
