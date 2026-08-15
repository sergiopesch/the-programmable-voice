export function shouldUsePhysicalBook(reduceMotion = false) {
  if (reduceMotion || typeof window === 'undefined') return false
  if (window.matchMedia('(forced-colors: active)').matches) return false

  const params = new URLSearchParams(window.location.search)
  if (params.get('book3d') === '0') return false
  if (params.get('book3d') === '1' || params.has('bookQuality')) return true
  if (navigator.webdriver) return false
  return Boolean(window.WebGL2RenderingContext)
}
