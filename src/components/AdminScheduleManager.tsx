import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getScheduleForMonth,
  replaceMonthSchedule,
  updateSchedulePic,
  deleteScheduleSlot,
  addScheduleSlot,
  getAssignableWorkers,
  getAllMasterItems
} from '../lib/supabaseDb'
import { parseScheduleFile, matchPicName } from '../utils/scheduleParser'
import type { Area, ScheduleSlot, AppUser, Item } from '../types'

interface Props {
  areas: Area[]
}

function currentYearMonth(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function shiftMonth(ym: string, delta: number): string {
  const [yStr, mStr] = ym.split('-')
  const d = new Date(Number(yStr), Number(mStr) - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AdminScheduleManager({ areas }: Props) {
  const queryClient = useQueryClient()
  const [yearMonth, setYearMonth] = useState(currentYearMonth)
  const [areaFilter, setAreaFilter] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleSlot | null>(null)

  // Data queries
  const { data: slots = [], isLoading: isLoadingSlots } = useQuery({
    queryKey: ['schedules', yearMonth, areaFilter],
    queryFn: () => getScheduleForMonth(yearMonth, areaFilter || undefined)
  })

  const { data: workers = [] } = useQuery({
    queryKey: ['assignableWorkers'],
    queryFn: getAssignableWorkers
  })

  const { data: items = [] } = useQuery({
    queryKey: ['allMasterItems'],
    queryFn: getAllMasterItems
  })

  // Mutations
  const updatePicMut = useMutation({
    mutationFn: ({ id, name, uid }: { id: string; name: string; uid: string | null }) =>
      updateSchedulePic(id, name, uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
    }
  })

  const deleteSlotMut = useMutation({
    mutationFn: (id: string) => deleteScheduleSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setDeleteTarget(null)
    }
  })

  const addSlotMut = useMutation({
    mutationFn: addScheduleSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setShowAddModal(false)
    }
  })

  // Group slots by day
  const grouped = useMemo(() => {
    const map: Record<number, ScheduleSlot[]> = {}
    for (const slot of slots) {
      if (!map[slot.dayOfMonth]) map[slot.dayOfMonth] = []
      map[slot.dayOfMonth].push(slot)
    }
    return Object.entries(map)
      .map(([day, list]) => ({ day: Number(day), list }))
      .sort((a, b) => a.day - b.day)
  }, [slots])

  // Upload handler
  async function handleFileUpload(file: File) {
    setIsUploading(true)
    setStatusMessage(null)
    try {
      const parsed = await parseScheduleFile(file)
      const itemsByCode = new Map(items.map((i) => [i.code.toUpperCase(), i]))

      let missingItemCount = 0
      let unassignedPicCount = 0
      const uniqueSlots = new Map<string, Omit<ScheduleSlot, 'scheduleId'>>()

      for (const row of parsed) {
        const item = itemsByCode.get(row.itemCode.toUpperCase())
        if (!item || !item.areaId) {
          missingItemCount++
          continue
        }
        const matched = matchPicName(row.picRaw, workers)
        if (!matched) unassignedPicCount++

        for (const day of row.days) {
          const key = `${yearMonth}-${day}-${item.id}`
          uniqueSlots.set(key, {
            yearMonth,
            dayOfMonth: day,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            areaId: item.areaId,
            reportType: item.reportType || 'daily',
            durationMinutes: row.durationMinutes,
            picNameRaw: row.picRaw || 'Belum ditugaskan',
            picUid: matched?.uid || null,
            source: 'excel'
          })
        }
      }

      const list = Array.from(uniqueSlots.values())
      const inserted = await replaceMonthSchedule(yearMonth, list)
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setStatusMessage(
        `Jadwal ${yearMonth} berhasil diunggah: ${inserted} tugas tersimpan (${missingItemCount} item tidak ditemukan, ${unassignedPicCount} PIC belum cocok).`
      )
    } catch (err: any) {
      setStatusMessage(`Gagal mengunggah jadwal: ${err.message || String(err)}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Month + Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYearMonth((prev) => shiftMonth(prev, -1))}
            className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold"
          >
            ‹ Bulan Sebelumnya
          </button>
          <span className="text-base font-bold text-[#F4F5F7]">{yearMonth}</span>
          <button
            onClick={() => setYearMonth((prev) => shiftMonth(prev, 1))}
            className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold"
          >
            Bulan Berikutnya ›
          </button>
          <span className="text-xs text-[#A8AEBC] ml-2">({slots.length} tugas)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
          >
            + Tambah Manual
          </button>

          <label className="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F4F5F7] hover:bg-[#A8AEBC] text-white cursor-pointer transition-colors">
            <span>{isUploading ? 'Mengunggah...' : 'Unggah Excel (.xlsx)'}</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isUploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFileUpload(f)
                e.target.value = ''
              }}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-[#F4F5F7]/40 bg-[#F4F5F7]/10 p-3 text-xs text-[#F4F5F7] flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-[#F4F5F7] hover:text-white">✕</button>
        </div>
      )}

      {/* Area filter chips */}
      {areas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setAreaFilter(null)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              areaFilter === null
                ? 'bg-white text-[#121417] border-white font-semibold'
                : 'bg-white/5 text-[#DCDDE1] border-white/10 hover:bg-white/10'
            }`}
          >
            Semua Area
          </button>
          {areas.map((a) => (
            <button
              key={a.areaId}
              onClick={() => setAreaFilter(a.areaId)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                areaFilter === a.areaId
                  ? 'bg-white text-[#121417] border-white font-semibold'
                  : 'bg-white/5 text-[#DCDDE1] border-white/10 hover:bg-white/10'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Schedule Table / List */}
      {isLoadingSlots ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-[#F4F5F7] animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-[#A8AEBC]">
          Belum ada jadwal untuk {yearMonth}. Unggah file Excel 4S atau tambah manual.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ day, list }) => (
            <div key={day} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5">
                <span className="font-bold text-[#F4F5F7]">Hari ke-{day}</span>
                <span className="text-[#A8AEBC]">
                  {list.length} tugas • {list.reduce((acc, s) => acc + s.durationMinutes, 0)} menit
                </span>
              </div>
              <div className="space-y-1.5">
                {list.map((slot) => (
                  <div
                    key={slot.scheduleId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#18191C] px-3 py-2 text-xs border border-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold px-1.5 py-0.5 rounded bg-white/5 text-[#F4F5F7]">
                        {slot.itemCode}
                      </span>
                      <span className="text-[#F4F5F7]">{slot.itemName}</span>
                      <span className="text-[#A8AEBC] text-[10px]">
                        ({slot.durationMinutes} mnt • {slot.reportType})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={slot.picUid || ''}
                        onChange={(e) => {
                          const uid = e.target.value || null
                          const found = workers.find((w) => w.uid === uid)
                          updatePicMut.mutate({
                            id: slot.scheduleId,
                            name: found ? found.displayName : 'Belum ditugaskan',
                            uid
                          })
                        }}
                        className={`text-xs rounded px-2 py-1 bg-white/5 border ${
                          slot.picUid
                            ? 'border-white/20 text-[#F4F5F7]'
                            : 'border-[#C4623F]/60 text-[#E08462]'
                        }`}
                      >
                        <option value="" className="bg-[#222429] text-[#DCDDE1]">
                          Tanpa PIC ({slot.picNameRaw || 'Unassigned'})
                        </option>
                        {workers.map((w) => (
                          <option key={w.uid} value={w.uid} className="bg-[#222429] text-[#F4F5F7]">
                            {w.displayName}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => setDeleteTarget(slot)}
                        className="text-[#8E929B] hover:text-[#E08462] px-1 py-0.5"
                        title="Hapus slot jadwal"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#222429] p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Hapus Jadwal</h3>
            <p className="text-xs text-[#DCDDE1]">
              Hapus tugas <strong className="text-[#F4F5F7]">{deleteTarget.itemCode}</strong> pada hari ke-
              {deleteTarget.dayOfMonth}?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs text-[#A8AEBC] hover:text-white"
              >
                Batal
              </button>
              <button
                onClick={() => deleteSlotMut.mutate(deleteTarget.scheduleId)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#C4623F] hover:bg-[#C4623F] text-white"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {showAddModal && (
        <AddSlotModal
          yearMonth={yearMonth}
          items={items}
          workers={workers}
          onClose={() => setShowAddModal(false)}
          onAdd={(slot) => addSlotMut.mutate(slot)}
        />
      )}
    </div>
  )
}

interface AddModalProps {
  yearMonth: string
  items: Item[]
  workers: AppUser[]
  onClose: () => void
  onAdd: (slot: Omit<ScheduleSlot, 'scheduleId'>) => void
}

function AddSlotModal({ yearMonth, items, workers, onClose, onAdd }: AddModalProps) {
  const [day, setDay] = useState(1)
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '')
  const [selectedPicUid, setSelectedPicUid] = useState<string>('')
  const [duration, setDuration] = useState(10)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const item = items.find((i) => i.id === selectedItemId)
    if (!item || !item.areaId) return
    const worker = workers.find((w) => w.uid === selectedPicUid)

    onAdd({
      yearMonth,
      dayOfMonth: day,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      areaId: item.areaId,
      reportType: item.reportType || 'daily',
      durationMinutes: duration,
      picNameRaw: worker ? worker.displayName : 'Belum ditugaskan',
      picUid: worker?.uid || null,
      source: 'manual'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-[#222429] p-5 space-y-3"
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <h3 className="text-sm font-bold text-white">Tambah Jadwal Manual</h3>
          <button type="button" onClick={onClose} className="text-[#A8AEBC] hover:text-white">✕</button>
        </div>

        <div>
          <label className="text-[11px] text-[#A8AEBC] block mb-1">Hari ke- (1..31)</label>
          <input
            type="number"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-white"
            required
          />
        </div>

        <div>
          <label className="text-[11px] text-[#A8AEBC] block mb-1">Mesin / Titik Kanban</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-white"
            required
          >
            {items.map((it) => (
              <option key={it.id} value={it.id} className="bg-[#222429]">
                {it.code} • {it.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-[#A8AEBC] block mb-1">PIC Worker (Opsional)</label>
          <select
            value={selectedPicUid}
            onChange={(e) => setSelectedPicUid(e.target.value)}
            className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-white"
          >
            <option value="" className="bg-[#222429]">Tanpa PIC</option>
            {workers.map((w) => (
              <option key={w.uid} value={w.uid} className="bg-[#222429]">
                {w.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-[#A8AEBC] block mb-1">Durasi (Menit)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-[#A8AEBC] hover:text-white">
            Batal
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F4F5F7] hover:bg-[#A8AEBC] text-white"
          >
            Simpan
          </button>
        </div>
      </form>
    </div>
  )
}
