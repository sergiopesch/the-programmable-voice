import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three'
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
  anisotropy: number
  tier?: BookTextureTier
  /** Compatibility hint for callers that have not selected an explicit tier. */
  highDetail?: boolean
}

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

function drawWaveform(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  colour: string,
) {
  const bars = 41
  context.strokeStyle = colour
  context.lineWidth = Math.max(1.2, width / 310)
  context.beginPath()
  for (let index = 0; index < bars; index += 1) {
    const progress = index / (bars - 1)
    const envelope = Math.sin(progress * Math.PI) ** 0.72
    const signal = 0.24 + Math.abs(Math.sin(index * 1.93) * Math.cos(index * 0.47)) * 0.76
    const barHeight = height * envelope * signal
    const barX = x + progress * width
    context.moveTo(barX, y - barHeight / 2)
    context.lineTo(barX, y + barHeight / 2)
  }
  context.stroke()
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
) {
  context.fillStyle = '#e7dece'
  context.fillRect(0, 0, width, height)
  const random = seededRandom(seed)
  for (let index = 0; index < Math.round(width * height / 2200); index += 1) {
    const light = random() > 0.48
    context.fillStyle = light
      ? `rgba(255, 252, 241, ${0.025 + random() * 0.04})`
      : `rgba(83, 62, 43, ${0.012 + random() * 0.022})`
    context.fillRect(random() * width, random() * height, 0.6 + random() * 1.3, 0.6 + random() * 1.3)
  }
  const gutter = context.createLinearGradient(0, 0, width, 0)
  gutter.addColorStop(0, 'rgba(54, 38, 25, .12)')
  gutter.addColorStop(0.08, 'rgba(54, 38, 25, 0)')
  gutter.addColorStop(0.92, 'rgba(255, 253, 245, 0)')
  gutter.addColorStop(1, 'rgba(255, 253, 245, .12)')
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
) {
  const height = size
  const width = Math.round(size * BOOK_PAGE_WIDTH / BOOK_PAGE_HEIGHT)
  const { element, context } = canvas(width, height)
  paintOpeningPaper(context, width, height, side === 'left' ? 521 : 733)
  const insetX = width * 0.115
  const usableWidth = width - insetX * 2
  context.textBaseline = 'alphabetic'
  context.textAlign = 'left'
  context.fillStyle = 'rgba(48, 42, 36, .64)'
  context.font = `500 ${Math.round(width * 0.018)}px "IBM Plex Mono", ui-monospace, monospace`
  context.fillText(side === 'left' ? 'THE PROGRAMMABLE VOICE' : `${part.toUpperCase()} · READ`, insetX, height * 0.09)

  if (side === 'left') {
    context.fillStyle = '#27221e'
    context.font = `510 ${Math.round(width * 0.092)}px "Newsreader Variable", Newsreader, Georgia, serif`
    const titleLines = wrappedLines(context, title, usableWidth * 0.8)
    const titleLineHeight = width * 0.087
    titleLines.forEach((line, index) => context.fillText(line, insetX, height * 0.27 + index * titleLineHeight))
    const titleBottom = height * 0.27 + Math.max(0, titleLines.length - 1) * titleLineHeight
    context.fillStyle = '#7b2328'
    context.fillRect(insetX, titleBottom + width * 0.052, width * 0.075, Math.max(3, width * 0.003))
    context.fillStyle = '#39322c'
    context.font = `400 ${Math.round(width * 0.035)}px "Newsreader Variable", Newsreader, Georgia, serif`
    wrappedLines(context, deck, usableWidth).forEach((line, index) => {
      context.fillText(line, insetX, titleBottom + width * 0.12 + index * width * 0.05)
    })
    context.strokeStyle = 'rgba(45, 38, 32, .42)'
    context.lineWidth = Math.max(2, width * 0.0014)
    context.beginPath()
    context.moveTo(insetX, height * 0.79)
    context.lineTo(width - insetX, height * 0.79)
    context.stroke()
    context.fillStyle = 'rgba(48, 42, 36, .64)'
    context.font = `500 ${Math.round(width * 0.016)}px "IBM Plex Mono", ui-monospace, monospace`
    context.fillText('PROLOGUE · 1 MIN · 30 CHAPTERS', insetX, height * 0.91)
  } else {
    context.fillStyle = 'rgba(48, 42, 36, .62)'
    context.font = `400 ${Math.round(width * 0.018)}px "IBM Plex Mono", ui-monospace, monospace`
    context.fillText('NARRATION · RECORDED EDITION', insetX, height * 0.15)
    context.fillStyle = '#302a25'
    context.font = `400 ${Math.round(width * 0.034)}px "Newsreader Variable", Newsreader, Georgia, serif`
    const lineHeight = width * 0.049
    let y = height * 0.25
    for (const paragraph of paragraphs) {
      for (const line of wrappedLines(context, paragraph, usableWidth)) {
        context.fillText(line, insetX, y)
        y += lineHeight
      }
      y += lineHeight * 0.72
    }
    context.strokeStyle = 'rgba(45, 38, 32, .58)'
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
  context.shadowColor = 'rgba(0, 0, 0, 0.55)'
  context.shadowBlur = width * 0.004
  context.shadowOffsetY = width * 0.002
  context.font = `560 ${Math.round(width * 0.128)}px "Newsreader Variable", Newsreader, Georgia, serif`
  context.fillText('The', inset, height * 0.205)
  context.fillText('Programmable', inset, height * 0.31, width - inset * 1.55)
  context.fillText('Voice', inset, height * 0.415)

  context.shadowBlur = 0
  context.shadowOffsetY = 0
  drawWaveform(context, inset, height * 0.555, width - inset * 2, height * 0.115, 'rgba(133, 50, 54, 0.92)')

  context.fillStyle = 'rgba(219, 211, 194, 0.64)'
  context.font = `400 ${Math.round(width * 0.028)}px "IBM Plex Mono", ui-monospace, monospace`
  drawWrappedText(context, deck, inset, height * 0.745, width - inset * 2, width * 0.045, 4)

  context.fillStyle = 'rgba(133, 50, 54, 0.78)'
  context.fillRect(inset, height * 0.89, width * 0.14, Math.max(2, width * 0.004))
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
  drawWaveform(context, inset, height * 0.69, width - inset * 2, height * 0.095, 'rgba(107, 36, 40, 0.62)')

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

export function createBookTextures({
  deck,
  openingParagraphs,
  openingPart,
  openingTitle,
  highDetail = false,
  anisotropy,
  tier,
}: CreateBookTextureOptions): BookTextures {
  const resolvedTier = tier ?? (highDetail ? '2k' : undefined)
  const size = resolvedTier ? TEXTURE_LONG_EDGE[resolvedTier] : FALLBACK_TEXTURE_WIDTH
  const maxAnisotropy = Math.max(1, Math.floor(anisotropy))
  const fullWidth = resolvedTier !== undefined

  return {
    coverFront: createCoverFront(size, deck, maxAnisotropy),
    coverBack: createCoverBack(size, deck, maxAnisotropy),
    coverSpine: createSpine(size, maxAnisotropy, fullWidth),
    openingLeft: createOpeningPage(
      size,
      maxAnisotropy,
      'left',
      openingTitle,
      deck,
      openingParagraphs,
      openingPart,
    ),
    openingRight: createOpeningPage(
      size,
      maxAnisotropy,
      'right',
      openingTitle,
      deck,
      openingParagraphs,
      openingPart,
    ),
    pageEdges: createPageEdges(size, maxAnisotropy, fullWidth),
  }
}
