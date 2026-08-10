import { describe, expect, it } from 'vitest'
import { sections } from '../data/book'
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
    ...(section.kind === 'opening' ? [] : section.blocks.flatMap(manuscriptStringsForBlock)),
  ]
}

describe('book narration units', () => {
  it('preserves the 26-section manuscript order', () => {
    const encounteredSectionIds = bookNarrationUnits.reduce<string[]>((ids, unit) => {
      if (ids.at(-1) !== unit.sectionId) ids.push(unit.sectionId)
      return ids
    }, [])

    expect(encounteredSectionIds).toEqual(sections.map((section) => section.id))
    expect(encounteredSectionIds).toHaveLength(26)

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
      id: 'narration:shipping-contract:block-2-callout-text',
      sectionId: 'shipping-contract',
      targetId: 'narration-shipping-contract-block-2',
      kind: 'callout-text',
      text: 'This rebuilt edition does not claim to recover the unavailable prior 165-source registry. Its evidence register is newly assembled from the sources visible here, with explicit caveats and access dates for living documentation.',
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

  it('narrates only visible opening copy and retains the authored lab demonstration', () => {
    expect(extractSectionNarrationUnits(sections[0]!)).toEqual([
      {
        id: 'narration:opening:section-title',
        sectionId: 'opening',
        targetId: 'narration-opening-header',
        kind: 'section-title',
        text: sections[0]!.title,
      },
      {
        id: 'narration:opening:section-deck',
        sectionId: 'opening',
        targetId: 'narration-opening-header',
        kind: 'section-deck',
        text: sections[0]!.deck,
      },
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
})
