import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

// Cermin LoginScreen.kt: header atas dengan kontur topografi dan brand 3PilarAA,
// kartu form melengkung 32px dari bawah header, validasi inline per field.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CONTOUR_PATHS = [
  'M-20 46.8 C120 13 240 83.2 420 39',
  'M-20 91 C100 52 260 124.8 420 72.8',
  'M-20 135.2 C140 98.8 280 161.2 420 117',
  'M-20 176.8 C80 143 220 202.8 420 156',
  'M-20 221 C160 182 300 239.2 420 202.8',
]

const fieldBase =
  'w-full min-h-[52px] rounded-[12px] border bg-[#222429] text-sm text-[#F4F5F7] placeholder:text-[#A8AEBC]/45 focus:outline-none transition-colors'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const { signIn, appUser } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cleanEmail = email.trim()
    const eErr = !cleanEmail
      ? 'Email wajib diisi'
      : !EMAIL_RE.test(cleanEmail)
        ? 'Format email tidak valid'
        : null
    const pErr = password ? null : 'Kata sandi wajib diisi'

    setEmailError(eErr)
    setPasswordError(pErr)
    setError('')
    if (eErr || pErr) return

    setLoading(true)
    try {
      await signIn(cleanEmail, password)
      // Navigasi dilakukan setelah appUser terisi
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(
        msg === 'Invalid email or password.'
          ? 'Email atau kata sandi salah.'
          : msg === 'Please confirm your email before signing in.'
            ? 'Email belum dikonfirmasi. Hubungi supervisor shift.'
            : msg.startsWith('Too many failed')
              ? 'Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.'
              : 'Gagal masuk. Silakan coba lagi.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (appUser) navigate(appUser.role === 'admin' ? '/dashboard' : '/home', { replace: true })
  }, [appUser, navigate])

  const emailBorder = emailError
    ? 'border-[#C4623F]'
    : 'border-[#2F3238] focus:border-[#F4F5F7]/60'
  const passwordBorder = passwordError
    ? 'border-[#C4623F]'
    : 'border-[#2F3238] focus:border-[#F4F5F7]/60'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#222429]">
      {/* Header atas: gradien kartu -> surface, kontur, brand */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px] bg-gradient-to-b from-[#222429] to-[#18191C]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 400 260"
          preserveAspectRatio="none"
          aria-hidden
        >
          {CONTOUR_PATHS.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div className="relative pt-[18px] text-center">
          <p className="text-[32px] font-extrabold tracking-[0.5px] text-[#F4F5F7]">3PilarAA</p>
          <p className="mt-0.5 text-xs font-medium tracking-[0.3px] text-[#A8AEBC]">
            Sistem Inspeksi &amp; Pelaporan
          </p>
        </div>
      </div>

      {/* Kartu form: mulai 180px dari atas, sudut atas 32px, sampai bawah */}
      <main className="relative flex min-h-screen flex-col pt-[180px]">
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col rounded-t-[32px] bg-[#222429] px-7 pb-8 pt-8 shadow-[0_-12px_32px_rgba(0,0,0,0.35)]">
          <h1 className="text-[28px] font-extrabold leading-tight text-[#F4F5F7]">Masuk</h1>
          <div className="mt-1.5 h-[3.5px] w-[42px] rounded-full bg-[#F4F5F7]" />

          <div className="mt-6 flex flex-1 flex-col">
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-[12px] border border-[#C4623F]/40 bg-[#C4623F]/15 px-4 py-3 text-xs text-[#E08462]"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
              {/* Email */}
              <label htmlFor="email" className="text-[13px] font-bold text-[#F4F5F7]">
                Email
              </label>
              <div className="relative mt-1.5">
                <Mail
                  className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${
                    email.trim() ? 'text-[#F4F5F7]' : 'text-[#8E929B]'
                  }`}
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setEmailError(null)
                    setError('')
                  }}
                  autoComplete="email"
                  placeholder="nama@aa.com"
                  className={`${fieldBase} ${emailBorder} py-3 pl-12 pr-4`}
                />
              </div>
              {emailError && <p className="mt-1.5 text-[11px] text-[#E08462]">{emailError}</p>}

              {/* Kata Sandi */}
              <label htmlFor="password" className="mt-[18px] text-[13px] font-bold text-[#F4F5F7]">
                Kata Sandi
              </label>
              <div className="relative mt-1.5">
                <Lock
                  className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${
                    password ? 'text-[#F4F5F7]' : 'text-[#8E929B]'
                  }`}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordError(null)
                    setError('')
                  }}
                  autoComplete="current-password"
                  className={`${fieldBase} ${passwordBorder} py-3 pl-12 pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-[#A8AEBC] transition-colors hover:text-[#F4F5F7]"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1.5 text-[11px] text-[#E08462]">{passwordError}</p>
              )}

              {/* Ingat Saya + Lupa Kata Sandi */}
              <div className="mt-3.5 flex items-center justify-between">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={rememberMe}
                  onClick={() => setRememberMe((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg px-0.5 py-1"
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-[6px] border ${
                      rememberMe ? 'border-[#F4F5F7] bg-[#F4F5F7]' : 'border-[#8E929B]'
                    }`}
                  >
                    {rememberMe && (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 text-[#121417]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-xs font-medium text-[#F4F5F7]">Ingat Saya</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowHelp(true)}
                  className="flex h-12 items-center px-2 text-xs font-bold text-[#F4F5F7]"
                >
                  Lupa Kata Sandi?
                </button>
              </div>

              {/* Dorong tombol dan footer ke bawah kartu */}
              <div className="flex-1" />

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[12px] bg-[#F4F5F7] text-[15px] font-bold text-[#121417] transition-colors hover:bg-[#DCDDE1] disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#121417]/25 border-t-[#121417]" />
                    Memproses...
                  </>
                ) : (
                  'Masuk'
                )}
              </button>

              <p className="mt-5 text-center text-xs text-[#A8AEBC]">
                Belum punya akun? Hubungi supervisor shift.
              </p>
            </form>
          </div>
        </div>
      </main>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setShowHelp(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[20px] border border-[#2F3238] bg-[#222429] p-6"
          >
            <h2 className="text-base font-bold text-[#F4F5F7]">Bantuan Kata Sandi</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-[#A8AEBC]">
              Akun pekerja dikelola terpusat oleh administrator pabrik 3PilarAA. Jika Anda lupa
              kata sandi atau mengalami masalah saat masuk, silakan hubungi supervisor shift atau
              administrator Anda untuk mereset kata sandi.
            </p>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 ml-auto block text-sm font-bold text-[#F4F5F7]"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
