import { describe, expect, it } from 'vitest'
import {
  narrationLoudnessIsWithinBounds,
  narrationMinimumIntegratedLoudnessLufs,
  type NarrationLoudnessMeasurement,
} from './narration-loudness'

const measurement = (overrides: Partial<NarrationLoudnessMeasurement> = {}): NarrationLoudnessMeasurement => ({
  durationSeconds: 2.361,
  integratedLoudnessLufs: -21.2,
  loudnessRangeLu: 0,
  truePeakDbtp: -2.5,
  targetTruePeakDbtp: -2,
  ...overrides,
})

describe('narration loudness contract', () => {
  it('accepts the measured peak-constrained short passage', () => {
    const actual = measurement()
    expect(narrationMinimumIntegratedLoudnessLufs(actual)).toBe(-21.2)
    expect(narrationLoudnessIsWithinBounds(actual)).toBe(true)
  })

  it('accepts the codec-compensated epilogue without relaxing the global target', () => {
    const original = measurement({
      durationSeconds: 2.362,
      integratedLoudnessLufs: -21.9,
      truePeakDbtp: -2.8,
    })
    const compensated = measurement({
      durationSeconds: 2.362,
      integratedLoudnessLufs: -19.9,
      truePeakDbtp: -2,
    })

    expect(narrationLoudnessIsWithinBounds(original)).toBe(false)
    expect(narrationMinimumIntegratedLoudnessLufs(compensated)).toBe(-20.5)
    expect(compensated.targetTruePeakDbtp).toBe(-2)
    expect(narrationLoudnessIsWithinBounds(compensated)).toBe(true)
  })

  it.each([
    [2.5, -21.5],
    [3, -21],
    [3.5, -20.5],
    [6, -20.5],
  ])('tapers the duration floor at %s seconds', (durationSeconds, expectedFloor) => {
    const actual = measurement({
      durationSeconds,
      integratedLoudnessLufs: -21.5,
      truePeakDbtp: -2,
    })
    expect(narrationMinimumIntegratedLoudnessLufs(actual)).toBe(expectedFloor)
  })

  it('rejects a short quiet clip that still has enough peak headroom', () => {
    const actual = measurement({ truePeakDbtp: -4 })
    expect(narrationMinimumIntegratedLoudnessLufs(actual)).toBe(-20.5)
    expect(narrationLoudnessIsWithinBounds(actual)).toBe(false)
  })

  it('retains the absolute short-form floor', () => {
    expect(narrationLoudnessIsWithinBounds(measurement({ integratedLoudnessLufs: -21.6 }))).toBe(false)
  })

  it('retains the upper loudness, loudness-range and true-peak limits', () => {
    expect(narrationLoudnessIsWithinBounds(measurement({ integratedLoudnessLufs: -15.4 }))).toBe(false)
    expect(narrationLoudnessIsWithinBounds(measurement({ loudnessRangeLu: 12.1 }))).toBe(false)
    expect(narrationLoudnessIsWithinBounds(measurement({ truePeakDbtp: -0.9 }))).toBe(false)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('fails closed for invalid duration %s', (durationSeconds) => {
    expect(() => narrationMinimumIntegratedLoudnessLufs(measurement({ durationSeconds }))).toThrow(/positive duration/)
    expect(narrationLoudnessIsWithinBounds(measurement({ durationSeconds }))).toBe(false)
  })
})
