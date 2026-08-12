import { describe, expect, it } from 'vitest'
import type { NarrationTechnicalQc } from '../src/lib/narrationRelease'
import { narrationFullMediaQcProblems } from './verify-narration'

const recordedQc: NarrationTechnicalQc = {
  durationExpectedSeconds: 1.364,
  durationMeasuredSeconds: 1.206,
  wordsPerMinute: 149.2,
  integratedLoudnessLufs: -18.4,
  loudnessRangeLu: 0,
  truePeakDbtp: -3.7,
  leadingSilenceSeconds: 0,
  trailingSilenceSeconds: 0,
  normalisationVersion: 'loudnorm-2026.2-24khz-48kbps',
  fullDecodePassed: true,
}

const measuredQc = {
  integratedLoudnessLufs: -18.44,
  loudnessRangeLu: 0,
  truePeakDbtp: -3.68,
  leadingSilenceSeconds: 0,
  trailingSilenceSeconds: 0,
  wordsPerMinute: 149.3,
  charactersPerSecond: 14.096,
  minimumCharactersPerSecond: 6,
  maximumCharactersPerSecond: 20,
  loudnessWithinBounds: true,
}

describe('full narration verification parity', () => {
  it('accepts the passage-10 one-decimal WPM boundary already accepted during reuse', () => {
    expect(narrationFullMediaQcProblems(recordedQc, measuredQc)).toEqual([])
  })

  it('rejects material metadata drift and names every mismatched field', () => {
    expect(narrationFullMediaQcProblems(recordedQc, {
      ...measuredQc,
      integratedLoudnessLufs: Number.NaN,
      wordsPerMinute: 149.4,
      charactersPerSecond: 20.1,
      loudnessWithinBounds: false,
    })).toEqual([
      'integrated loudness measurement is not finite',
      'words per minute measured 149.4 but metadata records 149.2',
      'character pace 20.1 is outside 6–20',
      'loudness is outside the configured bounds',
    ])
  })
})
