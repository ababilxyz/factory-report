import { useNavigate } from 'react-router-dom'
import { QrCode } from 'lucide-react'

export type WorkerTab = 'beranda' | 'riwayat' | 'profil'

const TAB_ROUTES: Record<WorkerTab, string> = {
  beranda: '/home',
  riwayat: '/history',
  profil: '/profile',
}

/**
 * Cermin `WorkerBottomBar.kt`: kapsul mengambang dengan dua tab pill dan tombol
 * pindai QR bulat di tengah. Disamakan supaya PWA dan APK tidak terasa seperti
 * dua aplikasi berbeda.
 *
 * Profil tidak punya tab sendiri — di kedua klien ia dibuka dari ikon di header,
 * jadi kapsul hanya memuat Beranda dan Riwayat.
 */
export default function WorkerBottomBar({ active }: { active: WorkerTab }) {
  const navigate = useNavigate()

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
      <div
        className="glass-rim mx-auto flex h-[66px] max-w-md items-center justify-between rounded-[33px] bg-[#222429]/90 px-3 backdrop-blur-md"
      >
        <PillTab label="Beranda" active={active === 'beranda'} onClick={() => navigate(TAB_ROUTES.beranda)} />

        <button
          type="button"
          onClick={() => navigate('/scan')}
          aria-label="Pindai Kode QR"
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border-[1.2px] border-[#3E424D] bg-[#2A2D35] text-[#F4F5F7] transition-transform active:scale-90"
        >
          <QrCode className="h-6 w-6" />
        </button>

        <PillTab label="Riwayat" active={active === 'riwayat'} onClick={() => navigate(TAB_ROUTES.riwayat)} />
      </div>
    </div>
  )
}

function PillTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 rounded-[23px] px-6 py-3 text-xs transition-colors ${
        active
          ? 'bg-[#F4F5F7] font-extrabold text-[#121417]'
          : 'font-semibold text-[#8E929B] hover:text-[#A8AEBC]'
      }`}
    >
      {label}
    </button>
  )
}