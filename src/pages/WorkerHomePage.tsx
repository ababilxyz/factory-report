import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { motion } from 'framer-motion'

export default function WorkerHomePage() {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className='min-h-screen bg-factory-dark flex flex-col'
    >
      {/* Header */}
      <header className='bg-factory-card border-b border-factory-border px-4 py-4 flex items-center justify-between'>
        <div>
          <h1 className='text-white font-semibold'>Form Laporan Line AA</h1>
          <p className='text-factory-muted text-xs mt-0.5'>{appUser?.displayName}</p>
        </div>
        <button
          onClick={() => void signOut()}
          className='text-factory-muted hover:text-white text-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-end'
        >
          Sign out
        </button>
      </header>

      {/* Main content */}
      <main className='flex-1 flex flex-col items-center justify-center p-6 gap-6'>
        {/* Big Scan Button */}
        <motion.button
          onClick={() => navigate('/scan')}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
          className='w-full max-w-sm bg-factory-accent hover:bg-factory-accent-light text-white rounded-3xl p-8 flex flex-col items-center gap-4 transition-all shadow-lg shadow-indigo-900/30'
        >
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
            className='w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center'
          >
            <svg className='w-10 h-10 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.5}>
              <path strokeLinecap='round' strokeLinejoin='round' d='M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z' />
              <path strokeLinecap='round' strokeLinejoin='round' d='M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z' />
            </svg>
          </motion.div>
          <div className='text-center'>
            <p className='text-xl font-bold'>Scan QR Code</p>
            <p className='text-white/70 text-sm mt-1'>Scan QR Code Untuk Melaporkan</p>
          </div>
        </motion.button>

        {/* Instructions card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className='w-full max-w-sm bg-factory-card border border-factory-border rounded-2xl p-5'
        >
          <h2 className='text-white font-bold mb-3'>Cara Melaporkan</h2>
          <ol className='space-y-2.5 text-sm text-factory-muted'>
            {['Cari QR Code Yang Tertempel', 'Tekan "Scan QR Code" dan izinkan akses kamera', 'Arahkan kamera ke kode QR', 'Ambil foto jika ada masalah', 'Deskripsikan masalah dan kirim', 'Segera Ambil Tindakan', 'Berikan Foto Setelah Dilakukan Tindakan dan Deskripsikan Tindakan Apa Yang Dilakukan'].map((step, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
                className='flex gap-3 items-start'
              >
                <span className='w-5 h-5 rounded-full bg-factory-accent/20 text-factory-accent text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-medium'>
                  {i + 1}
                </span>
                <span>{step}</span>
              </motion.li>
            ))}
          </ol>
        </motion.div>
      </main>

      {/* Bottom Navigation */}
      <nav className='bg-factory-card border-t border-factory-border px-4 py-3 flex justify-around'>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/home')}
          className='flex flex-col items-center gap-1 text-sm font-medium'
        >
          <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
            <path strokeLinecap='round' strokeLinejoin='round' d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 001 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001-1m-5 8v-3' />
          </svg>
          <span>Home</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/profile')}
          className='flex flex-col items-center gap-1 text-sm font-medium'
        >
          <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
            <path strokeLinecap='round' strokeLinejoin='round' d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
          </svg>
          <span>Profile</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/history')}
          className='flex flex-col items-center gap-1 text-sm font-medium'
        >
          <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
            <path strokeLinecap='round' strokeLinejoin='round' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z' />
          </svg>
          <span>History</span>
        </motion.button>
      </nav>
    </motion.div>
  )
}
