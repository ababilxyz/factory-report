import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { checkRateLimit, clearRateLimitRecord, recordAttempt } from '../utils/rateLimiter'
import { isValidEmail, sanitizeEmail, sanitizeString } from '../utils/sanitizer'
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
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedPassword = sanitizeString(password, 128);

    if (!isValidEmail(sanitizedEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    if (sanitizedPassword.length < 1) {
      throw new Error('Please enter your password.');
    }

    const rateLimitKey = `factory_report_login:${sanitizedEmail}`;
    const rateLimit = checkRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      const minutes = Math.ceil(rateLimit.retryAfterMs / 60000);
      throw new Error(`Too many failed login attempts. Please try again in ${minutes} minute(s).`);
    }

    recordAttempt(rateLimitKey);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password: sanitizedPassword,
    });

    if (error) {
      const errorMessage = error.message?.toLowerCase() || '';
      if (errorMessage.includes('invalid login credentials') || errorMessage.includes('invalid email or password')) {
        throw new Error('Invalid email or password.');
      }
      if (errorMessage.includes('email not confirmed')) {
        throw new Error('Please confirm your email before signing in.');
      }
      throw new Error(error.message || 'Failed to sign in. Please try again.');
    }

    clearRateLimitRecord(rateLimitKey);

    if (data.user) {
      const profile = await getUserProfile(data.user.id);
      if (!profile) {
        throw new Error('User profile not found. Contact your administrator.');
      }
      setAppUser(profile);
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