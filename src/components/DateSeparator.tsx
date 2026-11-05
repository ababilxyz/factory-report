/**
 * Garis tipis kiri-kanan dengan label tanggal di tengah.
 * Cermin `DateSeparator.kt` — dipakai Riwayat pekerja dan daftar laporan admin
 * supaya laporan dari hari berbeda tidak menyatu jadi satu dinding kartu.
 */
export default function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center py-2">
      <span className="h-px flex-1 bg-[#2F3238]" />
      <span className="rounded-full bg-[#18191C] px-3 py-1 text-[10px] font-semibold tracking-wider uppercase text-[#8E929B]">
        {label}
      </span>
      <span className="h-px flex-1 bg-[#2F3238]" />
    </div>
  )
}
