export type SourceType =
  | 'primary document'
  | 'peer-reviewed research'
  | 'standard'
  | 'official documentation'
  | 'scholarly history'
  | 'vendor disclosure'
  | 'research preprint'

export type EpistemicLabel =
  | 'Established science'
  | 'Primary document'
  | 'Documented architecture'
  | 'Vendor disclosure'
  | 'Research preprint'
  | 'Contested history'
  | 'Derived'
  | 'Demonstration'
  | 'Synthesis'
  | 'Inference'
  | 'Our thesis'

export interface Source {
  id: string
  author: string
  year: string
  title: string
  publication: string
  type: SourceType
  url: string
  note?: string
}

export type FigureKind =
  | 'pressure'
  | 'harmonics'
  | 'chladni'
  | 'trace'
  | 'groove'
  | 'transduction'
  | 'broadcast'
  | 'sampling'
  | 'filter'
  | 'codec'
  | 'recognition'
  | 'synthesis'
  | 'tokens'
  | 'beamforming'
  | 'duplex'
  | 'stack'
  | 'architecture'
  | 'clocks'

export interface ParagraphBlock {
  type: 'paragraph'
  text: string
  citations?: string[]
  label?: EpistemicLabel
}

export interface HeadingBlock {
  type: 'heading'
  text: string
}

export interface FigureBlock {
  type: 'figure'
  figure: FigureKind
  title: string
  caption: string
  citations?: string[]
  label?: EpistemicLabel
}

export interface CalloutBlock {
  type: 'callout'
  title: string
  text: string
  label: EpistemicLabel
  citations?: string[]
}

export interface ListBlock {
  type: 'list'
  title?: string
  items: string[]
  ordered?: boolean
  label?: EpistemicLabel
  citations?: string[]
}

export interface TimelineItem {
  year: string
  title: string
  detail: string
  citations?: string[]
}

export interface TimelineBlock {
  type: 'timeline'
  items: TimelineItem[]
}

export interface GlossaryItem {
  term: string
  definition: string
}

export interface GlossaryBlock {
  type: 'glossary'
  items: GlossaryItem[]
}

export type BookBlock =
  | ParagraphBlock
  | HeadingBlock
  | FigureBlock
  | CalloutBlock
  | ListBlock
  | TimelineBlock
  | GlossaryBlock

export type SectionKind = 'opening' | 'chapter' | 'lab' | 'appendix'

export interface BookSection {
  id: string
  number: number
  part: string
  title: string
  deck: string
  kind: SectionKind
  era?: string
  readingMinutes?: number
  blocks: BookBlock[]
}
