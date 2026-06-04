import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
    <div className="min-h-screen bg-factory-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-factory-accent mb-4"
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </motion.div>
          <h1 className="text-2xl font-bold text-white tracking-tight">FactoryReport</h1>
          <p className="text-factory-muted text-sm mt-1">Issue Reporting System</p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-factory-card border border-factory-border rounded-2xl p-6"
        >
          <h2 className="text-white font-semibold text-lg mb-6">Sign in to continue</h2>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg p-3 mb-4"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-factory-muted mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-factory-dark border border-factory-border rounded-xl px-4 py-3 text-white placeholder-factory-muted focus:outline-none focus:border-factory-accent transition-colors min-h-[44px]"
                placeholder="worker@factory.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-factory-muted mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-factory-dark border border-factory-border rounded-xl px-4 py-3 text-white placeholder-factory-muted focus:outline-none focus:border-factory-accent transition-colors min-h-[44px]"
                placeholder="••••••••"
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              className="w-full bg-factory-accent hover:bg-factory-accent-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 transition-colors min-h-[44px] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </>
              ) : 'Sign in'}
            </motion.button>
          </form>
        </motion.div>

        <p className="text-center text-factory-muted text-xs mt-6">
          Need access? Contact your Team Leader.
        </p>
      </div>
    </div>
  )
}
