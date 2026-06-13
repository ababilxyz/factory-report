import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { encryptQrPayload } from '../utils/encryption'
import {
  getAllAreas,
  getItemsByAreaId,
  getWeeklyItemsByAreaId,
  getWeeklyChecksByItemId,
} from '../lib/supabaseDb'
import { useQuery } from '@tanstack/react-query'
import type { Area, Item, ReportType } from '../types'
import { motion, AnimatePresence } from 'framer-motion'

export default function QrGeneratorPage() {
  const navigate = useNavigate()
  const [reportMode, setReportMode] = useState<ReportType>('daily')
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [generatedPayload, setGeneratedPayload] = useState<string | null>(null)

  const { data: areas = [], isLoading: areasLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: getAllAreas,
    select: (data) => [...data].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
  })

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['items', selectedArea?.areaId, reportMode],
    queryFn: () => {
      if (!selectedArea) return Promise.resolve([])
      return reportMode === 'weekly'
        ? getWeeklyItemsByAreaId(selectedArea.areaId)
        : getItemsByAreaId(selectedArea.areaId)
    },
    enabled: !!selectedArea,
  })

  function generateQr(item: Item, area: Area) {
    // Use actual item id for daily, or weekly item id for weekly
    const targetItemId = item.id
    const encrypted = encryptQrPayload(targetItemId)
    setSelectedItem(item)
    setSelectedArea(area)
    setGeneratedPayload(encrypted)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#0f172a] text-slate-100">
      <header className="border-b border-white/10 bg-[#0f172a]/80">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-4">
          <button
            onClick={() => (selectedItem ? setSelectedItem(null) : navigate(-1))}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-semibold tracking-tight">
            {selectedItem ? `QR · ${selectedItem.name}` : 'QR codes'}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <section className="flex items-center justify-between">
          <h2 className="text-sm text-slate-400">Report type</h2>
          <div className="flex rounded-full border border-white/10 overflow-hidden">
            <button
              onClick={() => {
                setReportMode('daily')
                setSelectedItem(null)
                setGeneratedPayload(null)
              }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                reportMode === 'daily'
                  ? 'bg-[#0d9488] text-white'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => {
                setReportMode('weekly')
                setSelectedItem(null)
                setGeneratedPayload(null)
              }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                reportMode === 'weekly'
                  ? 'bg-[#0d9488] text-white'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Weekly
            </button>
          </div>
        </section>

        {!selectedItem && (
          <section className="space-y-3">
            <h2 className="text-sm text-slate-400">Select area</h2>
            {areasLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#0d9488] animate-spin" />
              </div>
            ) : areas.length === 0 ? (
              <p className="text-sm text-slate-500">No areas found.</p>
            ) : (
              <div className="space-y-2">
                {areas.map((area) => (
                  <button
                    key={area.areaId}
                    onClick={() => setSelectedArea(area)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      selectedArea?.areaId === area.areaId
                        ? 'border-[#0d9488] bg-[#0d9488]/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <p className="text-sm font-medium">{area.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{area.areaId}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedArea && !selectedItem && (
          <section className="space-y-3">
            <h2 className="text-sm text-slate-400">
              {reportMode === 'weekly'
                ? `Weekly items in ${selectedArea.name}`
                : `Items in ${selectedArea.name}`}
            </h2>
            {itemsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#0d9488] animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">
                {reportMode === 'weekly'
                  ? 'No weekly items in this area.'
                  : 'No items in this area.'}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => generateQr(item, selectedArea)}
                    className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:border-[#0d9488]/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.code}</p>
                      </div>
                      {reportMode === 'weekly' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-slate-200">
                          Weekly
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <AnimatePresence>
          {generatedPayload && selectedItem && selectedArea && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="rounded-2xl border border-white/10 bg-white p-5 text-center space-y-4"
            >
              <QRCodeSVG value={generatedPayload} size={220} level="M" includeMargin />
              <div>
                <p className="text-sm font-semibold text-slate-900">{selectedItem.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{selectedItem.code}</p>
              </div>
              <button
                onClick={() => window.print()}
                className="rounded-xl bg-[#0f172a] text-white text-sm font-medium px-4 py-2.5 hover:bg-[#0f172a]/90 transition-colors"
              >
                Print QR
              </button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  )
}
