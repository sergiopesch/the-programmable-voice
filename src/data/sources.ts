import type { Source } from '../types'
import { foundationSources } from './sourcesFoundations'
import { machineSources } from './sourcesMachine'
import { mediaSources } from './sourcesMedia'

export const sources: Source[] = [
  ...foundationSources,
  ...mediaSources,
  ...machineSources,
]

export const sourceById = new Map<string, Source>(
  sources.map((source) => [source.id, source]),
)

export const sourceNumberById = new Map<string, number>(
  sources.map((source, index) => [source.id, index + 1]),
)
