import { describe, expect, it } from 'vitest'
import { narrationPacingBounds, narrationReportedWordsPerMinute } from './narration-pacing'

describe('narration pacing contract', () => {
  it.each([
    [5, 45, 240],
    [6, 90, 195],
    [19, 90, 195],
    [20, 100, 193.6],
    [21, 100, 192.3],
    [29, 100, 181.4],
    [30, 100, 180],
    [31, 100, 180],
  ])('sets reproducible bounds for %i words', (wordCount, minimum, maximum) => {
    expect(narrationPacingBounds(wordCount)).toEqual({
      minimumWordsPerMinute: minimum,
      maximumWordsPerMinute: maximum,
    })
  })

  it('accepts the measured 21-word list item while retaining a hard outlier ceiling', () => {
    const text = 'How and where a string is bowed, struck or plucked changes the mixture and evolution of its modes, which changes timbre.'
    const wordCount = text.split(/\s+/).length
    const { minimumWordsPerMinute, maximumWordsPerMinute } = narrationPacingBounds(wordCount)

    expect(wordCount).toBe(21)
    expect(182.5).toBeGreaterThanOrEqual(minimumWordsPerMinute)
    expect(182.5).toBeLessThanOrEqual(maximumWordsPerMinute)
    expect(205).toBeGreaterThan(maximumWordsPerMinute)
  })

  it('applies the one-decimal reporting boundary identically', () => {
    const { maximumWordsPerMinute } = narrationPacingBounds(20)
    const accepted = narrationReportedWordsPerMinute(193.64)
    const rejected = narrationReportedWordsPerMinute(193.66)

    expect(accepted).toBe(193.6)
    expect(accepted).toBeLessThanOrEqual(maximumWordsPerMinute)
    expect(rejected).toBe(193.7)
    expect(rejected).toBeGreaterThan(maximumWordsPerMinute)
  })

  it.each([0, -1, 1.5, Number.NaN])('fails closed for an invalid word count (%s)', (wordCount) => {
    expect(() => narrationPacingBounds(wordCount)).toThrow(/positive whole-word count/)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('fails closed for an invalid pace (%s)', (wordsPerMinute) => {
    expect(() => narrationReportedWordsPerMinute(wordsPerMinute)).toThrow(/positive finite number/)
  })
})
