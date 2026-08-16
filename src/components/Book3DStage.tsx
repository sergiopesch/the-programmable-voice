import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Theme } from '../hooks/usePreferences'
import type { BookFace } from '../lib/book3d/bookView'
import type { BookSceneController } from '../lib/book3d/createBookScene'
import { shouldInspectPhysicalBook } from '../lib/book3d/shouldUsePhysicalBook'

interface Book3DStageProps {
  deck: string
  openingParagraphs: string[]
  openingPart: string
  openingTitle: string
  open: boolean
  reduceMotion: boolean
  theme: Theme
  onOpenAnimationComplete: () => void
  onOpenHandoffReady: () => void
  onReadyChange: (ready: boolean) => void
}

type Book3DPhase = 'loading' | 'ready' | 'fallback'
// Native UHD texture decode and PMREM compilation can exceed ten seconds on
// software WebGL even though the semantic cover remains fully usable. Keep a
// longer closed-scene deadline; an actual Open request still has its own
// 3.2-second safety handoff, so readers never wait on this diagnostic limit.
const BOOK_SCENE_INITIALISATION_TIMEOUT = 30_000

function openingSafetyDuration() {
  return new URLSearchParams(window.location.search).get('bookMotion') === 'slow'
    ? 30_000
    : 3_200
}

