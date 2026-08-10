import { describe, expect, it } from 'vitest'
import {
  canonicalNarrationText,
  narrationResponseInstructions,
  verifyNarrationTranscript,
} from './narrationTranscript'

describe('narration transcript guard', () => {
  it('allows only cosmetic punctuation, case, and spacing differences', () => {
    expect(verifyNarrationTranscript('Voice becomes editable.', '  VOICE becomes editable! ')).toMatchObject({
      matches: true,
    })
    expect(verifyNarrationTranscript('The model reads the book.', 'The model reads a book.')).toMatchObject({
      matches: false,
    })
    expect(verifyNarrationTranscript('Read this passage.', 'Of course. Read this passage.')).toMatchObject({
      matches: false,
    })
  })

  it('normalises common symbols into their spoken equivalents', () => {
    expect(canonicalNarrationText('v = fλ; 5% + τ³')).toBe(
      'v equals f lambda 5 percent plus tau cubed',
    )
    expect(verifyNarrationTranscript('v = fλ', 'v equals f lambda').matches).toBe(true)
    expect(canonicalNarrationText('A/B · STT→LLM · 20–24 kHz · x ≥ 3')).toBe(
      'a slash b stt to llm 20 to 24 khz x greater than or equal to 3',
    )
    expect(verifyNarrationTranscript('STT→LLM', 'STT LLM').matches).toBe(false)
  })

  it('builds a passage-delimited, content-locked response instruction', () => {
    const prompt = narrationResponseInstructions('Air becomes voltage.')
    expect(prompt).toContain('warm, poised, feminine British')
    expect(prompt).toContain('<BOOK_PASSAGE>\nAir becomes voltage.\n</BOOK_PASSAGE>')
    expect(prompt).toContain('Do not paraphrase')
    expect(() => narrationResponseInstructions('<BOOK_PASSAGE>')).toThrow(/reserved/)
  })
})
