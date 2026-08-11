export interface NarrationCharacterPacingBounds {
  minimumCharactersPerSecond: number
  maximumCharactersPerSecond: number
}

export function narrationCanonicalPacingText(spokenText: string) {
  const canonical = spokenText.normalize('NFC').trim().replace(/\s+/gu, ' ')
  if (!canonical) throw new RangeError('Narration pacing requires non-empty spoken text.')
  return canonical
}

/** The manifest records and verifies pace to one decimal place. */
export function narrationReportedWordsPerMinute(wordsPerMinute: number) {
  if (!Number.isFinite(wordsPerMinute) || wordsPerMinute <= 0) {
    throw new RangeError('Narration pace must be a positive finite number.')
  }
  return Number(wordsPerMinute.toFixed(1))
}

/**
 * Counts the exact synthesiser input after NFC normalisation. Unicode code
 * points, including spaces and punctuation, are used because they represent
 * phrase length without making the gate depend on whether a language or
 * sentence happens to use many short words.
 */
export function narrationCharacterCount(spokenText: string) {
  return [...narrationCanonicalPacingText(spokenText)].length
}

/** Exact derived pace used by the technical gate; it is not stored in the manifest. */
export function narrationCharactersPerSecond(spokenText: string, durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError('Narration character pace requires a positive finite duration.')
  }
  return narrationCharacterCount(spokenText) / durationSeconds
}

/**
 * Hard technical pacing bounds derived from exact spoken-text length. Brief
 * headings tolerate wider variance; the range tapers into a stricter
 * long-form band. WPM remains useful reader-facing metadata, but it is not a
 * fair accept/reject metric for passages with unusually short or long words.
 */
export function narrationCharacterPacingBounds(spokenText: string): NarrationCharacterPacingBounds {
  const characterCount = narrationCharacterCount(spokenText)
  const minimumCharactersPerSecond = characterCount <= 40
    ? 6
    : characterCount < 160
      ? 6 + (4 * (characterCount - 40)) / 120
      : 10
  const maximumCharactersPerSecond = characterCount <= 100
    ? 20
    : characterCount < 160
      ? 20 - (2 * (characterCount - 100)) / 60
      : 18
  return {
    minimumCharactersPerSecond,
    maximumCharactersPerSecond,
  }
}
