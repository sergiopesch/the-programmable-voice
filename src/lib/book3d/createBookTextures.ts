import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three'
import type { Theme } from '../../hooks/usePreferences'
import type { BookTextureTier } from './bookAssets'
import {
  BOOK_CLOSED_ASPECT,
  BOOK_PAGE_HEIGHT,
  BOOK_PAGE_WIDTH,
} from './bookGeometry'

export interface BookTextures {
  coverFront: Texture
  coverBack: Texture
  coverSpine: Texture
  openingLeft: Texture
  openingRight: Texture
  pageEdges: Texture
}

export interface CreateBookTextureOptions {
  deck: string
  openingTitle: string
  openingParagraphs: string[]
  openingPart: string
  theme: Theme
  anisotropy: number
  tier?: BookTextureTier
  /** Compatibility hint for callers that have not selected an explicit tier. */
  highDetail?: boolean
}

export type OpeningPageTextures = Pick<BookTextures, 'openingLeft' | 'openingRight'>

const TEXTURE_LONG_EDGE: Record<BookTextureTier, number> = {
  '2k': 2048,
  '4k': 4096,
}

const FALLBACK_TEXTURE_WIDTH = 960

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function canvas(width: number, height: number, alpha = false) {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  const context = element.getContext('2d', { alpha })
  if (!context) throw new Error('Canvas 2D is unavailable')
  return { element, context }
}

function finishTexture(element: HTMLCanvasElement, anisotropy: number, colour = true) {
  const texture = new CanvasTexture(element)
  texture.anisotropy = anisotropy
  texture.minFilter = LinearMipmapLinearFilter
  if (colour) texture.colorSpace = SRGBColorSpace
  return texture
}

function envelopeAt(x: number) {
  const centerA = Math.exp(-(((x - 0.47) / 0.18) ** 2))
  const centerB = 0.66 * Math.exp(-(((x - 0.76) / 0.24) ** 2))
  return Math.min(1, centerA + centerB)
}

function drawWaveform(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  colour: string,
) {
  context.save()
  context.strokeStyle = colour
  context.lineCap = 'round'
  context.lineJoin = 'round'
  const layers = 16
  for (let layer = 0; layer < layers; layer += 1) {
    const scale = (layer + 2) / 18
    context.globalAlpha = 0.1 + layer * 0.035
    context.lineWidth = Math.max(0.8, width / 520)
    context.beginPath()
    for (let step = 0; step <= 180; step += 1) {
      const progress = step / 180
      const carrier = Math.sin(progress * Math.PI * 2 * (4.8 + layer * 0.055))
      const formant = 0.45 * Math.sin(progress * Math.PI * 2 * 11.3 + layer * 0.2)
      const px = x + progress * width
      const py = y + (carrier + formant) * (height / 2) * envelopeAt(progress) * scale
      if (step === 0) context.moveTo(px, py)
      else context.lineTo(px, py)
    }
    context.stroke()
  }
  context.globalAlpha = 0.42
  context.lineWidth = Math.max(1, width / 420)
  context.beginPath()
  context.moveTo(x, y)
  context.lineTo(x + width, y)
  context.stroke()
  context.restore()
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  wrappedLines(context, text, maxWidth, maxLines).forEach((value, index) => {
    context.fillText(value, x, y + index * lineHeight, maxWidth)
  })
}

function wrappedLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = Number.POSITIVE_INFINITY,
) {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  let truncated = false
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!
    const candidate = line ? `${line} ${word}` : word
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = word
      if (lines.length === maxLines - 1) {
        truncated = index < words.length - 1
        break
      }
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (truncated) {
    const lastIndex = lines.length - 1
    lines[lastIndex] = `${lines[lastIndex]!.replace(/[.,;:]?$/, '')}…`
  }
  return lines
}

function paintOpeningPaper(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  theme: Theme,
) {
  const dark = theme === 'dark'
  // The printed face is colour-managed independently of the studio lighting,
  // so these values match the semantic reader's paper tokens exactly.
  context.fillStyle = dark ? '#1c1a18' : '#f4efe5'
  context.fillRect(0, 0, width, height)
  const random = seededRandom(seed)
  for (let index = 0; index < Math.round(width * height / 2200); index += 1) {
    const light = random() > 0.48
    context.fillStyle = light
      ? `rgba(255, 252, 241, ${dark ? 0.008 + random() * 0.015 : 0.025 + random() * 0.04})`
      : `rgba(0, 0, 0, ${dark ? 0.03 + random() * 0.045 : 0.012 + random() * 0.022})`
    context.fillRect(random() * width, random() * height, 0.6 + random() * 1.3, 0.6 + random() * 1.3)
  }
  const gutter = context.createLinearGradient(0, 0, width, 0)
  gutter.addColorStop(0, dark ? 'rgba(0, 0, 0, .46)' : 'rgba(54, 38, 25, .12)')
  gutter.addColorStop(0.08, dark ? 'rgba(0, 0, 0, 0)' : 'rgba(54, 38, 25, 0)')
  gutter.addColorStop(0.92, 'rgba(255, 253, 245, 0)')
  gutter.addColorStop(1, dark ? 'rgba(255, 253, 245, .04)' : 'rgba(255, 253, 245, .12)')
  context.fillStyle = gutter
  context.fillRect(0, 0, width, height)
}

