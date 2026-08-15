import { Fragment, useEffect, useState } from 'react'
import type { Theme } from '../hooks/usePreferences'
import type { NarrationCatalogueStatus, NarrationStatus } from '../hooks/useNarrationPlayer'
import { shouldUsePhysicalBook } from '../lib/book3d/shouldUsePhysicalBook'
import { narrationTargetId } from '../lib/narration'
import type { BookSection } from '../types'
import { ArrowIcon } from './Icons'
import { Book3DStage } from './Book3DStage'
import { SectionListenButton } from './NarrationControls'
import { WaveformHero } from './WaveformHero'

interface OpeningProps {
  section: BookSection
  total: number
  onBegin: () => void
  reduceMotion: boolean
  theme: Theme
  activeNarrationTargetId: string | null
  narrationStatus: NarrationStatus
  catalogueStatus: NarrationCatalogueStatus
  catalogueError: string | null
  reviewMode: boolean
  narrationActive: boolean
  onStartNarration: () => void
  onPauseNarration: () => void
  onResumeNarration: () => void
  onRetryNarration: () => void
}

export function Opening({
  section,
  total,
  onBegin,
  reduceMotion,
  theme,
  activeNarrationTargetId,
  narrationStatus,
  catalogueStatus,
  catalogueError,
  reviewMode,
  narrationActive,
  onStartNarration,
  onPauseNarration,
  onResumeNarration,
  onRetryNarration,
}: OpeningProps) {
  const [open, setOpen] = useState(false)
  const [coverSettled, setCoverSettled] = useState(false)
  const [physicalHandoffReady, setPhysicalHandoffReady] = useState(false)
  const [threeReady, setThreeReady] = useState(false)
  const [physicalBook] = useState(() => shouldUsePhysicalBook(reduceMotion))
  const targetId = narrationTargetId(section.id)
  const titleWords = section.title.split(' ')
  const prologueHeading = section.blocks.find((block) => block.type === 'heading')
  const prologueHeadingIndex = prologueHeading ? section.blocks.indexOf(prologueHeading) : -1
  const prologueParagraphs = section.blocks.flatMap((block, index) => {
    if (block.type !== 'paragraph') return []
    const blockTargetId = narrationTargetId(section.id, index)
    return [{ id: blockTargetId, text: block.text }]
  })
  const visualOpen = open && (reduceMotion || coverSettled || physicalHandoffReady)
  const physicalOpening = open && threeReady && !coverSettled && !reduceMotion
  const openingPending = open && !coverSettled && !reduceMotion

  const openBook = () => {
    setOpen(true)
    if (reduceMotion || !physicalBook) setCoverSettled(true)
  }

  useEffect(() => {
    if (!open || !coverSettled) return
    requestAnimationFrame(() => {
      const prologue = document.getElementById('opening-prologue')
      prologue?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [coverSettled, open])

  return (
    <section
      className={`opening opening--${visualOpen ? 'open' : 'closed'}${threeReady ? ' opening--three-ready' : ''}${physicalOpening ? ' opening--opening' : ''}`}
      aria-labelledby={openingPending ? undefined : visualOpen ? 'opening-spread-title' : 'opening-title'}
      aria-label={openingPending ? `${section.title}. Preparing and opening the book.` : undefined}
      aria-busy={openingPending || undefined}
    >
      <div className="opening__object">
        <div className="opening__endpaper" aria-hidden="true" />
        {physicalBook && !coverSettled ? (
          <Book3DStage
            deck={section.deck}
            openingParagraphs={prologueParagraphs.map(({ text }) => text)}
            openingPart={section.part}
            openingTitle={prologueHeading?.text ?? section.title}
            open={open}
            reduceMotion={reduceMotion}
            theme={theme}
            onReadyChange={setThreeReady}
            onOpenAnimationComplete={() => setCoverSettled(true)}
            onOpenHandoffReady={() => setPhysicalHandoffReady(true)}
          />
        ) : null}
        {!coverSettled && !physicalOpening ? (
          <div
            id={visualOpen ? undefined : targetId}
            className={`opening__cover narration-target${activeNarrationTargetId === targetId ? ' narration-target--active' : ''}`}
            aria-hidden={visualOpen}
            inert={open}
          >
            <div className="opening__cover-inner">
              <h1 id="opening-title">
                {titleWords.map((word, index) => (
                  <Fragment key={`${word}-${index}`}>
                    {word}{index < titleWords.length - 1 ? <>{' '}<br /></> : null}
                  </Fragment>
                ))}
              </h1>
              <WaveformHero />
              <p>{section.deck}</p>
              <button className="primary-action" type="button" onClick={openBook} disabled={open} aria-expanded={open} aria-controls="opening-pages">
                <span>Open the book</span>
                <ArrowIcon />
              </button>
            </div>
          </div>
        ) : null}
        <div id="opening-pages" className="opening__pages" hidden={!visualOpen}>
          <article
            id={visualOpen ? targetId : undefined}
            className={`opening__title-page narration-target${activeNarrationTargetId === targetId ? ' narration-target--active' : ''}`}
            aria-label="Title page"
          >
            <h1 id="opening-spread-title" className="sr-only">{section.title}</h1>
            <span className="opening__folio">{section.title}</span>
            <div className="opening__title-page-copy">
              {prologueHeading ? (
                <h2
                  id={narrationTargetId(section.id, prologueHeadingIndex)}
                  className={`narration-target${activeNarrationTargetId === narrationTargetId(section.id, prologueHeadingIndex) ? ' narration-target--active' : ''}`}
                >
                  {prologueHeading.text}
                </h2>
              ) : null}
              <div className="short-rule" aria-hidden="true" />
              <span className="opening__title-deck">{section.deck}</span>
            </div>
            <div className="opening__mini-wave" aria-hidden="true"><WaveformHero /></div>
            <span className="opening__folio">{section.part} · {section.readingMinutes ?? 1} min · {total} chapters</span>
          </article>
          <article id="opening-prologue" className="opening__prologue" aria-label="Prologue" tabIndex={-1}>
            <span className="opening__running-head">{section.part} · Read</span>
            <SectionListenButton
              id="listen-opening"
              className="opening__listen"
              status={narrationStatus}
              catalogueStatus={catalogueStatus}
              catalogueError={catalogueError}
              reviewMode={reviewMode}
              active={narrationActive}
              onStart={onStartNarration}
              onPause={onPauseNarration}
              onResume={onResumeNarration}
              onRetry={onRetryNarration}
            />
            {prologueParagraphs.map((paragraph) => (
              <p
                id={paragraph.id}
                key={paragraph.id}
                className={`narration-target${activeNarrationTargetId === paragraph.id ? ' narration-target--active' : ''}`}
              >
                {paragraph.text}
              </p>
            ))}
            <button className="opening__begin" type="button" onClick={onBegin}>
              <span>Begin chapter one</span>
              <ArrowIcon />
            </button>
          </article>
        </div>
      </div>
    </section>
  )
}