export function Book3DStage({
  deck,
  openingParagraphs,
  openingPart,
  openingTitle,
  open,
  reduceMotion,
  theme,
  onOpenAnimationComplete,
  onOpenHandoffReady,
  onReadyChange,
}: Book3DStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<BookSceneController | null>(null)
  const openRef = useRef(open)
  const completionFiredRef = useRef(false)
  const openingSafetyTimerRef = useRef(0)
  const openWasQueuedRef = useRef(false)
  const onCompleteRef = useRef(onOpenAnimationComplete)
  const onHandoffReadyRef = useRef(onOpenHandoffReady)
  const onReadyChangeRef = useRef(onReadyChange)
  const themeRef = useRef(theme)
  const openingCopy = openingParagraphs.join('\n\n')
  const [phase, setPhase] = useState<Book3DPhase>(reduceMotion ? 'fallback' : 'loading')
  const [face, setFace] = useState<BookFace>('Front cover')
  const [inspect] = useState(() => shouldInspectPhysicalBook())

  openRef.current = open
  onCompleteRef.current = onOpenAnimationComplete
  onHandoffReadyRef.current = onOpenHandoffReady
  onReadyChangeRef.current = onReadyChange
  themeRef.current = theme
  if (open && !controllerRef.current) openWasQueuedRef.current = true

  const clearOpeningSafetyTimer = useCallback(() => {
    window.clearTimeout(openingSafetyTimerRef.current)
    openingSafetyTimerRef.current = 0
  }, [])

  const completeOpening = useCallback(() => {
    if (completionFiredRef.current) return
    clearOpeningSafetyTimer()
    completionFiredRef.current = true
    const stage = hostRef.current?.closest<HTMLElement>('.book3d-stage')
    stage?.setAttribute('data-opening-progress', '1.000')
    stage?.setAttribute('data-opening-phase', 'settled')
    onCompleteRef.current()
  }, [clearOpeningSafetyTimer])

  const playOpening = useCallback((controller: BookSceneController) => {
    if (!openingSafetyTimerRef.current) {
      openingSafetyTimerRef.current = window.setTimeout(() => {
        controller.finishOpening()
        completeOpening()
      }, openingSafetyDuration())
    }
    void controller.open().then(completeOpening)
  }, [completeOpening])

  // This deadline begins with the reader's intent, not with the late scene
  // controller. Slow texture/HDR preparation can otherwise consume the whole
  // interaction budget before `playOpening` has a chance to arm its guard.
  useEffect(() => {
    if (!open || completionFiredRef.current || openingSafetyTimerRef.current) return
    openingSafetyTimerRef.current = window.setTimeout(() => {
      controllerRef.current?.finishOpening()
      completeOpening()
    }, openingSafetyDuration())
    return clearOpeningSafetyTimer
  }, [clearOpeningSafetyTimer, completeOpening, open])

  useEffect(() => {
    const host = hostRef.current
    if (!host || reduceMotion || window.matchMedia('(forced-colors: active)').matches) {
      setPhase('fallback')
      onReadyChangeRef.current(false)
      return
    }

    let active = true
    let initialiseTimer = 0
    let initialisationDeadlineTimer = 0
    let fallbackHandled = false
    setPhase('loading')

    const activateFallback = (reason = 'initialisation') => {
      if (!active || fallbackHandled) return
      fallbackHandled = true
      window.clearTimeout(initialisationDeadlineTimer)
      initialisationDeadlineTimer = 0
      host.closest<HTMLElement>('.book3d-stage')?.setAttribute('data-book-fallback', reason)
      controllerRef.current?.dispose()
      controllerRef.current = null
      host.querySelectorAll('canvas').forEach((canvas) => {
        canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
      })
      host.replaceChildren()
      setPhase('fallback')
      onReadyChangeRef.current(false)
      if (openRef.current) completeOpening()
    }

    const initialise = () => {
      if (!active) return
      if (document.querySelector('dialog[open], [role="dialog"]')) {
        initialiseTimer = window.setTimeout(initialise, 500)
        return
      }

      if (!initialisationDeadlineTimer) {
        initialisationDeadlineTimer = window.setTimeout(
          () => activateFallback('initialisation-timeout'),
          BOOK_SCENE_INITIALISATION_TIMEOUT,
        )
      }

      void import('../lib/book3d/createBookScene')
        .then(({ createBookScene }) => createBookScene({
          host,
          deck,
          openingParagraphs: openingCopy.split('\n\n'),
          openingPart,
          openingTitle,
          theme: themeRef.current,
          onReady: () => {
            if (!active) return
            window.clearTimeout(initialisationDeadlineTimer)
            initialisationDeadlineTimer = 0
            setPhase('ready')
            onReadyChangeRef.current(true)
          },
          onHandoffReady: () => onHandoffReadyRef.current(),
          shouldSkipClosedFirstFrame: () => openRef.current,
          onViewChange: (nextFace) => {
            if (active) setFace(nextFace)
          },
          onContextLost: () => activateFallback('context-loss'),
        }))
        .then((controller) => {
          if (!active || fallbackHandled) {
            controller.dispose()
            return
          }
          controllerRef.current = controller
          window.clearTimeout(initialisationDeadlineTimer)
          initialisationDeadlineTimer = 0
          controller.setTheme(themeRef.current)
          if (openRef.current) {
            if (openWasQueuedRef.current || completionFiredRef.current) {
              void controller.open()
              controller.finishOpening()
              completeOpening()
            } else {
              playOpening(controller)
            }
          }
        })
        .catch(() => activateFallback('initialisation'))
    }

    initialiseTimer = window.setTimeout(initialise, 80)

    return () => {
      active = false
      window.clearTimeout(initialiseTimer)
      window.clearTimeout(initialisationDeadlineTimer)
      clearOpeningSafetyTimer()
      onReadyChangeRef.current(false)
      controllerRef.current?.dispose()
      controllerRef.current = null
      host.replaceChildren()
    }
  }, [clearOpeningSafetyTimer, completeOpening, deck, openingCopy, openingPart, openingTitle, playOpening, reduceMotion])

  useEffect(() => {
    controllerRef.current?.setTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!open) return
    const controller = controllerRef.current
    if (controller) {
      if (completionFiredRef.current) {
        void controller.open()
        controller.finishOpening()
      } else {
        playOpening(controller)
      }
    } else if (phase === 'fallback' || reduceMotion) {
      completeOpening()
    }
  }, [completeOpening, open, phase, playOpening, reduceMotion])

  const interact = (action: (controller: BookSceneController) => void) => {
    const controller = controllerRef.current
    if (!controller || open || !inspect) return
    action(controller)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLButtonElement) return
    const controller = controllerRef.current
    if (!controller || open || !inspect) return

    switch (event.key) {
      case 'ArrowLeft':
        controller.rotateBy(-15)
        break
      case 'ArrowRight':
        controller.rotateBy(15)
        break
      case 'ArrowUp':
        controller.rotateBy(0, -10)
        break
      case 'ArrowDown':
        controller.rotateBy(0, 10)
        break
      case 'Home':
        controller.reset()
        break
      case '+':
      case '=':
        controller.zoomBy(0.9)
        break
      case '-':
      case '_':
        controller.zoomBy(1.1)
        break
      default:
        return
    }

    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      className={`book3d-stage book3d-stage--${phase}${open ? ' book3d-stage--open' : ''}`}
      data-book-view={face}
      data-page-keys="ignore"
      role="group"
      aria-hidden={phase === 'ready' && !open ? undefined : true}
      aria-label="Interactive 3D hardback"
      aria-describedby={inspect ? 'book3d-description book3d-help' : 'book3d-description'}
      aria-keyshortcuts={inspect ? 'ArrowLeft ArrowRight ArrowUp ArrowDown Home + -' : undefined}
      tabIndex={inspect && phase === 'ready' && !open ? 0 : -1}
      onKeyDown={onKeyDown}
      onDoubleClick={(event) => {
        if (event.target instanceof HTMLCanvasElement) interact((controller) => controller.reset())
      }}
    >
      <span id="book3d-description" className="sr-only">
        Closed charcoal woven-cloth hardback with an oxblood spine and warm ivory page edges.
      </span>
      {inspect ? (
        <span id="book3d-help" className="sr-only">
          Drag horizontally to inspect all sides. Use the arrow keys to rotate and tilt, Home to return to the front, and plus or minus to change distance.
        </span>
      ) : null}
      <div ref={hostRef} className="book3d-stage__viewport" aria-hidden="true" />
      {inspect && phase === 'ready' && !open ? (
        <div className="book3d-stage__toolbar" aria-hidden="true">
          <span className="book3d-stage__hint">Drag to turn <span>·</span> scroll to move closer <span>·</span> double-click to reset</span>
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite" aria-atomic="true">{face}</span>
    </div>
  )
}
