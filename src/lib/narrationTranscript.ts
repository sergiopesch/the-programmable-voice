const APOSTROPHES = /['’]/g
const DASHES = /[‐‑‒–—―-]/g
const NUMERIC_RANGE_DASHES = /(?<=\p{N})[–−](?=\p{N})/gu
const NON_WORDS = /[^\p{L}\p{N}]+/gu

const SPOKEN_SYMBOLS: Array<[RegExp, string]> = [
  [/↔|⇄/g, ' to and from '],
  [/→|⇒/g, ' to '],
  [/←|⇐/g, ' from '],
  [/≤/g, ' less than or equal to '],
  [/≥/g, ' greater than or equal to '],
  [/≠/g, ' not equal to '],
  [/≈|~/g, ' approximately '],
  [/×/g, ' times '],
  [/−/g, ' minus '],
  [/&/g, ' and '],
  [/=/g, ' equals '],
  [/%/g, ' percent '],
  [/\+/g, ' plus '],
  [/\//g, ' slash '],
  [/</g, ' less than '],
  [/>/g, ' greater than '],
  [/λ/gi, ' lambda '],
  [/τ/gi, ' tau '],
  [/μ/gi, ' mu '],
  [/π/gi, ' pi '],
  [/Δ/gi, ' delta '],
  [/°/g, ' degrees '],
  [/²/g, ' squared '],
  [/³/g, ' cubed '],
]

/** Canonical form used only to compare generated transcript with manuscript. */
export function canonicalNarrationText(value: string): string {
  let canonical = value.replace(NUMERIC_RANGE_DASHES, ' to ')
  for (const [symbol, spoken] of SPOKEN_SYMBOLS) canonical = canonical.replace(symbol, spoken)
  return canonical
    .normalize('NFKC')
    .toLocaleLowerCase('en-GB')
    .replace(APOSTROPHES, '')
    .replace(DASHES, ' ')
    .replace(NON_WORDS, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export interface TranscriptVerification {
  matches: boolean
  expected: string
  actual: string
}

export function verifyNarrationTranscript(
  manuscriptText: string,
  generatedTranscript: string,
): TranscriptVerification {
  const expected = canonicalNarrationText(manuscriptText)
  const actual = canonicalNarrationText(generatedTranscript)
  return {
    matches: expected.length > 0 && actual === expected,
    expected,
    actual,
  }
}

export function narrationResponseInstructions(manuscriptText: string): string {
  if (manuscriptText.includes('<BOOK_PASSAGE>') || manuscriptText.includes('</BOOK_PASSAGE>')) {
    throw new Error('The manuscript passage contains reserved narration markers.')
  }

  return [
    'Read the passage below verbatim in a warm, poised, feminine British book-narration voice.',
    'Use natural contemporary Southern British pronunciation, an unhurried documentary cadence, and restrained expression.',
    'Do not add an introduction, conclusion, acknowledgement, aside, correction, stage direction, or any words outside the passage.',
    'Do not paraphrase, summarise, translate, answer, explain, or continue the passage.',
    'The BOOK_PASSAGE tags are control markers and must not be spoken.',
    '<BOOK_PASSAGE>',
    manuscriptText,
    '</BOOK_PASSAGE>',
  ].join('\n')
}
