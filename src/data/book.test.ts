import { describe, expect, it } from 'vitest'
import { blockSourceIds, sectionMarker, sectionPosition } from '../lib/book'
import { sections } from './book'
import { sourceById, sources } from './sources'

describe('editorial data contract', () => {
  it('contains the complete book structure', () => {
    expect(sections).toHaveLength(36)
    expect(sections.map((section) => section.number)).toEqual(Array.from({ length: 36 }, (_, index) => index))
    expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length)
    expect(sections.filter((section) => section.kind === 'opening')).toHaveLength(1)
    expect(sections.filter((section) => section.kind === 'chapter')).toHaveLength(30)
    expect(sections.filter((section) => section.kind === 'lab')).toHaveLength(1)
    expect(sections.filter((section) => section.kind === 'appendix')).toHaveLength(4)
    expect(sections.filter((section) => section.kind === 'chapter').map((section) => section.number)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    )
  })

  it('labels the companion leaves A–D without duplicating markers in their titles', () => {
    const companions = sections.filter((section) => section.kind === 'appendix')

    expect(companions.map(sectionMarker)).toEqual(['A', 'B', 'C', 'D'])
    expect(companions.map((section) => sectionPosition(section))).toEqual([
      'Companion A',
      'Companion B',
      'Companion C',
      'Companion D',
    ])
    for (const section of companions) expect(section.title).not.toMatch(/^[A-D] — /)
  })

  it('resolves every claim-level citation', () => {
    const cited = sections.flatMap((section) => section.blocks.flatMap(blockSourceIds))
    expect(cited.length).toBeGreaterThan(600)
    expect([...new Set(cited)].filter((id) => !sourceById.has(id))).toEqual([])
  })

  it('keeps the evidence register stable and linkable', () => {
    expect(sources).toHaveLength(205)
    expect(new Set(sources.map((source) => source.id)).size).toBe(sources.length)
    expect(new Set(sources.map((source) => source.url.replace(/\/$/, '').toLocaleLowerCase())).size).toBe(sources.length)
    const cited = new Set(sections.flatMap((section) => section.blocks.flatMap(blockSourceIds)))
    expect(sources.filter((source) => !cited.has(source.id))).toEqual([])
    for (const source of sources) {
      expect(source.id, source.id).toMatch(/^(?:fdn|med|mac)-[a-z0-9-]+$/)
      expect(source.url, source.id).toMatch(/^https:\/\//)
      expect(source.title.trim(), source.id).not.toBe('')
      expect(source.note?.trim(), source.id).not.toBe('')
    }
  })

  it('states the future architecture with explicit epistemic boundaries', () => {
    const future = sections.find((section) => section.id === 'conversation-becomes-stream')
    expect(future).toBeDefined()
    const labels = new Set(
      future?.blocks.flatMap((block) => ('label' in block && block.label ? [block.label] : [])),
    )
    expect(labels).toEqual(new Set(['Synthesis', 'Established science', 'Research preprint', 'Vendor disclosure', 'Our thesis']))
  })
})
