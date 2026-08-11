import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { artefactNarrationText, soundArtefacts, type ArtefactKind } from '../data/artefacts'
import { representationLadderSection } from '../data/companions'
import { sourceNumberById } from '../data/sources'
import { narrationTargetId } from '../lib/narration'
import { CitationGroup } from './Citations'

function ArtefactIcon({ kind }: { kind: ArtefactKind }) {
  if (kind === 'string') return <svg viewBox="0 0 80 80"><path d="M8 40h64M8 30v20M72 30v20M8 40c12-26 24 26 32 0s20 26 32 0" /></svg>
  if (kind === 'telephone') return <svg viewBox="0 0 80 80"><path d="M22 62h36M30 62V34c0-12 20-12 20 0v28M19 24c8 9 34 9 42 0M22 20h36v7H22zM34 39h12v14H34z" /></svg>
  if (kind === 'cylinder') return <svg viewBox="0 0 80 80"><ellipse cx="40" cy="20" rx="20" ry="8"/><path d="M20 20v40c0 11 40 11 40 0V20M20 32c0 11 40 11 40 0M20 44c0 11 40 11 40 0" /></svg>
  if (kind === 'disc' || kind === 'vinyl') return <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="30"/><circle cx="40" cy="40" r="5"/><path d="M17 28c16-15 43-8 47 12M14 40c7 27 43 33 57 8M20 55c15 14 38 10 46-6" /></svg>
  if (kind === 'tape') return <svg viewBox="0 0 80 80"><rect x="8" y="15" width="64" height="50"/><circle cx="27" cy="36" r="12"/><circle cx="53" cy="36" r="12"/><path d="M27 48h26M20 60h40" /></svg>
  if (kind === 'pcm') return <svg viewBox="0 0 80 80"><path d="M8 63h64M8 12v51M12 54h8V40h8V48h8V24h8V30h8V16h8V36h8V20h8" /></svg>
  if (kind === 'cd') return <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="31"/><circle cx="40" cy="40" r="7"/><path d="M40 9v24M18 18l17 17M9 40h24M62 18 45 35" /></svg>
  if (kind === 'file') return <svg viewBox="0 0 80 80"><path d="M18 8h30l14 14v50H18zM48 8v14h14M25 49c7-22 11 18 17-5s9 19 14-3" /></svg>
  if (kind === 'packet') return <svg viewBox="0 0 80 80"><rect x="8" y="16" width="20" height="16"/><rect x="52" y="16" width="20" height="16"/><rect x="30" y="50" width="20" height="16"/><path d="M28 24h24M18 32l18 18M62 32 44 50" /></svg>
  return <svg viewBox="0 0 80 80"><circle cx="18" cy="18" r="7"/><circle cx="62" cy="20" r="7"/><circle cx="40" cy="40" r="8"/><circle cx="17" cy="61" r="7"/><circle cx="63" cy="62" r="7"/><path d="m24 22 10 12m12 0 10-9M22 56l12-11m12 1 11 11M25 18h30M24 61h32" /></svg>
}

