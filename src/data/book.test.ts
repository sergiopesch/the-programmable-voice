import { describe, expect, it } from 'vitest'
import { blockSourceIds } from '../lib/book'
import { sections } from './book'
import { sourceById, sources } from './sources'

describe('editorial data contract', () => {
  it('contains the complete book structure', () => {
    expect(sections).toHaveLength(26)
    expect(sections.map((section) => section.number)).toEqual(
      Array.from({ length: 26 }, (_, index) => index),
    )
    expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length)
    expect(sections.filter((section) => section.kind === 'opening')).toHaveLength(1)
    expect(sections.filter((section) => section.kind === 'chapter')).toHaveLength(19)
    expect(sections.filter((section) => section.kind === 'lab')).toHaveLength(1)
    expect(sections.filter((section) => section.kind === 'appendix')).toHaveLength(5)
  })

  it('resolves every claim-level citation', () => {
    const cited = sections.flatMap((section) => section.blocks.flatMap(blockSourceIds))
    expect(cited.length).toBeGreaterThan(100)
    expect([...new Set(cited)].filter((id) => !sourceById.has(id))).toEqual([])
  })

  it('keeps the evidence register stable and linkable', () => {
    expect(sources.length).toBeGreaterThanOrEqual(80)
    expect(new Set(sources.map((source) => source.id)).size).toBe(sources.length)
    expect(sources.map((source) => source.id)).toEqual(
      sources.map((_, index) => `s${String(index + 1).padStart(2, '0')}`),
    )
    for (const source of sources) {
      expect(source.url, source.id).toMatch(/^https:\/\//)
      expect(source.title.trim(), source.id).not.toBe('')
      expect(source.note?.trim(), source.id).not.toBe('')
    }
  })

  it('states the future architecture with explicit epistemic boundaries', () => {
    const future = sections.find((section) => section.id === 'voice-after-turns')
    expect(future).toBeDefined()
    const labels = new Set(
      future?.blocks.flatMap((block) => ('label' in block && block.label ? [block.label] : [])),
    )
    expect(labels).toEqual(new Set(['Vendor disclosure', 'Documented architecture', 'Inference', 'Our thesis']))
  })
})
