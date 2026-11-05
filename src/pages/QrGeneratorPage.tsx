import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { encryptQrPayload } from '../utils/encryption'
import {
  getAllAreas,
  getItemsByAreaId,
  getWeeklyItemsByAreaId,
  getMonthlyItemsByAreaId,
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
        : reportMode === 'monthly'
          ? getMonthlyItemsByAreaId(selectedArea.areaId)
          : getItemsByAreaId(selectedArea.areaId)
    },
    enabled: !!selectedArea,
  })

  function generateQr(item: Item, area: Area) {
    const targetItemId = item.id
    const encrypted = encryptQrPayload(targetItemId, reportMode)
    setSelectedItem(item)
    setSelectedArea(area)
    setGeneratedPayload(encrypted)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#18191C] text-[#F4F5F7]">
      <header className="border-b border-white/10 bg-[#18191C]/90">
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
          <h2 className="text-sm text-[#A8AEBC]">Report type</h2>
          <div className="flex rounded-full border border-white/10 overflow-hidden">
            <button
              onClick={() => {
                setReportMode('daily')
                setSelectedItem(null)
                setGeneratedPayload(null)
              }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                reportMode === 'daily'
                  ? 'bg-[#F4F5F7] text-[#121417]'
                  : 'text-[#DCDDE1] hover:bg-white/5'
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
                  ? 'bg-[#F4F5F7] text-[#121417]'
                  : 'text-[#DCDDE1] hover:bg-white/5'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => {
                setReportMode('monthly')
                setSelectedItem(null)
                setGeneratedPayload(null)
              }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                reportMode === 'monthly'
                  ? 'bg-[#F4F5F7] text-[#121417]'
                  : 'text-[#DCDDE1] hover:bg-white/5'
              }`}
            >
              Monthly
            </button>
          </div>
        </section>

        {!selectedItem && (
          <section className="space-y-3">
            <h2 className="text-sm text-[#A8AEBC]">Select area</h2>
            {areasLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#F4F5F7] animate-spin" />
              </div>
            ) : areas.length === 0 ? (
              <p className="text-sm text-[#8E929B]">No areas found.</p>
            ) : (
              <div className="space-y-2">
                {areas.map((area) => (
                  <button
                    key={area.areaId}
                    onClick={() => setSelectedArea(area)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      selectedArea?.areaId === area.areaId
                        ? 'border-[#F4F5F7] bg-[#F4F5F7]/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <p className="text-sm font-medium">{area.name}</p>
                    <p className="text-xs text-[#8E929B] mt-0.5">{area.areaId}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedArea && !selectedItem && (
          <section className="space-y-3">
            <h2 className="text-sm text-[#A8AEBC]">
              {reportMode === 'weekly'
                ? `Weekly items in ${selectedArea.name}`
                : reportMode === 'monthly'
                  ? `Monthly items in ${selectedArea.name}`
                  : `Items in ${selectedArea.name}`}
            </h2>
            {itemsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#F4F5F7] animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-[#8E929B]">
                  {reportMode === 'weekly'
                    ? 'No weekly items in this area.'
                    : reportMode === 'monthly'
                      ? 'No monthly items in this area.'
                      : 'No items in this area.'}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => generateQr(item, selectedArea)}
                    className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:border-[#F4F5F7]/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-[#8E929B] mt-0.5">{item.code}</p>
                      </div>
                      {reportMode === 'weekly' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-[#F4F5F7]">
                          Weekly
                        </span>
                      )}
                      {reportMode === 'monthly' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-[#F4F5F7]">
                          Monthly
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
                <p className="text-sm font-semibold text-[#121417]">{selectedItem.name}</p>
                <p className="text-xs text-[#8E929B] mt-0.5">{selectedItem.code}</p>
              </div>
              <button
                onClick={() => window.print()}
                className="rounded-xl bg-[#222429] text-white text-sm font-medium px-4 py-2.5 hover:bg-[#222429]/90 transition-colors"
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
