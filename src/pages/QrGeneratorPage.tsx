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
    queryFn: getAllAreas
  })

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['items', selectedArea?.areaId],
    queryFn: () => selectedArea ? getItemsByAreaId(selectedArea.areaId) : Promise.resolve([]),
    enabled: !!selectedArea
  })

  function generateQr(item: Item, area: Area) {
    const encrypted = encryptQrPayload(item.id)
    setSelectedItem(item)
    setSelectedArea(area)
    setGeneratedPayload(encrypted)
  }

  function goBackToAreas() {
    setSelectedItem(null)
    setGeneratedPayload(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-factory-dark"
    >
      <header className="bg-factory-card border-b border-factory-border px-4 py-4 flex items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => selectedItem ? goBackToAreas() : navigate(-1)}
          className="w-11 h-11 rounded-xl bg-factory-border/50 flex items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>
        <h1 className="text-white font-semibold">
          {selectedItem ? `QR: ${selectedItem.name}` : 'QR Code Generator'}
        </h1>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* Areas list */}
        {!selectedItem && (
          <div className="space-y-2">
            <h2 className="text-white font-medium">Select Area</h2>
            {areasLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-factory-accent/30 border-t-factory-accent animate-spin" />
              </div>
            ) : areas.length === 0 ? (
              <p className="text-factory-muted text-sm">No areas configured. Add areas to Supabase first.</p>
            ) : (
              <div className="space-y-2">
                {areas.map(area => (
                  <motion.button
                    key={area.areaId}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => setSelectedArea(area)}
                    className={`w-full text-left bg-factory-card border rounded-xl p-4 transition-colors ${
                      selectedArea?.areaId === area.areaId
                        ? 'border-factory-accent text-white'
                        : 'border-factory-border text-factory-muted hover:text-white hover:border-factory-accent/50'
                    }`}
                  >
                    <p className="font-medium text-white">{area.name}</p>
                    <p className="text-xs mt-0.5 font-mono">{area.areaId}</p>
                    <p className="text-xs mt-0.5">📍 {area.allowedLat.toFixed(5)}, {area.allowedLng.toFixed(5)} (±{area.radiusMeters}m)</p>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Items list */}
        {selectedArea && !selectedItem && (
          <div className="space-y-2">
            <h2 className="text-white font-medium">Items in {selectedArea.name}</h2>
            {itemsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-factory-accent/30 border-t-factory-accent animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-factory-muted text-sm">No items configured for this area.</p>
            ) : (
              <div className="space-y-2">
                {items.map(item => (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => generateQr(item, selectedArea)}
                    className="w-full text-left bg-factory-card border border-factory-border rounded-xl p-4 text-white hover:border-factory-accent/50 transition-colors"
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs mt-0.5 font-mono">{item.code}</p>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generated QR */}
        <AnimatePresence>
          {generatedPayload && selectedItem && selectedArea && (
            <motion.div
              key="qr-card"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4"
            >
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <QRCodeSVG
                  value={generatedPayload}
                  size={240}
                  level="H"
                  includeMargin={true}
                />
              </motion.div>
              <div className="text-center">
                <p className="text-factory-dark font-bold">{selectedItem.name}</p>
                <p className="text-gray-500 text-xs mt-0.5 font-mono">{selectedItem.code}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Reusable QR for {selectedItem.name}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => window.print()}
                className="bg-factory-dark text-white px-6 py-2.5 rounded-xl text-sm font-medium min-h-[44px]"
              >
                Print QR Code
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  )
}
