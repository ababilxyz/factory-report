import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { updateUserProfile } from '../lib/supabaseDb'
import type { AppUser } from '../types'
import { motion } from 'framer-motion'

export default function ProfilePage() {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [userProfile, setUserProfile] = useState<AppUser | null>(null)
  const [editing, setEditing] = useState(false)
  const [editedProfile, setEditedProfile] = useState<AppUser | null>(null)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (appUser) {
      setUserProfile(appUser)
      setEditedProfile({ ...appUser })
    }
  }, [appUser])

  async function handleSave() {
    if (!editedProfile) return

    setSaveError('')
    setSaving(true)

    try {
      await updateUserProfile(editedProfile.uid, {
        displayName: editedProfile.displayName,
        email: editedProfile.email,
      })
      setUserProfile({ ...editedProfile })
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  function handleInputChange(field: keyof AppUser, value: string) {
    if (!editedProfile) return
    setEditedProfile((prev) => {
      if (!prev) return prev
      return { ...prev, [field]: value }
    })
  }

  if (!appUser) {
    navigate('/login', { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <header className="border-b border-white/10 bg-[#0f172a]/80">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Profile</h1>
            <p className="text-sm text-slate-400 mt-0.5">Worker Account</p>
          </div>
          <button
            onClick={() => navigate('/home')}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </header>

      {saveError && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mx-4 mt-4 rounded-xl border border-red-800 bg-red-950/50 text-red-200 text-xs px-3 py-2"
        >
          {saveError}
        </motion.div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#0d9488]/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>

              <div className="flex-1">
                <h2 className="text-white font-semibold tracking-tight">
                  {userProfile?.displayName || 'Worker'}
                </h2>
                <p className="text-sm text-slate-400">{userProfile?.email || 'No email'}</p>
                <p className="text-xs text-[#0d9488] font-medium mt-0.5">
                  Role: {userProfile?.role === 'worker' ? 'Field Worker' : 'Administrator'}
                </p>
              </div>

              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <form className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Display name</label>
                  <input
                    type="text"
                    value={editedProfile?.displayName || ''}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0d9488] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={editedProfile?.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0d9488] transition-colors"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-[#0d9488] text-white text-sm font-medium py-2.5 hover:bg-[#0d9488]/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-3 py-2.5 rounded-lg border border-white/10 text-sm text-slate-300 hover:text-white hover:border-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 pt-1">
                <div>
                  <p className="text-xs text-slate-500">User ID</p>
                  <p className="text-sm text-slate-200 mt-0.5">{userProfile?.uid}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Member since</p>
                  <p className="text-sm text-slate-200 mt-0.5">
                    {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Last active</p>
                  <p className="text-sm text-slate-200 mt-0.5">Today</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => void signOut()}
          className="w-full rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 py-2.5 hover:border-white/20 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </main>
    </div>
  )
}
