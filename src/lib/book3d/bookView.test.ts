import { describe, expect, it } from 'vitest'
import { bookFaceFromAzimuth, cameraAzimuthDegrees, normaliseDegrees, shortestAngleDelta } from './bookView'

describe('book view descriptions', () => {
  it('normalises continuous rotations without losing full-turn input', () => {
    expect(normaliseDegrees(725)).toBe(5)
    expect(normaliseDegrees(-90)).toBe(270)
  })

  it('uses meaningful physical faces around the full book', () => {
    expect(bookFaceFromAzimuth(0)).toBe('Front cover')
    expect(bookFaceFromAzimuth(90)).toBe('Fore edge')
    expect(bookFaceFromAzimuth(180)).toBe('Back cover')
    expect(bookFaceFromAzimuth(270)).toBe('Spine')
    expect(bookFaceFromAzimuth(360)).toBe('Front cover')
  })

  it('derives azimuth from camera position', () => {
    expect(cameraAzimuthDegrees(0, 10)).toBe(0)
    expect(cameraAzimuthDegrees(10, 0)).toBe(90)
  })

  it('settles to the front along the shortest orbit without crossing the book', () => {
    expect(shortestAngleDelta(Math.PI * 0.9, 0)).toBeCloseTo(-Math.PI * 0.9)
    expect(shortestAngleDelta(-Math.PI * 0.9, 0)).toBeCloseTo(Math.PI * 0.9)
    expect(shortestAngleDelta(Math.PI * 1.9, 0)).toBeCloseTo(Math.PI * 0.1)
  })
})
