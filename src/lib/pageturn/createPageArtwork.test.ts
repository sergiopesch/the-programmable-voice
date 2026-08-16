import { describe, expect, it } from 'vitest'
import type { BookSection } from '../../types'
import { pageArtworkContent } from './createPageArtwork'

const section: BookSection = {
  id: 'test-section',
  number: 4,
  part: 'I — Test part',
  title: 'The section title',
  deck: 'The section deck.',
  kind: 'chapter',
  era: 'Measured time',
  blocks: [
    { type: 'heading', text: 'The first body heading' },
    { type: 'paragraph', text: 'The first body paragraph.', label: 'Established science' },
  ],
}

describe('pageArtworkContent', () => {
  it('prints the chapter threshold on the title face', () => {
    expect(pageArtworkContent(section, 'title')).toEqual({
      body: 'The section deck.',
      deck: 'The section deck.',
      kicker: 'CHAPTER 04',
      label: 'MEASURED TIME',
      title: 'The section title',
    })
  })

  it('prints manuscript copy on the body face', () => {
    expect(pageArtworkContent(section, 'body')).toEqual({
      body: 'The first body paragraph.',
      deck: 'The section deck.',
      kicker: 'MEASURED TIME',
      label: 'CHAPTER 04',
      title: 'The first body heading',
    })
  })
})
