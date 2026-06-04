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
        email: editedProfile.email
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
    setEditedProfile(prev => {
      if (!prev) return prev
      return { ...prev, [field]: value }
    })
  }

  if (!appUser) {
    navigate('/login', { replace: true })
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-factory-dark flex flex-col"
    >
      {/* Header */}
      <header className="bg-factory-card border-b border-factory-border px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold">Profile</h1>
          <p className="text-factory-accent text-xs font-medium">Worker Account</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/home')}
          className="w-11 h-11 rounded-xl bg-factory-border/50 flex items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>
      </header>

      {/* Error */}
      {saveError && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl p-3 mx-4 my-4"
        >
          {saveError}
        </motion.div>
      )}

      <main className="flex-1 overflow-y-auto p-6">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-factory-card border border-factory-border rounded-2xl p-6"
        >
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-factory-accent/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-factory-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>

              <div className="flex-1">
                <h2 className="text-white font-bold text-xl">
                  {userProfile?.displayName || 'Worker'}
                </h2>
                <p className="text-factory-muted text-sm">
                  {userProfile?.email || 'No email'}
                </p>
                <p className="text-factory-accent text-xs font-medium mt-1">
                  Role: {userProfile?.role === 'worker' ? 'Field Worker' : 'Administrator'}
                </p>
              </div>

              {/* Edit Button */}
              {!editing && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setEditing(true)}
                  className="text-factory-muted hover:text-white text-sm px-3 py-1 rounded transition-colors"
                >
                  Edit Profile
                </motion.button>
              )}
            </div>

            {/* Form */}
            {editing ? (
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editedProfile?.displayName || ''}
                    onChange={e => handleInputChange('displayName', e.target.value)}
                    className="w-full bg-factory-card border border-factory-border rounded-xl px-4 py-3 text-white placeholder-factory-muted focus:outline-none focus:border-factory-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editedProfile?.email || ''}
                    onChange={e => handleInputChange('email', e.target.value)}
                    className="w-full bg-factory-card border border-factory-border rounded-xl px-4 py-3 text-white placeholder-factory-muted focus:outline-none focus:border-factory-accent"
                  />
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-factory-accent hover:bg-factory-accent-light text-white font-semibold rounded-xl py-3 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setEditing(false)}
                    className="flex-1 text-factory-muted hover:text-white text-sm px-3 py-2 rounded border border-factory-border transition-colors"
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                {/* User ID */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-factory-muted">User ID</p>
                  <p className="text-white text-monospace bg-factory-dark rounded-xl px-4 py-2">
                    {userProfile?.uid}
                  </p>
                </div>

                {/* Member Since */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-factory-muted">Member Since</p>
                  <p className="text-white">
                    {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>

                {/* Last Active */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-factory-muted">Last Active</p>
                  <p className="text-white">Today</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Sign Out Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => void signOut()}
          className="w-full mt-6 bg-factory-accent/20 text-factory-accent border border-factory-accent/30 text-sm px-4 py-3 rounded-xl font-medium hover:bg-factory-accent/30 transition-colors"
        >
          Sign Out
        </motion.button>
      </main>
    </motion.div>
  )
}