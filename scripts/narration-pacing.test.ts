import { describe, expect, it } from 'vitest'
import {
  narrationCharacterCount,
  narrationCharacterPacingBounds,
  narrationCharactersPerSecond,
  narrationReportedWordsPerMinute,
} from './narration-pacing'

describe('narration pacing contract', () => {
  it.each([
    [40, 6, 20],
    [80, 7.333333333333333, 20],
    [100, 8, 19.5],
    [120, 8.666666666666666, 19],
    [159, 9.966666666666667, 18.025],
    [160, 10, 18],
    [200, 10, 18],
  ])('sets reproducible bounds for %i characters', (characterCount, minimum, maximum) => {
    expect(narrationCharacterPacingBounds('x'.repeat(characterCount))).toEqual({
      minimumCharactersPerSecond: minimum,
      maximumCharactersPerSecond: maximum,
    })
  })

  it.each([
    ['How and where a string is bowed, struck or plucked changes the mixture and evolution of its modes, which changes timbre.', 6.903958, 17.4],
    ['The plain question: why does a room have a sound of its own?', 3.316417, 18.1],
  ])('accepts a healthy passage whose WPM is distorted by word length', (text, durationSeconds, expectedPace) => {
    const pace = narrationCharactersPerSecond(text, durationSeconds)
    const bounds = narrationCharacterPacingBounds(text)
    expect(Number(pace.toFixed(1))).toBe(expectedPace)
    expect(pace).toBeGreaterThanOrEqual(bounds.minimumCharactersPerSecond)
    expect(pace).toBeLessThanOrEqual(bounds.maximumCharactersPerSecond)
  })

  it('retains meaningful hard limits for long-form speech', () => {
    const text = 'x'.repeat(160)
    const bounds = narrationCharacterPacingBounds(text)
    expect(narrationCharactersPerSecond(text, 8)).toBeGreaterThan(bounds.maximumCharactersPerSecond)
    expect(narrationCharactersPerSecond(text, 20)).toBeLessThan(bounds.minimumCharactersPerSecond)
    expect(narrationCharactersPerSecond(text, 10)).toBeGreaterThanOrEqual(bounds.minimumCharactersPerSecond)
    expect(narrationCharactersPerSecond(text, 10)).toBeLessThanOrEqual(bounds.maximumCharactersPerSecond)
  })

  it('counts canonically equivalent Unicode text identically', () => {
    expect(narrationCharacterCount('café')).toBe(narrationCharacterCount('cafe\u0301'))
    expect(narrationCharacterCount('  voice  ')).toBe(5)
    expect(narrationCharacterCount('one\n\t two')).toBe(narrationCharacterCount('one two'))
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('fails closed for an invalid pace (%s)', (wordsPerMinute) => {
    expect(() => narrationReportedWordsPerMinute(wordsPerMinute)).toThrow(/positive finite number/)
  })

  it('fails closed for empty text or an invalid duration', () => {
    expect(() => narrationCharacterCount('   ')).toThrow(/non-empty spoken text/)
    expect(() => narrationCharactersPerSecond('voice', 0)).toThrow(/positive finite duration/)
    expect(() => narrationCharactersPerSecond('voice', Number.NaN)).toThrow(/positive finite duration/)
  })
})
