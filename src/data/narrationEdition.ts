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

interface NarrationFreshRawDiagnostic {
  inputIntegratedLoudnessLufs: number
  inputTruePeakDbtp: number
  globalTargetMp3IntegratedLoudnessLufs: number
  globalTargetMp3TruePeakDbtp: number
  compensatedMp3IntegratedLoudnessLufs: number
  compensatedMp3TruePeakDbtp: number
}

interface NarrationCodecCompensatedNormalisationOverride {
  method: 'codec-compensated-single-pass-loudnorm'
  preEncodeTruePeakDbtp: number
  freshRawDiagnostic: NarrationFreshRawDiagnostic
  version: string
}

interface NarrationLimitedNormalisationOverride {
  method: 'post-normalisation-gain-limiter'
  postNormalisationGainDb: number
  limiter: {
    limitLinear: number
    attackMilliseconds: number
    releaseMilliseconds: number
    autoReleaseControl: false
    autoLevel: false
    latencyCompensation: false
  }
  freshRawDiagnostic: NarrationFreshRawDiagnostic
  qualityDiagnostic: {
    maximumGainReductionDb: number
    integratedLoudnessCostLu: number
  }
  version: string
}

export type NarrationPassageNormalisationOverride =
  | NarrationCodecCompensatedNormalisationOverride
  | NarrationLimitedNormalisationOverride

/**
 * Passage-local mastering exceptions. These live outside the edition-wide
 * configuration so an exceptional short clip can be corrected without
 * changing the approved pilot or invalidating ordinary narration assets.
 * The override itself is bound into only the affected passage digest below.
 */
export const narrationPassageNormalisationOverrides: Readonly<Record<string, NarrationPassageNormalisationOverride>> = {
  'passage:access-restoration-agency:block-2-heading': {
    method: 'codec-compensated-single-pass-loudnorm',
    preEncodeTruePeakDbtp: -1.25,
    freshRawDiagnostic: {
      inputIntegratedLoudnessLufs: -19.8,
      inputTruePeakDbtp: -0.89,
      globalTargetMp3IntegratedLoudnessLufs: -21.36,
      globalTargetMp3TruePeakDbtp: -2.9,
      compensatedMp3IntegratedLoudnessLufs: -20.57,
      compensatedMp3TruePeakDbtp: -2.26,
    },
    version: 'loudnorm-codec-compensated-single-pass-2026.2-24khz-48kbps',
  },
  'passage:air-again:block-5-heading': {
    method: 'post-normalisation-gain-limiter',
    postNormalisationGainDb: 2,
    limiter: {
      limitLinear: 0.8413951416451951,
      attackMilliseconds: 5,
      releaseMilliseconds: 50,
      autoReleaseControl: false,
      autoLevel: false,
      latencyCompensation: false,
    },
    freshRawDiagnostic: {
      inputIntegratedLoudnessLufs: -19.44,
      inputTruePeakDbtp: 0.04,
      globalTargetMp3IntegratedLoudnessLufs: -21.87,
      globalTargetMp3TruePeakDbtp: -2.76,
      compensatedMp3IntegratedLoudnessLufs: -19.91,
      compensatedMp3TruePeakDbtp: -1.97,
    },
    qualityDiagnostic: {
      maximumGainReductionDb: 1.5,
      integratedLoudnessCostLu: 0.04,
    },
    version: 'loudnorm-post-gain-limiter-2026.2-24khz-48kbps',
  },
}

export function narrationPassageNormalisationOverrideFor(passageId: string) {
  return narrationPassageNormalisationOverrides[passageId] ?? null
}

export function narrationNormalisationVersionFor(passageId: string) {
  return narrationPassageNormalisationOverrideFor(passageId)?.version
    ?? narrationEditionConfiguration.normalisation.version
}

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

