import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { BookSection } from '../types'
import type { NarrationStatus } from '../hooks/useRealtimeNarration'
import { narrationTargetId } from '../lib/narration'
import { PauseIcon, PlayIcon } from './Icons'
import { SectionListenButton } from './NarrationControls'
import { ScientificFigure } from './ScientificFigure'

type LabMode = 'wave' | 'sampling' | 'codec' | 'conversation'
type Comparison = 'original' | 'processed'

const modes: Array<{ id: LabMode; label: string }> = [
  { id: 'wave', label: 'Wave' },
  { id: 'sampling', label: 'Sampling' },
  { id: 'codec', label: 'Codec' },
  { id: 'conversation', label: 'Conversation' },
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
  return Math.max(24, folded)
}

interface LabPlotProps {
  mode: LabMode
  comparison: Comparison
  frequency: number
  amplitude: number
  sampleRate: number
  bits: number
  latency: number
}

function LabPlot({ mode, comparison, frequency, amplitude, sampleRate, bits, latency }: LabPlotProps) {
  const wave = useMemo(() => sinePoints(frequency, amplitude), [frequency, amplitude])
  const aliased = useMemo(() => sinePoints(aliasFrequency(frequency, sampleRate), amplitude), [frequency, sampleRate, amplitude])
  const quantised = useMemo(() => quantisedPoints(frequency, amplitude, bits), [frequency, amplitude, bits])
  const sampleCount = Math.max(5, Math.min(48, Math.round(sampleRate / 160)))
  const samples = useMemo(() => Array.from({ length: sampleCount }, (_, index) => {
    const x = 20 + (index / Math.max(1, sampleCount - 1)) * 680
    const cycles = Math.max(1.5, Math.min(10, frequency / 90))
    return { x, y: 130 - Math.sin((x / 720) * cycles * Math.PI * 2) * amplitude }
  }), [amplitude, frequency, sampleCount])

  return (
    <div className="lab-plot" tabIndex={0} aria-label={`${modes.find((item) => item.id === mode)?.label} demonstration plot`}>
      <svg viewBox="0 0 720 260" role="img" aria-labelledby={`lab-${mode}-title lab-${mode}-desc`}>
        <title id={`lab-${mode}-title`}>{mode} demonstration</title>
        <desc id={`lab-${mode}-desc`}>Idealised generated audio plot. It is not a calibrated measurement of this device.</desc>
        <path d="M0 130h720M0 28v204" className="lab-axis" />
        {[180, 360, 540].map((x) => <path key={x} d={`M${x} 26v208`} className="lab-gridline" />)}
        {mode === 'wave' ? (
          <>
            <path d={wave} className="lab-wave lab-wave--animated" />
            {comparison === 'processed' ? <path d={sinePoints(frequency * 2, amplitude * 0.26)} className="lab-wave lab-wave--faint" /> : null}
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
        <text x="8" y="250">0</text><text x="338" y="250">time</text><text x="694" y="250">→</text>
      </svg>
    </div>
  )
}

interface SoundLabProps {
  section: BookSection
  activeNarrationTargetId: string | null
  narrationStatus: NarrationStatus
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

  useEffect(() => stop, [mode, stop])

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
      master.gain.setValueAtTime(0.0001, context.currentTime)
      master.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.025)
      master.gain.setValueAtTime(0.13, context.currentTime + 1.55)
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
  }, [bits, comparison, frequency, latency, mode, sampleRate, stop])

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
    setMode(nextMode)
    setComparison('original')
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
    : mode === 'sampling'
      ? belowNyquist
        ? `The rate is below twice the signal frequency. The processed example folds toward an alias near ${Math.round(aliasFrequency(frequency, sampleRate))} Hz.`
        : 'The rate is above twice this idealised tone frequency. Real reconstruction still requires band-limiting and a reconstruction filter.'
      : mode === 'codec'
        ? `${bits} bits provide ${2 ** bits} idealised amplitude levels in this toy scalar codec. Quantisation error is distinct from sampling error.`
        : 'The two lanes separate who is producing audio. Processed mode demonstrates overlap, response delay, and an interruption marker.'
  const headerTargetId = narrationTargetId(section.id)
  const introTargetId = narrationTargetId(section.id, 0)
  const intro = section.blocks[0]?.type === 'paragraph' ? section.blocks[0].text : ''

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

      {intro ? (
        <p id={introTargetId} className={`lab-intro narration-target${activeNarrationTargetId === introTargetId ? ' narration-target--active' : ''}`}>{intro}</p>
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
        <LabPlot mode={mode} comparison={comparison} frequency={frequency} amplitude={amplitude} sampleRate={sampleRate} bits={bits} latency={latency} />
        <div className="lab-controls">
          {mode !== 'conversation' ? (
            <label><span>Frequency <output>{frequency} Hz</output></span><input type="range" min="110" max="1200" step="10" value={frequency} onChange={(event) => setFrequency(Number(event.currentTarget.value))} /></label>
          ) : null}
          {mode === 'wave' ? (
            <label><span>Amplitude <output>{amplitude}</output></span><input type="range" min="28" max="108" step="4" value={amplitude} onChange={(event) => setAmplitude(Number(event.currentTarget.value))} /></label>
          ) : null}
          {mode === 'sampling' ? (
            <label><span>Sample rate <output>{sampleRate.toLocaleString()} Hz</output></span><input type="range" min="320" max="8000" step="80" value={sampleRate} onChange={(event) => setSampleRate(Number(event.currentTarget.value))} /></label>
          ) : null}
          {mode === 'codec' ? (
            <label><span>Bit depth <output>{bits} bits</output></span><input type="range" min="2" max="8" step="1" value={bits} onChange={(event) => setBits(Number(event.currentTarget.value))} /></label>
          ) : null}
          {mode === 'conversation' ? (
            <label><span>Response delay <output>{latency} ms</output></span><input type="range" min="80" max="900" step="20" value={latency} onChange={(event) => setLatency(Number(event.currentTarget.value))} /></label>
          ) : null}

          <div className="lab-actions">
            <button className="lab-play" type="button" onClick={playing ? stop : () => void play()}>
              {playing ? <PauseIcon /> : <PlayIcon />}
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

      <p className="lab-disclaimer"><strong>Demonstration—idealised, not a measurement of your device.</strong> No microphone is used, no audio leaves this page, and nothing plays automatically.</p>

      <section className="live-loop">
        <div><h2>The live loop</h2><p>A useful voice system keeps listening, speaking, interruption, and slower reasoning on explicit clocks.</p></div>
        <ScientificFigure kind="duplex" title="Full-duplex conversational loop" />
      </section>
    </article>
  )
}
