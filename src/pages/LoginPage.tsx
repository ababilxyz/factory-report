import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { motion } from 'framer-motion'
import { Mail, Lock, Shield, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { signIn, appUser } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      // Navigation handled by router after appUser is set
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      if (msg.includes('Invalid login credentials') || msg.includes('Email not confirmed')) {
        setError('Invalid email or password.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // Redirect after successful login
  if (appUser) {
    navigate(appUser.role === 'admin' ? '/dashboard' : '/home', { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-[#18191C] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-sm"
      >
        {/* Shield Icon */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl border-2 border-[#F4F5F7]/60 bg-[#F4F5F7]/10 flex items-center justify-center">
              <Shield className="w-10 h-10 text-[#F4F5F7]" strokeWidth={1.5} />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-[#F4F5F7]/30 animate-pulse" />
          </div>
        </motion.div>

        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl font-bold tracking-wide uppercase">
            Secure Access
          </h1>
          <p className="text-[#8E929B] text-[10px] tracking-[0.15em] uppercase mt-2">
            Encrypted · Authenticated · Validated
          </p>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="bg-[#222429] border border-[#2F3238] rounded-2xl p-6"
        >
          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#C4623F]/15 border border-[#C4623F]/40 text-[#E08462] text-xs rounded-lg px-4 py-2.5 mb-4"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-[10px] text-[#8E929B] tracking-wider uppercase mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E929B]" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-[#18191C] border border-[#2F3238] rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-[#8E929B] focus:outline-none focus:border-[#F4F5F7]/60 transition-colors min-h-[44px]"
                  placeholder="operator@factory.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-[10px] text-[#8E929B] tracking-wider uppercase mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E929B]" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#18191C] border border-[#2F3238] rounded-xl pl-11 pr-11 py-3 text-white text-sm placeholder-[#8E929B] focus:outline-none focus:border-[#F4F5F7]/60 transition-colors min-h-[44px]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8E929B] hover:text-[#A8AEBC] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              className="w-full bg-[#F4F5F7] hover:bg-[#A8AEBC] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 transition-colors min-h-[44px] flex items-center justify-center gap-2 tracking-wide uppercase text-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Authenticating...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Authenticate & Enter
                </>
              )}
            </motion.button>
          </form>
        </motion.div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-5 bg-[#222429] border border-[#2F3238] rounded-xl px-4 py-3 flex items-start gap-2.5"
        >
          <Shield className="w-3.5 h-3.5 text-[#E08462] mt-0.5 flex-shrink-0" />
          <p className="text-[#8E929B] text-[11px] leading-relaxed">
            All sessions are encrypted and geo-validated. Unauthorized access attempts are logged and reported.
          </p>
        </motion.div>

        <p className="text-center text-[#8E929B] text-[11px] mt-5">
          Need access? Contact your Team Leader.
        </p>
      </motion.div>
    </div>
  )
}
