import {
  DataTexture,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three'
import {
  BOOK_SURFACE_ASSETS,
  bookSurfaceAssetPath,
  type BookTextureTier,
} from './bookAssets'

export interface BookSurfaceTextures {
  clothColor: Texture
  clothNormal: Texture
  clothArm: Texture
  paperColor: Texture
  paperNormal: Texture
  paperRoughness: Texture
}

export interface LoadBookSurfaceTextureOptions {
  anisotropy: number
  tier?: BookTextureTier
}

function configureTexture(
  texture: Texture,
  {
    anisotropy,
    colour,
    repeat,
  }: {
    anisotropy: number
    colour: boolean
    repeat: readonly [number, number]
  },
) {
  texture.colorSpace = colour ? SRGBColorSpace : NoColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(...repeat)
  texture.anisotropy = anisotropy
  texture.needsUpdate = true
}

function sourceDimensions(texture: Texture) {
  const source = texture.source.data as { height?: number; naturalHeight?: number; naturalWidth?: number; width?: number } | undefined
  return {
    height: source?.naturalHeight ?? source?.height ?? 0,
    width: source?.naturalWidth ?? source?.width ?? 0,
  }
}

export async function loadBookSurfaceTextures({
  anisotropy,
  tier = '2k',
}: LoadBookSurfaceTextureOptions): Promise<BookSurfaceTextures> {
  const loader = new TextureLoader()
  const maxAnisotropy = Math.max(1, Math.floor(anisotropy))
  const results = await Promise.allSettled(
    BOOK_SURFACE_ASSETS.map((name) => loader.loadAsync(bookSurfaceAssetPath(name, tier))),
  )
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) {
    results.forEach((result) => {
      if (result.status === 'fulfilled') result.value.dispose()
    })
    throw failed.reason
  }
  const loadedTextures = results.map((result) => (
    result as PromiseFulfilledResult<Texture>
  ).value) as [Texture, Texture, Texture, Texture, Texture, Texture]
  const [
    clothColor,
    clothNormal,
    clothArm,
    paperColor,
    paperNormal,
    paperRoughness,
  ] = loadedTextures

  if (tier === '4k') {
    const undersized = loadedTextures.find((texture) => {
      const { height, width } = sourceDimensions(texture)
      return Math.max(width, height) < 4_096
    })
    if (undersized) {
      loadedTextures.forEach((texture) => texture.dispose())
      throw new Error('A decoded 4K book material did not contain a 4096-pixel source edge')
    }
  }

  const clothRepeat = [2.65, 3.72] as const
  const paperRepeat = [1.35, 2.35] as const

  configureTexture(clothColor, { anisotropy: maxAnisotropy, colour: true, repeat: clothRepeat })
  configureTexture(clothNormal, { anisotropy: maxAnisotropy, colour: false, repeat: clothRepeat })
  configureTexture(clothArm, { anisotropy: maxAnisotropy, colour: false, repeat: clothRepeat })
  configureTexture(paperColor, { anisotropy: maxAnisotropy, colour: true, repeat: paperRepeat })
  configureTexture(paperNormal, { anisotropy: maxAnisotropy, colour: false, repeat: paperRepeat })
  configureTexture(paperRoughness, { anisotropy: maxAnisotropy, colour: false, repeat: paperRepeat })

  return {
    clothColor,
    clothNormal,
    clothArm,
    paperColor,
    paperNormal,
    paperRoughness,
  }
}

function singlePixelTexture(
  rgba: readonly [number, number, number, number],
  colour = false,
) {
  const texture = new DataTexture(new Uint8Array(rgba), 1, 1)
  texture.colorSpace = colour ? SRGBColorSpace : NoColorSpace
  texture.needsUpdate = true
  return texture
}

export function createFallbackBookSurfaceTextures(): BookSurfaceTextures {
  return {
    clothColor: singlePixelTexture([255, 255, 255, 255], true),
    clothNormal: singlePixelTexture([128, 128, 255, 255]),
    clothArm: singlePixelTexture([255, 235, 0, 255]),
    paperColor: singlePixelTexture([255, 255, 255, 255], true),
    paperNormal: singlePixelTexture([128, 128, 255, 255]),
    paperRoughness: singlePixelTexture([242, 242, 242, 255]),
  }
}
