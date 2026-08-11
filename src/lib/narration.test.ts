import { describe, expect, it } from 'vitest'
import { sections } from '../data/book'
import {
  narrationPassageHashMaterial,
  narrationPassageReadingNotes,
  narrationPilotPassageIds,
  narrationReadingNoteFor,
} from '../data/narrationEdition'
import type { BookBlock, BookSection } from '../types'
import {
  bookNarrationPassages,
  bookNarrationUnits,
  extractNarrationUnits,
  extractSectionNarrationUnits,
  groupNarrationPassages,
  narrationTargetId,
} from './narration'

function manuscriptStringsForBlock(block: BookBlock): string[] {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return [block.text]
    case 'figure':
      return [block.title, block.caption]
    case 'callout':
      return [block.title, block.text]
    case 'list':
      return [...(block.title ? [block.title] : []), ...block.items]
    case 'timeline':
      return block.items.flatMap((item) => [item.year, item.title, item.detail])
    case 'glossary':
      return block.items.flatMap((item) => [item.term, item.definition])
  }
}

function manuscriptStringsForSection(section: BookSection): string[] {
  return [
    section.title,
    section.deck,
    ...section.blocks.flatMap(manuscriptStringsForBlock),
  ]
}

describe('book narration units', () => {
  it('preserves the complete manuscript order', () => {
    const encounteredSectionIds = bookNarrationUnits.reduce<string[]>((ids, unit) => {
      if (ids.at(-1) !== unit.sectionId) ids.push(unit.sectionId)
      return ids
    }, [])

    expect(encounteredSectionIds).toEqual(sections.map((section) => section.id))
    expect(encounteredSectionIds).toHaveLength(36)

    for (const section of sections) {
      expect(bookNarrationUnits.filter((unit) => unit.sectionId === section.id)).toEqual(
        extractSectionNarrationUnits(section),
      )
    }
  })

  it('assigns deterministic, unique stable ids and predictable visible target ids', () => {
    const repeatedExtraction = extractNarrationUnits(sections)
    expect(repeatedExtraction.map((unit) => unit.id)).toEqual(
      bookNarrationUnits.map((unit) => unit.id),
    )

    expect(new Set(bookNarrationUnits.map((unit) => unit.id)).size).toBe(
      bookNarrationUnits.length,
    )
    expect(narrationTargetId('machines-hear')).toBe('narration-machines-hear-header')
    expect(narrationTargetId('machines-hear', 2)).toBe('narration-machines-hear-block-2')
    expect(narrationTargetId('machines-hear', 2, 4)).toBe('narration-machines-hear-block-2-item-4')

    expect(bookNarrationUnits[0]).toEqual({
      id: 'narration:opening:section-title',
      sectionId: 'opening',
      targetId: 'narration-opening-header',
      kind: 'section-title',
      text: 'The Programmable Voice',
    })
    expect(bookNarrationUnits.at(-1)).toEqual({
      id: 'narration:trust-after-voice:block-4-callout-text',
      sectionId: 'trust-after-voice',
      targetId: 'narration-trust-after-voice-block-4',
      kind: 'callout-text',
      text: 'Voice is an interface, not authority. Warmth can invite; it cannot authenticate. Fluency can clarify; it cannot consent. Memory can assist; it cannot own. A system worthy of trust makes it easy to know which of those things is happening now.',
    })

    for (const unit of bookNarrationUnits) {
      expect(unit.id).toMatch(/^narration:[a-z0-9-]+:[a-z0-9-]+$/)
      expect(unit.targetId).toMatch(/^narration-[a-z0-9-]+$/)
    }
  })

  it('never emits an empty narration response', () => {
    for (const unit of bookNarrationUnits) {
      expect(unit.text.trim(), unit.id).not.toBe('')
    }
  })

  it('covers every stored manuscript string exactly once and verbatim', () => {
    const manuscriptStrings = sections.flatMap(manuscriptStringsForSection)
    expect(bookNarrationUnits.map((unit) => unit.text)).toEqual(manuscriptStrings)
  })

  it('narrates the visible prologue and retains the authored lab demonstration', () => {
    const opening = sections[0]!
    expect(extractSectionNarrationUnits(opening).map((unit) => unit.text)).toEqual([
      opening.title,
      opening.deck,
      ...opening.blocks.flatMap(manuscriptStringsForBlock),
    ])

    const lab = sections.find((section) => section.kind === 'lab')!
    expect(extractSectionNarrationUnits(lab).map((unit) => unit.text)).toEqual([
      lab.title,
      lab.deck,
      ...lab.blocks.flatMap(manuscriptStringsForBlock),
    ])
  })

  it('groups adjacent strings only when they share one visible target', () => {
    expect(bookNarrationPassages.length).toBeLessThan(bookNarrationUnits.length)
    expect(bookNarrationPassages.flatMap((passage) => passage.unitIds)).toEqual(
      bookNarrationUnits.map((unit) => unit.id),
    )
    expect(new Set(bookNarrationPassages.map((passage) => passage.id)).size).toBe(
      bookNarrationPassages.length,
    )

    for (const passage of bookNarrationPassages) {
      const units = passage.unitIds.map((id) => bookNarrationUnits.find((unit) => unit.id === id)!)
      expect(new Set(units.map((unit) => unit.targetId))).toEqual(new Set([passage.targetId]))
      expect(new Set(units.map((unit) => unit.sectionId))).toEqual(new Set([passage.sectionId]))
      for (const unit of units) expect(passage.text).toContain(unit.text)
    }

    expect(groupNarrationPassages(bookNarrationUnits)).toEqual(bookNarrationPassages)
  })

  it('keeps pronunciation direction passage-scoped and covers the configured pilot', () => {
    const passageIds = new Set(bookNarrationPassages.map(({ id }) => id))
    for (const passageId of Object.keys(narrationPassageReadingNotes)) {
      expect(passageIds.has(passageId), passageId).toBe(true)
      expect(narrationPassageHashMaterial('configuration', passageId, 'Same text')).toBe(
        `configuration\n${narrationReadingNoteFor(passageId)}\nSame text`,
      )
    }

    const unnotedPassage = bookNarrationPassages.find(({ id }) => !narrationPassageReadingNotes[id])!
    expect(narrationPassageHashMaterial('configuration', unnotedPassage.id, 'Same text')).toBe('configuration\n\nSame text')
    expect(new Set(narrationPilotPassageIds).size).toBe(narrationPilotPassageIds.length)
    expect(narrationPilotPassageIds.every((id) => passageIds.has(id))).toBe(true)
    expect(new Set(narrationPilotPassageIds.map((id) => bookNarrationPassages.find((passage) => passage.id === id)!.sectionId)).size).toBeGreaterThanOrEqual(5)
  })
})
