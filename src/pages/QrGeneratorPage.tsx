import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { encryptQrPayload } from '../utils/encryption'
import { getAllAreas, getItemsByAreaId } from '../lib/supabaseDb'
import { useQuery } from '@tanstack/react-query'
import type { Area, Item } from '../types'
import { motion, AnimatePresence } from 'framer-motion'

export default function QrGeneratorPage() {
  const navigate = useNavigate()
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [generatedPayload, setGeneratedPayload] = useState<string | null>(null)

  const { data: areas = [], isLoading: areasLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: getAllAreas,
  })

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['items', selectedArea?.areaId],
    queryFn: () => (selectedArea ? getItemsByAreaId(selectedArea.areaId) : Promise.resolve([])),
    enabled: !!selectedArea,
  })

  function generateQr(item: Item, area: Area) {
    const encrypted = encryptQrPayload(item.id)
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
            <h2 className="text-sm text-slate-400">Items in {selectedArea.name}</h2>
            {itemsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#0d9488] animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">No items in this area.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => generateQr(item, selectedArea)}
                    className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:border-[#0d9488]/60 transition-colors"
                  >
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.code}</p>
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
