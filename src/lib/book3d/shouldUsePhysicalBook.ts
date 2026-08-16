export function shouldUsePhysicalBook(reduceMotion = false) {
  if (reduceMotion || typeof window === 'undefined') return false
  if (window.matchMedia('(forced-colors: active)').matches) return false

  const params = new URLSearchParams(window.location.search)
  if (params.get('book3d') === '0') return false
  const forced = params.get('book3d') === '1' || params.has('bookQuality')
  if (forced) return true
  if (navigator.webdriver) return false
  // A phone is a single paper leaf. The physical hardback is a desktop cover.
  if (window.matchMedia('(max-width: 760px)').matches) return false
  return Boolean(window.WebGL2RenderingContext)
}

/**
 * The travelling leaf is a two-page-spread enhancement. At the reader's
 * single-page breakpoint, semantic motion preserves the real layout instead
 * of projecting a detached desktop-sized sheet over it.
 */
export function shouldUsePhysicalPageTurn(reduceMotion = false) {
  return shouldUsePhysicalBook(reduceMotion)
    && window.matchMedia('(min-width: 981px)').matches
}

export function shouldUsePhysicalOpening(reduceMotion = false) {
  return shouldUsePhysicalBook(reduceMotion)
    && window.matchMedia('(min-width: 1100px)').matches
}

export function shouldInspectPhysicalBook() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('inspect') !== '0'
}
