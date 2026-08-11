import { describe, expect, it } from 'vitest'
import { sections } from '../data/book'
import { normaliseSearchText, searchBookSections, searchExcerpt } from './book'

describe('book search', () => {
  it('matches case and diacritics without changing the displayed manuscript', () => {
    const results = searchBookSections(sections, 'YORUBA')

    expect(results).toHaveLength(1)
    expect(results[0]?.section.id).toBe('fdn-memory-without-recording')
    expect(results[0]?.excerpt).toContain('Yorùbá')
    expect(results[0]?.blockIndex).toBeTypeOf('number')
  })

  it('normalises canonical and decomposed accents to the same key', () => {
    expect(normaliseSearchText('Yorùbá')).toBe('yoruba')
    expect(normaliseSearchText('Yoru\u0300ba\u0301')).toBe('yoruba')
  })

  it('keeps long excerpts concise while retaining the match', () => {
    const source = `Before ${'context '.repeat(30)}Yorùbá ${'detail '.repeat(30)}after.`
    const excerpt = searchExcerpt(source, 'Yoruba', 120)

    expect(excerpt.length).toBeLessThanOrEqual(122)
    expect(excerpt).toContain('Yorùbá')
    expect(excerpt).toMatch(/^…/)
    expect(excerpt).toMatch(/…$/)
  })
})
