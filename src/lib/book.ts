import type { BookBlock, BookSection } from '../types'

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

export function sectionSearchText(section: BookSection): string {
  return sectionPlainText(section).toLocaleLowerCase()
}
