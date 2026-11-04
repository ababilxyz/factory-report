/**
 * Indikator evaluasi PIC: lingkaran dipotong empat kuadran.
 *
 * Nilai 0-4 = berapa perempat tugas PIC itu yang sudah selesai. Kuadran diisi
 * searah jarum jam dari kanan-atas supaya nilai 1 dan nilai 3 tidak tertukar
 * saat dibaca sekilas.
 */
const WEDGES = [
  'M 12 12 L 12 0 A 12 12 0 0 1 24 12 Z',
  'M 12 12 L 24 12 A 12 12 0 0 1 12 24 Z',
  'M 12 12 L 12 24 A 12 12 0 0 1 0 12 Z',
  'M 12 12 L 0 12 A 12 12 0 0 1 12 0 Z',
]

export default function EvaluationQuarters({ value, size = 24 }: { value: number; size?: number }) {
  const filled = Math.min(4, Math.max(0, Math.round(value)))
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={`Evaluasi ${filled} dari 4`}
    >
      <circle cx="12" cy="12" r="11" fill="none" stroke="#2F3238" strokeWidth="1.5" />
      {WEDGES.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={i < filled ? '#F4F5F7' : 'none'}
          stroke={i < filled ? '#F4F5F7' : '#2F3238'}
          strokeWidth="0.8"
        />
      ))}
    </svg>
  )
}