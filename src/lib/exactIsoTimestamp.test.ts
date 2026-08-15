import { describe, expect, it } from 'vitest'
import { isExactIsoTimestamp } from './exactIsoTimestamp'

describe('exact ISO timestamp validation', () => {
  it('accepts canonical UTC timestamps with millisecond precision', () => {
    expect(isExactIsoTimestamp('2026-08-15T12:34:56.789Z')).toBe(true)
  })

  it.each([
    null,
    '2026-08-15T12:34:56Z',
    '2026-08-15T12:34:56.789+00:00',
    '2026-02-30T12:34:56.789Z',
  ])('rejects non-canonical or impossible values', (value) => {
    expect(isExactIsoTimestamp(value)).toBe(false)
  })
})
