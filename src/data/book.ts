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
      label: 'Synthesis',
      text: 'For most of human history, a voice survived by entering another body: a listener remembered it, a child learnt it, a community called it back. Recording changed that bargain. This book follows what happened next—not as a procession of inventors, but as a chain of choices. Each new form kept something: pitch, timing, words, resemblance. Each left something behind. By the time a machine can answer in a made voice, the old question has become urgent: what, exactly, are we hearing—and who still has the right to decide what happens next?',
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
