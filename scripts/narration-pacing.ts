export interface NarrationPacingBounds {
  minimumWordsPerMinute: number
  maximumWordsPerMinute: number
}

/** The manifest records and verifies pace to one decimal place. */
export function narrationReportedWordsPerMinute(wordsPerMinute: number) {
  if (!Number.isFinite(wordsPerMinute) || wordsPerMinute <= 0) {
    throw new RangeError('Narration pace must be a positive finite number.')
  }
  return Number(wordsPerMinute.toFixed(1))
}

/**
 * Hard technical pacing bounds for a recorded passage. Short passages have
 * greater whole-word variance, so their upper limit tapers smoothly into the
 * settled long-form ceiling instead of dropping at a single word boundary.
 *
 * The upper limit is rounded to the same one-decimal precision stored in the
 * narration manifest. This keeps generation and later verification identical
 * at the boundary.
 */
export function narrationPacingBounds(wordCount: number): NarrationPacingBounds {
  if (!Number.isSafeInteger(wordCount) || wordCount < 1) {
    throw new RangeError('Narration pacing requires a positive whole-word count.')
  }

  if (wordCount < 6) {
    return { minimumWordsPerMinute: 45, maximumWordsPerMinute: 240 }
  }
  if (wordCount < 20) {
    return { minimumWordsPerMinute: 90, maximumWordsPerMinute: 195 }
  }
  if (wordCount <= 30) {
    const taperedMaximum = 180 + (15 * (30 - wordCount)) / 11
    return {
      minimumWordsPerMinute: 100,
      maximumWordsPerMinute: Number(taperedMaximum.toFixed(1)),
    }
  }
  return { minimumWordsPerMinute: 100, maximumWordsPerMinute: 180 }
}
