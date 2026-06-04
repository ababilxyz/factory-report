import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { createReport, getChecksByItemId, getItem } from '../lib/supabaseDb'
import { openCameraCapture } from '../utils/imageUtils'
import type { ScanResult, ChecklistData, Item, CheckItem } from '../types'
import { motion, AnimatePresence } from 'framer-motion'

// Helper function to generate check ID with format "label(code)"
function generateCheckId(label: string, code: string, index: number): string {
  const cleanCode = code.replace(/\s/g, '')
  return `${label}(${cleanCode})-${index}`
}

// Fetch checks from database for a specific item
async function fetchChecklistFromDb(itemId: string): Promise<ChecklistData | null> {
  // First get item data
  const item = await getItem(itemId)
  if (!item) {
    console.error('Item not found:', itemId)
    return null
  }

  // Then get checks
  const checks: CheckItem[] = []
  try {
    const itemChecks = await getChecksByItemId(itemId)
    checks.push(...itemChecks.map((c, index) => ({
      id: generateCheckId(c.checkLabel, item.code, index),
      label: c.checkLabel,
      code: item.code,
      options: c.checkOptions,
      order: c.displayOrder
    })))
  } catch (e) {
    console.error('Failed to fetch checks, using fallback')
  }
  
  const items: Record<string, Item> = {
    [itemId]: {
      id: item.id,
      areaId: item.areaId,
      code: item.code,
      name: item.name,
      order: item.order,
      checks,
      examplePhotoUrl: item.examplePhotoUrl
    }
  }
  
  return {
    areaId: itemId,
    items,
    hasIssues: false
  }
}

// Helper to determine if a selected option indicates an issue
function isIssueOption(option: string): boolean {
  const issueOptions = ['Rusak', 'Tidak Sesuai', 'Kotor', 'Terkelupas']
  return issueOptions.includes(option)
}

