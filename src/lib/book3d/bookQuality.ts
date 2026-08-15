import type { WebGLRenderer } from 'three'
import type { BookTextureTier } from './bookAssets'

export interface BookRenderQuality {
  outputTier: BookOutputTier
  pixelRatio: number
  renderLongEdge: number
  shadowMapSize: 1024 | 2048 | 4096
  textureTier: BookTextureTier
}

export type BookOutputTier = 'adaptive' | '2k' | '4k' | '8k'

interface NetworkInformationLike {
  saveData?: boolean
}

interface NavigatorWithCapacity extends Navigator {
  connection?: NetworkInformationLike
  deviceMemory?: number
}

function requestedTier(): Exclude<BookOutputTier, 'adaptive'> | null {
  const value = new URLSearchParams(window.location.search).get('bookQuality')
  return value === '8k' || value === '4k' || value === '2k' ? value : null
}

function outputPixelRatio({
  baselinePixelRatio,
  height,
  maxRenderbufferSize,
  renderLongEdge,
  width,
}: {
  baselinePixelRatio: number
  height: number
  maxRenderbufferSize: number
  renderLongEdge: number
  width: number
}) {
  width = Math.max(1, width)
  height = Math.max(1, height)
  // WebGLRenderer floors CSS-size * pixel-ratio. A sub-pixel epsilon avoids
  // 4095/7679 buffers caused by binary rounding without changing layout.
  // Leave a whole backing pixel of headroom. WebGLRenderer floors the
  // multiplication after its own size bookkeeping; fractional CSS pixels can
  // otherwise still produce 4095 even when a tiny floating epsilon was added.
  const targetRatio = (renderLongEdge + 1) / Math.max(width, height)
  const hardwareRatio = Math.min(maxRenderbufferSize / width, maxRenderbufferSize / height)
  return Math.max(0.5, Math.min(hardwareRatio, Math.max(baselinePixelRatio, targetRatio)))
}

/**
 * Re-fits a fixed output tier after responsive layout has settled. The stage
 * can change size after its renderer is created; retaining the ratio selected
 * for the earlier size silently turns a nominal 4K buffer into a smaller one.
 */
export function resolveBookOutputPixelRatio(
  quality: BookRenderQuality,
  width: number,
  height: number,
) {
  if (quality.outputTier === 'adaptive') return quality.pixelRatio

  return outputPixelRatio({
    baselinePixelRatio: 1,
    height,
    maxRenderbufferSize: quality.renderLongEdge,
    renderLongEdge: quality.renderLongEdge,
    width,
  })
}

/**
 * Separates material resolution from drawing-buffer resolution. Native 4K
 * photographed maps remain the highest source tier; an 8K-class output is a
 * guarded supersampling tier for large, capable desktop GPUs.
 */
export function selectBookRenderQuality(
  renderer: WebGLRenderer,
  host: HTMLElement,
): BookRenderQuality {
  const navigatorWithCapacity = navigator as NavigatorWithCapacity
  const forcedTier = requestedTier()
  const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1)
  const mobile = matchMedia('(max-width: 760px)').matches
  const baselinePixelRatio = Math.min(devicePixelRatio, mobile ? 1.5 : 2)
  const physicalLongEdge = Math.max(
    host.clientWidth,
    host.clientHeight,
    window.innerWidth,
    window.innerHeight,
  ) * baselinePixelRatio
  const gl = renderer.getContext()
  const maxRenderbufferSize = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))
  // The photographed cloth maps are 4096 x 4116. A nominal 4096 texture
  // limit is therefore not enough, and the drawing buffer must independently
  // support a true UHD edge.
  const supports4kMaterials = renderer.capabilities.maxTextureSize >= 4_116
  const supports4kOutput = maxRenderbufferSize >= 4_096
  const supports8kOutput = maxRenderbufferSize >= 7_680
  const memoryAllows4k = (navigatorWithCapacity.deviceMemory ?? 8) >= 8
  const cpuAllows4k = (navigator.hardwareConcurrency || 8) >= 6
  const memoryAllows8k = (navigatorWithCapacity.deviceMemory ?? 8) >= 16
  const cpuAllows8k = (navigator.hardwareConcurrency || 8) >= 12
  const dataSaver = navigatorWithCapacity.connection?.saveData === true

  const textureTier: BookTextureTier = forcedTier === '2k'
    ? '2k'
    : supports4kMaterials && supports4kOutput && (
      forcedTier === '4k'
      || forcedTier === '8k'
      || (
        physicalLongEdge >= 1_600
        && memoryAllows4k
        && cpuAllows4k
        && !dataSaver
        && !mobile
        && navigator.webdriver !== true
      )
    )
      ? '4k'
      : '2k'

  const outputTier: BookOutputTier = forcedTier === '2k'
    ? '2k'
    : forcedTier === '8k' && textureTier === '4k' && supports8kOutput
      && memoryAllows8k && cpuAllows8k && !dataSaver && !mobile && navigator.webdriver !== true
      ? '8k'
      : forcedTier === '4k' && textureTier === '4k' && supports4kOutput
        ? '4k'
        : textureTier === '4k' && supports8kOutput && physicalLongEdge >= 3_840
          && memoryAllows8k && cpuAllows8k && !dataSaver && !mobile && navigator.webdriver !== true
          ? '8k'
          : textureTier === '4k' && supports4kOutput
            ? '4k'
            : 'adaptive'

  const renderLongEdge = outputTier === '8k'
    ? 7_680
    : outputTier === '4k'
      ? 4_096
      : outputTier === '2k'
        ? 2_048
        : Math.round(Math.max(host.clientWidth, host.clientHeight) * baselinePixelRatio)
  const pixelRatio = outputPixelRatio({
    baselinePixelRatio: outputTier === 'adaptive' ? baselinePixelRatio : 1,
    height: host.clientHeight,
    maxRenderbufferSize,
    renderLongEdge,
    width: host.clientWidth,
  })

  const shadowMapSize = textureTier === '4k' && maxRenderbufferSize >= 4096
    ? 4096
    : matchMedia('(max-width: 1199px)').matches
      ? 1024
      : 2048

  return { outputTier, pixelRatio, renderLongEdge, shadowMapSize, textureTier }
}
