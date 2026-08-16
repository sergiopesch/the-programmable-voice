import { useEffect, useRef } from 'react'
import type { Theme } from '../hooks/usePreferences'
import type { PageTurnDirection, PageTurnSceneController } from '../lib/pageturn/createPageTurnScene'
import type { BookSection } from '../types'

interface PageTurnStageProps {
  direction: PageTurnDirection
  theme: Theme
  reduceMotion: boolean
  source: BookSection
  target: BookSection
  onComplete: () => void
}

export function PageTurnStage({
  direction,
  theme,
  reduceMotion,
  source,
  target,
  onComplete,
}: PageTurnStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete

  useEffect(() => {
    if (reduceMotion) {
      completeRef.current()
      return
    }

    const host = hostRef.current
    if (!host) {
      completeRef.current()
      return
    }

    let active = true
    let controller: PageTurnSceneController | null = null
    const initialisationSafety = window.setTimeout(() => {
      if (active && !controller) completeRef.current()
    }, 15_000)
    void import('../lib/pageturn/createPageTurnScene')
      .then(({ createPageTurnScene }) => createPageTurnScene({
        host,
        direction,
        theme,
        source,
        target,
        onComplete: () => {
          if (active) completeRef.current()
        },
      }))
      .then((next) => {
        window.clearTimeout(initialisationSafety)
        if (!active) {
          next.dispose()
          return
        }
        controller = next
      })
      .catch((error: unknown) => {
        window.clearTimeout(initialisationSafety)
        console.error('The physical page turn could not be rendered.', error)
        if (active) completeRef.current()
      })

    return () => {
      active = false
      window.clearTimeout(initialisationSafety)
      controller?.dispose()
      host.replaceChildren()
    }
  }, [direction, reduceMotion, source, target, theme])

  if (reduceMotion) return null

  return (
    <div
      className={`page-turn-stage page-turn-stage--${direction}`}
      data-page-turn-direction={direction}
      data-page-turn-source={source.id}
      data-page-turn-target={target.id}
      aria-hidden="true"
    >
      <div ref={hostRef} className="page-turn-stage__viewport" />
    </div>
  )
}
