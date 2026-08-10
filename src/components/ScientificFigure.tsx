import { useId, useMemo } from 'react'
import type { FigureKind } from '../types'

interface ScientificFigureProps {
  kind: FigureKind
  title: string
}

function wavePath(amplitude: number, cycles: number, phase = 0, y = 110) {
  const points: string[] = []
  for (let x = 0; x <= 720; x += 6) {
    const value = y + Math.sin((x / 720) * Math.PI * 2 * cycles + phase) * amplitude
    points.push(`${x === 0 ? 'M' : 'L'}${x.toFixed(1)},${value.toFixed(1)}`)
  }
  return points.join(' ')
}

function Arrow({ markerId, dashed = false }: { markerId: string; dashed?: boolean }) {
  return (
    <path
      d="M0 0h82"
      className={dashed ? 'diagram-dashed' : undefined}
      markerEnd={`url(#${markerId})`}
    />
  )
}

function DiagramDefs({ markerId }: { markerId: string }) {
  return (
    <defs>
      <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 10 5 0 10Z" fill="currentColor" stroke="none" />
      </marker>
      <pattern id={`${markerId}-dots`} width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.25" fill="currentColor" stroke="none" />
      </pattern>
    </defs>
  )
}

function PressureFigure() {
  return (
    <>
      <path d={wavePath(48, 2.5)} className="diagram-wave diagram-wave--moving" />
      {Array.from({ length: 22 }, (_, index) => {
        const x = 22 + index * 32
        const offset = Math.sin(index * 0.72) * 14
        return <circle key={x} cx={x + offset} cy="110" r="3" />
      })}
      <path d="M0 110h720" className="diagram-faint" />
      <text x="18" y="28">compression</text>
      <text x="610" y="198">rarefaction</text>
    </>
  )
}

function HarmonicsFigure() {
  return (
    <>
      <path d={wavePath(28, 1, 0, 42)} />
      <path d={wavePath(18, 2, 0, 100)} />
      <path d={wavePath(12, 3, 0, 150)} />
      <path d={wavePath(36, 1, 0, 205)} className="diagram-heavy" />
      <text x="16" y="25">fundamental</text>
      <text x="16" y="88">2×</text>
      <text x="16" y="140">3×</text>
      <text x="620" y="205">sum</text>
    </>
  )
}

function ChladniFigure() {
  return (
    <>
      <rect x="238" y="12" width="244" height="196" />
      <path d="M238 110h244M360 12v196" />
      <path d="M250 30c58 36 58 124 0 160M470 30c-58 36-58 124 0 160" />
      <path d="M268 24c30 56 154 56 184 0M268 196c30-56 154-56 184 0" />
      {Array.from({ length: 72 }, (_, i) => {
        const angle = i * 2.4
        const radius = 16 + ((i * 17) % 96)
        const x = 360 + Math.cos(angle) * radius
        const y = 110 + Math.sin(angle * 1.7) * Math.min(radius, 84)
        return <circle key={i} cx={x} cy={y} r="1.4" fill="currentColor" stroke="none" />
      })}
      <text x="20" y="35">vibration makes</text>
      <text x="20" y="57">nodes visible</text>
    </>
  )
}

function TraceFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <path d={wavePath(46, 4, 0, 112)} className="diagram-wave--moving" />
      <path d="M568 40 620 110 568 180Z" />
      <path d="M620 110h72" markerEnd={`url(#${markerId})`} />
      <path d="M20 198c90-28 140 28 230 0s140 28 230 0 140 28 220 0" />
      <text x="538" y="28">stylus</text>
      <text x="18" y="28">airborne pressure</text>
      <text x="18" y="218">inscribed trace</text>
    </>
  )
}

function GrooveFigure() {
  return (
    <>
      {Array.from({ length: 9 }, (_, index) => (
        <ellipse key={index} cx="360" cy="112" rx={308 - index * 29} ry={98 - index * 8} />
      ))}
      <path d={wavePath(9, 18, 0, 112)} className="diagram-heavy" />
      <circle cx="360" cy="112" r="10" fill="currentColor" />
      <text x="22" y="26">time becomes distance</text>
      <text x="534" y="214">distance becomes time again</text>
    </>
  )
}

function TransductionFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <g transform="translate(38 78)"><Arrow markerId={markerId} /><text x="0" y="-18">pressure</text></g>
      <path d="M156 36c30 28 30 124 0 152M178 36v152" className="diagram-heavy" />
      <line x1="178" y1="112" x2="250" y2="112" />
      <g transform="translate(264 78)"><Arrow markerId={markerId} /></g>
      <path d="M360 72c-28 0-28 18 0 18s28 18 0 18-28 18 0 18 28 18 0 18-28 18 0 18" />
      <path d="M388 72h76v108h-76M464 72h76M464 180h76" />
      <circle cx="546" cy="72" r="4" /><circle cx="546" cy="180" r="4" />
      <path d={wavePath(24, 3, 0, 112).replaceAll(/([ML])([0-9.]+),/g, (_, command, x) => `${command}${Number(x) * 0.2 + 570},`)} />
      <text x="132" y="215">diaphragm</text><text x="330" y="215">transducer</text><text x="572" y="215">voltage</text>
    </>
  )
}

function BroadcastFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <path d={wavePath(26, 2, 0, 42)} />
      <text x="18" y="22">voice</text>
      <path d={wavePath(18, 18, 0, 106)} />
      <text x="18" y="83">carrier</text>
      <path d={wavePath(44, 18, 0, 178)} className="diagram-heavy" />
      <path d={wavePath(28, 2, 0, 178)} className="diagram-dashed" />
      <g transform="translate(610 28)"><Arrow markerId={markerId} /></g>
      <text x="620" y="19">distance</text>
      <text x="18" y="222">amplitude follows the message</text>
    </>
  )
}

function SamplingFigure() {
  const samples = useMemo(() => Array.from({ length: 17 }, (_, index) => {
    const x = 36 + index * 40
    return { x, y: 112 + Math.sin((x / 720) * Math.PI * 8) * 54 }
  }), [])
  return (
    <>
      <path d={wavePath(54, 4, 0, 112)} className="diagram-faint" />
      {samples.map(({ x, y }) => (
        <g key={x}><path d={`M${x} 190V${y}`} className="diagram-dashed" /><circle cx={x} cy={y} r="5" fill="currentColor" /></g>
      ))}
      <path d={`M${samples.map(({ x, y }) => `${x},${y}`).join(' L')}`} className="diagram-heavy" />
      <text x="18" y="26">continuous</text><text x="566" y="214">discrete observations</text>
    </>
  )
}

function FilterFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <path d={wavePath(28, 8, 0, 48)} /><path d={wavePath(8, 31, 0.8, 48)} />
      <g transform="translate(318 78)"><Arrow markerId={markerId} /></g>
      <rect x="410" y="72" width="112" height="76" />
      <path d="M428 130 450 108 472 119 495 89 510 92" />
      <text x="430" y="100">filter</text>
      <g transform="translate(538 78)"><Arrow markerId={markerId} /></g>
      <path d={wavePath(34, 3, 0, 188)} className="diagram-heavy" />
      <text x="18" y="80">signal + unwanted band</text><text x="545" y="222">selected structure</text>
    </>
  )
}

function CodecFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <path d={wavePath(34, 5, 0, 58)} />
      <g transform="translate(146 82)"><Arrow markerId={markerId} /></g>
      <g transform="translate(250 26)">{Array.from({ length: 24 }, (_, i) => <rect key={i} x={(i % 8) * 18} y={Math.floor(i / 8) * 28} width="12" height={8 + ((i * 7) % 18)} fill={i % 3 ? 'none' : 'currentColor'} />)}</g>
      <g transform="translate(410 82)"><Arrow markerId={markerId} /></g>
      <text x="514" y="66">0110 1011</text><text x="514" y="92">0010 1101</text><text x="514" y="118">1011 0001</text>
      <path d={wavePath(28, 5, 0, 186)} className="diagram-heavy" />
      <text x="18" y="215">reconstructed ≠ identical</text>
    </>
  )
}

function RecognitionFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <path d={wavePath(34, 6, 0, 52)} />
      <g transform="translate(160 76)"><Arrow markerId={markerId} /></g>
      <g transform="translate(260 24)">{Array.from({ length: 56 }, (_, i) => <rect key={i} x={(i % 14) * 13} y={Math.floor(i / 14) * 24} width="9" height="18" fill="currentColor" opacity={0.08 + ((i * 13) % 80) / 100} stroke="none" />)}</g>
      <g transform="translate(460 76)"><Arrow markerId={markerId} /></g>
      <text x="570" y="52">/v/ /ɔɪ/ /s/</text><text x="570" y="96" className="diagram-label-large">VOICE</text>
      <path d="M18 184h684" className="diagram-faint" /><text x="18" y="214">probability replaces a single mechanical path</text>
    </>
  )
}

function SynthesisFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <text x="28" y="58" className="diagram-label-large">VOICE</text>
      <g transform="translate(144 44)"><Arrow markerId={markerId} /></g>
      <g transform="translate(246 22)">{Array.from({ length: 34 }, (_, i) => <rect key={i} x={i * 8} y={92 - ((i * 17) % 74)} width="5" height={8 + ((i * 17) % 74)} fill="currentColor" stroke="none" />)}</g>
      <g transform="translate(520 44)"><Arrow markerId={markerId} /></g>
      <path d={wavePath(42, 7, 0, 164)} className="diagram-heavy diagram-wave--moving" />
      <text x="248" y="138">acoustic plan</text><text x="585" y="214">waveform</text>
    </>
  )
}

function TokensFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <path d={wavePath(34, 7, 0, 52)} />
      <g transform="translate(180 76)"><Arrow markerId={markerId} /></g>
      <g transform="translate(286 34)">{['042', '317', '088', '512', '203', '731', '019'].map((value, i) => <g key={value} transform={`translate(${i * 58} 0)`}><rect width="46" height="46" fill={i % 2 ? 'none' : 'currentColor'} /><text x="23" y="29" textAnchor="middle" fill={i % 2 ? 'currentColor' : 'var(--paper)'}>{value}</text></g>)}</g>
      <path d="M288 114h390" className="diagram-dashed" />
      <text x="288" y="146">a learned alphabet of acoustic events</text>
      <text x="18" y="214">the code is useful; it is not a transcript of meaning</text>
    </>
  )
}

function BeamformingFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <circle cx="92" cy="92" r="34" /><path d="M42 92h100M92 42v100" className="diagram-faint" /><text x="54" y="28">source</text>
      {[250, 360, 470, 580].map((x, i) => <g key={x}><circle cx={x} cy="168" r="9" fill="currentColor" /><path d={`M110 92 Q${210 + i * 72} ${32 + i * 8} ${x} 159`} className="diagram-dashed" /><text x={x - 18} y="202">+{i * 2}Δt</text></g>)}
      <g transform="translate(602 134)"><Arrow markerId={markerId} /></g>
      <text x="584" y="114">align</text><text x="584" y="224">sum</text>
    </>
  )
}

function DuplexFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <circle cx="142" cy="110" r="62" /><circle cx="578" cy="110" r="62" />
      <text x="142" y="106" textAnchor="middle">human</text><text x="142" y="128" textAnchor="middle">stream</text>
      <text x="578" y="106" textAnchor="middle">model</text><text x="578" y="128" textAnchor="middle">stream</text>
      <path d="M210 82h294" markerEnd={`url(#${markerId})`} className="diagram-wave--moving" />
      <path d="M510 142H216" markerEnd={`url(#${markerId})`} className="diagram-wave--moving" />
      <path d="M360 44v132" className="diagram-dashed" /><path d="M346 96l28 28M374 96l-28 28" className="diagram-heavy" />
      <text x="317" y="26">barge-in</text><text x="263" y="212">both paths remain open</text>
    </>
  )
}

function StackFigure({ markerId }: { markerId: string }) {
  const rows = ['AIR / ROOM', 'MICROPHONE ARRAY', 'AUDIO DSP', 'NEURAL MODEL', 'TOOLS + MEMORY', 'LOUDSPEAKER']
  return (
    <>
      {rows.map((row, index) => <g key={row} transform={`translate(112 ${14 + index * 34})`}><rect width="496" height="25" fill={index === 2 || index === 3 ? 'currentColor' : 'none'} /><text x="248" y="18" textAnchor="middle" fill={index === 2 || index === 3 ? 'var(--paper)' : 'currentColor'}>{row}</text></g>)}
      <path d="M74 22v180" markerEnd={`url(#${markerId})`} /><path d="M646 198V18" markerEnd={`url(#${markerId})`} />
      <text x="20" y="112" transform="rotate(-90 20 112)">listen</text><text x="700" y="112" transform="rotate(90 700 112)">speak</text>
    </>
  )
}

