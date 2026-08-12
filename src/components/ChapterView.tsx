import type { CSSProperties } from 'react'
import type { BookBlock, BookSection } from '../types'
import { sectionMarker, sectionPosition, sectionSourceIds } from '../lib/book'
import { narrationTargetId } from '../lib/narration'
import { sourceNumberById } from '../data/sources'
import type { NarrationCatalogueStatus, NarrationStatus } from '../hooks/useNarrationPlayer'
import { CitationGroup } from './Citations'
import { ArtefactTimeline } from './ArtefactTimeline'
import { SectionListenButton } from './NarrationControls'
import { ScientificFigure } from './ScientificFigure'

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
}: ChapterViewProps) {
  const sectionLabel = sectionMarker(section)
  const progress = `${section.kind === 'chapter' ? (section.number / Math.max(1, total)) * 100 : 100}%`
  const headerTargetId = narrationTargetId(section.id)
  const sourceCount = sectionSourceIds(section).length
  return (
    <div className={`chapter-layout${section.id === 'representation-ladder' ? ' chapter-layout--atlas' : ''}`}>
      <aside className="chapter-progress" aria-label={sectionPosition(section, total)}>
        <span>{section.kind === 'chapter' ? `${sectionLabel} / ${String(total).padStart(2, '0')}` : sectionLabel}</span>
        <div className="chapter-progress__rail">
          <span style={{ top: progress, '--mobile-progress': progress } as CSSProperties} />
        </div>
        <span className="chapter-progress__part">{section.part}</span>
      </aside>
      <article className="chapter-article">
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
        <div className="chapter-body">
          {section.id === 'representation-ladder' ? <ArtefactTimeline onCitation={onCitation} activeNarrationTargetId={activeNarrationTargetId} /> : section.blocks.map((block, index) => (
            <BlockRenderer
              key={`${section.id}-${index}`}
              block={block}
              sectionId={section.id}
              blockIndex={index}
              activeNarrationTargetId={activeNarrationTargetId}
              onCitation={onCitation}
            />
          ))}
        </div>
      </article>
    </div>
  )
}
