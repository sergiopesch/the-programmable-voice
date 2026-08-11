export const narrationEditionConfiguration = {
  edition: '2026.1',
  model: 'gpt-4o-mini-tts-2025-12-15',
  voice: 'coral',
  responseFormat: 'mp3',
  voiceProfile: 'one mature adult woman; warm, thoughtful and intimate; natural modern Standard Southern British English',
  targetWordsPerMinute: 140,
  normalisation: {
    version: 'loudnorm-2026.1',
    integratedLoudnessLufs: -18,
    loudnessRangeLu: 7,
    truePeakDbtp: -2,
    sampleRateHz: 44_100,
    channels: 1,
    bitrateKbps: 128,
  },
  instructions: [
    'Read the supplied manuscript exactly as written, without additions, omissions, introductions, or paraphrases.',
    'Use one stable speaker identity throughout: a mature adult British woman from southern England, never a North American or transatlantic speaker.',
    'Speak in natural modern Standard Southern British English (contemporary Received Pronunciation): non-rhotic, poised and unmistakably British without sounding aristocratic, period-drama theatrical, or like a caricature.',
    'Use a warm lower-middle register and the intimate authority of an excellent British documentary and literary-audiobook narrator. Sound thoughtful, human and quietly engaged; never breathy, girlish, glossy, promotional or sing-song.',
    'The audience ranges from teenagers to professors. Make technical terms lucid, keep the pace measured at about 140 words per minute, and allow punctuation and changes of idea to breathe.',
    'Use British pronunciation and phrasing for dates, abbreviations and ordinary English words. Do not drift into General American vowels, rhotic post-vocalic r sounds, vocal fry, or an American newsreader cadence.',
  ].join(' '),
} as const

/**
 * A deliberately small, equal-text listening comparison. The public narration
 * remains locked until a human listener confirms that one candidate actually
 * sounds like the requested British woman; voice names and prompt text alone
 * cannot establish accent or gender presentation.
 */
export const narrationBritishVoiceComparison = {
  passageId: 'passage:opening:block-1-paragraph',
  candidates: [
    { label: 'A', voice: 'shimmer' },
    { label: 'B', voice: 'nova' },
    { label: 'C', voice: 'coral' },
  ],
} as const

export const narrationDisclosure = 'This recorded narration is AI-generated, not a human voice. It was generated once for this edition and is never recreated during playback.'
export const narrationApprovalChecklistVersion = '2026.2'
export const narrationComparisonApprovalChecklistVersion = '2026.1'

export const narrationComparisonApprovalConfirmations = [
  { flag: '--confirm-listened', label: 'all equal-text comparison candidates listened to in full' },
  { flag: '--confirm-device-check', label: 'all candidates compared on both headphones and a phone speaker' },
  { flag: '--confirm-british-accent', label: 'the selected candidate is consistently natural contemporary Southern British English' },
  { flag: '--confirm-adult-woman', label: 'the selected candidate presents as one mature adult woman' },
  { flag: '--confirm-warmth', label: 'the selected candidate is warm, intimate and suitable for literary documentary narration' },
  { flag: '--confirm-cadence', label: 'the selected candidate has a measured, lucid and non-theatrical cadence' },
] as const

export const narrationEditionAssetDirectory = `edition-${narrationEditionConfiguration.edition.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`

/**
 * A compact, representative listening set. Full-edition generation is locked
 * until these clips establish that the selected model follows the intended
 * speaker identity, accent and editorial cadence.
 */
export const narrationPilotPassageIds = [
  'passage:opening:section-title',
  'passage:fdn-string-tension:block-5-paragraph',
  'passage:fdn-string-tension:block-6-paragraph',
  'passage:fdn-music-before-machines:block-4-paragraph',
  'passage:fdn-memory-without-recording:block-8-paragraph',
  'passage:fdn-machines-imagine-speech:block-2-paragraph',
  'passage:fdn-machines-imagine-speech:block-3-paragraph',
  'passage:fdn-machines-imagine-speech:block-4-paragraph',
  'passage:fdn-machines-imagine-speech:block-5-paragraph',
  'passage:fdn-tinfoil-wax-cylinder:block-8-paragraph',
  'passage:media-tape-editable-time:block-2-paragraph',
  'passage:media-counting-waveform:block-0-paragraph',
  'passage:media-counting-waveform:block-2-paragraph',
  'passage:trust-after-voice:block-4-callout-title',
] as const

/**
 * Notes are deliberately keyed by passage, rather than added to the global
 * voice prompt, so correcting one pronunciation invalidates only that clip.
 */