function ArchitectureFigure({ markerId }: { markerId: string }) {
  return (
    <>
      <rect x="34" y="66" width="270" height="96" /><text x="169" y="106" textAnchor="middle">continuous media loop</text><text x="169" y="130" textAnchor="middle">listen ⇄ speak</text>
      <path d="M304 114h110" markerEnd={`url(#${markerId})`} />
      <rect x="414" y="36" width="270" height="58" /><text x="549" y="70" textAnchor="middle">frontier reasoning</text>
      <rect x="414" y="126" width="122" height="58" /><text x="475" y="160" textAnchor="middle">tools</text>
      <rect x="562" y="126" width="122" height="58" /><text x="623" y="160" textAnchor="middle">memory</text>
      <path d="M414 64 304 91" markerEnd={`url(#${markerId})`} className="diagram-dashed" />
      <path d="M414 154 304 132" markerEnd={`url(#${markerId})`} className="diagram-dashed" />
      <path d="M562 154 304 142" markerEnd={`url(#${markerId})`} className="diagram-dashed" />
      <text x="331" y="205">solid: documented live path</text><text x="331" y="224">dashed: asynchronous delegation</text>
    </>
  )
}

function ClocksFigure() {
  const rows = [
    ['audio', 1],
    ['interaction', 3],
    ['reasoning', 7],
    ['memory', 14],
  ] as const
  return (
    <>
      {rows.map(([label, stride], row) => <g key={label} transform={`translate(104 ${34 + row * 51})`}><text x="-86" y="5">{label}</text><path d="M0 0h590" />{Array.from({ length: Math.ceil(24 / stride) }, (_, i) => <path key={i} d={`M${i * stride * 24} -9v18`} className={row > 1 ? 'diagram-heavy' : undefined} />)}</g>)}
      <text x="498" y="228">different clocks, one experience</text>
    </>
  )
}

export function ScientificFigure({ kind, title }: ScientificFigureProps) {
  const reactId = useId().replaceAll(':', '')
  const markerId = `arrow-${kind}-${reactId}`

  const content = (() => {
    switch (kind) {
      case 'pressure': return <PressureFigure />
      case 'harmonics': return <HarmonicsFigure />
      case 'chladni': return <ChladniFigure />
      case 'trace': return <TraceFigure markerId={markerId} />
      case 'groove': return <GrooveFigure />
      case 'transduction': return <TransductionFigure markerId={markerId} />
      case 'broadcast': return <BroadcastFigure markerId={markerId} />
      case 'sampling': return <SamplingFigure />
      case 'filter': return <FilterFigure markerId={markerId} />
      case 'codec': return <CodecFigure markerId={markerId} />
      case 'recognition': return <RecognitionFigure markerId={markerId} />
      case 'synthesis': return <SynthesisFigure markerId={markerId} />
      case 'tokens': return <TokensFigure markerId={markerId} />
      case 'beamforming': return <BeamformingFigure markerId={markerId} />
      case 'duplex': return <DuplexFigure markerId={markerId} />
      case 'stack': return <StackFigure markerId={markerId} />
      case 'architecture': return <ArchitectureFigure markerId={markerId} />
      case 'clocks': return <ClocksFigure />
    }
  })()

  return (
    <div className="scientific-figure__viewport" tabIndex={0} aria-label={`${title}. Scroll horizontally if needed.`}>
      <svg className="scientific-figure__svg" viewBox="0 0 720 240" role="img" aria-labelledby={`${markerId}-title ${markerId}-desc`}>
        <title id={`${markerId}-title`}>{title}</title>
        <desc id={`${markerId}-desc`}>A simplified, idealised scientific diagram. Its meaning is explained in the caption and surrounding text.</desc>
        <DiagramDefs markerId={markerId} />
        {content}
      </svg>
    </div>
  )
}
