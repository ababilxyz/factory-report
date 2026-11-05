/**
 * Debu halus yang melayang naik di balik permukaan kaca.
 *
 * Dipakai hanya pada kartu hero dasbor sebagai kedalaman, bukan hiasan
 * (antislop R-07/R-19). Posisi berasal dari seed tetap supaya tidak berubah
 * setiap render. Saat `prefers-reduced-motion` aktif, partikel jadi titik
 * diam — efeknya tetap terbaca tanpa memaksa gerak.
 */
interface Props {
  count?: number
  seed?: number
  className?: string
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function ParticleField({ count = 18, seed = 7, className = '' }: Props) {
  const rnd = mulberry32(seed)
  const dots = Array.from({ length: count }, (_, i) => {
    const x = rnd() * 100
    const size = 1 + rnd() * 1.6
    const delay = rnd() * 14
    const duration = 14 + rnd() * 10
    const alpha = 0.08 + rnd() * 0.18
    return { id: i, x, size, delay, duration, alpha }
  })

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {dots.map((d) => (
        <span
          key={d.id}
          className="absolute bottom-0 rounded-full bg-white motion-safe:animate-[float_linear_infinite] motion-reduce:bottom-auto motion-reduce:top-1/2"
          style={{
            left: `${d.x}%`,
            width: d.size,
            height: d.size,
            opacity: d.alpha,
            animationDuration: `${d.duration}s`,
            animationDelay: `-${d.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
