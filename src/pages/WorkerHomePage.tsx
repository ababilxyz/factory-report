import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { motion } from 'framer-motion'
import { Factory, ScanQrCode, Home, User, Clock } from 'lucide-react'

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
      <header className='bg-factory-card border-b border-factory-border px-5 py-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='w-8 h-8 rounded-lg bg-factory-accent flex items-center justify-center text-white'>
              <Factory className='w-5 h-5' />
            </div>
            <div>
              <h1 className='text-white font-semibold text-base leading-tight'>Form Laporan Line AA</h1>
              <p className='text-factory-muted text-sm mt-0.5'>{appUser?.displayName}</p>
            </div>
          </div>
          <button
            onClick={() => void signOut()}
            className='text-factory-muted hover:text-white text-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-end'
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className='flex-1 flex flex-col items-center justify-center p-6 gap-6'>
        {/* Big Scan Button */}
        <motion.button
          onClick={() => navigate('/scan')}
          whileTap={{ scale: 0.97 }}
          className='w-full max-w-sm bg-factory-accent hover:bg-factory-accent-light text-white rounded-2xl p-8 flex flex-col items-center gap-4 transition-colors'
        >
          <div className='w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center'>
            <ScanQrCode className='w-10 h-10 text-white' />
          </div>
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
            {['Cari QR code yang tertempel', 'Tekan "Scan QR Code" dan izinkan akses kamera', 'Arahkan kamera ke kode QR', 'Ambil foto jika ada masalah dan dideskripsikan','Segera ambil tindakan', 'Ambil foto setelah dilakukan tindakan dan deskripsikan tindakan apa yang dilakukan', 'Kirim Laporan'].map((step, i) => (
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
          <Home className='w-5 h-5' />
          <span>Home</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/profile')}
          className='flex flex-col items-center gap-1 text-sm font-medium'
        >
          <User className='w-5 h-5' />
          <span>Profile</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/history')}
          className='flex flex-col items-center gap-1 text-sm font-medium'
        >
          <Clock className='w-5 h-5' />
          <span>History</span>
        </motion.button>
      </nav>
    </motion.div>
  )
}
