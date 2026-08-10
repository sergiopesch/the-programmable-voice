import type { Source } from '../types'

interface CitationGroupProps {
  ids?: string[]
  onOpen: (sourceId: string) => void
  sourceIndex: Map<string, number>
}

export function CitationGroup({ ids, onOpen, sourceIndex }: CitationGroupProps) {
  if (!ids?.length) return null
  return (
    <span className="citation-group" aria-label="Sources">
      {ids.map((id) => (
        <sup key={id}>
          <button
            className="citation"
            type="button"
            onClick={() => onOpen(id)}
            aria-label={`Open source ${sourceIndex.get(id) ?? id}`}
          >
            [{sourceIndex.get(id) ?? id}]
          </button>
        </sup>
      ))}
    </span>
  )
}

interface SourceEntryProps {
  source: Source
  number: number
  selected?: boolean
  idPrefix?: string
}

export function SourceEntry({ source, number, selected = false, idPrefix = 'source' }: SourceEntryProps) {
  return (
    <article className={`source-entry ${selected ? 'source-entry--selected' : ''}`} id={`${idPrefix}-${source.id}`} tabIndex={selected ? -1 : undefined}>
      <div className="source-entry__number">{String(number).padStart(2, '0')}</div>
      <div>
        <div className="source-entry__meta">
          <span>{source.type}</span>
          <span>{source.year}</span>
        </div>
        <p>{source.author}. <cite>{source.title}</cite>. {source.publication}.</p>
        {source.note ? <p className="source-entry__note">{source.note}</p> : null}
        <a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open source: ${source.title} (opens in a new tab)`}>Open source</a>
      </div>
    </article>
  )
}