export const narrationDisclosure = 'This recorded narration is AI-generated, not a human voice. It was generated once for this edition and is never recreated during playback.'
export const narrationApprovalChecklistVersion = '2026.2'

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
  'passage:fdn-disturbance-world:block-4-list-item-1': 'Read the equation v = fλ as “v equals f lambda”.',
  'passage:fdn-string-tension:block-5-paragraph': 'Pronounce al-Farabi as al fah-RAH-bee.',
  'passage:fdn-string-tension:block-6-paragraph': 'Pronounce Marin Mersenne in the French manner as mah-RAN mehr-SENN.',
  'passage:fdn-string-tension:block-7-paragraph': 'Pronounce Mersenne: mehr-SENN.',
  'passage:fdn-music-before-machines:block-4-paragraph': 'Pronounce Jiahu as JYAH-hoo, in two syllables.',
  'passage:fdn-memory-without-recording:block-8-paragraph': 'Pronounce Yorùbá as yaw-roo-BAH and dùndún as doon-DOON, without anglicising the written accents.',
  'passage:fdn-machines-imagine-speech:block-2-paragraph': 'Pronounce Prātiśākhya as praa-tee-SHAAKH-yuh and Śikṣā as SHIK-shaa.',
  'passage:fdn-machines-imagine-speech:block-3-paragraph': 'Pronounce Qurʾānic as koo-RAH-nik.',
  'passage:fdn-tinfoil-wax-cylinder:block-8-paragraph': 'Pronounce Passamaquoddy: pass-uh-muh-KWOD-ee.',
  'passage:media-disc-shellac:block-3-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:media-telephone-network:block-4-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:media-electric-studio:block-3-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:media-record-culture:block-2-paragraph': 'Read 33⅓ rpm as “thirty-three and a third R-P-M”, 45 rpm as “forty-five R-P-M”, and spell out PVC and RCA.',
  'passage:media-record-culture:block-5-paragraph': 'Read 45/45 as “forty-five forty-five”.',
  'passage:media-tape-editable-time:block-2-paragraph': 'Pronounce Valdemar Poulsen with Poulsen as POWL-sen.',
  'passage:media-tape-editable-time:block-3-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:media-electric-instrument:block-3-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:media-electric-instrument:block-11-paragraph': 'Read EMS as E-M-S and VCS3 as V-C-S three.',
  'passage:media-counting-waveform:block-0-paragraph': 'Pronounce SIGSALY as sig-SAL-ee, as a spoken name rather than separate letters.',
  'passage:media-counting-waveform:block-2-paragraph': 'Pronounce Joseph Fourier with Fourier as FOO-ree-ay.',
  'passage:media-counting-waveform:block-3-paragraph': 'Pronounce Fourier as FOO-ree-ay.',
  'passage:media-counting-waveform:block-10-paragraph': 'Pronounce SIGSALY as sig-SAL-ee, as a spoken name rather than separate letters.',
  'passage:media-counting-waveform:block-14-paragraph': 'Read the equation as “six point zero two N plus one point seven six D-B for N bits”.',
  'passage:media-studio-software:block-0-paragraph': 'Read MUSIC I as “Music One”, IBM 704 as “I-B-M seven-oh-four”, and In the Silver Scale as the title of the piece.',
  'passage:media-studio-software:block-7-paragraph': 'Read CMI as C-M-I.',
  'passage:media-disc-file-stream:block-2-paragraph': 'Read PCM as P-C-M, 44.1 kHz as “forty-four point one kilohertz”, and 16-bit as “sixteen-bit”.',
  'passage:media-disc-file-stream:block-3-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:media-disc-file-stream:block-4-paragraph': 'Read MP3 as M-P-three and MPEG-1 Audio Layer III as “M-peg One Audio Layer Three”.',
  'passage:media-disc-file-stream:block-5-paragraph': 'Read .mp3 as “dot M-P-three” and MPEG as “M-peg”.',
  'passage:media-disc-file-stream:block-8-paragraph': 'Read 128 kbit/s AAC as “one hundred and twenty-eight kilobits per second A-A-C”.',
  'passage:media-voice-packets:block-2-paragraph': 'Read TAT-1 as T-A-T one and 4 kHz as “four kilohertz”.',
  'passage:media-voice-packets:block-6-paragraph': 'Read RFC 741 as R-F-C seven-four-one and ISI as I-S-I.',
  'passage:media-voice-packets:block-7-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:media-voice-packets:block-8-paragraph': 'Read RTP as R-T-P and RFC 3550 as R-F-C three-five-five-zero.',
  'passage:media-voice-packets:block-9-paragraph': 'Read G.711 as “G seven eleven”, PCM as P-C-M, and kbit/s as “kilobits per second”.',
  'passage:media-voice-packets:block-13-paragraph': 'Read WebRTC as “Web R-T-C”, RTCPeerConnection as “R-T-C Peer Connection”, and W3C as W-three-C.',
  'passage:templates-to-probabilities:block-5-timeline-item-3-year': 'Read HMM as H-M-M.',
  'passage:templates-to-probabilities:block-8-paragraph': 'Read HMMs as H-M-Ms and CTC as C-T-C.',
  'passage:templates-to-probabilities:block-9-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:voder-to-neural-speech:block-9-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:whose-voice-in-data:block-9-paragraph': 'Read NIST as “nist”, US as U-S, and SP 800-63B-4 as “S-P eight hundred dash sixty-three B dash four”.',
  'passage:whose-voice-in-data:block-10-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:voice-becomes-tokens:block-4-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:voice-becomes-tokens:block-6-paragraph': 'Read VALL-E as “Valley”.',
  'passage:conversation-becomes-stream:block-3-paragraph': 'Read VAD as V-A-D.',
  'passage:conversation-becomes-stream:block-8-paragraph': 'Read VAD as V-A-D.',
  'passage:conversation-becomes-stream:block-10-paragraph': 'Read AAC as A-A-C.',
  'passage:access-restoration-agency:block-5-paragraph': 'Read W3C as W-three-C and WHO as W-H-O.',
  'passage:access-restoration-agency:block-7-paragraph': 'Read ALS as A-L-S.',
  'passage:access-restoration-agency:block-8-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:access-restoration-agency:block-10-paragraph': 'Read UN as U-N and Article 4(3) as “Article four, paragraph three”.',
  'passage:consent-provenance-synthetic-self:block-4-paragraph': 'Read VALL-E as “Valley”.',
  'passage:consent-provenance-synthetic-self:block-6-paragraph': 'Read C2PA as C-two-P-A.',
  'passage:consent-provenance-synthetic-self:block-9-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
  'passage:consent-provenance-synthetic-self:block-10-paragraph': 'Read NIST as “nist”.',
  'passage:chronology:block-0-timeline-item-0-year': 'Read >35,000 as “more than thirty-five thousand”.',
  'passage:chronology:block-0-timeline-item-1-year': 'Pronounce Jiahu as JYAH-hoo; read c. as “circa” and BCE as B-C-E.',
  'passage:chronology:block-0-timeline-item-2-year': 'Read c. as “circa” and BCE as B-C-E.',
  'passage:chronology:block-0-timeline-item-3-year': 'Pronounce al-Farabi as al fah-RAH-bee; read c. as “circa” and CE as C-E.',
  'passage:chronology:block-0-timeline-item-4-year': 'Pronounce Mersenne: mehr-SENN.',
  'passage:chronology:block-0-timeline-item-10-year': 'Pronounce Poulsen: POWL-sen.',
  'passage:chronology:block-0-timeline-item-19-year': 'Read MP3 and .mp3 as “M-P-three” and “dot M-P-three”.',
  'passage:chronology:block-0-timeline-item-24-year': 'Read APIs as A-P-Is.',
  'passage:representation-ladder:block-2-timeline-item-0-year': 'Read c. as “circa” and BCE as B-C-E.',
  'passage:representation-ladder:block-2-timeline-item-5-year': 'Read PCM as P-C-M.',
  'passage:representation-ladder:block-2-timeline-item-6-year': 'Read LP as L-P.',
  'passage:representation-ladder:block-2-timeline-item-9-year': 'Read .mp3 as “dot M-P-three” and MPEG-1 Layer III as “M-peg One Layer Three”.',
  'passage:trust-after-voice:block-0-figure-title': 'Read each right arrow as “to”, with a short pause between stages.',
}