function createOpeningPage(
  size: number,
  anisotropy: number,
  side: 'left' | 'right',
  title: string,
  deck: string,
  paragraphs: string[],
  part: string,
  theme: Theme,
) {
  const height = size
  const width = Math.round(size * BOOK_PAGE_WIDTH / BOOK_PAGE_HEIGHT)
  const { element, context } = canvas(width, height)
  paintOpeningPaper(context, width, height, side === 'left' ? 521 : 733, theme)
  const dark = theme === 'dark'
  const insetX = width * 0.115
  const usableWidth = width - insetX * 2
  context.textBaseline = 'alphabetic'
  context.textAlign = 'left'
  context.fillStyle = dark ? 'rgba(244, 239, 229, .64)' : 'rgba(48, 42, 36, .64)'
  context.font = `500 ${Math.round(width * 0.018)}px "IBM Plex Mono", ui-monospace, monospace`
  context.fillText(side === 'left' ? 'THE PROGRAMMABLE VOICE' : `${part.toUpperCase()} · READ`, insetX, height * 0.09)

  if (side === 'left') {
    context.fillStyle = dark ? '#f4efe5' : '#27221e'
    context.font = `510 ${Math.round(width * 0.084)}px "Newsreader Variable", Newsreader, Georgia, serif`
    const titleLines = wrappedLines(context, title, usableWidth * 0.55)
    const titleLineHeight = width * 0.074
    titleLines.forEach((line, index) => context.fillText(line, insetX, height * 0.22 + index * titleLineHeight))
    const titleBottom = height * 0.22 + Math.max(0, titleLines.length - 1) * titleLineHeight
    context.fillStyle = dark ? '#d06a73' : '#7b2328'
    context.fillRect(insetX, titleBottom + width * 0.052, width * 0.075, Math.max(3, width * 0.003))
    context.fillStyle = dark ? '#e8dfd1' : '#39322c'
    context.font = `400 ${Math.round(width * 0.035)}px "Newsreader Variable", Newsreader, Georgia, serif`
    wrappedLines(context, deck, usableWidth).forEach((line, index) => {
      context.fillText(line, insetX, titleBottom + width * 0.12 + index * width * 0.05)
    })
    const openingParagraph = paragraphs[0]
    if (openingParagraph) {
      context.fillStyle = dark ? '#e8dfd1' : '#39322c'
      context.font = `400 ${Math.round(width * 0.026)}px "Newsreader Variable", Newsreader, Georgia, serif`
      const paragraphLineHeight = width * 0.039
      wrappedLines(context, openingParagraph, usableWidth, 11).forEach((line, index) => {
        context.fillText(line, insetX, height * 0.59 + index * paragraphLineHeight)
      })
    }
    context.strokeStyle = dark ? 'rgba(244, 239, 229, .34)' : 'rgba(45, 38, 32, .42)'
    context.lineWidth = Math.max(2, width * 0.0014)
    context.beginPath()
    context.moveTo(insetX, height * 0.79)
    context.lineTo(width - insetX, height * 0.79)
    context.stroke()
    context.fillStyle = dark ? 'rgba(244, 239, 229, .64)' : 'rgba(48, 42, 36, .64)'
    context.font = `500 ${Math.round(width * 0.016)}px "IBM Plex Mono", ui-monospace, monospace`
    context.fillText('PROLOGUE · 1 MIN · 30 CHAPTERS', insetX, height * 0.91)
  } else {
    context.fillStyle = dark ? 'rgba(244, 239, 229, .62)' : 'rgba(48, 42, 36, .62)'
    context.font = `400 ${Math.round(width * 0.018)}px "IBM Plex Mono", ui-monospace, monospace`
    context.fillText('NARRATION · RECORDED EDITION', insetX, height * 0.15)
    context.fillStyle = dark ? '#e8dfd1' : '#302a25'
    context.font = `400 ${Math.round(width * 0.034)}px "Newsreader Variable", Newsreader, Georgia, serif`
    const lineHeight = width * 0.049
    let y = height * 0.25
    const continuation = paragraphs.length > 1 ? paragraphs.slice(1) : paragraphs
    for (const paragraph of continuation) {
      for (const line of wrappedLines(context, paragraph, usableWidth)) {
        context.fillText(line, insetX, y)
        y += lineHeight
      }
      y += lineHeight * 0.72
    }
    context.strokeStyle = dark ? 'rgba(244, 239, 229, .48)' : 'rgba(45, 38, 32, .58)'
    context.lineWidth = Math.max(2, width * 0.0014)
    context.strokeRect(insetX, height * 0.86, usableWidth, height * 0.065)
    context.font = `500 ${Math.round(width * 0.018)}px "IBM Plex Mono", ui-monospace, monospace`
    context.fillText('BEGIN CHAPTER ONE', insetX + width * 0.04, height * 0.9)
  }
  return finishTexture(element, anisotropy)
}

