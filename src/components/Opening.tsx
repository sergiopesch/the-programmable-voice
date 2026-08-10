import { ArrowIcon } from './Icons'
import type { NarrationStatus } from '../hooks/useRealtimeNarration'
import { narrationTargetId } from '../lib/narration'
import { SectionListenButton } from './NarrationControls'
import { WaveformHero } from './WaveformHero'

interface OpeningProps {
  total: number
  onBegin: () => void
  activeNarrationTargetId: string | null
  narrationStatus: NarrationStatus
  narrationActive: boolean
  onStartNarration: () => void
  onPauseNarration: () => void
  onResumeNarration: () => void
  onRetryNarration: () => void
}

export function Opening({
  total,
  onBegin,
  activeNarrationTargetId,
  narrationStatus,
  narrationActive,
  onStartNarration,
  onPauseNarration,
  onResumeNarration,
  onRetryNarration,
}: OpeningProps) {
  const targetId = narrationTargetId('opening')
  return (
    <section className="opening" aria-labelledby="opening-title">
      <div id={targetId} className={`opening__copy narration-target${activeNarrationTargetId === targetId ? ' narration-target--active' : ''}`}>
        <h1 id="opening-title">The<br />Programmable<br />Voice</h1>
        <div className="short-rule" aria-hidden="true" />
        <p>How humanity taught machines to hear, speak and converse.</p>
        <button className="primary-action" type="button" onClick={onBegin}>
          <span>Begin reading</span>
          <ArrowIcon />
        </button>
        <SectionListenButton
          id="listen-opening"
          className="opening__listen"
          status={narrationStatus}
          active={narrationActive}
          onStart={onStartNarration}
          onPause={onPauseNarration}
          onResume={onResumeNarration}
          onRetry={onRetryNarration}
        />
      </div>
      <WaveformHero />
      <div className="opening__progress" aria-label={`Section 1 of ${total}`}>
        <span>01 / {String(total).padStart(2, '0')}</span>
        <div className="progress-line"><span style={{ width: `${100 / total}%` }} /></div>
      </div>
      <div className="opening__next" aria-hidden="true">
        <span>Chapter 01</span>
        <strong>Breath becomes pressure</strong>
      </div>
    </section>
  )
}