export default function ReportFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { appUser } = useAuth()

  const scanResult = location.state?.scanResult as ScanResult | undefined

  // State for before/after photos
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null)
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null)
  const [beforePhotoPreview, setBeforePhotoPreview] = useState<string | null>(null)
  const [afterPhotoPreview, setAfterPhotoPreview] = useState<string | null>(null)
  const [isAfterPhoto, setIsAfterPhoto] = useState(false)

  // State for description and checklist
  const [description, setDescription] = useState('')
  const [checklistData, setChecklistData] = useState<ChecklistData>({ areaId: '', items: {}, hasIssues: false })

  // Load checklist when scanResult changes
  useEffect(() => {
    if (scanResult) {
      void fetchChecklistFromDb(scanResult.areaId).then(data => {
        if (data) setChecklistData(data)
      })
    }
  }, [scanResult])

  // State for form submission
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Redirect if no scan result
  useEffect(() => {
    if (!scanResult) navigate('/home', { replace: true })
  }, [scanResult, navigate])

  // Update hasIssues when checklist changes
  useEffect(() => {
    const hasIssues = Object.values(checklistData.items).some(item =>
      item.checks.some(check => check.selectedOption && isIssueOption(check.selectedOption))
    )
    if (hasIssues !== checklistData.hasIssues) {
      setChecklistData(prev => ({ ...prev, hasIssues }))
    }
  }, [checklistData.items])

  // Handle taking photo (before or after)
  async function handleTakePhoto() {
    try {
      const file = await openCameraCapture()

      if (isAfterPhoto) {
        setAfterPhoto(file)
        const url = URL.createObjectURL(file)
        setAfterPhotoPreview(url)
      } else {
        setBeforePhoto(file)
        const url = URL.createObjectURL(file)
        setBeforePhotoPreview(url)
      }
    } catch (err) {
      if (err instanceof Error && err.message !== 'Camera cancelled') {
        setSubmitError('Could not access camera. ' + err.message)
      }
    }
  }

  // Toggle between before/after photo mode
  function togglePhotoMode() {
    setIsAfterPhoto(!isAfterPhoto)
  }

  // Handle check option selection
  function handleCheckSelection(itemId: string, checkId: string, option: string) {
    setChecklistData(prev => {
      const newItems = { ...prev.items }
      if (newItems[itemId]) {
        newItems[itemId] = {
          ...newItems[itemId],
          checks: newItems[itemId].checks.map(check =>
            check.id === checkId ? { ...check, selectedOption: option } : check
          )
        }
      }
      // Recalculate hasIssues
      const hasIssues = Object.values(newItems).some(item =>
        item.checks.some(check => check.selectedOption && isIssueOption(check.selectedOption))
      )
      return { ...prev, items: newItems, hasIssues }
    })
  }

  async function handleSubmit() {
    if (!beforePhoto || !description.trim() || !scanResult || !appUser) {
      setSubmitError('Please provide description and take at least the "before" photo')
      return
    }

    const hasIssues = checklistData.hasIssues
    if (hasIssues && !afterPhoto) {
      setSubmitError('Please take an "after" photo showing the fix/cleanup')
      return
    }

    setSubmitError('')
    setSubmitting(true)
    setUploadProgress(0)

    try {
      await createReport(
        {
          areaId: scanResult.areaId,
          beforePhotoFile: beforePhoto ?? undefined,
          afterPhotoFile: afterPhoto ?? undefined,
          description: description.trim(),
          gpsLat: scanResult.gpsLat,
          gpsLng: scanResult.gpsLng,
          sessionId: scanResult.sessionId,
          checklistData: checklistData
        },
        appUser.uid,
        setUploadProgress
      )
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-factory-dark flex flex-col items-center justify-center p-6 gap-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center"
        >
          <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </motion.div>
        <div className="text-center">
          <h2 className="text-white text-2xl font-bold">Report Submitted</h2>
          <p className="text-factory-muted mt-2">Your report has been sent to the team leader.</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/home')}
          className="bg-factory-accent text-white px-8 py-3.5 rounded-xl font-semibold min-h-[44px]"
        >
          Back to Home
        </motion.button>
      </motion.div>
    )
  }

  if (!scanResult) return null

  const sortedItems = Object.values(checklistData.items).sort((a, b) => a.order - b.order)
  const scanItem = sortedItems[0] // Get the scanned item for example photo

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-factory-dark flex flex-col"
    >
      {/* Header */}
      <header className="bg-factory-card border-b border-factory-border px-4 py-4 flex items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="w-11 h-11 rounded-xl bg-factory-border/50 flex items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>
        <div>
          <h1 className="text-white font-semibold">Report Issue</h1>
          <p className="text-factory-accent text-xs font-medium">{scanResult.areaName}</p>
        </div>
      </header>

      {/* Example Photo Section */}
      {scanItem?.examplePhotoUrl && (
        <div className="p-4 bg-factory-card border-b border-factory-border">
          <p className="text-xs text-factory-muted mb-2">Example Reference:</p>
          <img
            src={scanItem.examplePhotoUrl}
            alt="Example reference"
            className="w-full max-h-48 object-cover rounded-xl"
          />
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Photo Section */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            {isAfterPhoto ? 'After Photo (Fix/Cleanup)' : 'Before Photo (Issue)'}
            <span className="text-red-400">*</span>
          </label>

          {(isAfterPhoto ? afterPhotoPreview : beforePhotoPreview) ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-2xl overflow-hidden bg-factory-card border border-factory-border"
            >
              <img
                src={isAfterPhoto ? afterPhotoPreview! : beforePhotoPreview!}
                alt={isAfterPhoto ? 'After' : 'Before'}
                className="w-full max-h-64 object-cover"
              />

              {!isAfterPhoto && beforePhotoPreview && afterPhotoPreview ? (
                <div className="absolute top-3 right-3 flex gap-2">
                  <img
                    src={beforePhotoPreview}
                    alt="Before"
                    className="w-10 h-10 rounded object-cover border border-factory-border"
                  />
                  <img
                    src={afterPhotoPreview}
                    alt="After"
                    className="w-10 h-10 rounded object-cover border border-factory-border"
                  />
                </div>
              ) : null}

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => void handleTakePhoto()}
                className="absolute bottom-3 right-3 bg-black/60 text-white text-sm px-3 py-2 rounded-lg min-h-[44px] flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                {isAfterPhoto ? 'Retake After' : 'Retake Before'}
              </motion.button>
            </motion.div>
          ) : (
            <div className="space-y-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.01 }}
                onClick={() => void handleTakePhoto()}
                className="w-full bg-factory-card border-2 border-dashed border-factory-border hover:border-factory-accent rounded-2xl p-8 flex flex-col items-center gap-3 text-factory-muted hover:text-factory-accent transition-colors"
              >
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                <span className="font-medium">
                  {isAfterPhoto ? 'Take After Photo' : 'Take Before Photo'}
                </span>
              </motion.button>

              {/* Show toggle button when we have a before photo but not after, or vice versa */}
              {(beforePhotoPreview && !afterPhotoPreview) || (!beforePhotoPreview && afterPhotoPreview) ? (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={togglePhotoMode}
                  className="w-full text-factory-muted hover:text-white text-sm px-3 py-2 rounded border border-factory-border transition-colors"
                >
                  {isAfterPhoto ? 'Retake Before Photo' : 'Take After Photo'}
                </motion.button>
              ) : null}
            </div>
          )}

          {(checklistData.hasIssues && !afterPhoto) && (
            <div className="mt-2 text-factory-accent text-sm">
              ⚠️ Issues found - after photo showing fix/cleanup is required
            </div>
          )}

          {(!checklistData.hasIssues && afterPhoto) && (
            <div className="mt-2 text-factory-accent text-sm">
              ℹ️ No issues found - after photo is optional
            </div>
          )}
        </div>

        {/* Checklist Section */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Inspection Checklist <span className="text-red-400">*</span>
          </label>

          <div className="space-y-4">
            {sortedItems.map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: item.order * 0.01 }}
                className="bg-factory-card border border-factory-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{item.name}</h3>
                    <p className="text-factory-accent text-xs">{item.code}</p>
                  </div>
                  <div className="w-8 h-8 flex items-center justify-center rounded-full">
                    {item.checks.every(check => check.selectedOption && !isIssueOption(check.selectedOption)) ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {item.checks.sort((a, b) => (a.order || 0) - (b.order || 0)).map(check => (
                    <div key={check.id} className="flex flex-col gap-2">
                      <span className="text-white text-sm font-medium">{check.label}</span>
                      <div className="flex flex-wrap gap-2">
                        {check.options.map(option => {
                          const isSelected = check.selectedOption === option
                          const isIssue = isIssueOption(option)
                          return (
                            <button
                              key={option}
                              onClick={() => handleCheckSelection(item.id, check.id, option)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                                isSelected
                                  ? isIssue
                                    ? 'bg-red-900/50 text-red-300 border border-red-800'
                                    : 'bg-green-900/50 text-green-300 border border-green-800'
                                  : 'bg-factory-border/30 text-factory-muted border border-factory-border'
                              }`}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full bg-factory-card border border-factory-border rounded-xl px-4 py-3 text-white placeholder-factory-muted focus:outline-none focus:border-factory-accent transition-colors resize-none"
            placeholder="Describe the issue in detail. What is the problem? When did it start?"
          />
          <p className="text-factory-muted text-xs mt-1 text-right">{description.length}/500</p>
        </div>

        {/* Error */}
        <AnimatePresence>
          {submitError && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl p-3"
            >
              {submitError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload progress */}
        <AnimatePresence>
          {submitting && uploadProgress > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex justify-between text-xs text-factory-muted mb-1">
                <span>Uploading photos...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-factory-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-factory-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Submit button */}
      <div className="p-4 bg-factory-dark border-t border-factory-border">
        <motion.button
          whileTap={{ scale: !beforePhoto || !description.trim() || submitting ? 1 : 0.97 }}
          onClick={() => void handleSubmit()}
          disabled={!beforePhoto || !description.trim() || submitting}
          className="w-full bg-factory-accent hover:bg-factory-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-4 transition-colors min-h-[52px] flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Submitting...
            </>
          ) : 'Submit Report'}
        </motion.button>
      </div>
    </motion.div>
  )
}