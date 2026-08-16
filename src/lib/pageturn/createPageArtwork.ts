import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three'
import type { Theme } from '../../hooks/usePreferences'
import { sectionMarker } from '../book'
import type { BookSection } from '../../types'

export type PageArtworkRole = 'title' | 'body'

export interface PageArtworkContent {
  body: string
  deck: string
  kicker: string
  label: string
  title: string
}

function firstBodyCopy(section: BookSection) {
  const heading = section.blocks.find((block) => block.type === 'heading')
  const paragraph = section.blocks.find((block) => block.type === 'paragraph')
  return {
    body: paragraph?.text ?? section.deck,
    title: heading?.text ?? section.title,
  }
}

export function pageArtworkContent(
  section: BookSection,
  role: PageArtworkRole,
): PageArtworkContent {
  const marker = section.kind === 'chapter'
    ? `CHAPTER ${sectionMarker(section)}`
    : section.kind === 'appendix'
      ? `COMPANION ${sectionMarker(section)}`
      : section.kind === 'lab'
        ? 'SOUND LABORATORY'
        : 'PROLOGUE'
  const body = firstBodyCopy(section)

  return role === 'title'
    ? {
        body: section.deck,
        deck: section.deck,
        kicker: marker,
        label: section.era?.toUpperCase() ?? section.part.toUpperCase(),
        title: section.title,
      }
    : {
        body: body.body,
        deck: section.deck,
        kicker: section.era?.toUpperCase() ?? marker,
        label: marker,
        title: body.title,
      }
}

function wrappedLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!
    const candidate = line ? `${line} ${word}` : word
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    lines.push(line)
    line = word
    if (lines.length === maxLines - 1) {
      const omitted = index < words.length - 1
      lines.push(`${line.replace(/[.,;:]?$/, '')}${omitted ? '…' : ''}`)
      return lines
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

function paintPaper(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  gutter: 'left' | 'right',
  theme: Theme,
) {
  const dark = theme === 'dark'
  context.fillStyle = dark ? '#1c1a18' : '#e8dfcf'
  context.fillRect(0, 0, width, height)
  const gutterShade = context.createLinearGradient(0, 0, width, 0)
  if (gutter === 'left') {
    gutterShade.addColorStop(0, dark ? 'rgba(0, 0, 0, .42)' : 'rgba(61, 43, 29, .15)')
    gutterShade.addColorStop(0.075, dark ? 'rgba(0, 0, 0, 0)' : 'rgba(61, 43, 29, 0)')
    gutterShade.addColorStop(0.94, 'rgba(255, 253, 246, 0)')
    gutterShade.addColorStop(1, dark ? 'rgba(255, 253, 246, .05)' : 'rgba(255, 253, 246, .14)')
  } else {
    gutterShade.addColorStop(0, dark ? 'rgba(255, 253, 246, .05)' : 'rgba(255, 253, 246, .14)')
    gutterShade.addColorStop(0.06, 'rgba(255, 253, 246, 0)')
    gutterShade.addColorStop(0.925, dark ? 'rgba(0, 0, 0, 0)' : 'rgba(61, 43, 29, 0)')
    gutterShade.addColorStop(1, dark ? 'rgba(0, 0, 0, .42)' : 'rgba(61, 43, 29, .15)')
  }
  context.fillStyle = gutterShade
  context.fillRect(0, 0, width, height)
}

export function createPageArtworkTexture({
  anisotropy,
  gutter = 'left',
  mirror,
  role,
  section,
  size,
  theme,
}: {
  anisotropy: number
  gutter?: 'left' | 'right'
  mirror: boolean
  role: PageArtworkRole
  section: BookSection
  size: number
  theme: Theme
}): Texture {
  const height = size
  const width = Math.round(size * 0.705)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')

  if (mirror) {
    context.translate(width, 0)
    context.scale(-1, 1)
  }
  paintPaper(context, width, height, gutter, theme)

  const content = pageArtworkContent(section, role)
  const dark = theme === 'dark'
  const inset = width * 0.105
  const measure = width - inset * 2
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.fillStyle = dark ? 'rgba(244, 239, 229, .68)' : 'rgba(48, 42, 36, .66)'
  context.font = `600 ${Math.round(width * 0.021)}px "IBM Plex Mono", ui-monospace, monospace`
  context.fillText(content.kicker, inset, height * 0.09)

  context.fillStyle = dark ? '#f4efe5' : '#2a2520'
  context.font = role === 'title'
    ? `520 ${Math.round(width * 0.088)}px "Newsreader Variable", Newsreader, Georgia, serif`
    : `520 ${Math.round(width * 0.064)}px "Newsreader Variable", Newsreader, Georgia, serif`
  const titleLines = wrappedLines(context, content.title, measure, role === 'title' ? 4 : 3)
  const titleLineHeight = width * (role === 'title' ? 0.085 : 0.065)
  const titleY = height * (role === 'title' ? 0.22 : 0.19)
  titleLines.forEach((line, index) => context.fillText(line, inset, titleY + index * titleLineHeight, measure))
  const titleBottom = titleY + Math.max(0, titleLines.length - 1) * titleLineHeight

  context.fillStyle = dark ? '#d06a73' : '#7b2328'
  context.fillRect(inset, titleBottom + width * 0.045, width * 0.08, Math.max(3, width * 0.003))
  context.fillStyle = dark ? 'rgba(244, 239, 229, .72)' : 'rgba(48, 42, 36, .68)'
  context.font = `600 ${Math.round(width * 0.018)}px "IBM Plex Mono", ui-monospace, monospace`
  context.fillText(content.label, inset, titleBottom + width * 0.105)

  context.fillStyle = dark ? '#e8dfd1' : '#3a332c'
  context.font = `410 ${Math.round(width * 0.034)}px "Newsreader Variable", Newsreader, Georgia, serif`
  const bodyY = titleBottom + width * 0.17
  const bodyLines = wrappedLines(context, content.body, measure, role === 'title' ? 8 : 14)
  const bodyLineHeight = width * 0.048
  bodyLines.forEach((line, index) => context.fillText(line, inset, bodyY + index * bodyLineHeight, measure))

  context.strokeStyle = dark ? 'rgba(244, 239, 229, .32)' : 'rgba(57, 48, 40, .38)'
  context.lineWidth = Math.max(2, width * 0.0015)
  context.beginPath()
  context.moveTo(inset, height * 0.9)
  context.lineTo(width - inset, height * 0.9)
  context.stroke()
  context.fillStyle = dark ? 'rgba(244, 239, 229, .64)' : 'rgba(48, 42, 36, .62)'
  context.font = `600 ${Math.round(width * 0.017)}px "IBM Plex Mono", ui-monospace, monospace`
  context.fillText('THE PROGRAMMABLE VOICE', inset, height * 0.945)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = Math.max(1, Math.floor(anisotropy))
  texture.minFilter = LinearMipmapLinearFilter
  return texture
}
