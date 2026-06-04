import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQrScanner } from '../hooks/useQrScanner'
import { motion } from 'framer-motion'

export default function ScannerPage() {
  const navigate = useNavigate()
  const { scanState, result, error, statusMessage, startScanner, reset, SCANNER_ELEMENT_ID } = useQrScanner()

  useEffect(() => {
    void startScanner()
    return () => { void reset() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to report form on success
  useEffect(() => {
    if (scanState === 'success' && result) {
      const timer = setTimeout(() => {
        navigate('/report', { state: { scanResult: result } })
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [scanState, result, navigate])

  const isScanning = scanState === 'idle' || scanState === 'scanning'
  const isProcessing = scanState === 'decrypting' || scanState === 'verifying_location'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-black flex flex-col"
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-safe-top py-4 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="w-11 h-11 rounded-full bg-black/50 flex items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-semibold">Scan Area QR</h1>
        <div className="w-11" /> {/* Spacer */}
      </div>

      {/* Camera viewport */}
      <div className="flex-1 relative overflow-hidden">
        <div id={SCANNER_ELEMENT_ID} className="absolute inset-0 w-full h-full" />

        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          >
            {/* Corner markers */}
            <div className="relative w-72 h-72">
              {/* Top-left */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
                className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-md" style={{ borderWidth: '3px 0 0 3px' }}
              />
              {/* Top-right */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15 }}
                className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-md" style={{ borderWidth: '3px 3px 0 0' }}
              />
              {/* Bottom-left */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-md" style={{ borderWidth: '0 0 3px 3px' }}
              />
              {/* Bottom-right */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.25 }}
                className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-md" style={{ borderWidth: '0 3px 3px 0' }}
              />
              {/* Scanning line animation */}
              {scanState === 'scanning' && (
                <motion.div
                  className="absolute inset-x-0 h-0.5 bg-factory-accent opacity-80"
                  initial={{ top: 0 }}
                  animate={{ top: 'calc(100% - 2px)' }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                />
              )}
            </div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white/80 text-sm mt-6 font-medium"
            >
              {scanState === 'idle' ? 'Starting camera...' : 'Point at the QR code in the area'}
            </motion.p>
          </motion.div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-factory-accent/30 border-t-factory-accent animate-spin" />
            <p className="text-white font-medium">{statusMessage}</p>
            <p className="text-white/50 text-sm">Please wait...</p>
          </div>
        )}

        {scanState === 'success' && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 p-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center"
            >
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <div className="text-center">
              <p className="text-green-400 font-semibold text-lg">Area Verified</p>
              <p className="text-white text-xl font-bold mt-1">{result.areaName}</p>
              <p className="text-white/50 text-sm mt-2">Redirecting to report form...</p>
            </div>
          </motion.div>
        )}

        {scanState === 'error' && error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-5 p-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 250 }}
              className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center"
            >
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.div>
            <div className="text-center">
              <p className="text-red-400 font-semibold">
                {error.code === 'LOCATION_MISMATCH' ? 'Wrong Location' :
                 error.code === 'PERMISSION_DENIED' ? 'Permission Denied' :
                 'Scan Failed'}
              </p>
              <p className="text-white/70 text-sm mt-2 max-w-xs leading-relaxed">{error.message}</p>
            </div>
            <button
              onClick={() => void reset().then(() => startScanner())}
              className="bg-factory-accent text-white px-6 py-3 rounded-xl font-medium min-h-[44px]"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
