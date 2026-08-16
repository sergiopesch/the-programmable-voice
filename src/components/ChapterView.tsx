import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { BookBlock, BookSection } from '../types'
import { sectionMarker, sectionPosition, sectionSourceIds } from '../lib/book'
import { narrationTargetId } from '../lib/narration'
import { sourceNumberById } from '../data/sources'
import type { NarrationCatalogueStatus, NarrationStatus } from '../hooks/useNarrationPlayer'
import { CitationGroup } from './Citations'
import { ArtefactTimeline } from './ArtefactTimeline'
import { SectionListenButton } from './NarrationControls'
import { ScientificFigure } from './ScientificFigure'
import { ArrowIcon } from './Icons'

interface ChapterViewProps {
  section: BookSection
  total: number
  onCitation: (sourceId: string) => void
  activeNarrationTargetId: string | null
  narrationStatus: NarrationStatus
  catalogueStatus: NarrationCatalogueStatus
  catalogueError: string | null
  reviewMode: boolean
  narrationActive: boolean
  evidenceOpen: boolean
  onStartNarration: () => void
  onPauseNarration: () => void
  onResumeNarration: () => void
  onRetryNarration: () => void
  onOpenEvidence: () => void
  previous: BookSection | null
  next: BookSection | null
  spreadIndex: number
  onSpreadChange: (index: number) => void
  onSpreadCountChange: (count: number) => void
  onNavigateSection: (id: string) => void
  reduceMotion: boolean
}

interface BlockRendererProps {
  block: BookBlock
  sectionId: string
  blockIndex: number
  activeNarrationTargetId: string | null
  onCitation: (sourceId: string) => void
}

function narrationClass(base: string, targetId: string, activeTargetId: string | null) {
  return `${base} narration-target${activeTargetId === targetId ? ' narration-target--active' : ''}`
}

function BlockRenderer({ block, sectionId, blockIndex, activeNarrationTargetId, onCitation }: BlockRendererProps) {
  const citations = 'citations' in block ? block.citations : undefined
  const citationGroup = <CitationGroup ids={citations} onOpen={onCitation} sourceIndex={sourceNumberById} />
  const targetId = narrationTargetId(sectionId, blockIndex)

  if (block.type === 'heading') return <h2 id={targetId} className={narrationClass('chapter-subheading', targetId, activeNarrationTargetId)}>{block.text}</h2>
  if (block.type === 'paragraph') {
    return (
      <p id={targetId} className={narrationClass('chapter-paragraph', targetId, activeNarrationTargetId)}>
        {block.label ? <span className="epistemic-label">{block.label}</span> : null}
        {block.text} {citationGroup}
      </p>
    )
  }
  if (block.type === 'callout') {
    return (
      <aside id={targetId} className={narrationClass('chapter-callout', targetId, activeNarrationTargetId)}>
        <span className="epistemic-label">{block.label}</span>
        <h2>{block.title}</h2>
        <p>{block.text} {citationGroup}</p>
      </aside>
    )
  }
  if (block.type === 'figure') {
    return (
      <figure id={targetId} className={narrationClass('scientific-figure', targetId, activeNarrationTargetId)}>
        <ScientificFigure kind={block.figure} title={block.title} />
        <figcaption>
          <span className="epistemic-label">{block.label ?? 'Synthesis'}</span>
          <strong>{block.title}.</strong> {block.caption} {citationGroup}
        </figcaption>
      </figure>
    )
  }
  if (block.type === 'list') {
    const List = block.ordered ? 'ol' : 'ul'
    return (
      <section id={targetId} className={narrationClass('chapter-list', targetId, activeNarrationTargetId)}>
        {block.label ? <span className="epistemic-label">{block.label}</span> : null}
        {block.title ? <h2>{block.title}</h2> : null}
        <List>{block.items.map((item, itemIndex) => {
          const itemTargetId = narrationTargetId(sectionId, blockIndex, itemIndex)
          return <li id={itemTargetId} className={narrationClass('', itemTargetId, activeNarrationTargetId).trim()} key={item}>{item}</li>
        })}</List>
        {citationGroup}
      </section>
    )
  }
  if (block.type === 'timeline') {
    return (
      <ol id={targetId} className="timeline">
        {block.items.map((item, itemIndex) => {
          const itemTargetId = narrationTargetId(sectionId, blockIndex, itemIndex)
          return (
          <li id={itemTargetId} className={narrationClass('', itemTargetId, activeNarrationTargetId).trim()} key={`${item.year}-${item.title}`}>
            <time>{item.year}</time>
            <div><h2>{item.title}</h2><p>{item.detail} <CitationGroup ids={item.citations} onOpen={onCitation} sourceIndex={sourceNumberById} /></p></div>
          </li>
          )
        })}
      </ol>
    )
  }
  if (block.type === 'glossary') {
    return (
      <dl id={targetId} className="glossary">
        {block.items.map((item, itemIndex) => {
          const itemTargetId = narrationTargetId(sectionId, blockIndex, itemIndex)
          return <div id={itemTargetId} className={narrationClass('', itemTargetId, activeNarrationTargetId).trim()} key={item.term}><dt>{item.term}</dt><dd>{item.definition}</dd></div>
        })}
      </dl>
    )
  }
  return null
}

