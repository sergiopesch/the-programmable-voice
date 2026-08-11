export const narrationEditionConfiguration = {
  edition: '2026.2',
  provider: 'local-open-weight-inference',
  model: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  modelRevision: '1939ad2a8e416c0acfeecc08a694d14ef25f2231',
  runtime: 'kokoro-js',
  runtimeVersion: '1.2.1',
  quantization: 'q8',
  device: 'cpu',
  sourceLicense: 'Apache-2.0',
  sourceUrl: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX',
  modelFiles: [
    { path: 'config.json', sha256: 'df34b4f930b23447cd4dc410fabfb42eb3f24e803e6c3f97d618fb359380a36f' },
    { path: 'tokenizer.json', sha256: '77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34' },
    { path: 'tokenizer_config.json', sha256: 'be1cb066d6ef6b074b3f15e6a6dd21ac88ff3cdaedf325f0aaed686c70f75d20' },
    { path: 'onnx/model_quantized.onnx', sha256: 'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478' },
  ],
  voice: 'bf_emma',
  voiceFileSha256: '669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73',
  voiceLocale: 'en-gb',
  voiceGenderCatalogLabel: 'Female',
  speed: 0.86,
  responseFormat: 'mp3',
  voiceProfile: 'Emma; one British woman; warm, clear and measured literary-documentary narration',
  targetWordsPerMinute: 132,
  normalisation: {
    version: 'loudnorm-2026.2-24khz-48kbps',
    integratedLoudnessLufs: -18,
    loudnessRangeLu: 7,
    truePeakDbtp: -2,
    sampleRateHz: 24_000,
    channels: 1,
    bitrateKbps: 48,
  },
  instructions: [
    'Editorial generation policy: read the supplied manuscript exactly as written, without additions, omissions, introductions or paraphrases.',
    'Kokoro does not accept free-form performance instructions; speaker identity, British pronunciation and delivery are therefore fixed by the pinned bf_emma voice, model revision and speed rather than inferred from this text.',
    'Passage-specific notes remain listening and correction requirements. They are metadata, not unsupported claims that the local synthesiser followed a hidden prompt.',
  ].join(' '),
} as const

export const narrationGenerationProvenance = {
  provider: narrationEditionConfiguration.provider,
  modelRevision: narrationEditionConfiguration.modelRevision,
  runtime: narrationEditionConfiguration.runtime,
  runtimeVersion: narrationEditionConfiguration.runtimeVersion,
  quantization: narrationEditionConfiguration.quantization,
  device: narrationEditionConfiguration.device,
  sourceLicense: narrationEditionConfiguration.sourceLicense,
  sourceUrl: narrationEditionConfiguration.sourceUrl,
  modelFiles: narrationEditionConfiguration.modelFiles,
  voiceFileSha256: narrationEditionConfiguration.voiceFileSha256,
  voiceLocale: narrationEditionConfiguration.voiceLocale,
  voiceGenderCatalogLabel: narrationEditionConfiguration.voiceGenderCatalogLabel,
  speed: narrationEditionConfiguration.speed,
  output: {
    responseFormat: narrationEditionConfiguration.responseFormat,
    sampleRateHz: narrationEditionConfiguration.normalisation.sampleRateHz,
    channels: narrationEditionConfiguration.normalisation.channels,
    bitrateKbps: narrationEditionConfiguration.normalisation.bitrateKbps,
    normalisationVersion: narrationEditionConfiguration.normalisation.version,
  },
} as const

/**
 * The project owner listened to this exact fixed diagnostic and explicitly
 * selected Emma. This receipt approves the speaker choice only. It does not
 * claim a representative-pilot listen or approve a complete recorded edition.
 */
export const narrationVoiceSelectionReceipt = {
  schemaVersion: 1,
  selectedAt: '2026-08-11',
  selectedBy: 'project owner',
  approvalScope: 'speaker-selection-only',
  passageId: 'passage:fdn-tinfoil-wax-cylinder:block-10-callout-title',
  auditionPath: 'docs/narration/voice-selection/kokoro-bf-emma-diagnostic-2026-08-11.mp3',
  auditionSha256: '899956afe3852838bb4de3c3205ac29242d7a562a8937e57652deb271f59de18',
  model: narrationEditionConfiguration.model,
  modelRevision: narrationEditionConfiguration.modelRevision,
  runtime: narrationEditionConfiguration.runtime,
  runtimeVersion: narrationEditionConfiguration.runtimeVersion,
  quantization: narrationEditionConfiguration.quantization,
  voice: narrationEditionConfiguration.voice,
  speed: narrationEditionConfiguration.speed,
  evidence: [
    'The project owner listened to the fixed Emma diagnostic and described Emma as definitely British.',
    'The project owner explicitly instructed the book to use Emma as its voice.',
  ],
  doesNotApprove: [
    'representative voice-pilot listening',
    'complete in-order edition listening',
    'pronunciation, level, continuity or device checks for the full edition',
  ],
} as const

/**
 * A deliberately small, equal-text listening comparison. The public narration
 * remains locked until a human listener confirms that one candidate actually
 * sounds like the requested British woman; voice names and prompt text alone
 * cannot establish accent or gender presentation.
 */
export const narrationBritishVoiceComparison = {
  passageId: narrationVoiceSelectionReceipt.passageId,
  candidates: [
    { label: 'A', voice: 'bf_emma' },
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