export interface NarrationSpokenReplacement {
  from: string
  to: string
  expectedOccurrences?: number
}

/**
 * Exact, passage-local text normalisation for recorded speech. The visible
 * manuscript remains unchanged. Every source fragment and expected count is
 * validated before replacement, and the complete plan is bound into only the
 * affected passage digest.
 */
export const narrationPassageSpokenReplacements: Readonly<Record<string, readonly NarrationSpokenReplacement[]>> = {
  'passage:fdn-disturbance-world:block-4-list-item-1': [{ from: 'v = fλ', to: 'vee equals eff lambda' }],
  'passage:media-disc-shellac:block-3-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 3 }],
  'passage:media-telephone-network:block-4-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 5 }],
  'passage:media-electric-studio:block-3-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 4 }],
  'passage:media-record-culture:block-2-paragraph': [
    { from: '33⅓ rpm', to: 'thirty-three and a third R-P-M' },
    { from: 'PVC', to: 'P-V-C' },
    { from: 'RCA', to: 'R-C-A' },
    { from: '45 rpm', to: 'forty-five R-P-M' },
  ],
  'passage:media-record-culture:block-5-paragraph': [{ from: '45/45', to: 'forty-five forty-five' }],
  'passage:media-tape-editable-time:block-3-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 2 }],
  'passage:media-electric-instrument:block-3-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 4 }],
  'passage:media-electric-instrument:block-11-paragraph': [
    { from: 'EMS', to: 'E-M-S' },
    { from: 'VCS3', to: 'V-C-S three' },
  ],
  'passage:media-counting-waveform:block-14-paragraph': [{
    from: '6.02N + 1.76 dB for N bits',
    to: 'six point zero two en plus one point seven six dee bee for en bits',
  }],
  'passage:media-studio-software:block-0-paragraph': [
    { from: 'MUSIC I', to: 'Music One' },
    { from: 'IBM 704', to: 'I-B-M seven-oh-four' },
  ],
  'passage:media-studio-software:block-7-paragraph': [{ from: 'CMI', to: 'C-M-I' }],
  'passage:media-disc-file-stream:block-2-paragraph': [
    { from: 'PCM', to: 'P-C-M' },
    { from: '44.1 kHz', to: 'forty-four point one kilohertz' },
    { from: '16-bit', to: 'sixteen-bit' },
  ],
  'passage:media-disc-file-stream:block-3-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 4 }],
  'passage:media-disc-file-stream:block-4-paragraph': [
    { from: 'MP3', to: 'M-P-three' },
    { from: 'MPEG-1 Audio Layer III', to: 'M-peg One Audio Layer Three' },
  ],
  'passage:media-disc-file-stream:block-5-paragraph': [
    { from: '.mp3', to: 'dot M-P-three' },
    { from: 'MPEG', to: 'M-peg' },
  ],
  'passage:media-disc-file-stream:block-8-paragraph': [{
    from: '128 kbit/s AAC',
    to: 'one hundred and twenty-eight kilobits per second A-A-C',
  }],
  'passage:media-voice-packets:block-2-paragraph': [
    { from: 'TAT-1', to: 'T-A-T one' },
    { from: '4 kHz', to: 'four kilohertz' },
  ],
  'passage:media-voice-packets:block-6-paragraph': [
    { from: 'RFC 741', to: 'R-F-C seven-four-one' },
    { from: 'ISI', to: 'I-S-I' },
  ],
  'passage:media-voice-packets:block-7-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 7 }],
  'passage:media-voice-packets:block-8-paragraph': [
    { from: 'RFC 3550', to: 'R-F-C three-five-five-zero' },
    { from: 'RTP', to: 'R-T-P' },
  ],
  'passage:media-voice-packets:block-9-paragraph': [
    { from: 'G.711', to: 'G seven eleven' },
    { from: '8,000 companded PCM samples per second', to: 'eight thousand companded P-C-M samples per second' },
    { from: '64 kbit/s', to: 'sixty-four kilobits per second' },
  ],
  'passage:media-voice-packets:block-13-paragraph': [
    { from: 'WebRTC', to: 'Web R-T-C' },
    { from: 'RTCPeerConnection', to: 'R-T-C Peer Connection' },
    { from: 'W3C', to: 'W-three-C' },
  ],
  'passage:templates-to-probabilities:block-5-timeline-item-3-year': [{ from: 'HMM', to: 'H-M-M' }],
  'passage:templates-to-probabilities:block-8-paragraph': [
    { from: 'HMMs', to: 'H-M-Ms' },
    { from: 'CTC', to: 'C-T-C' },
  ],
  'passage:templates-to-probabilities:block-9-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 4 }],
  'passage:voder-to-neural-speech:block-9-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 8 }],
  'passage:whose-voice-in-data:block-9-paragraph': [
    { from: 'NIST', to: 'nist', expectedOccurrences: 2 },
    { from: 'US', to: 'U-S' },
    { from: 'SP 800-63B-4', to: 'S-P eight hundred dash sixty-three B dash four' },
  ],
  'passage:whose-voice-in-data:block-10-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 6 }],
  'passage:voice-becomes-tokens:block-4-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 5 }],
  'passage:voice-becomes-tokens:block-6-paragraph': [{ from: 'VALL-E', to: 'Valley' }],
  'passage:conversation-becomes-stream:block-3-paragraph': [{ from: 'VAD', to: 'V-A-D', expectedOccurrences: 2 }],
  'passage:conversation-becomes-stream:block-8-paragraph': [{ from: 'VAD', to: 'V-A-D' }],
  'passage:conversation-becomes-stream:block-10-paragraph': [{ from: 'AAC-mediated', to: 'A-A-C-mediated' }],
  'passage:access-restoration-agency:block-5-paragraph': [
    { from: 'W3C', to: 'W-three-C' },
    { from: 'WHO', to: 'W-H-O' },
  ],
  'passage:access-restoration-agency:block-7-paragraph': [{ from: 'ALS', to: 'A-L-S' }],
  'passage:access-restoration-agency:block-8-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 5 }],
  'passage:access-restoration-agency:block-10-paragraph': [
    { from: 'UN', to: 'U-N' },
    { from: 'Article 4(3)', to: 'Article four, paragraph three' },
  ],
  'passage:consent-provenance-synthetic-self:block-4-paragraph': [{ from: 'VALL-E', to: 'Valley' }],
  'passage:consent-provenance-synthetic-self:block-6-paragraph': [{ from: 'C2PA', to: 'C-two-P-A' }],
  'passage:consent-provenance-synthetic-self:block-9-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 6 }],
  'passage:consent-provenance-synthetic-self:block-10-paragraph': [{ from: 'NIST', to: 'nist' }],
  'passage:chronology:block-0-timeline-item-0-year': [{ from: '>35,000 years ago', to: 'more than thirty-five thousand years ago' }],
  'passage:chronology:block-0-timeline-item-1-year': [
    { from: 'c. 7000–5700 BCE', to: 'circa seven thousand to five thousand seven hundred B-C-E' },
  ],
  'passage:chronology:block-0-timeline-item-2-year': [{ from: 'c. 2600 BCE', to: 'circa twenty-six hundred B-C-E' }],
  'passage:chronology:block-0-timeline-item-3-year': [
    { from: 'c. 950 CE', to: 'circa nine hundred and fifty C-E' },
  ],
  'passage:chronology:block-0-timeline-item-19-year': [
    { from: 'MP3', to: 'M-P-three' },
    { from: '.mp3', to: 'dot M-P-three' },
  ],
  'passage:chronology:block-0-timeline-item-24-year': [{ from: 'APIs', to: 'A-P-Is' }],
  'passage:representation-ladder:block-2-timeline-item-0-year': [{ from: 'c. 2600 BCE', to: 'circa twenty-six hundred B-C-E' }],
  'passage:representation-ladder:block-2-timeline-item-5-year': [{ from: 'PCM', to: 'P-C-M' }],
  'passage:representation-ladder:block-2-timeline-item-6-year': [{ from: 'LP', to: 'L-P' }],
  'passage:representation-ladder:block-2-timeline-item-9-year': [
    { from: '.mp3', to: 'dot M-P-three', expectedOccurrences: 2 },
    { from: 'MPEG-1 Layer III', to: 'M-peg One Layer Three' },
  ],
  'passage:trust-after-voice:block-0-figure-title': [{ from: '→', to: 'to', expectedOccurrences: 7 }],
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

export function narrationSpokenReplacementsFor(passageId: string) {
  return narrationPassageSpokenReplacements[passageId] ?? []
}

function sourceRanges(text: string, source: string) {
  const ranges: { start: number; end: number }[] = []
  let cursor = 0
  while (cursor <= text.length - source.length) {
    const start = text.indexOf(source, cursor)
    if (start < 0) break
    ranges.push({ start, end: start + source.length })
    cursor = start + source.length
  }
  return ranges
}

/**
 * Returns the exact text sent to the fixed synthesiser. Replacement plans are
 * deliberately literal: manuscript drift, an ambiguous source fragment or
 * overlapping rules fails closed instead of silently changing the reading.
 */
export function narrationSpokenTextFor(passageId: string, manuscriptText: string) {
  const replacements = narrationSpokenReplacementsFor(passageId)
  if (replacements.length === 0) return manuscriptText

  const edits: { start: number; end: number; to: string; from: string }[] = []
  for (const replacement of replacements) {
    const expectedOccurrences = replacement.expectedOccurrences ?? 1
    if (!replacement.from || !replacement.to || replacement.from === replacement.to) {
      throw new Error(`Spoken normalisation for ${passageId} contains an empty or ineffective replacement.`)
    }
    if (!Number.isSafeInteger(expectedOccurrences) || expectedOccurrences < 1) {
      throw new Error(`Spoken normalisation for ${passageId} has an invalid expected occurrence count.`)
    }
    const ranges = sourceRanges(manuscriptText, replacement.from)
    if (ranges.length !== expectedOccurrences) {
      throw new Error(`Spoken normalisation for ${passageId} expected ${expectedOccurrences} occurrence(s) of ${JSON.stringify(replacement.from)}, found ${ranges.length}.`)
    }
    edits.push(...ranges.map(({ start, end }) => ({ start, end, to: replacement.to, from: replacement.from })))
  }

  edits.sort((left, right) => left.start - right.start || left.end - right.end)
  for (let index = 1; index < edits.length; index += 1) {
    const previous = edits[index - 1]!
    const current = edits[index]!
    if (current.start < previous.end) {
      throw new Error(`Spoken normalisation for ${passageId} has overlapping replacements ${JSON.stringify(previous.from)} and ${JSON.stringify(current.from)}.`)
    }
  }

  let spokenText = ''
  let cursor = 0
  for (const edit of edits) {
    spokenText += manuscriptText.slice(cursor, edit.start)
    spokenText += edit.to
    cursor = edit.end
  }
  spokenText += manuscriptText.slice(cursor)
  if (!spokenText.trim()) throw new Error(`Spoken normalisation for ${passageId} produced empty speech.`)
  return spokenText
}

export function narrationInstructionsFor(passageId: string) {
  const readingNote = narrationReadingNoteFor(passageId)
  return readingNote
    ? `${narrationEditionConfiguration.instructions} Passage-specific pronunciation direction: ${readingNote}`
    : narrationEditionConfiguration.instructions
}

export function narrationPassageHashMaterial(configurationHash: string, passageId: string, text: string) {
  const readingNote = narrationReadingNoteFor(passageId)
  const replacements = narrationSpokenReplacementsFor(passageId)
  const normalisationOverride = narrationPassageNormalisationOverrideFor(passageId)
  if (replacements.length === 0 && !normalisationOverride) return `${configurationHash}\n${readingNote}\n${text}`
  const material = [configurationHash, readingNote, text]
  if (replacements.length > 0) {
    const spokenText = narrationSpokenTextFor(passageId, text)
    material.push(
      'spoken-normalisation-v1',
      JSON.stringify(replacements),
      spokenText,
    )
  }
  if (normalisationOverride) {
    material.push(
      'passage-normalisation-v1',
      JSON.stringify(normalisationOverride),
    )
  }
  return material.join('\n')
}
