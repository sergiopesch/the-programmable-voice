import type { NarrationCatalogueStatus, NarrationStatus } from '../hooks/useNarrationPlayer'
import type { NarrationPassage } from '../lib/narration'
import { CloseIcon, PauseIcon, PlayIcon, SpeakerIcon } from './Icons'

interface SectionListenButtonProps {
  id?: string
  status: NarrationStatus
  catalogueStatus: NarrationCatalogueStatus
  catalogueError: string | null
  active: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRetry: () => void
  className?: string
}

export function SectionListenButton({
  id,
  status,
  catalogueStatus,
  catalogueError,
  active,
  onStart,
  onPause,
  onResume,
  onRetry,
  className = '',
}: SectionListenButtonProps) {
  const pauseable = active && status === 'speaking'
  const loading = active && status === 'loading'
  const resumable = active && status === 'paused'
  const retryable = active && status === 'error'
  const label = catalogueStatus === 'loading'
    ? 'Preparing recorded edition'
    : catalogueStatus === 'error'
      ? 'Recorded edition awaiting release'
      : pauseable
    ? 'Pause narration'
    : loading
      ? 'Loading approved recording'
      : resumable
      ? 'Resume narration'
      : retryable
        ? 'Retry narration'
        : 'Listen from this section'
  const action = pauseable ? onPause : resumable ? onResume : retryable ? onRetry : onStart

  if (catalogueStatus === 'error') {
    return (
      <span
        id={id}
        className={`listen-status ${className}`.trim()}
        title={catalogueError ?? 'The approved recording is unavailable.'}
        role="status"
      >
        <SpeakerIcon />
        <span>Narration awaiting editorial approval</span>
      </span>
    )
  }

  return (
    <button
      id={id}
      className={`listen-control ${className}`.trim()}
      type="button"
      onClick={action}
      aria-pressed={active}
      disabled={loading || catalogueStatus !== 'ready'}
      aria-controls={active || status !== 'idle' ? 'narration-player' : undefined}
    >
      {pauseable ? <PauseIcon /> : resumable || retryable ? <PlayIcon /> : <SpeakerIcon />}
      <span>{label}</span>
    </button>
  )
}

interface NarrationDockProps {
  status: NarrationStatus
  passage: NarrationPassage | null
  sectionTitle: string
  sectionProgress: { current: number; total: number }
  error: string | null
  announcement: string
  playbackRate: number
  currentTime: number
  duration: number
  onPause: () => void
  onResume: () => void
  onRetry: () => void
  onStop: () => void
  onReplaySection: () => void
  onPlaybackRate: (rate: number) => void
  onSeek: (time: number) => void
}

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const rounded = Math.floor(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

function statusText(status: NarrationStatus) {
  if (status === 'loading') return 'Loading the approved recording'
  if (status === 'speaking') return 'Playing the recorded edition'
  if (status === 'paused') return 'Paused'
  if (status === 'error') return 'Recording unavailable'
  if (status === 'complete') return 'Book complete'
  return 'Ready'
}

export function NarrationDock({
  status,
  passage,
  sectionTitle,
  sectionProgress,
  error,
  announcement,
  playbackRate,
  currentTime,
  duration,
  onPause,
  onResume,
  onRetry,
  onStop,
  onReplaySection,
  onPlaybackRate,
  onSeek,
}: NarrationDockProps) {
  if (status === 'idle') return null
  const canPause = status === 'speaking'
  const primaryAction = canPause
    ? { label: 'Pause', icon: <PauseIcon />, onClick: onPause }
      : status === 'loading'
        ? { label: 'Loading…', icon: <SpeakerIcon />, onClick: onStop }
        : status === 'paused'
      ? { label: 'Resume', icon: <PlayIcon />, onClick: onResume }
      : status === 'error'
        ? { label: 'Retry', icon: <PlayIcon />, onClick: onRetry }
        : { label: 'Replay section', icon: <PlayIcon />, onClick: onReplaySection }

  return (
    <section
      id="narration-player"
      className={`narration-dock narration-dock--${status}`}
      aria-label="Recorded narration player"
    >
      <div className="narration-dock__identity">
        <span>Recorded edition</span>
        <strong>Approved AI narration</strong>
        <small>AI-generated, not human · generated once and editorially fixed</small>
      </div>
      <div className="narration-dock__passage">
        <span>{statusText(status)}</span>
        <strong>{sectionTitle || passage?.sectionId || 'The Programmable Voice'}</strong>
        <small className="narration-dock__mobile-disclosure">AI-generated, not human · fixed edition</small>
        {sectionProgress.total > 0 ? (
          <small>{String(sectionProgress.current).padStart(2, '0')} / {String(sectionProgress.total).padStart(2, '0')} passages</small>
        ) : null}
      </div>
      <div className="narration-dock__actions">
        <button type="button" onClick={() => onSeek(currentTime - 15)} disabled={duration <= 0} aria-label="Go back 15 seconds">
          <span>−15</span>
        </button>
        <button id="narration-primary-action" type="button" onClick={primaryAction.onClick} disabled={status === 'loading'}>
          {primaryAction.icon}
          <span>{primaryAction.label}</span>
        </button>
        <button type="button" onClick={() => onSeek(currentTime + 15)} disabled={duration <= 0} aria-label="Go forward 15 seconds">
          <span>+15</span>
        </button>
        <button type="button" onClick={onStop} aria-label={status === 'complete' ? 'Close narration player' : 'Stop narration'}>
          <CloseIcon />
          <span>{status === 'complete' ? 'Close' : 'Stop'}</span>
        </button>
        <label className="narration-rate">
          <span>Speed</span>
          <select value={playbackRate} onChange={(event) => onPlaybackRate(Number(event.currentTarget.value))}>
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </label>
      </div>
      <label className="narration-scrubber">
        <span className="sr-only">Narration position</span>
        <time>{clock(currentTime)}</time>
        <input type="range" min="0" max={Math.max(duration, 0)} step="0.1" value={Math.min(currentTime, Math.max(duration, 0))} disabled={duration <= 0} onChange={(event) => onSeek(Number(event.currentTarget.value))} />
        <time>{clock(duration)}</time>
      </label>
      {error ? <p className="narration-dock__error" role="alert">{error}</p> : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </section>
  )
}
