import { useEffect, useRef } from 'react'
import type { Theme } from '../hooks/usePreferences'
import { sectionMarker } from '../lib/book'
import type { BookSection } from '../types'
type PageTurnDirection = 'forward' | 'backward'

const PAGE_TURN_SAFETY_TIMEOUT = 1_500

interface PageTurnOverlayProps {
  direction: PageTurnDirection
  theme: Theme
  reduceMotion: boolean
  source: BookSection
  target: BookSection
  onComplete: () => void
}

function excerptFrom(section: BookSection) {
  const paragraph = section.blocks.find((block) => block.type === 'paragraph')
  return paragraph && 'text' in paragraph ? paragraph.text : section.deck
}

function kickerFrom(section: BookSection) {
  if (section.kind === 'opening') return 'Prologue'
  if (section.kind === 'lab') return 'Sound laboratory'
  if (section.kind === 'appendix') return section.part
  return `Chapter ${sectionMarker(section)}`
}

export function PageTurnOverlay({
  direction,
  theme,
  reduceMotion,
  source,
  target,
  onComplete,
}: PageTurnOverlayProps) {
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete

  useEffect(() => {
    if (reduceMotion) {
      completeRef.current()
      return
    }
    const safety = window.setTimeout(() => completeRef.current(), PAGE_TURN_SAFETY_TIMEOUT)
    return () => window.clearTimeout(safety)
  }, [reduceMotion])

  if (reduceMotion) return null

  return (
    <div
      className={`page-turn-overlay page-turn-overlay--${direction}`}
      data-page-turn-direction={direction}
      data-page-turn-theme={theme}
      aria-hidden="true"
    >
      <div
        className="page-turn-overlay__leaf"
        onAnimationEnd={(event) => {
          if (event.currentTarget === event.target) completeRef.current()
        }}
      >
        <div className="page-turn-overlay__face" data-page-turn-face="front">
          <span>{kickerFrom(source)}</span>
          <strong>{source.title}</strong>
          <p>{excerptFrom(source)}</p>
        </div>
        <div className="page-turn-overlay__face" data-page-turn-face="back">
          <span>{kickerFrom(target)}</span>
          <strong>{target.title}</strong>
          <p>{excerptFrom(target)}</p>
        </div>
      </div>
    </div>
  )
}
