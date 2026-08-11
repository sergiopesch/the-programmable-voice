import { useCallback, useEffect, useRef, useState } from 'react'
import { ContentsDialog, SearchDialog } from './components/BookDialogs'
import { ChapterView } from './components/ChapterView'
import { EvidenceDrawer } from './components/EvidenceRail'
import { Header } from './components/Header'
import { NarrationDock } from './components/NarrationControls'
import { Opening } from './components/Opening'
import { SectionNavigation } from './components/SectionNavigation'
import { SoundLab } from './components/SoundLab'
import { sections, sectionById } from './data/book'
import { useNarrationPlayer } from './hooks/useNarrationPlayer'
import { usePreferences } from './hooks/usePreferences'
import { sectionSourceIds } from './lib/book'
import { bookNarrationPassages, type NarrationPassage } from './lib/narration'

const chapterCount = 30

function initialSectionId() {
  const fromHash = window.location.hash.slice(1)
  return sectionById.has(fromHash) ? fromHash : 'opening'
}

export default function App() {
  const preferences = usePreferences()
  const [activeId, setActiveId] = useState(initialSectionId)
  const [contentsOpen, setContentsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [turnDirection, setTurnDirection] = useState<'forward' | 'backward'>('forward')
  const [hasNavigated, setHasNavigated] = useState(false)
  const readerRef = useRef<HTMLElement>(null)

  const activeIndex = sections.findIndex((section) => section.id === activeId)
  const activeSection = sections[activeIndex] ?? sections[0]!
  const previous = activeIndex > 0 ? sections[activeIndex - 1] ?? null : null
  const next = activeIndex < sections.length - 1 ? sections[activeIndex + 1] ?? null : null

  const focusReader = useCallback(() => {
    requestAnimationFrame(() => {
      readerRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [])

  const presentNarrationPassage = useCallback(async (passage: NarrationPassage) => {
    if (!sectionById.has(passage.sectionId)) return
    if (passage.sectionId === activeId) {
      document.getElementById(passage.targetId)?.scrollIntoView({
        block: 'center',
        behavior: preferences.reduceMotion ? 'auto' : 'smooth',
      })
      return
    }
    const previouslyFocused = document.activeElement
    setSelectedSourceId(null)
    setContentsOpen(false)
    setSearchOpen(false)
    setEvidenceOpen(false)
    setTurnDirection('forward')
    setHasNavigated(true)
    setActiveId(passage.sectionId)
    const url = `${window.location.pathname}${window.location.search}#${passage.sectionId}`
    window.history.replaceState({ section: passage.sectionId, cause: 'narration' }, '', url)
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    if (previouslyFocused instanceof HTMLElement && !previouslyFocused.isConnected) {
      document.getElementById('narration-primary-action')?.focus({ preventScroll: true })
    }
    document.getElementById(passage.targetId)?.scrollIntoView({
      block: 'center',
      behavior: preferences.reduceMotion ? 'auto' : 'smooth',
    })
  }, [activeId, preferences.reduceMotion])

  const narration = useNarrationPlayer({
    passages: bookNarrationPassages,
    onPresentPassage: presentNarrationPassage,
  })
  const {
    currentPassage: narratedPassage,
    pause: pauseNarration,
    status: narrationStatus,
    stop: stopNarration,
  } = narration

  const pauseNarrationForOverlay = useCallback(() => {
    if (narrationStatus === 'loading' || narrationStatus === 'speaking') {
      pauseNarration()
    }
  }, [narrationStatus, pauseNarration])

  const handleStopNarration = useCallback(() => {
    const sectionId = narratedPassage?.sectionId ?? activeSection.id
    stopNarration()
    requestAnimationFrame(() => {
      const listenButton = document.getElementById(`listen-${sectionId}`)
      if (listenButton instanceof HTMLElement) listenButton.focus({ preventScroll: true })
      else readerRef.current?.focus({ preventScroll: true })
    })
  }, [activeSection.id, narratedPassage?.sectionId, stopNarration])

  const navigate = useCallback((id: string, replace = false) => {
    if (!sectionById.has(id)) return
    const targetIndex = sections.findIndex((section) => section.id === id)
    setTurnDirection(targetIndex < activeIndex ? 'backward' : 'forward')
    setHasNavigated(true)
    window.dispatchEvent(new Event('pv:stop-media'))
    setSelectedSourceId(null)
    setContentsOpen(false)
    setSearchOpen(false)
    setEvidenceOpen(false)
    setActiveId(id)
    const url = `${window.location.pathname}${window.location.search}#${id}`
    if (replace) window.history.replaceState({ section: id }, '', url)
    else if (window.location.hash !== `#${id}`) window.history.pushState({ section: id }, '', url)
    focusReader()
  }, [activeIndex, focusReader])

  useEffect(() => {
    if (!sectionById.has(window.location.hash.slice(1))) {
      window.history.replaceState({ section: 'opening' }, '', `${window.location.pathname}${window.location.search}#opening`)
    }
    const onHistory = () => {
      const id = window.location.hash.slice(1)
      if (!sectionById.has(id)) {
        window.history.replaceState(
          { section: activeId },
          '',
          `${window.location.pathname}${window.location.search}#${activeId}`,
        )
        return
      }
      const targetIndex = sections.findIndex((section) => section.id === id)
      setTurnDirection(targetIndex < activeIndex ? 'backward' : 'forward')
      setHasNavigated(true)
      window.dispatchEvent(new Event('pv:stop-media'))
      setActiveId(id)
      setSelectedSourceId(null)
      setContentsOpen(false)
      setSearchOpen(false)
      setEvidenceOpen(false)
      focusReader()
    }
    window.addEventListener('popstate', onHistory)
    window.addEventListener('hashchange', onHistory)
    return () => {
      window.removeEventListener('popstate', onHistory)
      window.removeEventListener('hashchange', onHistory)
    }
  }, [activeId, activeIndex, focusReader])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || contentsOpen || searchOpen || evidenceOpen || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      if (target instanceof HTMLElement && target.closest('button, a, [role="tab"], [contenteditable="true"], [data-page-keys="ignore"]')) return
      if (window.getSelection()?.toString()) return
      if (event.key === 'ArrowLeft' && previous) {
        event.preventDefault()
        navigate(previous.id)
      }
      if (event.key === 'ArrowRight' && next) {
        event.preventDefault()
        navigate(next.id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [contentsOpen, evidenceOpen, navigate, next, previous, searchOpen])

  useEffect(() => {
    document.title = activeId === 'opening'
      ? 'The Programmable Voice'
      : `${activeSection.title} — The Programmable Voice`
  }, [activeId, activeSection.title])

  const openCitation = useCallback((sourceId: string) => {
    pauseNarrationForOverlay()
    setSelectedSourceId(sourceId)
    setEvidenceOpen(true)
  }, [pauseNarrationForOverlay])

  const openEvidence = useCallback(() => {
    pauseNarrationForOverlay()
    setSelectedSourceId(null)
    setEvidenceOpen(true)
  }, [pauseNarrationForOverlay])

  const narrationActive = narration.currentPassage?.sectionId === activeSection.id && narration.status !== 'idle'
  const narrationActions = {
    activeNarrationTargetId: narration.activeTargetId,
    narrationStatus: narration.status,
    catalogueStatus: narration.catalogueStatus,
    catalogueError: narration.catalogueError,
    narrationActive,
    evidenceOpen,
    onStartNarration: () => narration.startFromSection(activeSection.id),
    onPauseNarration: narration.pause,
    onResumeNarration: narration.resume,
    onRetryNarration: narration.retry,
  }

  let mainContent
  if (activeSection.kind === 'opening') {
    mainContent = (
      <Opening
        section={activeSection}
        total={chapterCount}
        onBegin={() => navigate(sections[1]!.id)}
        {...narrationActions}
      />
    )
  } else if (activeSection.kind === 'lab') {
    mainContent = (
      <SoundLab
        section={activeSection}
        sourceCount={sectionSourceIds(activeSection).length}
        onOpenEvidence={openEvidence}
        {...narrationActions}
      />
    )
  } else {
    mainContent = (
      <ChapterView
        section={activeSection}
        total={chapterCount}
        onCitation={openCitation}
        onOpenEvidence={openEvidence}
        {...narrationActions}
      />
    )
  }

  const showEvidence = activeSection.kind !== 'opening'

  return (
    <div className={`app-shell${narration.status !== 'idle' ? ' app-shell--narrating' : ''}`}>
      <Header
        theme={preferences.theme}
        onToggleTheme={preferences.toggleTheme}
        onOpenContents={() => {
          pauseNarrationForOverlay()
          setContentsOpen(true)
        }}
        onOpenSearch={() => {
          pauseNarrationForOverlay()
          setSearchOpen(true)
        }}
        onHome={() => navigate('opening')}
        onLab={() => {
          const lab = sections.find((section) => section.kind === 'lab')
          if (lab) navigate(lab.id)
        }}
      />

      <div className={`reader-grid reader-grid--single book-stage book-stage--${activeSection.kind}`}>
        <main
          id="reader"
          ref={readerRef}
          className="reader"
          tabIndex={-1}
          aria-label={activeSection.title}
          aria-keyshortcuts="ArrowLeft ArrowRight"
        >
          <div key={activeSection.id} className={`page-turn${hasNavigated ? ` page-turn--${turnDirection}` : ''}`}>
            {mainContent}
            {activeSection.kind !== 'opening' ? <SectionNavigation previous={previous} next={next} onNavigate={navigate} /> : null}
          </div>
        </main>
      </div>

      <ContentsDialog
        open={contentsOpen}
        sections={sections}
        activeId={activeId}
        textSize={preferences.textSize}
        reduceMotion={preferences.reduceMotion}
        onClose={() => setContentsOpen(false)}
        onNavigate={navigate}
        onTextSize={preferences.setTextSize}
        onReduceMotion={preferences.setReduceMotion}
      />
      <SearchDialog open={searchOpen} sections={sections} onClose={() => setSearchOpen(false)} onNavigate={navigate} />
      {showEvidence ? (
        <EvidenceDrawer
          open={evidenceOpen}
          section={activeSection}
          selectedSourceId={selectedSourceId}
          onClose={() => setEvidenceOpen(false)}
        />
      ) : null}
      <NarrationDock
        status={narration.status}
        passage={narration.currentPassage}
        sectionTitle={narration.currentPassage ? sectionById.get(narration.currentPassage.sectionId)?.title ?? '' : ''}
        sectionProgress={narration.sectionProgress}
        error={narration.error}
        announcement={narration.announcement}
        playbackRate={narration.playbackRate}
        currentTime={narration.currentTime}
        duration={narration.duration}
        onPause={narration.pause}
        onResume={narration.resume}
        onRetry={narration.retry}
        onStop={handleStopNarration}
        onReplaySection={() => narration.startFromSection(narration.currentPassage?.sectionId ?? activeSection.id)}
        onPlaybackRate={narration.setPlaybackRate}
        onSeek={narration.seek}
      />
    </div>
  )
}
