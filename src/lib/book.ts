import type { BookBlock, BookSection } from '../types'

export interface SectionSearchResult {
  section: BookSection
  excerpt: string
  blockIndex?: number
  itemIndex?: number
}

interface SearchableSectionUnit {
  text: string
  excerptText?: string
  blockIndex?: number
  itemIndex?: number
}

export function blockSourceIds(block: BookBlock): string[] {
  if ('citations' in block && block.citations) return block.citations
  if (block.type === 'timeline') return block.items.flatMap((item) => item.citations ?? [])
  return []
}

export function sectionSourceIds(section: BookSection): string[] {
  const ids = new Set<string>()
  for (const block of section.blocks) {
    for (const id of blockSourceIds(block)) ids.add(id)
  }
  return [...ids]
}

export function sectionMarker(section: BookSection): string {
  if (section.kind === 'opening') return 'P'
  if (section.kind === 'lab') return 'LAB'
  if (section.kind === 'appendix') {
    const companionIndex = Math.max(0, section.number - 32)
    return String.fromCharCode('A'.charCodeAt(0) + companionIndex)
  }
  return String(section.number).padStart(2, '0')
}

export function sectionPosition(section: BookSection, chapterTotal = 30): string {
  if (section.kind === 'chapter') return `Chapter ${section.number} of ${chapterTotal}`
  if (section.kind === 'opening') return 'Prologue'
  if (section.kind === 'lab') return 'Sound laboratory'
  return `Companion ${sectionMarker(section)}`
}

export function sectionPlainText(section: BookSection): string {
  const pieces = [section.title, section.deck]
  for (const block of section.blocks) {
    if (block.type === 'paragraph') pieces.push(block.text)
    if (block.type === 'heading') pieces.push(block.text)
    if (block.type === 'callout') pieces.push(block.title, block.text)
    if (block.type === 'figure') pieces.push(block.title, block.caption)
    if (block.type === 'list') pieces.push(block.title ?? '', ...block.items)
    if (block.type === 'timeline') pieces.push(...block.items.flatMap((item) => [item.year, item.title, item.detail]))
    if (block.type === 'glossary') pieces.push(...block.items.flatMap((item) => [item.term, item.definition]))
  }
  return pieces.join(' ')
}

/**
 * Produces a forgiving search key while leaving the displayed manuscript
 * untouched. Decomposing Unicode accents means, for example, that a reader
 * can type "Yoruba" and still find the correctly written "Yorùbá".
 */
export function normaliseSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en-GB')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sectionSearchText(section: BookSection): string {
  return normaliseSearchText(sectionPlainText(section))
}

function searchableSectionUnits(section: BookSection): SearchableSectionUnit[] {
  const units: SearchableSectionUnit[] = [
    { text: section.title, excerptText: section.deck },
    { text: section.deck },
  ]

  for (const [blockIndex, block] of section.blocks.entries()) {
    if (block.type === 'paragraph' || block.type === 'heading') {
      units.push({ text: block.text, blockIndex })
    }
    if (block.type === 'callout') {
      units.push({ text: `${block.title}. ${block.text}`, blockIndex })
    }
    if (block.type === 'figure') {
      units.push({ text: `${block.title}. ${block.caption}`, blockIndex })
    }
    if (block.type === 'list') {
      if (block.title) units.push({ text: block.title, blockIndex })
      for (const [itemIndex, item] of block.items.entries()) {
        units.push({ text: item, blockIndex, itemIndex })
      }
    }
    if (block.type === 'timeline') {
      for (const [itemIndex, item] of block.items.entries()) {
        units.push({
          text: `${item.year}. ${item.title}. ${item.detail}`,
          blockIndex,
          itemIndex,
        })
      }
    }
    if (block.type === 'glossary') {
      for (const [itemIndex, item] of block.items.entries()) {
        units.push({
          text: `${item.term}. ${item.definition}`,
          blockIndex,
          itemIndex,
        })
      }
    }
  }

  return units
}

function normalisedTextWithOriginalIndices(value: string) {
  let text = ''
  const originalIndices: number[] = []

  for (let originalIndex = 0; originalIndex < value.length;) {
    const character = String.fromCodePoint(value.codePointAt(originalIndex)!)
    const normalised = character
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLocaleLowerCase('en-GB')

    for (const outputCharacter of normalised) {
      text += outputCharacter
      originalIndices.push(originalIndex)
    }
    originalIndex += character.length
  }

  return { text, originalIndices }
}

export function searchExcerpt(value: string, query: string, maximumLength = 176): string {
  const source = value.trim()
  if (source.length <= maximumLength) return source

  const normalisedQuery = normaliseSearchText(query)
  const mappedSource = normalisedTextWithOriginalIndices(source)
  const normalisedMatchIndex = mappedSource.text.indexOf(normalisedQuery)
  const originalMatchIndex = normalisedMatchIndex >= 0
    ? mappedSource.originalIndices[normalisedMatchIndex] ?? 0
    : 0
  const originalMatchEnd = normalisedMatchIndex >= 0
    ? (mappedSource.originalIndices[normalisedMatchIndex + Math.max(0, normalisedQuery.length - 1)] ?? originalMatchIndex) + 1
    : originalMatchIndex

  const surroundingCharacters = Math.max(24, maximumLength - (originalMatchEnd - originalMatchIndex))
  let start = Math.max(0, originalMatchIndex - Math.floor(surroundingCharacters * 0.45))
  let end = Math.min(source.length, start + maximumLength)
  start = Math.max(0, end - maximumLength)

  if (start > 0) {
    const nextSpace = source.indexOf(' ', start)
    if (nextSpace >= 0 && nextSpace < originalMatchIndex) start = nextSpace + 1
  }
  if (end < source.length) {
    const previousSpace = source.lastIndexOf(' ', end)
    if (previousSpace > originalMatchEnd) end = previousSpace
  }

  return `${start > 0 ? '…' : ''}${source.slice(start, end).trim()}${end < source.length ? '…' : ''}`
}

export function searchBookSections(
  sections: readonly BookSection[],
  query: string,
): SectionSearchResult[] {
  const normalisedQuery = normaliseSearchText(query)
  if (normalisedQuery.length < 2) return []

  const results: SectionSearchResult[] = []
  for (const section of sections) {
    const match = searchableSectionUnits(section).find((unit) =>
      normaliseSearchText(unit.text).includes(normalisedQuery),
    )
    if (!match) continue

    results.push({
      section,
      excerpt: searchExcerpt(match.excerptText ?? match.text, query),
      blockIndex: match.blockIndex,
      itemIndex: match.itemIndex,
    })
  }

  return results
}
