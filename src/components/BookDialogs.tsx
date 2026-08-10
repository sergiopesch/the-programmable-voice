import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { BookSection } from '../types'
import type { TextSize } from '../hooks/usePreferences'
import { sectionSearchText } from '../lib/book'
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
  const groups = useMemo(() => {
    const grouped = new Map<string, BookSection[]>()
    for (const section of props.sections) {
      grouped.set(section.part, [...(grouped.get(section.part) ?? []), section])
    }
    return [...grouped.entries()]
  }, [props.sections])

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
              {sections.map((section) => <li key={section.id}><button type="button" aria-current={section.id === props.activeId ? 'page' : undefined} onClick={() => { props.onClose(); props.onNavigate(section.id) }}><span>{String(section.number + 1).padStart(2, '0')}</span><strong>{section.title}</strong></button></li>)}
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
  onNavigate: (id: string) => void
}

export function SearchDialog({ open, sections, onClose, onNavigate }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const deferredQuery = useDeferredValue(query)
  const results = deferredQuery.trim().length > 1
    ? sections.filter((section) => sectionSearchText(section).includes(deferredQuery.trim().toLocaleLowerCase())).slice(0, 12)
    : sections.slice(0, 6)

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  return (
    <Modal open={open} title="Search the book" onClose={onClose} className="search-modal">
      <label className="search-field">
        <span className="sr-only">Search terms</span>
        <input ref={inputRef} value={query} type="search" placeholder="Sound, sampling, memory…" onChange={(event) => setQuery(event.currentTarget.value)} />
      </label>
      <div className="search-results" aria-live="polite">
        {results.map((section) => <button key={section.id} type="button" onClick={() => { onClose(); onNavigate(section.id) }}><span>{String(section.number + 1).padStart(2, '0')}</span><span><strong>{section.title}</strong><small>{section.deck}</small></span></button>)}
        {results.length === 0 ? <p className="search-empty">No sections match “{query.trim()}”.</p> : null}
      </div>
    </Modal>
  )
}
