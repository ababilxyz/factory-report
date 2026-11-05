import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { updateUserProfile } from '../lib/supabaseDb'
import type { AppUser } from '../types'
import { motion } from 'framer-motion'
import WorkerBottomBar from "../components/WorkerBottomBar"

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

  if (!userProfile && appUser) {
    setUserProfile(appUser)
    setEditedProfile({ ...appUser })
  }

  const initials = (() => {
    const words = (userProfile?.displayName || 'OP').trim().split(/\s+/)
    return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase()
  })()

  if (!appUser) {
    navigate('/login', { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-[#18191C] text-[#F4F5F7]">
      <header className="border-b border-white/10 bg-[#18191C]/90">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Profil</h1>
            <p className="text-sm text-[#A8AEBC] mt-0.5">Akun Petugas</p>
          </div>
          <button
            onClick={() => navigate('/home')}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-[#A8AEBC] transition-colors"
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
          className="mx-4 mt-4 rounded-xl border border-[#C4623F]/60 bg-[#C4623F]/15 text-[#E08462] text-xs px-3 py-2"
        >
          {saveError}
        </motion.div>
      )}

      <main className="max-w-3xl mx-auto px-4 pt-5 pb-32 space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#222429] border border-[#2F3238] flex items-center justify-center font-bold text-lg text-[#F4F5F7]">
                {initials}
              </div>

              <div className="flex-1">
                <h2 className="text-[#F4F5F7] font-semibold tracking-tight">
                  {userProfile?.displayName || 'Worker'}
                </h2>
                <p className="text-xs text-[#A8AEBC]">{userProfile?.email || 'Email belum diisi'}</p>
                <span className="mt-1 inline-block rounded-chip border border-[#2F3238] bg-[#1B1D22] px-2 py-0.5 text-[10px] font-semibold text-[#F4F5F7]">
                  {userProfile?.role === 'worker' ? 'Pekerja Lapangan' : 'Administrator'}
                </span>
              </div>

              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-[#A8AEBC] hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <form className="space-y-3">
                <div>
                  <label className="block text-xs text-[#A8AEBC] mb-1.5">Nama Tampilan</label>
                  <input
                    type="text"
                    value={editedProfile?.displayName || ''}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    className="w-full rounded-lg border border-[#2F3238] bg-[#18191C] px-3 py-2 text-xs text-white placeholder:text-[#8E929B] focus:outline-none focus:border-[#F4F5F7] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A8AEBC] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={editedProfile?.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full rounded-lg border border-[#2F3238] bg-[#18191C] px-3 py-2 text-xs text-white placeholder:text-[#8E929B] focus:outline-none focus:border-[#F4F5F7] transition-colors"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-[#F4F5F7] text-[#121417] text-xs font-bold py-2.5 hover:bg-[#F4F5F7]/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-4 py-2.5 rounded-lg border border-[#2F3238] text-xs text-[#DCDDE1] hover:text-white transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-[12px] border border-[#2F3238] bg-[#1B1D22] p-4 space-y-3">
                {[
                  { label: 'KODE OPERATOR', value: `OP-${(userProfile?.uid ?? '00000000').slice(0, 8).toUpperCase()}`, mono: true },
                  { label: 'LINE', value: 'AA', mono: false },
                  { label: 'TERDAFTAR SEJAK', value: userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tidak diketahui', mono: false },
                ].map((row, i) => (
                  <div key={row.label}>
                    {i > 0 && <div className="my-2.5 h-px bg-white/5" />}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-medium tracking-wide text-[#8E929B]">{row.label}</span>
                      <span className={`text-xs text-[#F4F5F7] ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => void signOut()}
          className="w-full rounded-[12px] border border-[#C4623F]/40 bg-[#C4623F]/10 text-xs font-semibold text-[#E08462] py-3 hover:bg-[#C4623F]/20 transition-colors"
        >
          Keluar Akun
        </button>

        <p className="pt-2 text-center text-[10px] text-[#8E929B]">
          Sistem Inspeksi Pabrik 3PilarAA • v1.0
        </p>
      </main>

      <WorkerBottomBar active="profil" />
    </div>
  )
}
