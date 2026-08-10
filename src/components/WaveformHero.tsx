import { useMemo, type CSSProperties } from 'react'

function envelope(x: number) {
  const centerA = Math.exp(-Math.pow((x - 0.47) / 0.18, 2))
  const centerB = 0.66 * Math.exp(-Math.pow((x - 0.76) / 0.24, 2))
  return Math.min(1, centerA + centerB)
}

function voicePath(index: number) {
  const points: string[] = []
  const scale = (index + 2) / 20
  for (let x = 0; x <= 880; x += 5) {
    const nx = x / 880
    const carrier = Math.sin(nx * Math.PI * 2 * (4.8 + index * 0.055))
    const formant = 0.45 * Math.sin(nx * Math.PI * 2 * 11.3 + index * 0.2)
    const y = 190 + (carrier + formant) * 128 * envelope(nx) * scale
    points.push(`${x === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return points.join(' ')
}

export function WaveformHero() {
  const paths = useMemo(() => Array.from({ length: 18 }, (_, index) => voicePath(index)), [])
  return (
    <div className="hero-wave" aria-hidden="true">
      <svg viewBox="0 0 880 380" preserveAspectRatio="none">
        <path d="M0 190h880" className="hero-wave__axis" />
        {paths.map((path, index) => (
          <path
            key={index}
            d={path}
            className="hero-wave__line"
            style={{ '--wave-index': index, opacity: 0.14 + index * 0.018 } as CSSProperties}
          />
        ))}
      </svg>
    </div>
  )
}
