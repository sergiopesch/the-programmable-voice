import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { BookSection } from '../types'
import type { TextSize } from '../hooks/usePreferences'
import { searchBookSections, sectionMarker, type SectionSearchResult } from '../lib/book'
import { narrationTargetId } from '../lib/narration'
import { Modal } from './Modal'

interface ContentsDialogProps {
  open: boolean
  sections: BookSection[]
  activeId: string
  textSize: TextSize
  reduceMotion: boolean
  onClose: () => void
  onNavigate: (id: string) => void
  onTextSize: (size: TextSize) => void
  onReduceMotion: (value: boolean) => void
}

export function ContentsDialog(props: ContentsDialogProps) {
  const activeEntryRef = useRef<HTMLButtonElement>(null)
  const groups = useMemo(() => {
    const grouped = new Map<string, BookSection[]>()
    for (const section of props.sections) {
      grouped.set(section.part, [...(grouped.get(section.part) ?? []), section])
    }
    return [...grouped.entries()]
  }, [props.sections])

  useEffect(() => {
    if (!props.open) return
    const frame = requestAnimationFrame(() => {
      activeEntryRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [props.activeId, props.open])

  return (
    <Modal open={props.open} title="Contents" onClose={props.onClose} className="contents-modal">
      <div className="reader-settings" aria-labelledby="reader-settings-heading">
        <h3 id="reader-settings-heading">Reader</h3>
        <div className="segmented" role="group" aria-label="Text size">
          {(['compact', 'default', 'large'] as TextSize[]).map((size) => <button key={size} type="button" aria-pressed={props.textSize === size} onClick={() => props.onTextSize(size)}>{size}</button>)}
        </div>
        <label className="switch-row"><span>Reduce motion</span><input type="checkbox" checked={props.reduceMotion} onChange={(event) => props.onReduceMotion(event.currentTarget.checked)} /></label>
      </div>
      <nav className="contents-list" aria-label="Book contents">
        {groups.map(([part, sections]) => (
          <section key={part}>
            <h3>{part}</h3>
            <ol>
              {sections.map((section) => {
                const active = section.id === props.activeId
                return (
                  <li key={section.id}>
                    <button
                      ref={active ? activeEntryRef : undefined}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => { props.onClose(); props.onNavigate(section.id) }}
                    >
                      <span>{sectionMarker(section)}</span>
                      <strong>{section.title}</strong>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
      </nav>
    </Modal>
  )
}

interface SearchDialogProps {
  open: boolean
  sections: BookSection[]
  onClose: () => void
  onNavigate: (id: string, revealTargetId: string) => void
}

export function SearchDialog({ open, sections, onClose, onNavigate }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const deferredQuery = useDeferredValue(query)
  const searching = deferredQuery.trim().length > 1
  const matches = searching ? searchBookSections(sections, deferredQuery) : []
  const results: SectionSearchResult[] = searching
    ? matches.slice(0, 12)
    : sections.slice(0, 6).map((section) => ({ section, excerpt: section.deck }))
  const resultSummary = searching
    ? matches.length === 0
      ? 'No sections found'
      : `${matches.length} ${matches.length === 1 ? 'section' : 'sections'} found${matches.length > results.length ? `; showing the first ${results.length}` : ''}`
    : 'Suggested sections'

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  const navigateToResult = (result: SectionSearchResult) => {
    onClose()
    const requestedTargetId = narrationTargetId(
      result.section.id,
      result.blockIndex,
      result.itemIndex,
    )
    onNavigate(result.section.id, requestedTargetId)
  }

  return (
    <Modal open={open} title="Search the book" onClose={onClose} className="search-modal">
      <label className="search-field">
        <span className="sr-only">Search terms</span>
        <input ref={inputRef} value={query} type="search" placeholder="Sound, sampling, memory…" onChange={(event) => setQuery(event.currentTarget.value)} />
      </label>
      <p className="search-result-count" role="status" aria-live="polite" aria-atomic="true">{resultSummary}</p>
      <div className="search-results">
        {results.map((result) => (
          <button key={result.section.id} type="button" onClick={() => navigateToResult(result)}>
            <span>{sectionMarker(result.section)}</span>
            <span>
              <strong>{result.section.title}</strong>
              <small>{result.excerpt}</small>
            </span>
          </button>
        ))}
        {searching && results.length === 0 ? <p className="search-empty">No sections match “{query.trim()}”.</p> : null}
      </div>
    </Modal>
  )
}
