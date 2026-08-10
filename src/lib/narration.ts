import { sections } from '../data/book'
import type { BookBlock, BookSection } from '../types'

export type NarrationUnitKind =
  | 'section-title'
  | 'section-deck'
  | 'heading'
  | 'paragraph'
  | 'figure-title'
  | 'figure-caption'
  | 'callout-title'
  | 'callout-text'
  | 'list-title'
  | 'list-item'
  | 'timeline-year'
  | 'timeline-title'
  | 'timeline-detail'
  | 'glossary-term'
  | 'glossary-definition'

export interface NarrationUnit {
  /** Stable manuscript identity; it is not a DOM id. */
  id: string
  sectionId: string
  /** DOM id for the visible element containing this exact manuscript string. */
  targetId: string
  kind: NarrationUnitKind
  text: string
}

export interface NarrationPassage {
  /** Stable identity for one Realtime response and one visible reading target. */
  id: string
  sectionId: string
  targetId: string
  unitIds: string[]
  text: string
}

/**
 * Returns the DOM id for a visible narration target.
 *
 * Omit blockIndex for the section header. Pass itemIndex only when a list,
 * timeline, or glossary block renders independently targetable items.
 */
export function narrationTargetId(
  sectionId: string,
  blockIndex?: number,
  itemIndex?: number,
): string {
  if (blockIndex === undefined) return `narration-${sectionId}-header`

  const blockId = `narration-${sectionId}-block-${blockIndex}`
  return itemIndex === undefined ? blockId : `${blockId}-item-${itemIndex}`
}

function assertNever(value: never): never {
  throw new Error(`Unsupported book block: ${JSON.stringify(value)}`)
}

function createNarrationUnit(
  sectionId: string,
  path: string,
  targetId: string,
  kind: NarrationUnitKind,
  text: string,
): NarrationUnit {
  if (text.trim().length === 0) {
    throw new Error(`Narration text is empty at ${sectionId}/${path}`)
  }

  return {
    id: `narration:${sectionId}:${path}`,
    sectionId,
    targetId,
    kind,
    text,
  }
}

function blockNarrationUnits(
  sectionId: string,
  block: BookBlock,
  blockIndex: number,
): NarrationUnit[] {
  const blockPath = `block-${blockIndex}`
  const blockTargetId = narrationTargetId(sectionId, blockIndex)
  const unit = (path: string, kind: NarrationUnitKind, text: string) =>
    createNarrationUnit(sectionId, `${blockPath}-${path}`, blockTargetId, kind, text)

  switch (block.type) {
    case 'heading':
      return [unit('heading', 'heading', block.text)]
    case 'paragraph':
      return [unit('paragraph', 'paragraph', block.text)]
    case 'figure':
      return [
        unit('figure-title', 'figure-title', block.title),
        unit('figure-caption', 'figure-caption', block.caption),
      ]
    case 'callout':
      return [
        unit('callout-title', 'callout-title', block.title),
        unit('callout-text', 'callout-text', block.text),
      ]
    case 'list': {
      const units = block.title ? [unit('list-title', 'list-title', block.title)] : []
      return units.concat(
        block.items.map((item, itemIndex) =>
          createNarrationUnit(
            sectionId,
            `${blockPath}-list-item-${itemIndex}`,
            narrationTargetId(sectionId, blockIndex, itemIndex),
            'list-item',
            item,
          ),
        ),
      )
    }
    case 'timeline':
      return block.items.flatMap((item, itemIndex) => {
        const targetId = narrationTargetId(sectionId, blockIndex, itemIndex)
        return [
          createNarrationUnit(sectionId, `${blockPath}-timeline-item-${itemIndex}-year`, targetId, 'timeline-year', item.year),
          createNarrationUnit(sectionId, `${blockPath}-timeline-item-${itemIndex}-title`, targetId, 'timeline-title', item.title),
          createNarrationUnit(sectionId, `${blockPath}-timeline-item-${itemIndex}-detail`, targetId, 'timeline-detail', item.detail),
        ]
      })
    case 'glossary':
      return block.items.flatMap((item, itemIndex) => {
        const targetId = narrationTargetId(sectionId, blockIndex, itemIndex)
        return [
          createNarrationUnit(sectionId, `${blockPath}-glossary-item-${itemIndex}-term`, targetId, 'glossary-term', item.term),
          createNarrationUnit(sectionId, `${blockPath}-glossary-item-${itemIndex}-definition`, targetId, 'glossary-definition', item.definition),
        ]
      })
    default:
      return assertNever(block)
  }
}

export function extractSectionNarrationUnits(section: BookSection): NarrationUnit[] {
  const headerTargetId = narrationTargetId(section.id)
  return [
    createNarrationUnit(section.id, 'section-title', headerTargetId, 'section-title', section.title),
    createNarrationUnit(section.id, 'section-deck', headerTargetId, 'section-deck', section.deck),
    ...(section.kind === 'opening' ? [] : section.blocks).flatMap((block, blockIndex) =>
      blockNarrationUnits(section.id, block, blockIndex),
    ),
  ]
}

export function extractNarrationUnits(bookSections: readonly BookSection[]): NarrationUnit[] {
  return bookSections.flatMap(extractSectionNarrationUnits)
}

function joinPassageText(parts: readonly string[]): string {
  return parts.reduce((joined, part) => {
    if (!joined) return part
    return /[.!?;:]$/.test(joined.trimEnd()) ? `${joined} ${part}` : `${joined}. ${part}`
  }, '')
}

/**
 * Groups adjacent strings that share one visible target into a natural spoken
 * passage. No manuscript words are added, removed, or reordered; only a full
 * stop is inserted between adjacent stored strings when one is needed for
 * spoken cadence.
 */
export function groupNarrationPassages(units: readonly NarrationUnit[]): NarrationPassage[] {
  const passages: NarrationPassage[] = []

  for (const unit of units) {
    const previous = passages.at(-1)
    if (previous?.sectionId === unit.sectionId && previous.targetId === unit.targetId) {
      previous.unitIds.push(unit.id)
      previous.text = joinPassageText([previous.text, unit.text])
      continue
    }

    passages.push({
      id: `passage:${unit.id.slice('narration:'.length)}`,
      sectionId: unit.sectionId,
      targetId: unit.targetId,
      unitIds: [unit.id],
      text: unit.text,
    })
  }

  return passages
}

/** Ordered narration units for the complete current manuscript. */
export const bookNarrationUnits = extractNarrationUnits(sections)

/** Ordered, target-aligned Realtime responses for the complete book. */
export const bookNarrationPassages = groupNarrationPassages(bookNarrationUnits)
