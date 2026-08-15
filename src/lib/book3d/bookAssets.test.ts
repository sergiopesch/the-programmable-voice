import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BOOK_SURFACE_ASSETS,
  bookEnvironmentCandidates,
  bookSurfaceAssetPath,
} from './bookAssets'

const projectRoot = path.resolve(import.meta.dirname, '../../..')
const assetDirectory = path.join(projectRoot, 'public/assets/book3d')

describe('physical book asset contract', () => {
  it('keeps a complete deployable 2K fallback', () => {
    const twoKilobytePaths = [
      ...BOOK_SURFACE_ASSETS.map((name) => bookSurfaceAssetPath(name, '2k')),
      bookEnvironmentCandidates('2k')[0]?.path,
    ].filter((assetPath): assetPath is string => Boolean(assetPath))

    for (const assetPath of twoKilobytePaths) {
      expect(existsSync(path.join(projectRoot, 'public', assetPath))).toBe(true)
    }

    const vercelIgnore = readFileSync(path.join(projectRoot, '.vercelignore'), 'utf8')
    expect(vercelIgnore).not.toMatch(/book3d\/\*-2k/)
    expect(vercelIgnore).toContain('public/assets/book3d/*-4k.jpg')
    expect(vercelIgnore).toContain('public/assets/book3d/*-4k.hdr')
  })

  it('falls back from a missing 4K environment to the 2K environment', () => {
    expect(bookEnvironmentCandidates('4k')).toEqual([
      { path: '/assets/book3d/studio-small-04-4k.hdr', tier: '4k' },
      { path: '/assets/book3d/studio-small-04-2k.hdr', tier: '2k' },
    ])
  })

  it('does not retain material files that the renderer never selects', () => {
    const expectedAssets = [
      ...BOOK_SURFACE_ASSETS.flatMap((name) => (
        ['2k', '4k'] as const
      ).map((tier) => path.basename(bookSurfaceAssetPath(name, tier)))),
      ...bookEnvironmentCandidates('4k').map(({ path: assetPath }) => path.basename(assetPath)),
    ].sort()
    const actualAssets = readdirSync(assetDirectory)
      .filter((file) => file !== 'ASSETS.md')
      .sort()

    expect(actualAssets).toEqual(expectedAssets)
  })

  it('keeps every retained asset bound to its documented checksum', () => {
    const assetManifest = readFileSync(path.join(assetDirectory, 'ASSETS.md'), 'utf8')
    const declaredChecksums = new Map(
      [...assetManifest.matchAll(/^\| `([^`]+)` \|.*\| `([a-f0-9]{64})` \|$/gm)]
        .map(([, file, checksum]) => [file!, checksum!]),
    )
    const retainedAssets = readdirSync(assetDirectory)
      .filter((file) => file !== 'ASSETS.md')
      .sort()

    expect([...declaredChecksums.keys()].sort()).toEqual(retainedAssets)
    for (const file of retainedAssets) {
      const digest = createHash('sha256')
        .update(readFileSync(path.join(assetDirectory, file)))
        .digest('hex')
      expect(digest, file).toBe(declaredChecksums.get(file))
    }
  })
})
