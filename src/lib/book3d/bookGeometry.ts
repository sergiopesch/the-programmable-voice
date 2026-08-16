/**
 * Canonical geometry for every representation of the physical book.
 *
 * Three.js scenes use these values directly. DOM stages use the exported
 * aspect ratios so a settled spread, its transient page, and the casing below
 * it describe one object instead of being independently fitted rectangles.
 */
export const BOOK_GEOMETRY = Object.freeze({
  boardWidth: 4.58,
  boardHeight: 6.38,
  boardDepth: 0.09,
  pageInsetX: 0.12,
  pageInsetY: 0.11,
  pageBlockDepth: 0.56,
})

export const BOOK_PAGE_WIDTH = BOOK_GEOMETRY.boardWidth - BOOK_GEOMETRY.pageInsetX * 2
export const BOOK_PAGE_HEIGHT = BOOK_GEOMETRY.boardHeight - BOOK_GEOMETRY.pageInsetY * 2
export const BOOK_SPREAD_WIDTH = BOOK_PAGE_WIDTH * 2
export const BOOK_OPEN_ASPECT = BOOK_SPREAD_WIDTH / BOOK_PAGE_HEIGHT
export const BOOK_CLOSED_ASPECT = BOOK_GEOMETRY.boardWidth / BOOK_GEOMETRY.boardHeight

/** Extra board visible around the paper block in an open spread. */
export const BOOK_CASING_WIDTH = BOOK_GEOMETRY.boardWidth * 2
export const BOOK_CASING_HEIGHT = BOOK_GEOMETRY.boardHeight
export const BOOK_CASING_ASPECT = BOOK_CASING_WIDTH / BOOK_CASING_HEIGHT

export const BOOK_CAMERA = Object.freeze({
  /** Perspective used while the reader can inspect the closed volume. */
  fov: 30,
  /** Empty image-space margin around the fitted physical bounds. */
  fitPadding: 1.1,
  /** A near-frontal reading pose: the cover faces the reader, with only enough
   *  yaw to reveal the oxblood spine and the thickness of the page block. */
  closedDirection: Object.freeze({ x: 0.22, y: 0.16, z: 0.96 }),
})

export interface PhysicalStageFit {
  height: number
  width: number
  left: number
  top: number
}

/**
 * Largest canonical open-book rectangle contained by a viewport. Keeping this
 * pure makes the DOM overlay and Three projection testable with the same rule.
 */
export function fitPhysicalSpread(
  availableWidth: number,
  availableHeight: number,
  aspect = BOOK_CASING_ASPECT,
): PhysicalStageFit {
  const safeWidth = Math.max(1, availableWidth)
  const safeHeight = Math.max(1, availableHeight)
  const widthFromHeight = safeHeight * aspect
  const width = Math.min(safeWidth, widthFromHeight)
  const height = width / aspect
  return {
    width,
    height,
    left: (safeWidth - width) / 2,
    top: (safeHeight - height) / 2,
  }
}