export function ChapterView({
  section,
  total,
  onCitation,
  activeNarrationTargetId,
  narrationStatus,
  catalogueStatus,
  catalogueError,
  reviewMode,
  narrationActive,
  evidenceOpen,
  onStartNarration,
  onPauseNarration,
  onResumeNarration,
  onRetryNarration,
  onOpenEvidence,
  previous,
  next,
  spreadIndex,
  onSpreadChange,
  onSpreadCountChange,
  onNavigateSection,
  reduceMotion,
}: ChapterViewProps) {
  const sectionLabel = sectionMarker(section)
  const progress = `${section.kind === 'chapter' ? (section.number / Math.max(1, total)) * 100 : 100}%`
  const headerTargetId = narrationTargetId(section.id)
  const sourceCount = sectionSourceIds(section).length
  const viewportRef = useRef<HTMLDivElement>(null)
  const flowRef = useRef<HTMLElement>(null)
  const spreadCountRef = useRef(1)
  const [pagesPerSpread, setPagesPerSpread] = useState(() => window.matchMedia('(min-width: 981px)').matches ? 2 : 1)
  const [pageCount, setPageCount] = useState(pagesPerSpread)

  const measureSpreads = useCallback(() => {
    const viewport = viewportRef.current
    const flow = flowRef.current
    if (!viewport || !flow || viewport.clientWidth < 1) return
    const nextPagesPerSpread = window.matchMedia('(min-width: 981px)').matches ? 2 : 1
    setPagesPerSpread(nextPagesPerSpread)
    const flowRect = flow.getBoundingClientRect()
    let lastContentEdge = 0
    for (const child of flow.children) {
      for (const rect of child.getClientRects()) {
        lastContentEdge = Math.max(lastContentEdge, rect.right - flowRect.left)
      }
    }
    const leafWidth = viewport.clientWidth / nextPagesPerSpread
    const occupiedPages = Math.max(1, Math.ceil((lastContentEdge - 1) / Math.max(1, leafWidth)))
    const count = Math.max(1, Math.ceil(occupiedPages / nextPagesPerSpread))
    setPageCount(occupiedPages)
    spreadCountRef.current = count
    onSpreadCountChange(count)
    if (spreadIndex >= count) onSpreadChange(count - 1)
  }, [onSpreadChange, onSpreadCountChange, spreadIndex])

  const revealTarget = useCallback((targetId: string) => {
    const viewport = viewportRef.current
    const flow = flowRef.current
    const target = document.getElementById(targetId)
    if (!viewport || !flow || !target || viewport.clientWidth < 1 || !flow.contains(target)) return
    let pageOwner = target
    while (pageOwner.parentElement && pageOwner.parentElement !== flow) pageOwner = pageOwner.parentElement
    const viewportRect = viewport.getBoundingClientRect()
    const targetRect = pageOwner.getClientRects()[0] ?? pageOwner.getBoundingClientRect()
    const absoluteLeft = targetRect.left - viewportRect.left + viewport.scrollLeft
    const requestedSpread = Math.max(0, Math.min(
      spreadCountRef.current - 1,
      Math.floor((absoluteLeft + viewport.clientWidth * 0.08) / viewport.clientWidth),
    ))
    onSpreadChange(requestedSpread)
  }, [onSpreadChange])

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(measureSpreads)
    const observer = new ResizeObserver(measureSpreads)
    if (viewportRef.current) observer.observe(viewportRef.current)
    if (flowRef.current) observer.observe(flowRef.current)
    document.fonts?.ready.then(measureSpreads).catch(() => {})
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [measureSpreads, section.id])

  useEffect(() => {
    if (activeNarrationTargetId) revealTarget(activeNarrationTargetId)
  }, [activeNarrationTargetId, revealTarget])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTo({
      left: spreadIndex * viewport.clientWidth,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [reduceMotion, spreadIndex])

  useEffect(() => {
    const onReveal = (event: Event) => {
      const targetId = (event as CustomEvent<{ targetId?: string }>).detail?.targetId
      if (targetId) requestAnimationFrame(() => revealTarget(targetId))
    }
    window.addEventListener('pv:reveal-target', onReveal)
    return () => window.removeEventListener('pv:reveal-target', onReveal)
  }, [revealTarget])

  const goBackward = () => {
    if (spreadIndex > 0) onSpreadChange(spreadIndex - 1)
    else if (previous) onNavigateSection(previous.id)
  }
  const goForward = () => {
    if (spreadIndex < spreadCountRef.current - 1) onSpreadChange(spreadIndex + 1)
    else if (next) onNavigateSection(next.id)
  }
  const hasPrevious = spreadIndex > 0 || previous !== null
  const hasNext = spreadIndex < spreadCountRef.current - 1 || next !== null
  const visiblePageStart = spreadIndex * pagesPerSpread + 1
  const totalPages = pageCount
  const visiblePageEnd = Math.min(totalPages, visiblePageStart + pagesPerSpread - 1)
  const pageStatus = visiblePageEnd > visiblePageStart
    ? `Pages ${visiblePageStart}–${visiblePageEnd} of ${totalPages}`
    : `Page ${visiblePageStart} of ${totalPages}`
  const manuscriptBlocks = []
  if (section.id !== 'representation-ladder') {
    for (let index = 0; index < section.blocks.length; index += 1) {
      const block = section.blocks[index]!
      const following = section.blocks[index + 1]
      if (block.type === 'heading' && following?.type === 'paragraph') {
        manuscriptBlocks.push(
          <section className="chapter-heading-pair" key={`${section.id}-${index}-pair`}>
            <BlockRenderer
              block={block}
              sectionId={section.id}
              blockIndex={index}
              activeNarrationTargetId={activeNarrationTargetId}
              onCitation={onCitation}
            />
            <BlockRenderer
              block={following}
              sectionId={section.id}
              blockIndex={index + 1}
              activeNarrationTargetId={activeNarrationTargetId}
              onCitation={onCitation}
            />
          </section>,
        )
        index += 1
      } else {
        manuscriptBlocks.push(
          <BlockRenderer
            key={`${section.id}-${index}`}
            block={block}
            sectionId={section.id}
            blockIndex={index}
            activeNarrationTargetId={activeNarrationTargetId}
            onCitation={onCitation}
          />,
        )
      }
    }
  }

  return (
    <div
      className={`chapter-layout chapter-layout--paginated${section.id === 'representation-ladder' ? ' chapter-layout--atlas' : ''}`}
      data-reader-spread={`${spreadIndex + 1}`}
      data-reader-spread-count={`${spreadCountRef.current}`}
    >
      <aside className="chapter-progress" aria-label={sectionPosition(section, total)}>
        <span>{section.kind === 'chapter' ? `${sectionLabel} / ${String(total).padStart(2, '0')}` : sectionLabel}</span>
        <div className="chapter-progress__rail">
          <span style={{ top: progress, '--mobile-progress': progress } as CSSProperties} />
        </div>
        <span className="chapter-progress__part">{section.part}</span>
      </aside>
      <div className="chapter-spread" ref={viewportRef}>
      <article
        className="chapter-article chapter-article--flow"
        ref={flowRef}
      >
        <header id={headerTargetId} className={narrationClass('chapter-header', headerTargetId, activeNarrationTargetId)}>
          <div className="chapter-header__meta">
            <span>{sectionPosition(section, total)}</span>
            {section.era ? <span>{section.era}</span> : null}
            {section.readingMinutes ? <span title="Estimated guided reading time, including diagrams">{section.readingMinutes} min guided</span> : null}
          </div>
          <h1>{section.title}</h1>
          <p>{section.deck}</p>
          <div className="chapter-header__actions">
            <SectionListenButton
              id={`listen-${section.id}`}
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
            <button
              className="evidence-control"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={evidenceOpen}
              aria-controls="evidence-drawer"
              onClick={onOpenEvidence}
            >
              <span>Sources</span>
              <strong>{String(sourceCount).padStart(2, '0')}</strong>
            </button>
          </div>
        </header>
        {section.id === 'representation-ladder'
          ? <ArtefactTimeline onCitation={onCitation} activeNarrationTargetId={activeNarrationTargetId} />
          : manuscriptBlocks}
      </article>
      </div>
      <nav className="spread-navigation" aria-label="Page navigation">
        {hasPrevious ? (
          <button type="button" className="spread-navigation__edge spread-navigation__edge--previous" onClick={goBackward}>
            <ArrowIcon direction="left" />
            <span className="sr-only">{spreadIndex > 0 ? `Previous spread, ${spreadIndex} of ${spreadCountRef.current}` : `Previous section, ${previous?.title}`}</span>
          </button>
        ) : <span />}
        <p className="spread-navigation__status" aria-live="polite">
          <span>{sectionLabel}</span>
          <span>{pageStatus}</span>
        </p>
        {hasNext ? (
          <button type="button" className="spread-navigation__edge spread-navigation__edge--next" onClick={goForward}>
            <span className="sr-only">{spreadIndex < spreadCountRef.current - 1 ? `Next spread, ${spreadIndex + 2} of ${spreadCountRef.current}` : `Next section, ${next?.title}`}</span>
            <ArrowIcon />
          </button>
        ) : <span />}
      </nav>
    </div>
  )
}