function createCoverFront(size: number, deck: string, anisotropy: number) {
  const height = size
  const width = Math.round(size * BOOK_CLOSED_ASPECT)
  const { element, context } = canvas(width, height, true)
  context.clearRect(0, 0, width, height)

  const inset = width * 0.11
  context.strokeStyle = 'rgba(6, 6, 5, 0.62)'
  context.lineWidth = Math.max(2, width * 0.003)
  context.strokeRect(inset * 0.52, inset * 0.52, width - inset * 1.04, height - inset * 1.04)
  context.strokeStyle = 'rgba(235, 225, 203, 0.075)'
  context.lineWidth = Math.max(1, width * 0.0014)
  context.strokeRect(inset * 0.56, inset * 0.56, width - inset * 1.12, height - inset * 1.12)

  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.fillStyle = 'rgba(244, 236, 220, 0.96)'
  context.shadowColor = 'rgba(0, 0, 0, 0.38)'
  context.shadowBlur = width * 0.003
  context.shadowOffsetY = width * 0.0015
  context.font = `510 ${Math.round(width * 0.142)}px "Newsreader Variable", Newsreader, Georgia, serif`
  context.fillText('The', inset, height * 0.2)
  context.fillText('Programmable', inset, height * 0.318, width - inset * 1.2)
  context.fillText('Voice', inset, height * 0.436)

  context.shadowBlur = 0
  context.shadowOffsetY = 0
  drawWaveform(context, inset, height * 0.62, width - inset * 2, height * 0.16, 'rgba(236, 228, 212, 0.88)')

  context.fillStyle = 'rgba(228, 220, 204, 0.78)'
  context.font = `400 ${Math.round(width * 0.032)}px "Newsreader Variable", Newsreader, Georgia, serif`
  drawWrappedText(context, deck, inset, height * 0.8, width - inset * 2, width * 0.046, 3)
  return finishTexture(element, anisotropy)
}

function createCoverBack(size: number, deck: string, anisotropy: number) {
  const height = size
  const width = Math.round(size * BOOK_CLOSED_ASPECT)
  const { element, context } = canvas(width, height, true)
  context.clearRect(0, 0, width, height)
  const inset = width * 0.13

  context.fillStyle = 'rgba(219, 210, 192, 0.42)'
  context.font = `400 ${Math.round(width * 0.031)}px "IBM Plex Mono", ui-monospace, monospace`
  context.textAlign = 'left'
  drawWrappedText(context, deck, inset, height * 0.37, width - inset * 2, width * 0.05, 6)
  drawWaveform(context, inset, height * 0.69, width - inset * 2, height * 0.11, 'rgba(228, 220, 204, 0.55)')

  context.strokeStyle = 'rgba(7, 7, 6, 0.36)'
  context.lineWidth = Math.max(2, width * 0.003)
  context.strokeRect(inset * 0.5, inset * 0.5, width - inset, height - inset)
  return finishTexture(element, anisotropy)
}

