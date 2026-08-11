import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { BookSection } from '../types'
import type { NarrationCatalogueStatus, NarrationStatus } from '../hooks/useNarrationPlayer'
import { narrationTargetId } from '../lib/narration'
import { PlayIcon, StopIcon } from './Icons'
import { SectionListenButton } from './NarrationControls'
import { ScientificFigure } from './ScientificFigure'

type LabMode = 'wave' | 'string' | 'groove' | 'sampling' | 'codec' | 'conversation'
type Comparison = 'original' | 'processed'

const modes: Array<{ id: LabMode; label: string }> = [
  { id: 'wave', label: 'Wave' },
  { id: 'string', label: 'String' },
  { id: 'groove', label: 'Groove' },
  { id: 'sampling', label: 'Sample' },
  { id: 'codec', label: 'Codec' },
  { id: 'conversation', label: 'Voice' },
]

function sinePoints(frequency: number, amplitude: number, width = 720, height = 260) {
  const cycles = Math.max(1.5, Math.min(10, frequency / 90))
  const points: string[] = []
  for (let x = 0; x <= width; x += 3) {
    const y = height / 2 - Math.sin((x / width) * cycles * Math.PI * 2) * amplitude
    points.push(`${x === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return points.join(' ')
}

function quantisedPoints(frequency: number, amplitude: number, bits: number) {
  const levels = 2 ** bits
  const points: string[] = []
  for (let x = 0; x <= 720; x += 6) {
    const value = Math.sin((x / 720) * Math.max(1.5, frequency / 90) * Math.PI * 2)
    const quantised = Math.round(((value + 1) / 2) * (levels - 1)) / (levels - 1) * 2 - 1
    const y = 130 - quantised * amplitude
    points.push(`${x === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return points.join(' ')
}

function aliasFrequency(frequency: number, sampleRate: number) {
  const folded = Math.abs(frequency - Math.round(frequency / sampleRate) * sampleRate)
  return folded
}

function stringPath(harmonic: number, amplitude: number) {
  const points: string[] = []
  for (let x = 22; x <= 698; x += 3) {
    const position = (x - 22) / 676
    const y = 130 - Math.sin(position * harmonic * Math.PI) * amplitude
    points.push(`${x === 22 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return points.join(' ')
}

interface LabPlotProps {
  mode: LabMode
  comparison: Comparison
  frequency: number
  amplitude: number
  sampleRate: number
  bits: number
  latency: number
  playing: boolean
}

function LabPlot({ mode, comparison, frequency, amplitude, sampleRate, bits, latency, playing }: LabPlotProps) {
  const wave = useMemo(() => sinePoints(frequency, amplitude), [frequency, amplitude])
  const aliased = useMemo(() => sinePoints(aliasFrequency(frequency, sampleRate), amplitude), [frequency, sampleRate, amplitude])
  const quantised = useMemo(() => quantisedPoints(frequency, amplitude, bits), [frequency, amplitude, bits])
  const sampleCount = Math.max(5, Math.min(48, Math.round(sampleRate / 160)))
  const samples = useMemo(() => Array.from({ length: sampleCount }, (_, index) => {
    const x = 20 + (index / Math.max(1, sampleCount - 1)) * 680
    const cycles = Math.max(1.5, Math.min(10, frequency / 90))
    return { x, y: 130 - Math.sin((x / 720) * cycles * Math.PI * 2) * amplitude }
  }), [amplitude, frequency, sampleCount])
  const modeLabel = modes.find((item) => item.id === mode)?.label ?? 'Audio'
  const scrollHelpId = `lab-${mode}-scroll-help`

  return (
    <div
      className="lab-plot horizontal-scroll-region"
      data-page-keys="ignore"
      role="group"
      tabIndex={0}
      aria-label={`${modeLabel} demonstration plot`}
      aria-describedby={scrollHelpId}
      aria-keyshortcuts="ArrowLeft ArrowRight"
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        const viewport = event.currentTarget
        if (viewport.scrollWidth <= viewport.clientWidth) return
        event.preventDefault()
        viewport.scrollBy({
          left: event.key === 'ArrowRight' ? Math.max(72, viewport.clientWidth * 0.24) : -Math.max(72, viewport.clientWidth * 0.24),
          behavior: 'auto',
        })
      }}
    >
      <span id={scrollHelpId} className="sr-only">Use the Left and Right Arrow keys to pan when this plot is wider than the page.</span>
      <svg viewBox="0 0 720 260" role="img" aria-labelledby={`lab-${mode}-title lab-${mode}-desc`}>
        <title id={`lab-${mode}-title`}>{mode} demonstration</title>
        <desc id={`lab-${mode}-desc`}>Idealised generated audio plot. It is not a calibrated measurement of this device.</desc>
        <path d="M0 130h720M0 28v204" className="lab-axis" />
        {[180, 360, 540].map((x) => <path key={x} d={`M${x} 26v208`} className="lab-gridline" />)}
        {mode === 'wave' ? (
          <>
            <path d={wave} className={`lab-wave${playing ? ' lab-wave--animated' : ''}`} />
            {comparison === 'processed' ? <path d={sinePoints(frequency * 2, amplitude * 0.26)} className="lab-wave lab-wave--faint" /> : null}
          </>
        ) : null}
        {mode === 'string' ? (
          <>
            <path d="M22 130h676" className="lab-string-rest" />
            <path d={stringPath(comparison === 'processed' ? 3 : 1, amplitude)} className={`lab-wave${playing ? ' lab-wave--animated' : ''}`} />
            <circle cx="22" cy="130" r="6" /><circle cx="698" cy="130" r="6" />
            <text x="24" y="28">{comparison === 'processed' ? 'THIRD HARMONIC · 3 × f' : 'FUNDAMENTAL · 1 × f'}</text>
          </>
        ) : null}
        {mode === 'groove' ? (
          <>
            {Array.from({ length: 9 }, (_, index) => {
              const y = 48 + index * 20
              const depth = comparison === 'processed' ? 7 + (index % 3) * 2 : 14
              return <path key={y} d={`M16 ${y} C120 ${y - depth}, 196 ${y + depth}, 300 ${y} S480 ${y - depth}, 704 ${y}`} className={index === 4 ? 'lab-wave lab-wave--processed' : 'lab-groove'} />
            })}
            <path d="M332 24v212M316 34l16-10 16 10" className="lab-stylus" />
            <text x="354" y="42">STYLUS FOLLOWS LATERAL MOTION</text>
          </>
        ) : null}
        {mode === 'sampling' ? (
          <>
            <path d={wave} className="lab-wave lab-wave--faint" />
            {samples.map(({ x, y }) => <g key={x}><path d={`M${x} 218V${y}`} className="lab-gridline" /><circle cx={x} cy={y} r="4.5" /></g>)}
            {comparison === 'processed' ? <path d={aliased} className="lab-wave lab-wave--processed" /> : null}
          </>
        ) : null}
        {mode === 'codec' ? (
          <>
            <path d={wave} className="lab-wave lab-wave--faint" />
            <path d={comparison === 'processed' ? quantised : wave} className="lab-wave lab-wave--processed" />
            {Array.from({ length: Math.min(2 ** bits, 16) }, (_, index) => {
              const y = 32 + index * (196 / Math.max(1, Math.min(2 ** bits, 16) - 1))
              return <path key={index} d={`M0 ${y}h720`} className="lab-gridline" />
            })}
          </>
        ) : null}
        {mode === 'conversation' ? (
          <>
            <text x="16" y="62">YOU</text><text x="16" y="190">SYSTEM</text>
            <rect x="116" y="34" width="248" height="48" fill="currentColor" />
            <rect x={116 + latency * 0.32} y="160" width="226" height="48" fill={comparison === 'processed' ? 'currentColor' : 'none'} />
            <rect x="366" y="34" width="84" height="48" fill="none" className="lab-interruption" />
            <path d={`M${116 + latency * 0.32} 104v44`} className="lab-gridline" />
            <text x={116 + latency * 0.32 + 8} y="132">{latency} ms</text>
            {comparison === 'processed' ? <path d="M366 28v190M350 107l32 32M382 107l-32 32" className="lab-wave--processed" /> : null}
          </>
        ) : null}
        <text x="8" y="250">0</text><text x="338" y="250">{mode === 'groove' ? 'distance' : 'time'}</text><text x="694" y="250">→</text>
      </svg>
    </div>
  )
}

interface SoundLabProps {
  section: BookSection
  activeNarrationTargetId: string | null
  narrationStatus: NarrationStatus
  catalogueStatus: NarrationCatalogueStatus
  catalogueError: string | null
  narrationActive: boolean
  evidenceOpen: boolean
  sourceCount: number
  onStartNarration: () => void
  onPauseNarration: () => void
  onResumeNarration: () => void
  onRetryNarration: () => void
  onOpenEvidence: () => void
}

export function SoundLab({
  section,
  activeNarrationTargetId,
  narrationStatus,
  catalogueStatus,
  catalogueError,
  narrationActive,
  evidenceOpen,
  sourceCount,
  onStartNarration,
  onPauseNarration,
  onResumeNarration,
  onRetryNarration,
  onOpenEvidence,
}: SoundLabProps) {
  const [mode, setMode] = useState<LabMode>('wave')
  const [comparison, setComparison] = useState<Comparison>('original')
  const [frequency, setFrequency] = useState(440)
  const [amplitude, setAmplitude] = useState(88)
  const [sampleRate, setSampleRate] = useState(800)
  const [bits, setBits] = useState(3)
  const [latency, setLatency] = useState(260)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const sourcesRef = useRef<AudioScheduledSourceNode[]>([])
  const graphNodesRef = useRef<AudioNode[]>([])
  const timerRef = useRef<number | null>(null)
  const runIdRef = useRef(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const stop = useCallback(() => {
    runIdRef.current += 1
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    for (const source of sourcesRef.current) {
      try { source.stop() } catch { /* The source may already have ended. */ }
    }
    for (const node of graphNodesRef.current) {
      try { node.disconnect() } catch { /* Safe cleanup for detached nodes. */ }
    }
    sourcesRef.current = []
    graphNodesRef.current = []
    setPlaying(false)
  }, [])

  useEffect(() => {
    window.addEventListener('pv:stop-media', stop)
    return () => {
      window.removeEventListener('pv:stop-media', stop)
      stop()
      void contextRef.current?.close()
    }
  }, [stop])

  const play = useCallback(async () => {
    window.dispatchEvent(new CustomEvent('pv:stop-media', { detail: { source: 'laboratory' } }))
    stop()
    const runId = runIdRef.current
    setError(null)
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) {
      setError('Web Audio is unavailable in this browser.')
      return
    }

    try {
      const context = contextRef.current ?? new AudioContextClass()
      contextRef.current = context
      await context.resume()
      if (runIdRef.current !== runId) return
      const master = context.createGain()
      const generatedLevel = mode === 'wave' ? Math.max(0.035, Math.min(0.16, amplitude / 680)) : 0.13
      master.gain.setValueAtTime(0.0001, context.currentTime)
      master.gain.exponentialRampToValueAtTime(generatedLevel, context.currentTime + 0.025)
      master.gain.setValueAtTime(generatedLevel, context.currentTime + 1.55)
      master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.78)
      master.connect(context.destination)
      graphNodesRef.current.push(master)

      const createTone = (start: number, duration: number, hz: number, type: OscillatorType = 'sine', gainValue = 1) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = type
        oscillator.frequency.setValueAtTime(Math.max(24, hz), context.currentTime + start)
        gain.gain.setValueAtTime(0.0001, context.currentTime + start)
        gain.gain.exponentialRampToValueAtTime(gainValue, context.currentTime + start + 0.02)
        gain.gain.setValueAtTime(gainValue, context.currentTime + Math.max(start + 0.03, start + duration - 0.04))
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration)
        oscillator.connect(gain)
        gain.connect(master)
        oscillator.start(context.currentTime + start)
        oscillator.stop(context.currentTime + start + duration + 0.02)
        sourcesRef.current.push(oscillator)
        graphNodesRef.current.push(oscillator, gain)
      }

      if (mode === 'conversation') {
        createTone(0, 0.72, 280, 'sine', 0.75)
        createTone(0.22, 0.42, 320, 'sine', 0.4)
        const responseStart = comparison === 'processed' ? latency / 1000 : Math.max(0.86, latency / 1000)
        createTone(responseStart, 0.84, 520, 'triangle', 0.55)
        if (comparison === 'processed') createTone(0.72, 0.15, 180, 'square', 0.24)
      } else if (mode === 'string') {
        createTone(0, 1.72, frequency, 'sine', .7)
        if (comparison === 'processed') {
          createTone(0, 1.3, frequency * 2, 'sine', .28)
          createTone(0, .95, frequency * 3, 'sine', .16)
        }
      } else if (mode === 'groove') {
        const oscillator = context.createOscillator()
        const filter = context.createBiquadFilter()
        oscillator.type = 'sawtooth'
        oscillator.frequency.setValueAtTime(frequency, context.currentTime)
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(comparison === 'processed' ? 4200 : 12_000, context.currentTime)
        oscillator.connect(filter)
        filter.connect(master)
        oscillator.start()
        oscillator.stop(context.currentTime + 1.8)
        sourcesRef.current.push(oscillator)
        graphNodesRef.current.push(oscillator, filter)
      } else {
        let outputFrequency = frequency
        if (mode === 'sampling' && comparison === 'processed') outputFrequency = aliasFrequency(frequency, sampleRate)
        const oscillator = context.createOscillator()
        oscillator.type = mode === 'wave' && comparison === 'processed' ? 'triangle' : 'sine'
        oscillator.frequency.setValueAtTime(outputFrequency, context.currentTime)

        if (mode === 'codec' && comparison === 'processed') {
          const shaper = context.createWaveShaper()
          const levels = 2 ** bits
          const curve = new Float32Array(2048)
          for (let index = 0; index < curve.length; index += 1) {
            const input = (index / (curve.length - 1)) * 2 - 1
            curve[index] = Math.round(((input + 1) / 2) * (levels - 1)) / (levels - 1) * 2 - 1
          }
          shaper.curve = curve
          oscillator.connect(shaper)
          shaper.connect(master)
          graphNodesRef.current.push(shaper)
        } else {
          oscillator.connect(master)
        }
        oscillator.start()
        oscillator.stop(context.currentTime + 1.8)
        sourcesRef.current.push(oscillator)
        graphNodesRef.current.push(oscillator)
      }

      setPlaying(true)
      timerRef.current = window.setTimeout(() => {
        if (runIdRef.current === runId) {
          for (const node of graphNodesRef.current) {
            try { node.disconnect() } catch { /* Safe cleanup for detached nodes. */ }
          }
          sourcesRef.current = []
          graphNodesRef.current = []
          setPlaying(false)
        }
      }, 1900)
    } catch {
      if (runIdRef.current !== runId) return
      setError('Audio could not start. Check this browser’s media settings and try again.')
      setPlaying(false)
    }
  }, [amplitude, bits, comparison, frequency, latency, mode, sampleRate, stop])

  const reset = () => {
    stop()
    setFrequency(440)
    setAmplitude(88)
    setSampleRate(800)
    setBits(3)
    setLatency(260)
    setComparison('original')
  }

  const selectMode = (nextMode: LabMode) => {
    stop()
    setMode(nextMode)
    setComparison('original')
  }

  const updateFrequency = (value: number) => {
    stop()
    setFrequency(value)
  }

  const updateAmplitude = (value: number) => {
    stop()
    setAmplitude(value)
  }

  const updateSampleRate = (value: number) => {
    stop()
    setSampleRate(value)
  }

  const updateBits = (value: number) => {
    stop()
    setBits(value)
  }

  const updateLatency = (value: number) => {
    stop()
    setLatency(value)
  }

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let targetIndex = index
    if (event.key === 'ArrowRight') targetIndex = (index + 1) % modes.length
    else if (event.key === 'ArrowLeft') targetIndex = (index - 1 + modes.length) % modes.length
    else if (event.key === 'Home') targetIndex = 0
    else if (event.key === 'End') targetIndex = modes.length - 1
    else return
    event.preventDefault()
    const targetMode = modes[targetIndex]
    if (targetMode) selectMode(targetMode.id)
    tabRefs.current[targetIndex]?.focus()
  }

  const belowNyquist = sampleRate < frequency * 2
  const explanation = mode === 'wave'
    ? 'Frequency controls repetitions per second. Amplitude controls the plotted and generated signal level—not perceived loudness.'
    : mode === 'string'
      ? comparison === 'original'
        ? 'A fixed string supports a fundamental standing wave with nodes at both ends.'
        : 'Real strings also carry harmonics. The second and third modes add brightness without changing the perceived fundamental.'
      : mode === 'groove'
        ? comparison === 'original'
          ? 'A lateral groove stores pressure changes as side-to-side motion. The stylus retraces that geometry.'
          : 'The processed example narrows the bandwidth, echoing the physical limits of an early mechanical recording path.'
    : mode === 'sampling'
      ? belowNyquist
        ? `The rate is below twice the signal frequency. The processed example folds toward an alias near ${Math.round(aliasFrequency(frequency, sampleRate))} Hz.`
        : 'The rate is above twice this idealised tone frequency. Real reconstruction still requires band-limiting and a reconstruction filter.'
      : mode === 'codec'
        ? `${bits} bits provide ${2 ** bits} idealised amplitude levels in this toy scalar codec. Quantisation error is distinct from sampling error.`
        : 'The two lanes separate who is producing audio. Processed mode demonstrates overlap, response delay, and an interruption marker.'
  const headerTargetId = narrationTargetId(section.id)
  const introTargetId = narrationTargetId(section.id, 0)
  const loopHeadingTargetId = narrationTargetId(section.id, 1)
  const loopCopyTargetId = narrationTargetId(section.id, 2)
  const loopFigureTargetId = narrationTargetId(section.id, 3)
  const intro = section.blocks[0]
  const loopHeading = section.blocks[1]
  const loopCopy = section.blocks[2]
  const loopFigure = section.blocks[3]

  return (
    <article className="sound-lab" aria-labelledby="sound-lab-title">
      <header className="sound-lab__header">
        <div id={headerTargetId} className={`narration-target${activeNarrationTargetId === headerTargetId ? ' narration-target--active' : ''}`}>
          <span>Interactive section</span>
          <h1 id="sound-lab-title">{section.title}</h1>
          <p className="sound-lab__deck">{section.deck}</p>
        </div>
        <div className="sound-lab__commands">
          <button type="button" className="text-button" onClick={reset}>Reset</button>
          <SectionListenButton
            id={`listen-${section.id}`}
            status={narrationStatus}
            catalogueStatus={catalogueStatus}
            catalogueError={catalogueError}
            active={narrationActive}
            onStart={onStartNarration}
            onPause={onPauseNarration}
            onResume={onResumeNarration}
            onRetry={onRetryNarration}
          />
          <button
            className="evidence-control"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={evidenceOpen}
            aria-controls="evidence-drawer"
            onClick={onOpenEvidence}
          >
            <span>Sources</span><strong>{String(sourceCount).padStart(2, '0')}</strong>
          </button>
        </div>
      </header>

      {intro?.type === 'paragraph' ? (
        <p id={introTargetId} className={`lab-intro narration-target${activeNarrationTargetId === introTargetId ? ' narration-target--active' : ''}`}>{intro.text}</p>
      ) : null}

      <div className="lab-tabs" role="tablist" aria-label="Laboratory mode">
        {modes.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => { tabRefs.current[index] = element }}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            aria-controls="lab-panel"
            tabIndex={mode === item.id ? 0 : -1}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            onClick={() => selectMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="lab-panel" id="lab-panel" role="tabpanel" aria-labelledby={`tab-${mode}`}>
        <LabPlot mode={mode} comparison={comparison} frequency={frequency} amplitude={amplitude} sampleRate={sampleRate} bits={bits} latency={latency} playing={playing} />
        <div className="lab-controls">
          {mode !== 'conversation' ? (
            <label><span>Frequency <output>{frequency} Hz</output></span><input aria-label="Frequency" type="range" min="110" max="1200" step="10" value={frequency} onChange={(event) => updateFrequency(Number(event.currentTarget.value))} /></label>
          ) : null}
          {mode === 'wave' ? (
            <label><span>Amplitude <output>{amplitude}</output></span><input aria-label="Amplitude" type="range" min="28" max="108" step="4" value={amplitude} onChange={(event) => updateAmplitude(Number(event.currentTarget.value))} /></label>
          ) : null}
          {mode === 'sampling' ? (
            <label><span>Sample rate <output>{sampleRate.toLocaleString()} Hz</output></span><input aria-label="Sample rate" type="range" min="320" max="8000" step="80" value={sampleRate} onChange={(event) => updateSampleRate(Number(event.currentTarget.value))} /></label>
          ) : null}
          {mode === 'codec' ? (
            <label><span>Bit depth <output>{bits} bits</output></span><input aria-label="Bit depth" type="range" min="2" max="8" step="1" value={bits} onChange={(event) => updateBits(Number(event.currentTarget.value))} /></label>
          ) : null}
          {mode === 'conversation' ? (
            <label><span>Response delay <output>{latency} ms</output></span><input aria-label="Response delay" type="range" min="80" max="900" step="20" value={latency} onChange={(event) => updateLatency(Number(event.currentTarget.value))} /></label>
          ) : null}

          <div className="lab-actions">
            <button className="lab-play" type="button" onClick={playing ? stop : () => void play()}>
              {playing ? <StopIcon /> : <PlayIcon />}
              <span>{playing ? 'Stop' : 'Play'}</span>
            </button>
            <div className="segmented" role="group" aria-label="Audio comparison">
              <button type="button" aria-pressed={comparison === 'original'} onClick={() => { stop(); setComparison('original') }}>A / Original</button>
              <button type="button" aria-pressed={comparison === 'processed'} onClick={() => { stop(); setComparison('processed') }}>B / Processed</button>
            </div>
          </div>
          <p className="lab-explanation">{explanation}</p>
          {error ? <p className="lab-error" role="alert">{error}</p> : null}
        </div>
      </section>

      <section className="live-loop">
        <div>
          {loopHeading?.type === 'heading' ? (
            <h2 id={loopHeadingTargetId} className={`narration-target${activeNarrationTargetId === loopHeadingTargetId ? ' narration-target--active' : ''}`}>{loopHeading.text}</h2>
          ) : null}
          {loopCopy?.type === 'paragraph' ? (
            <p id={loopCopyTargetId} className={`narration-target${activeNarrationTargetId === loopCopyTargetId ? ' narration-target--active' : ''}`}>{loopCopy.text}</p>
          ) : null}
        </div>
        {loopFigure?.type === 'figure' ? (
          <div id={loopFigureTargetId} className={`narration-target${activeNarrationTargetId === loopFigureTargetId ? ' narration-target--active' : ''}`}>
            <span className="sr-only">{loopFigure.title}. {loopFigure.caption}</span>
            <ScientificFigure kind={loopFigure.figure} title={loopFigure.title} />
          </div>
        ) : null}
      </section>
    </article>
  )
}
