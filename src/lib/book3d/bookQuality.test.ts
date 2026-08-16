import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebGLRenderer } from 'three'
import {
  resolveBookInteractionPixelRatio,
  resolveBookOutputPixelRatio,
  selectBookRenderQuality,
} from './bookQuality'
import { installBookBrowserTestEnvironment, type BookBrowserTestEnvironment } from './browserTestEnvironment'

function rendererWithLimits(maxTextureSize: number, maxRenderbufferSize: number) {
  const context = {
    MAX_RENDERBUFFER_SIZE: 0x84e8,
    getParameter: () => maxRenderbufferSize,
  }
  return {
    capabilities: { maxTextureSize },
    getContext: () => context,
  } as unknown as WebGLRenderer
}

function sizedHost(width = 1200, height = 800) {
  return { clientHeight: height, clientWidth: width } as HTMLElement
}

describe('book 4K capability selection', () => {
  let browser: BookBrowserTestEnvironment

  beforeEach(() => {
    browser = installBookBrowserTestEnvironment()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('honours forced 4K only when both texture and renderbuffer dimensions fit', () => {
    browser.setSearch('?bookQuality=4k')
    expect(selectBookRenderQuality(rendererWithLimits(8192, 8192), sizedHost()).textureTier).toBe('4k')
    expect(selectBookRenderQuality(rendererWithLimits(8192, 8192), sizedHost()).outputTier).toBe('4k')
    const textureConstrained = selectBookRenderQuality(
      rendererWithLimits(4096, 8192),
      sizedHost(),
    )
    expect(textureConstrained.textureTier).toBe('2k')
    expect(textureConstrained.outputTier).toBe('adaptive')
    const bufferConstrained = selectBookRenderQuality(
      rendererWithLimits(8192, 4095),
      sizedHost(),
    )
    expect(bufferConstrained.textureTier).toBe('2k')
    expect(bufferConstrained.outputTier).toBe('adaptive')
  })

  it('uses guarded 8K supersampling with native 4K materials', () => {
    browser.setSearch('?bookQuality=8k')
    const ultra = selectBookRenderQuality(rendererWithLimits(16384, 16384), sizedHost(1280, 720))
    expect(ultra.textureTier).toBe('4k')
    expect(ultra.outputTier).toBe('8k')
    expect(ultra.renderLongEdge).toBe(7680)
    expect(Math.floor(1280 * ultra.pixelRatio)).toBeGreaterThanOrEqual(7680)

    const constrained = selectBookRenderQuality(rendererWithLimits(8192, 4096), sizedHost(1280, 720))
    expect(constrained.outputTier).toBe('4k')
    expect(constrained.renderLongEdge).toBe(4096)
    expect(Math.floor(1280 * constrained.pixelRatio)).toBeGreaterThanOrEqual(4096)
    expect(Math.floor(720 * constrained.pixelRatio)).toBeLessThan(4096)
  })

  it('reserves automatic 8K for very large, high-capacity desktop output', () => {
    const ordinaryDesktop = selectBookRenderQuality(
      rendererWithLimits(16384, 16384),
      sizedHost(2000, 1200),
    )
    expect(ordinaryDesktop.textureTier).toBe('4k')
    expect(ordinaryDesktop.outputTier).toBe('4k')

    const largeDesktop = selectBookRenderQuality(
      rendererWithLimits(16384, 16384),
      sizedHost(4000, 2200),
    )
    expect(largeDesktop.outputTier).toBe('8k')

    browser.navigator.deviceMemory = 8
    expect(selectBookRenderQuality(
      rendererWithLimits(16384, 16384),
      sizedHost(4000, 2200),
    ).outputTier).toBe('4k')
  })

  it('allocates the requested long edge without a fixed pixel-ratio ceiling', () => {
    browser.setSearch('?bookQuality=4k')
    const quality = selectBookRenderQuality(rendererWithLimits(8192, 8192), sizedHost(768, 512))
    expect(quality.renderLongEdge).toBe(4096)
    expect(Math.floor(768 * quality.pixelRatio)).toBeGreaterThanOrEqual(4096)
  })

  it('re-fits a fixed tier when responsive layout changes the stage size', () => {
    browser.setSearch('?bookQuality=4k')
    const quality = selectBookRenderQuality(rendererWithLimits(8192, 8192), sizedHost(1440, 1000))
    const settledWidth = 1294
    const settledHeight = 817
    const settledRatio = resolveBookOutputPixelRatio(quality, settledWidth, settledHeight)

    expect(Math.floor(settledWidth * settledRatio)).toBeGreaterThanOrEqual(4096)
    expect(Math.floor(settledHeight * settledRatio)).toBe(
      Math.floor(4097 * settledHeight / settledWidth),
    )
  })

  it('keeps adaptive output density stable across responsive resizing', () => {
    const quality = selectBookRenderQuality(rendererWithLimits(4096, 4096), sizedHost())
    expect(quality.outputTier).toBe('adaptive')
    expect(resolveBookOutputPixelRatio(quality, 600, 400)).toBe(quality.pixelRatio)
  })

  it('keeps the explicit 2K accessibility/performance override', () => {
    browser.setSearch('?bookQuality=2k')
    const width = 1200
    const height = 800
    const quality = selectBookRenderQuality(rendererWithLimits(16384, 16384), sizedHost(width, height))
    expect(quality.textureTier).toBe('2k')
    expect(quality.outputTier).toBe('2k')
    expect(Math.floor(width * quality.pixelRatio)).toBeGreaterThanOrEqual(2048)
    expect(quality.shadowMapSize).toBeLessThan(4096)
  })

  it('temporarily caps interaction near 2K without upscaling a lighter settled tier', () => {
    expect(resolveBookInteractionPixelRatio(6, 1280, 720)).toBeCloseTo(1.6)
    expect(Math.round(1280 * resolveBookInteractionPixelRatio(6, 1280, 720))).toBe(2048)
    expect(resolveBookInteractionPixelRatio(1.25, 1280, 720)).toBe(1.25)
  })
})