function createSpine(size: number, anisotropy: number, fullWidth: boolean) {
  const height = size
  const width = fullWidth ? Math.max(512, Math.round(size * 0.19)) : Math.max(256, Math.round(size * 0.24))
  // This texture is a foil/deboss mask, not a second strip of cloth. Keeping
  // the canvas transparent lets the cylindrical PBR weave remain continuous
  // beneath the stamp instead of producing a conspicuous rectangular plaque.
  const { element, context } = canvas(width, height, true)
  context.clearRect(0, 0, width, height)

  context.save()
  context.translate(width * 0.5, height * 0.5)
  // Read from head to tail when the physical spine faces the reader, matching
  // the supplied binding reference after the model's -90° tangent rotation.
  context.rotate(Math.PI / 2)
  context.fillStyle = '#fff6dc'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.shadowColor = 'rgba(20, 7, 8, .85)'
  context.shadowBlur = width * 0.018
  context.shadowOffsetY = Math.max(1, width * 0.006)
  context.font = `650 ${Math.round(width * 0.42)}px "Newsreader Variable", Newsreader, Georgia, serif`
  context.fillText('The Programmable Voice', 0, 0, height * 0.86)
  context.shadowBlur = 0
  context.shadowOffsetY = 0
  context.fillStyle = 'rgba(133, 50, 54, 0.88)'
  const rule = height * 0.42
  context.fillRect(-rule / 2, width * 0.22, rule, Math.max(1.5, width * 0.018))
  context.fillRect(-rule / 2, -width * 0.238, rule, Math.max(1.5, width * 0.018))
  context.restore()
  return finishTexture(element, anisotropy)
}

function createPageEdges(size: number, anisotropy: number, fullWidth: boolean) {
  const textureSize = fullWidth ? size : Math.max(640, Math.round(size * 0.75))
  const { element, context } = canvas(textureSize, textureSize)
  const random = seededRandom(307)
  context.fillStyle = '#d7cbb7'
  context.fillRect(0, 0, textureSize, textureSize)

  for (let x = 0; x < textureSize; x += 2 + Math.round(random() * 4)) {
    context.strokeStyle = random() > 0.74
      ? `rgba(91, 65, 43, ${0.09 + random() * 0.14})`
      : `rgba(255, 250, 236, ${0.12 + random() * 0.22})`
    context.lineWidth = 0.5 + random() * 1.2
    context.beginPath()
    context.moveTo(x + random() * 1.5, 0)
    context.bezierCurveTo(
      x - 1 + random() * 2,
      textureSize * 0.3,
      x - 1 + random() * 2,
      textureSize * 0.7,
      x + random() * 1.5,
      textureSize,
    )
    context.stroke()
  }

  const vignette = context.createLinearGradient(0, 0, textureSize, 0)
  vignette.addColorStop(0, 'rgba(71, 45, 29, 0.13)')
  vignette.addColorStop(0.1, 'rgba(255, 255, 255, 0)')
  vignette.addColorStop(0.88, 'rgba(255, 255, 255, 0)')
  vignette.addColorStop(1, 'rgba(71, 45, 29, 0.16)')
  context.fillStyle = vignette
  context.fillRect(0, 0, textureSize, textureSize)
  return finishTexture(element, anisotropy)
}

export function createOpeningPageTextures({
  deck,
  openingParagraphs,
  openingPart,
  openingTitle,
  theme,
  highDetail = false,
  anisotropy,
  tier,
}: CreateBookTextureOptions): OpeningPageTextures {
  const resolvedTier = tier ?? (highDetail ? '2k' : undefined)
  const size = resolvedTier ? TEXTURE_LONG_EDGE[resolvedTier] : FALLBACK_TEXTURE_WIDTH
  const maxAnisotropy = Math.max(1, Math.floor(anisotropy))

  return {
    openingLeft: createOpeningPage(
      size,
      maxAnisotropy,
      'left',
      openingTitle,
      deck,
      openingParagraphs,
      openingPart,
      theme,
    ),
    openingRight: createOpeningPage(
      size,
      maxAnisotropy,
      'right',
      openingTitle,
      deck,
      openingParagraphs,
      openingPart,
      theme,
    ),
  }
}

export function createBookTextures(options: CreateBookTextureOptions): BookTextures {
  const {
    deck,
    highDetail = false,
    anisotropy,
    tier,
  } = options
  const resolvedTier = tier ?? (highDetail ? '2k' : undefined)
  const size = resolvedTier ? TEXTURE_LONG_EDGE[resolvedTier] : FALLBACK_TEXTURE_WIDTH
  const maxAnisotropy = Math.max(1, Math.floor(anisotropy))
  const fullWidth = resolvedTier !== undefined

  return {
    coverFront: createCoverFront(size, deck, maxAnisotropy),
    coverBack: createCoverBack(size, deck, maxAnisotropy),
    coverSpine: createSpine(size, maxAnisotropy, fullWidth),
    ...createOpeningPageTextures(options),
    pageEdges: createPageEdges(size, maxAnisotropy, fullWidth),
  }
}
