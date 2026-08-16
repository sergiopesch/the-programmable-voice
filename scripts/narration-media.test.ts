import { describe, expect, it } from 'vitest'
import { durationFromDecodedFrameSamples } from './narration-media'

describe('decoded narration duration', () => {
  it('measures duration from decoded frame samples instead of MP3 container padding', () => {
    expect(durationFromDecodedFrameSamples('1152\n1152\n567\n', 24_000)).toBeCloseTo(0.119625, 9)
  })

  it('rejects missing, malformed, or non-positive measurements', () => {
    expect(() => durationFromDecodedFrameSamples('', 24_000)).toThrow(/could not be measured/)
    expect(() => durationFromDecodedFrameSamples('1152\nnope\n', 24_000)).toThrow(/could not be measured/)
    expect(() => durationFromDecodedFrameSamples('0\n', 24_000)).toThrow(/could not be measured/)
    expect(() => durationFromDecodedFrameSamples('1152\n', 0)).toThrow(/positive finite sample rate/)
  })
})