export function ArtefactTimeline({ onCitation, activeNarrationTargetId }: { onCitation: (sourceId: string) => void; activeNarrationTargetId: string | null }) {
  const [chosenIndex, setChosenIndex] = useState(0)
  const descriptionId = useId()
  const railHelpId = useId()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const headingIndex = representationLadderSection.blocks.findIndex((block) => block.type === 'heading')
  const introductionIndex = representationLadderSection.blocks.findIndex((block) => block.type === 'paragraph' && block.label !== 'Contested history')
  const timelineIndex = representationLadderSection.blocks.findIndex((block) => block.type === 'timeline')
  const noteIndex = representationLadderSection.blocks.findIndex((block) => block.type === 'paragraph' && block.label === 'Contested history')
  const heading = representationLadderSection.blocks[headingIndex]
  const introduction = representationLadderSection.blocks[introductionIndex]
  const note = representationLadderSection.blocks[noteIndex]
  const headingTargetId = narrationTargetId(representationLadderSection.id, headingIndex)
  const introductionTargetId = narrationTargetId(representationLadderSection.id, introductionIndex)
  const noteTargetId = narrationTargetId(representationLadderSection.id, noteIndex)
  const narratedIndex = soundArtefacts.findIndex((_, artefactIndex) => activeNarrationTargetId === narrationTargetId(representationLadderSection.id, timelineIndex, artefactIndex))
  const selectedIndex = narratedIndex >= 0 ? narratedIndex : chosenIndex
  const selected = soundArtefacts[selectedIndex] ?? soundArtefacts[0]!

  const chooseArtefact = (index: number) => {
    setChosenIndex(index)
  }

  const handleRailKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % soundArtefacts.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + soundArtefacts.length) % soundArtefacts.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = soundArtefacts.length - 1
    else return

    event.preventDefault()
    chooseArtefact(nextIndex)
    const nextButton = buttonRefs.current[nextIndex]
    nextButton?.focus()
    nextButton?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' })
  }

  return (
    <section className="artefact-atlas" aria-labelledby={headingTargetId}>
      <header>
        <span>Interactive representation ladder</span>
        {heading?.type === 'heading' ? <h2 id={headingTargetId} className={activeNarrationTargetId === headingTargetId ? 'narration-target narration-target--active' : 'narration-target'}>{heading.text}</h2> : null}
        {introduction?.type === 'paragraph' ? <p id={introductionTargetId} className={activeNarrationTargetId === introductionTargetId ? 'narration-target narration-target--active' : 'narration-target'}>{introduction.text}</p> : null}
      </header>
      <span id={railHelpId} className="sr-only">Use the Left and Right Arrow keys to move through the representations. Use Home for the first and End for the last.</span>
      <ol
        className="artefact-atlas__rail horizontal-scroll-region"
        data-page-keys="ignore"
        aria-label="Sound representation timeline"
        aria-describedby={railHelpId}
      >
        {soundArtefacts.map((artefact, index) => {
          const targetId = narrationTargetId(representationLadderSection.id, timelineIndex, index)
          return (
          <li key={artefact.kind}>
            <button
              ref={(element) => { buttonRefs.current[index] = element }}
              id={targetId}
              className={activeNarrationTargetId === targetId ? 'narration-target narration-target--active' : 'narration-target'}
              type="button"
              aria-label={`${artefact.year}: ${artefact.title}`}
              aria-pressed={index === selectedIndex}
              aria-controls={descriptionId}
              aria-describedby={index === selectedIndex ? descriptionId : undefined}
              aria-keyshortcuts="ArrowLeft ArrowRight Home End"
              tabIndex={index === chosenIndex ? 0 : -1}
              onClick={() => chooseArtefact(index)}
              onKeyDown={(event) => handleRailKeyDown(event, index)}
            >
              <span className="sr-only" aria-hidden="true">{artefactNarrationText(artefact)}</span>
              <time aria-hidden="true">{artefact.year}</time>
              <span aria-hidden="true"><ArtefactIcon kind={artefact.kind} /></span>
              <strong aria-hidden="true">{artefact.title}</strong>
            </button>
          </li>
          )
        })}
      </ol>
      <label className="artefact-atlas__scrubber">
        <span>Scrub through time</span>
        <input
          type="range"
          min="0"
          max={soundArtefacts.length - 1}
          step="1"
          value={selectedIndex}
          aria-label="Choose a representation by date"
          aria-valuetext={`${selected.year}, ${selected.title}`}
          aria-controls={descriptionId}
          aria-describedby={descriptionId}
          onChange={(event) => chooseArtefact(Number(event.currentTarget.value))}
        />
      </label>
      <div className="artefact-atlas__detail" id={descriptionId}>
        <div className="artefact-atlas__enlargement" aria-hidden="true"><ArtefactIcon kind={selected.kind} /></div>
        <div>
          <span>{selected.year}</span>
          <h3>{selected.title}</h3>
          <p>{selected.detail} <CitationGroup ids={selected.citations} onOpen={onCitation} sourceIndex={sourceNumberById} /></p>
        </div>
        <dl>
          <div><dt>Preserves</dt><dd>{selected.preserves}</dd></div>
          <div><dt>Discards</dt><dd>{selected.discards}</dd></div>
        </dl>
      </div>
      {note?.type === 'paragraph' ? (
        <p id={noteTargetId} className={`artefact-atlas__note narration-target${activeNarrationTargetId === noteTargetId ? ' narration-target--active' : ''}`}>
          <strong>{note.text.slice(0, note.text.indexOf(':') + 1)}</strong>{note.text.slice(note.text.indexOf(':') + 1)}
        </p>
      ) : null}
    </section>
  )
}
