export type BookTextureTier = '2k' | '4k'

export type BookSurfaceAsset =
  | 'cover-cloth-arm'
  | 'cover-cloth-color'
  | 'cover-cloth-normal-gl'
  | 'page-paper-color'
  | 'page-paper-normal-gl'
  | 'page-paper-roughness'

export const BOOK_SURFACE_ASSETS: readonly BookSurfaceAsset[] = [
  'cover-cloth-color',
  'cover-cloth-normal-gl',
  'cover-cloth-arm',
  'page-paper-color',
  'page-paper-normal-gl',
  'page-paper-roughness',
]

export function bookSurfaceAssetPath(name: BookSurfaceAsset, tier: BookTextureTier) {
  return `/assets/book3d/${name}-${tier}.${tier === '4k' ? 'jpg' : 'webp'}`
}

export function bookEnvironmentCandidates(preferredTier: BookTextureTier) {
  const tiers: readonly BookTextureTier[] = preferredTier === '4k' ? ['4k', '2k'] : ['2k']
  return tiers.map((tier) => ({
    path: `/assets/book3d/studio-small-04-${tier}.hdr`,
    tier,
  }))
}
