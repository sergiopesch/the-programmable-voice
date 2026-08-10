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
import { useRealtimeNarration } from './hooks/useRealtimeNarration'
import { usePreferences } from './hooks/usePreferences'
import { sectionSourceIds } from './lib/book'
import { bookNarrationPassages, type NarrationPassage } from './lib/narration'

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
  const readerRef = useRef<HTMLElement>(null)

  const activeIndex = sections.findIndex((section) => section.id === activeId)
  const activeSection = sections[activeIndex] ?? sections[0]!
  const previous = activeIndex > 0 ? sections[activeIndex - 1] ?? null : null
  const next = activeIndex < sections.length - 1 ? sections[activeIndex + 1] ?? null : null

  const focusReader = useCallback(() => {
    requestAnimationFrame(() => {
      readerRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: preferences.reduceMotion ? 'auto' : 'smooth' })
    })
  }, [preferences.reduceMotion])

  const presentNarrationPassage = useCallback(async (passage: NarrationPassage) => {
    if (!sectionById.has(passage.sectionId)) return
    const previouslyFocused = document.activeElement
    setSelectedSourceId(null)
    setContentsOpen(false)
    setSearchOpen(false)
    setEvidenceOpen(false)
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
  }, [preferences.reduceMotion])

  const narration = useRealtimeNarration({
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
    if (narrationStatus === 'connecting' || narrationStatus === 'verifying' || narrationStatus === 'speaking') {
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
  }, [focusReader])

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState({ section: 'opening' }, '', '#opening')
    const onHistory = () => {
      const id = window.location.hash.slice(1)
      if (!sectionById.has(id)) return
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
  }, [focusReader])

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
        total={sections.length}
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
        total={sections.length}
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
      />

      <div className="reader-grid reader-grid--single">
        <main id="reader" ref={readerRef} className="reader" tabIndex={-1}>
          {mainContent}
          {activeSection.kind !== 'opening' ? <SectionNavigation previous={previous} next={next} onNavigate={navigate} /> : null}
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
        onPause={narration.pause}
        onResume={narration.resume}
        onRetry={narration.retry}
        onStop={handleStopNarration}
        onReplaySection={() => narration.startFromSection(narration.currentPassage?.sectionId ?? activeSection.id)}
      />
    </div>
  )
}