export const narrationPassageReadingNotes: Readonly<Record<string, string>> = {
  'passage:fdn-string-tension:block-5-paragraph': 'Pronounce al-Farabi as al fah-RAH-bee, and Marin Mersenne in the French manner as mah-RAN mehr-SENN.',
  'passage:fdn-string-tension:block-6-paragraph': 'Pronounce Mersenne: mehr-SENN.',
  'passage:fdn-music-before-machines:block-4-paragraph': 'Pronounce Jiahu as JYAH-hoo, in two syllables.',
  'passage:fdn-memory-without-recording:block-8-paragraph': 'Pronounce Yorùbá as yaw-roo-BAH and dùndún as doon-DOON, without anglicising the written accents.',
  'passage:fdn-tinfoil-wax-cylinder:block-8-paragraph': 'Pronounce Passamaquoddy: pass-uh-muh-KWOD-ee.',
  'passage:media-tape-editable-time:block-2-paragraph': 'Pronounce Valdemar Poulsen with Poulsen as POWL-sen.',
  'passage:media-counting-waveform:block-0-paragraph': 'Pronounce SIGSALY as sig-SAL-ee, as a spoken name rather than separate letters.',
  'passage:media-counting-waveform:block-2-paragraph': 'Pronounce Joseph Fourier with Fourier as FOO-ree-ay.',
  'passage:media-counting-waveform:block-3-paragraph': 'Pronounce Fourier as FOO-ree-ay.',
  'passage:media-counting-waveform:block-10-paragraph': 'Pronounce SIGSALY as sig-SAL-ee, as a spoken name rather than separate letters.',
  'passage:media-studio-software:block-0-paragraph': 'Read MUSIC I as “Music One”, IBM 704 as “I-B-M seven-oh-four”, and In the Silver Scale as the title of the piece.',
  'passage:chronology:block-0-timeline-item-2-year': 'Pronounce Mersenne: mehr-SENN.',
  'passage:chronology:block-0-timeline-item-8-year': 'Pronounce Poulsen: POWL-sen.',
}

export const narrationPilotApprovalConfirmations = [
  { flag: '--confirm-pilot-listened', label: 'all pilot samples listened to in full' },
  { flag: '--confirm-same-woman', label: 'the same adult woman is recognisable across every pilot clip' },
  { flag: '--confirm-british-accent', label: 'the accent is consistently natural contemporary Southern British English' },
  { flag: '--confirm-warmth', label: 'the delivery is consistently warm, thoughtful and intimate' },
  { flag: '--confirm-cadence', label: 'pace, pauses and sentence cadence remain measured and intelligible' },
  { flag: '--confirm-level', label: 'perceived level and tonal balance remain consistent between clips' },
  { flag: '--confirm-pronunciations', label: 'sampled names, dates, abbreviations and technical terms are correct' },
] as const

export const narrationReleaseApprovalConfirmations = [
  { flag: '--confirm-listened', label: 'the entire recorded edition listened to in order' },
  { flag: '--confirm-same-woman', label: 'the same adult woman is recognisable throughout the edition' },
  { flag: '--confirm-british-accent', label: 'the accent remains natural contemporary Southern British English throughout' },
  { flag: '--confirm-warmth', label: 'warmth and intimacy remain consistent throughout' },
  { flag: '--confirm-cadence', label: 'pace, pauses and sentence cadence remain measured and intelligible' },
  { flag: '--confirm-level', label: 'perceived level and tonal balance remain consistent between passages' },
  { flag: '--confirm-pronunciations', label: 'names, dates, abbreviations and technical pronunciations are correct' },
  { flag: '--confirm-device-continuity', label: 'continuous passage hand-off and saved-position resume checked on Safari, iOS and a backgrounded player' },
  { flag: '--confirm-disclosure', label: 'the AI disclosure and fixed recorded-edition description are accurate' },
] as const

export function narrationReadingNoteFor(passageId: string) {
  return narrationPassageReadingNotes[passageId] ?? ''
}

export function narrationInstructionsFor(passageId: string) {
  const readingNote = narrationReadingNoteFor(passageId)
  return readingNote
    ? `${narrationEditionConfiguration.instructions} Passage-specific pronunciation direction: ${readingNote}`
    : narrationEditionConfiguration.instructions
}

export function narrationPassageHashMaterial(configurationHash: string, passageId: string, text: string) {
  return `${configurationHash}\n${narrationReadingNoteFor(passageId)}\n${text}`
}
