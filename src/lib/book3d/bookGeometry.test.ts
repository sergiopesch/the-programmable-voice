import { describe, expect, it } from 'vitest'
import {
  BOOK_CASING_ASPECT,
  BOOK_CLOSED_ASPECT,
  BOOK_OPEN_ASPECT,
  fitPhysicalSpread,
} from './bookGeometry'

describe('canonical physical book geometry', () => {
  it('keeps cover, page and casing proportions explicit', () => {
    expect(BOOK_CLOSED_ASPECT).toBeCloseTo(0.718, 2)
    expect(BOOK_OPEN_ASPECT).toBeCloseTo(1.409, 2)
    expect(BOOK_CASING_ASPECT).toBeCloseTo(1.436, 2)
  })

  it('letterboxes a physical spread without changing its scale ratio', () => {
    expect(fitPhysicalSpread(1_200, 680)).toEqual({
      width: 680 * BOOK_CASING_ASPECT,
      height: 680,
      left: (1_200 - 680 * BOOK_CASING_ASPECT) / 2,
      top: 0,
    })

    const portrait = fitPhysicalSpread(390, 700)
    expect(portrait.width).toBe(390)
    expect(portrait.height).toBeCloseTo(390 / BOOK_CASING_ASPECT)
    expect(portrait.left).toBe(0)
    expect(portrait.top).toBeGreaterThan(0)
  })
})
