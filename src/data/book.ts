import type { BookSection } from '../types'
import { foundationSections } from './chaptersFoundations'
import { machineSections } from './chaptersMachine'
import { mediaSections } from './chaptersMedia'
import { companionSections } from './companions'

const prologue: BookSection = {
  id: 'opening',
  number: 0,
  part: 'Prologue',
  title: 'The Programmable Voice',
  deck: 'A material history of sound, music and the human voice—from vibrating air to machines that listen and answer.',
  kind: 'opening',
  readingMinutes: 1,
  blocks: [
    {
      type: 'heading',
      text: 'A voice returns',
    },
    {
      type: 'paragraph',
      label: 'Synthesis',
      text: 'Press play. A breath drawn in another room returns here as a voice. Between that breath and your ear lies a strange journey: air made visible, movement cut into wax, music pressed into vinyl, speech carried along copper, sound counted by computers, and conversation rebuilt from learned tokens.',
      citations: ['fdn-openstax-sound', 'fdn-scott-loc', 'med-berliner-patent', 'med-bell-patent', 'mac-soundstream2021'],
    },
    {
      type: 'paragraph',
      label: 'Scholarly history',
      text: 'For most of human history, people kept sound alive in bodies, rituals, rooms and communities. Recording changed how a voice might outlive its maker. This book follows that material chain, not a parade of lone inventors. At every threshold something is preserved and something falls away. No engineering background is needed: begin with the story, then follow the deeper layer and its evidence. Listen closely to what each representation makes possible—and what it asks us to forget.',
      citations: ['fdn-unesco-oral', 'fdn-parry-collection', 'med-iasa-disc-replay', 'mac-datasheets2021'],
    },
  ],
}

export const sections: BookSection[] = [
  prologue,
  ...foundationSections,
  ...mediaSections,
  ...machineSections,
  ...companionSections,
]

export const sectionById = new Map(sections.map((section) => [section.id, section]))
