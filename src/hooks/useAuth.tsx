import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { getUserProfile } from '../lib/supabaseDb'
import type { AppUser } from '../types'

interface AuthContextValue {
  currentUser: { uid: string; email?: string } | null
  appUser: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<{ uid: string; email?: string } | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setCurrentUser({
          uid: session.user.id,
          email: session.user.email
        })
        try {
          const profile = await getUserProfile(session.user.id)
          setAppUser(profile)
        } catch (err) {
          console.error('Failed to load user profile:', err)
          setAppUser(null)
        }
      }
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setCurrentUser({
            uid: session.user.id,
            email: session.user.email
          })
          try {
            const profile = await getUserProfile(session.user.id)
            setAppUser(profile)
          } catch (err) {
            console.error('Failed to load user profile:', err)
            setAppUser(null)
          }
        } else {
          setCurrentUser(null)
          setAppUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    if (data.user) {
      const profile = await getUserProfile(data.user.id)
      if (!profile) throw new Error('User profile not found. Contact your administrator.')
      setAppUser(profile)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAppUser(null)
  }

  return (
    <AuthContext.Provider value={{ currentUser, appUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}