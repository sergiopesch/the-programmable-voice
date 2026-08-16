import { describe, expect, it } from 'vitest'
import {
  createDevelopableSheetFrame,
  developableSheetPosition,
} from './developableSheet'

const width = 4.34
const height = 6.16
const floor = 0

function sample(frame: ReturnType<typeof createDevelopableSheetFrame>) {
  const points = []
  for (let u = 0; u <= width; u += width / 8) {
    for (let v = -height / 2; v <= height / 2; v += height / 8) {
      points.push(frame.position({ u, v }))
    }
  }
  return points
}

describe('developable travelling leaf', () => {
  it('keeps the binding on the hinge and the sheet above the floor', () => {
    for (const progress of [0, 0.18, 0.5, 0.82, 1]) {
      const frame = createDevelopableSheetFrame({ width, height, floor, progress })
      const binding = frame.position({ u: 0, v: 0.4 })
      expect(binding.x).toBeCloseTo(0, 8)
      expect(binding.z).toBeGreaterThanOrEqual(floor)
      for (const point of sample(frame)) {
        expect(point.z).toBeGreaterThanOrEqual(floor - 1e-9)
        expect(Number.isFinite(point.x)).toBe(true)
      }
    }
  })

  it('maps the closed and open covers to flat opposite leaves', () => {
    const start = createDevelopableSheetFrame({ width, height, floor, progress: 0 })
    const finish = createDevelopableSheetFrame({ width, height, floor, progress: 1 })
    expect(start.position({ u: width, v: 0 }).x).toBeCloseTo(width, 6)
    expect(finish.position({ u: width, v: 0 }).x).toBeCloseTo(-width, 6)
    expect(start.position({ u: width, v: 0 }).z).toBeCloseTo(floor, 6)
    expect(finish.position({ u: width, v: 0 }).z).toBeCloseTo(floor, 6)
  })

  it('preserves edge lengths of the undeformed sheet at mid-turn', () => {
    const rest = Math.hypot(width / 8, 0)
    const frame = createDevelopableSheetFrame({ width, height, floor, progress: 0.46, curl: 0.4 })
    for (let u = 0; u < width; u += width / 8) {
      const a = frame.position({ u, v: 0 })
      const b = frame.position({ u: u + width / 8, v: 0 })
      const chord = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
      expect(chord).toBeGreaterThan(rest * 0.86)
      expect(chord).toBeLessThan(rest * 1.08)
    }
  })

  it('rejects a stretching curl and a non-finite domain', () => {
    expect(() => createDevelopableSheetFrame({ width, height, progress: 0.4, curl: 0.8 })).toThrow(/curl/)
    expect(() => developableSheetPosition({ u: -1, v: 0 }, { width, height, progress: 0.2 })).toThrow(/u/)
  })
})
