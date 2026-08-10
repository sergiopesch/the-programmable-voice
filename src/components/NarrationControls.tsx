import type { NarrationStatus } from '../hooks/useRealtimeNarration'
import type { NarrationPassage } from '../lib/narration'
import { CloseIcon, PauseIcon, PlayIcon, SpeakerIcon } from './Icons'

interface SectionListenButtonProps {
  id?: string
  status: NarrationStatus
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
  active,
  onStart,
  onPause,
  onResume,
  onRetry,
  className = '',
}: SectionListenButtonProps) {
  const pauseable = active && (status === 'connecting' || status === 'verifying' || status === 'speaking')
  const resumable = active && status === 'paused'
  const retryable = active && status === 'error'
  const label = pauseable
    ? 'Pause narration'
    : resumable
      ? 'Resume narration'
      : retryable
        ? 'Retry narration'
        : 'Listen from this section'
  const action = pauseable ? onPause : resumable ? onResume : retryable ? onRetry : onStart

  return (
    <button
      id={id}
      className={`listen-control ${className}`.trim()}
      type="button"
      onClick={action}
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
  onPause: () => void
  onResume: () => void
  onRetry: () => void
  onStop: () => void
  onReplaySection: () => void
}

function statusText(status: NarrationStatus) {
  if (status === 'connecting') return 'Connecting'
  if (status === 'verifying') return 'Checking next transcript'
  if (status === 'speaking') return 'Reading · transcript checked'
  if (status === 'paused') return 'Paused'
  if (status === 'error') return 'Stopped by transcript check'
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
  onPause,
  onResume,
  onRetry,
  onStop,
  onReplaySection,
}: NarrationDockProps) {
  if (status === 'idle') return null
  const canPause = status === 'connecting' || status === 'verifying' || status === 'speaking'
  const primaryAction = canPause
    ? { label: 'Pause', icon: <PauseIcon />, onClick: onPause }
    : status === 'paused'
      ? { label: 'Resume', icon: <PlayIcon />, onClick: onResume }
      : status === 'error'
        ? { label: 'Retry', icon: <PlayIcon />, onClick: onRetry }
        : { label: 'Replay section', icon: <PlayIcon />, onClick: onReplaySection }

  return (
    <section
      className={`narration-dock narration-dock--${status}`}
      aria-label="OpenAI Realtime narration"
    >
      <div className="narration-dock__identity">
        <span>OpenAI Realtime</span>
        <strong>Warm British female voice</strong>
      </div>
      <div className="narration-dock__passage">
        <span>{statusText(status)}</span>
        <strong>{sectionTitle || passage?.sectionId || 'The Programmable Voice'}</strong>
        {sectionProgress.total > 0 ? (
          <small>{String(sectionProgress.current).padStart(2, '0')} / {String(sectionProgress.total).padStart(2, '0')} passages</small>
        ) : null}
      </div>
      <div className="narration-dock__actions">
        <button id="narration-primary-action" type="button" onClick={primaryAction.onClick}>
          {primaryAction.icon}
          <span>{primaryAction.label}</span>
        </button>
        <button type="button" onClick={onStop} aria-label={status === 'complete' ? 'Close narration player' : 'Stop narration'}>
          <CloseIcon />
          <span>{status === 'complete' ? 'Close' : 'Stop'}</span>
        </button>
      </div>
      {error ? <p className="narration-dock__error" role="alert">{error}</p> : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </section>
  )
}
