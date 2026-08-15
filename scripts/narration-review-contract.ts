import { createHash } from 'node:crypto'
import {
  narrationPassageNormalisationOverrideFor,
  narrationReadingNoteFor,
  narrationSpokenReplacementsFor,
  narrationSpokenTextFor,
  type NarrationPassageNormalisationOverride,
} from '../src/data/narrationEdition'
import { bookNarrationPassages } from '../src/lib/narration'
import { isExactIsoTimestamp } from '../src/lib/exactIsoTimestamp'
import {
  narrationFullListenConfirmations,
  narrationFullListenReceiptMaterial,
  type NarrationFullListenApprovalEvidence,
  type NarrationFullListenReceipt,
  type NarrationManifest,
  type NarrationManifestEntry,
} from '../src/lib/narrationRelease'
import {
  narrationCharacterPacingBounds,
  narrationCharactersPerSecond,
} from './narration-pacing'

export {
  narrationFullListenConfirmations,
  type NarrationFullListenApprovalEvidence,
  type NarrationFullListenReceipt,
}

export interface NarrationReviewSpokenReplacement {
  from: string
  to: string
  expectedOccurrences?: number
}

export interface NarrationReviewSourcePassage {
  id: string
  visibleText: string
  spokenText: string
  readingNote: string
  spokenReplacements: NarrationReviewSpokenReplacement[]
}

export type NarrationReviewAttentionCode =
  | 'reading-note'
  | 'spoken-normalisation'
  | 'complex-spoken-normalisation'
  | 'passage-normalisation-override'
  | 'below-ordinary-loudness-floor'
  | 'near-character-pacing-bound'
  | 'known-qc-46'
  | 'known-qc-56'
  | 'known-qc-86'
  | 'known-qc-146'
  | 'known-qc-385'
  | 'known-qc-453'
  | 'known-qc-506'

export interface NarrationReviewAttentionFlag {
  code: NarrationReviewAttentionCode
  priority: 'review' | 'priority'
  rationale: string
}

export interface NarrationReviewAttentionSummary {
  attentionPassageCount: number
  flagCount: number
  priorityPassageCount: number
  readingNotePassages: number
  spokenNormalisationPassages: number
  complexSpokenNormalisationPassages: number
  passageNormalisationOverridePassages: number
  belowOrdinaryLoudnessFloorPassages: number
  nearCharacterPacingBoundPassages: number
  knownQcPassages: number
}

export interface NarrationFullListenPassageIdentity {
  ordinal: number
  id: string
  sectionId: string
  targetId: string
  textHash: string
  url: string
  audioSha256: string
  durationSeconds: number
  visibleText: string
  spokenText: string
  readingNote: string
  spokenReplacements: NarrationReviewSpokenReplacement[]
  attentionFlags: NarrationReviewAttentionFlag[]
}

export interface NarrationFullListenManifest {
  schemaVersion: 1
  kind: 'narration-full-listen'
  releaseId: string
  edition: string
  disclosure: string
  configurationHash: string
  manuscriptHash: string
  pilotProfileHash: string
  passageCount: number
  totalDurationSeconds: number
  orderedPassageProfileSha256: string
  attentionSummary: NarrationReviewAttentionSummary
  humanListeningRequired: true
  passages: NarrationFullListenPassageIdentity[]
}

interface ReviewCandidate {
  releaseId: string
  edition: string
  disclosure: string
  configurationHash: string
  manuscriptHash: string
  pilotProfileHash: string
  passageCount: number
  totalDurationSeconds: number
  passages: NarrationManifestEntry[]
}

export interface NarrationFullListenPackage {
  directoryName: string
  manifest: NarrationFullListenManifest
  expectedReceipt: Omit<NarrationFullListenReceipt, 'completedAt' | 'completedBy'>
  files: {
    'manifest.json': string
    'checksums.sha256': string
    'listen.m3u8': string
    'CHECKLIST.md': string
    'receipt.schema.json': string
  }
}

export function narrationReviewSha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function assertDigest(value: string, label: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} is not a SHA-256 digest.`)
}

function assertSafeText(value: string, label: string) {
  if (!value || /[\r\n\0]/.test(value)) throw new Error(`${label} is empty or contains an unsafe control character.`)
}

function reviewRelativeAudioPath(url: string, expectedSha256?: string) {
  assertSafeText(url, 'Narration audio URL')
  const match = url.match(/^\/audio\/narration\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*-([a-f0-9]{64})\.mp3)$/)
  if (!match || (expectedSha256 !== undefined && match[3] !== expectedSha256)) {
    throw new Error(`Narration review cannot reference unsafe audio URL ${url}.`)
  }
  const relativeUrl = url.slice(1)
  if (relativeUrl.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`Narration review cannot reference unsafe audio URL ${url}.`)
  }
  return `../../../public/${relativeUrl}`
}

function assertBoundText(value: string, label: string, allowEmpty = false) {
  if (typeof value !== 'string' || value.includes('\0') || (!allowEmpty && !value.trim())) {
    throw new Error(`${label} is missing or unsafe.`)
  }
}

function applyReplacementPlan(visibleText: string, replacements: readonly NarrationReviewSpokenReplacement[]) {
  const edits: { start: number; end: number; to: string; from: string }[] = []
  for (const replacement of replacements) {
    assertBoundText(replacement.from, 'Narration review replacement source')
    assertBoundText(replacement.to, 'Narration review replacement target')
    if (replacement.from === replacement.to) throw new Error('Narration review replacement plan contains an ineffective rule.')
    const expectedOccurrences = replacement.expectedOccurrences ?? 1
    if (!Number.isSafeInteger(expectedOccurrences) || expectedOccurrences < 1) {
      throw new Error('Narration review replacement plan contains an invalid occurrence count.')
    }
    let cursor = 0
    let occurrences = 0
    while (cursor <= visibleText.length - replacement.from.length) {
      const start = visibleText.indexOf(replacement.from, cursor)
      if (start < 0) break
      edits.push({ start, end: start + replacement.from.length, to: replacement.to, from: replacement.from })
      occurrences += 1
      cursor = start + replacement.from.length
    }
    if (occurrences !== expectedOccurrences) {
      throw new Error(`Narration review replacement ${JSON.stringify(replacement.from)} expected ${expectedOccurrences} occurrence(s), found ${occurrences}.`)
    }
  }
  edits.sort((left, right) => left.start - right.start || left.end - right.end)
  for (let index = 1; index < edits.length; index += 1) {
    if (edits[index]!.start < edits[index - 1]!.end) throw new Error('Narration review replacement plan contains overlapping rules.')
  }
  let spokenText = ''
  let cursor = 0
  for (const edit of edits) {
    spokenText += visibleText.slice(cursor, edit.start)
    spokenText += edit.to
    cursor = edit.end
  }
  return `${spokenText}${visibleText.slice(cursor)}`
}

export function currentNarrationReviewSources(): NarrationReviewSourcePassage[] {
  return bookNarrationPassages.map((passage) => ({
    id: passage.id,
    visibleText: passage.text,
    spokenText: narrationSpokenTextFor(passage.id, passage.text),
    readingNote: narrationReadingNoteFor(passage.id),
    spokenReplacements: narrationSpokenReplacementsFor(passage.id).map((replacement) => ({
      from: replacement.from,
      to: replacement.to,
      ...(replacement.expectedOccurrences === undefined ? {} : { expectedOccurrences: replacement.expectedOccurrences }),
    })),
  }))
}

function rounded(value: number, digits = 3) {
  return Number(value.toFixed(digits))
}

function normalisationOverrideRationale(override: NarrationPassageNormalisationOverride) {
  if (override.method === 'codec-compensated-single-pass-loudnorm') {
    return `Passage-local mastering override ${override.method} (${override.version}) uses a ${override.preEncodeTruePeakDbtp.toFixed(2)} dBTP pre-encode target to compensate for MP3 peak and loudness behaviour. Compare both adjacent hand-offs at a fixed listening level for a level or timbre step, and listen for codec ringing, softened consonant attacks or other peak-compensation artefacts.`
  }
  if (override.method === 'post-normalisation-gain-limiter') {
    const limiterCeilingDb = 20 * Math.log10(override.limiter.limitLinear)
    return `Passage-local mastering override ${override.method} (${override.version}) applies ${override.postNormalisationGainDb.toFixed(1)} dB after ordinary normalisation, then limit=${override.limiter.limitLinear} (${limiterCeilingDb.toFixed(2)} dBFS), attack=${override.limiter.attackMilliseconds} ms and release=${override.limiter.releaseMilliseconds} ms; measured maximum gain reduction is ${override.qualityDiagnostic.maximumGainReductionDb.toFixed(1)} dB with ${override.qualityDiagnostic.integratedLoudnessCostLu.toFixed(2)} LU integrated cost. Compare both adjacent hand-offs at a fixed listening level, and listen for flattened or clipped consonant attacks, pumping, breathing or audible release-tail modulation.`
  }
  const exhaustive: never = override
  return exhaustive
}

export function narrationReviewAttentionFlags(
  entry: NarrationManifestEntry,
  source: NarrationReviewSourcePassage,
  ordinal: number,
): NarrationReviewAttentionFlag[] {
  const flags: NarrationReviewAttentionFlag[] = []
  const replacements = source.spokenReplacements
  if (source.readingNote) {
    flags.push({
      code: 'reading-note',
      priority: 'review',
      rationale: 'Passage-specific reading direction requires an explicit pronunciation or delivery check.',
    })
  }
  if (replacements.length > 0) {
    flags.push({
      code: 'spoken-normalisation',
      priority: 'review',
      rationale: `Visible manuscript is transformed by ${replacements.length} exact spoken replacement rule${replacements.length === 1 ? '' : 's'}; compare visible and spoken text.`,
    })
  }
  const maximumOccurrences = replacements.reduce((maximum, replacement) => Math.max(maximum, replacement.expectedOccurrences ?? 1), 0)
  if (replacements.length > 1 || maximumOccurrences > 1) {
    flags.push({
      code: 'complex-spoken-normalisation',
      priority: 'review',
      rationale: `Higher-risk replacement plan contains ${replacements.length} rule${replacements.length === 1 ? '' : 's'} and up to ${maximumOccurrences} occurrence${maximumOccurrences === 1 ? '' : 's'} per rule.`,
    })
  }
  const normalisationOverride = narrationPassageNormalisationOverrideFor(entry.id)
  if (normalisationOverride) {
    flags.push({
      code: 'passage-normalisation-override',
      priority: 'priority',
      rationale: normalisationOverrideRationale(normalisationOverride),
    })
  }
  const loudness = entry.technicalQc.integratedLoudnessLufs
  if (loudness < -20.5) {
    flags.push({
      code: 'below-ordinary-loudness-floor',
      priority: 'priority',
      rationale: `Measured integrated loudness ${loudness.toFixed(1)} LUFS is below the ordinary -20.5 LUFS floor; compare perceived level with adjacent passages.`,
    })
  }
  const charactersPerSecond = narrationCharactersPerSecond(source.spokenText, entry.durationSeconds)
  const bounds = narrationCharacterPacingBounds(source.spokenText)
  const lowerMargin = charactersPerSecond - bounds.minimumCharactersPerSecond
  const upperMargin = bounds.maximumCharactersPerSecond - charactersPerSecond
  const nearestMargin = Math.min(lowerMargin, upperMargin)
  if (lowerMargin >= 0 && upperMargin >= 0 && nearestMargin <= 0.5) {
    const nearest = lowerMargin <= upperMargin ? 'lower' : 'upper'
    const boundary = nearest === 'lower' ? bounds.minimumCharactersPerSecond : bounds.maximumCharactersPerSecond
    flags.push({
      code: 'near-character-pacing-bound',
      priority: 'priority',
      rationale: `Measured pace ${rounded(charactersPerSecond)} CPS is ${rounded(nearestMargin)} CPS from the ${nearest} ${rounded(boundary)} CPS bound; listen for unnaturally slow or rushed delivery.`,
    })
  }

  const wordsPerMinute = entry.technicalQc.wordsPerMinute.toFixed(1)
  const cps = rounded(charactersPerSecond)
  if (entry.id === 'passage:fdn-string-tension:block-4-list-item-3') {
    flags.push({
      code: 'known-qc-46',
      priority: 'priority',
      rationale: `Known cadence review (#46${ordinal === 46 ? '' : `; now #${ordinal}`}): ${wordsPerMinute} WPM prompted the pacing audit; confirm the long single-sentence list item remains articulated at ${cps} CPS.`,
    })
  }
  if (entry.id === 'passage:fdn-rooms-membranes-resonances:block-1-heading') {
    const wordCount = source.spokenText.trim().split(/\s+/u).length
    flags.push({
      code: 'known-qc-56',
      priority: 'priority',
      rationale: `Known cadence review (#56${ordinal === 56 ? '' : `; now #${ordinal}`}): the ${wordCount}-word question reports ${wordsPerMinute} WPM because short function words inflate WPM; confirm warm, unhurried question cadence at ${cps} CPS.`,
    })
  }
  if (entry.id === 'passage:fdn-music-before-machines:block-11-list-item-2') {
    flags.push({
      code: 'known-qc-86',
      priority: 'priority',
      rationale: `Known cadence review (#86${ordinal === 86 ? '' : `; now #${ordinal}`}): ${cps} CPS sits ${rounded(upperMargin)} CPS below the ${rounded(bounds.maximumCharactersPerSecond)} CPS upper bound; listen for rushed phrasing.`,
    })
  }
  if (entry.id === 'passage:fdn-machines-imagine-speech:block-12-list-item-0') {
    flags.push({
      code: 'known-qc-146',
      priority: 'priority',
      rationale: `Known level review (#146${ordinal === 146 ? '' : `; now #${ordinal}`}): ${loudness.toFixed(1)} LUFS on a ${entry.durationSeconds.toFixed(3)} s peak-limited phrase (${entry.technicalQc.truePeakDbtp.toFixed(1)} dBTP) is below the ordinary floor; compare it directly with neighbouring clips.`,
    })
  }
  if (entry.id === 'passage:templates-to-probabilities:block-2-heading') {
    flags.push({
      code: 'known-qc-385',
      priority: 'priority',
      rationale: `Known cadence remediation (#385${ordinal === 385 ? '' : `; now #${ordinal}`}): the visible question was reordered after its former reading failed at 21.1 CPS. Confirm the opening phrase and comma create a natural, unhurried question at ${cps} CPS without an artificial pause or shifted emphasis.`,
    })
  }
  if (entry.id === 'passage:conversation-becomes-stream:block-2-heading') {
    flags.push({
      code: 'known-qc-453',
      priority: 'priority',
      rationale: `Known cadence remediation (#453${ordinal === 453 ? '' : `; now #${ordinal}`}): the visible turn-taking question was rewritten after its former reading failed at 20.5 CPS. Confirm the speak-and-wait contrast and em-dash hinge sound warm and deliberate at ${cps} CPS, not rushed, jerky or theatrical.`,
    })
  }
  if (entry.id === 'passage:air-again:block-2-heading') {
    flags.push({
      code: 'known-qc-506',
      priority: 'priority',
      rationale: `Known cadence remediation (#506${ordinal === 506 ? '' : `; now #${ordinal}`}): the visible comma was changed to an em dash after the former reading failed at 20.5 CPS. Confirm an audible two-beat thesis question at ${cps} CPS without an overlong or artificial pause.`,
    })
  }
  return flags
}

function orderedPassages(
  candidate: ReviewCandidate,
  sources: readonly NarrationReviewSourcePassage[],
): NarrationFullListenPassageIdentity[] {
  if (candidate.passageCount !== candidate.passages.length || candidate.passages.length === 0) {
    throw new Error('Narration review requires a non-empty complete passage list.')
  }
  if (sources.length !== candidate.passages.length) throw new Error('Narration review source inventory is incomplete.')
  const ids = new Set<string>()
  const urls = new Set<string>()
  return candidate.passages.map((entry, index) => {
    const source = sources[index]
    if (!source || source.id !== entry.id) throw new Error(`Narration review source ${index + 1} does not match ${entry.id}.`)
    assertSafeText(entry.id, `Narration passage ${index + 1} id`)
    assertSafeText(entry.sectionId, `Narration passage ${entry.id} section id`)
    assertSafeText(entry.targetId, `Narration passage ${entry.id} target id`)
    assertDigest(entry.textHash, `Narration passage ${entry.id} text hash`)
    assertDigest(entry.sha256, `Narration passage ${entry.id} audio hash`)
    reviewRelativeAudioPath(entry.url, entry.sha256)
    if (!Number.isFinite(entry.durationSeconds) || entry.durationSeconds <= 0) throw new Error(`Narration passage ${entry.id} has an invalid duration.`)
    if (ids.has(entry.id)) throw new Error(`Narration review contains duplicate passage id ${entry.id}.`)
    if (urls.has(entry.url)) throw new Error(`Narration review contains duplicate audio URL ${entry.url}.`)
    assertBoundText(source.visibleText, `Narration passage ${entry.id} visible text`)
    assertBoundText(source.spokenText, `Narration passage ${entry.id} spoken text`)
    assertBoundText(source.readingNote, `Narration passage ${entry.id} reading note`, true)
    if (!Array.isArray(source.spokenReplacements)) throw new Error(`Narration passage ${entry.id} replacement plan is unavailable.`)
    const expectedSpokenText = applyReplacementPlan(source.visibleText, source.spokenReplacements)
    if (expectedSpokenText !== source.spokenText) throw new Error(`Narration passage ${entry.id} spoken text does not match its exact replacement plan.`)
    ids.add(entry.id)
    urls.add(entry.url)
    return {
      ordinal: index + 1,
      id: entry.id,
      sectionId: entry.sectionId,
      targetId: entry.targetId,
      textHash: entry.textHash,
      url: entry.url,
      audioSha256: entry.sha256,
      durationSeconds: entry.durationSeconds,
      visibleText: source.visibleText,
      spokenText: source.spokenText,
      readingNote: source.readingNote,
      spokenReplacements: source.spokenReplacements.map((replacement) => ({ ...replacement })),
      attentionFlags: narrationReviewAttentionFlags(entry, source, index + 1),
    }
  })
}

function orderedPassageProfileSha256(passages: readonly NarrationFullListenPassageIdentity[]) {
  return narrationReviewSha256(JSON.stringify(passages))
}

function attentionSummary(passages: readonly NarrationFullListenPassageIdentity[]): NarrationReviewAttentionSummary {
  const passageHas = (predicate: (flag: NarrationReviewAttentionFlag) => boolean) => passages.filter(
    (passage) => passage.attentionFlags.some(predicate),
  ).length
  return {
    attentionPassageCount: passageHas(() => true),
    flagCount: passages.reduce((total, passage) => total + passage.attentionFlags.length, 0),
    priorityPassageCount: passageHas((flag) => flag.priority === 'priority'),
    readingNotePassages: passageHas((flag) => flag.code === 'reading-note'),
    spokenNormalisationPassages: passageHas((flag) => flag.code === 'spoken-normalisation'),
    complexSpokenNormalisationPassages: passageHas((flag) => flag.code === 'complex-spoken-normalisation'),
    passageNormalisationOverridePassages: passageHas((flag) => flag.code === 'passage-normalisation-override'),
    belowOrdinaryLoudnessFloorPassages: passageHas((flag) => flag.code === 'below-ordinary-loudness-floor'),
    nearCharacterPacingBoundPassages: passageHas((flag) => flag.code === 'near-character-pacing-bound'),
    knownQcPassages: passageHas((flag) => flag.code.startsWith('known-qc-')),
  }
}

function playlist(passages: readonly NarrationFullListenPassageIdentity[], releaseId: string) {
  const lines = ['#EXTM3U', `#PLAYLIST:The Programmable Voice — ${releaseId}`]
  for (const passage of passages) {
    lines.push(
      `#EXTINF:${passage.durationSeconds.toFixed(3)},${String(passage.ordinal).padStart(4, '0')} ${passage.id}`,
      reviewRelativeAudioPath(passage.url, passage.audioSha256),
    )
  }
  return `${lines.join('\n')}\n`
}

function checklist(manifest: NarrationFullListenManifest) {
  const hours = Math.floor(manifest.totalDurationSeconds / 3600)
  const minutes = Math.floor((manifest.totalDurationSeconds % 3600) / 60)
  const seconds = Math.round(manifest.totalDurationSeconds % 60)
  const lines = [
    '# Full-edition narration listening checklist',
    '',
    `Release: \`${manifest.releaseId}\``,
    `Ordered passage profile: \`${manifest.orderedPassageProfileSha256}\``,
    `Runtime: ${hours}h ${minutes}m ${seconds}s across ${manifest.passageCount} passages.`,
    '',
    `Disclosure: ${manifest.disclosure}`,
    '',
    'Before listening, run `npm run narration:verify-candidate` from the repository root. Treat the package files as immutable; keep progress notes in a separate file or printed copy.',
    '',
    'For the real application player, run `npm run dev` and open `http://127.0.0.1:5173/?narration-review=1`. The development-only banner must remain visible. `listen.m3u8` is the portable exact-order companion; never reorder, shuffle, substitute or skip files.',
    '',
    'For every passage, check speaker continuity, British accent, warmth, cadence, perceived level and pronunciation. Record any defect before continuing. Separately test continuous hand-off and saved-position resume on Safari, iOS and a backgrounded player before final approval.',
    '',
    'Every passage-local mastering override is a mandatory transition check: replay both adjacent hand-offs at a fixed listening level, then check the method-specific artefacts listed for that passage.',
    '',
    '## Priority attention',
    '',
    `Reading notes: ${manifest.attentionSummary.readingNotePassages}; spoken normalisations: ${manifest.attentionSummary.spokenNormalisationPassages}; multi-rule or multi-occurrence plans: ${manifest.attentionSummary.complexSpokenNormalisationPassages}; passage-local mastering overrides: ${manifest.attentionSummary.passageNormalisationOverridePassages}; below ordinary level: ${manifest.attentionSummary.belowOrdinaryLoudnessFloorPassages}; near a CPS bound: ${manifest.attentionSummary.nearCharacterPacingBoundPassages}; known QC passages: ${manifest.attentionSummary.knownQcPassages}.`,
    '',
  ]
  for (const passage of manifest.passages.filter((candidate) => candidate.attentionFlags.some((flag) => flag.priority === 'priority'))) {
    const rationales = passage.attentionFlags.filter((flag) => flag.priority === 'priority').map((flag) => flag.rationale)
    lines.push(`- **${String(passage.ordinal).padStart(4, '0')}** \`${passage.id}\` — ${rationales.join(' ')}`)
  }
  lines.push(
    '',
    'Only after every box is complete, record the immutable private receipt:',
    '',
    '```bash',
    'npm run narration:record-full-listen -- --listener="Listener name" --confirm-full-listen-complete',
    '```',
    '',
    '## Ordered passages',
    '',
  )
  for (const passage of manifest.passages) {
    const attention = passage.attentionFlags.length > 0
      ? ` — attention: ${passage.attentionFlags.map((flag) => flag.code).join(', ')}`
      : ''
    lines.push(`- [ ] ${String(passage.ordinal).padStart(4, '0')} \`${passage.id}\` — ${passage.durationSeconds.toFixed(3)} s — \`${passage.audioSha256}\`${attention}`)
    if (passage.readingNote) lines.push(`  - Reading note: ${passage.readingNote}`)
    if (passage.spokenReplacements.length > 0) {
      const plan = passage.spokenReplacements.map((replacement) => (
        `${JSON.stringify(replacement.from)} → ${JSON.stringify(replacement.to)} × ${replacement.expectedOccurrences ?? 1}`
      )).join('; ')
      lines.push(`  - Visible manuscript: ${JSON.stringify(passage.visibleText)}`)
      lines.push(`  - Replacement plan: ${plan}`)
      lines.push(`  - Exact spoken text: ${JSON.stringify(passage.spokenText)}`)
    }
  }
  return `${lines.join('\n')}\n`
}

function receiptSchema(expected: Omit<NarrationFullListenReceipt, 'completedAt' | 'completedBy' | 'packageChecksumsSha256'>) {
  return canonicalJson({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'The Programmable Voice full-listen receipt',
    type: 'object',
    additionalProperties: false,
    required: [
      'schemaVersion',
      'kind',
      'releaseId',
      'reviewManifestSha256',
      'packageChecksumsSha256',
      'orderedPassageProfileSha256',
      'passageCount',
      'completedAt',
      'completedBy',
      'confirmations',
    ],
    properties: {
      schemaVersion: { const: expected.schemaVersion },
      kind: { const: expected.kind },
      releaseId: { const: expected.releaseId },
      reviewManifestSha256: { const: expected.reviewManifestSha256 },
      packageChecksumsSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      orderedPassageProfileSha256: { const: expected.orderedPassageProfileSha256 },
      passageCount: { const: expected.passageCount },
      completedAt: { type: 'string', format: 'date-time' },
      completedBy: { type: 'string', minLength: 1 },
      confirmations: {
        type: 'array',
        prefixItems: narrationFullListenConfirmations.map((confirmation) => ({ const: confirmation })),
        items: false,
        minItems: narrationFullListenConfirmations.length,
        maxItems: narrationFullListenConfirmations.length,
      },
    },
  })
}

export function buildNarrationFullListenPackage(
  candidate: ReviewCandidate,
  sources: readonly NarrationReviewSourcePassage[] = currentNarrationReviewSources(),
): NarrationFullListenPackage {
  assertSafeText(candidate.releaseId, 'Narration release id')
  if (!/^[a-z0-9-]+-[a-f0-9]{64}$/.test(candidate.releaseId)) throw new Error('Narration release id is unsafe for a review directory.')
  assertDigest(candidate.configurationHash, 'Narration configuration hash')
  assertDigest(candidate.manuscriptHash, 'Narration manuscript hash')
  assertDigest(candidate.pilotProfileHash, 'Narration pilot profile hash')
  if (!Number.isFinite(candidate.totalDurationSeconds) || candidate.totalDurationSeconds <= 0) throw new Error('Narration review has an invalid total duration.')

  const passages = orderedPassages(candidate, sources)
  const measuredTotal = Number(passages.reduce((total, passage) => total + passage.durationSeconds, 0).toFixed(3))
  if (Math.abs(measuredTotal - candidate.totalDurationSeconds) > 0.01) throw new Error('Narration review total duration is inconsistent.')
  const manifest: NarrationFullListenManifest = {
    schemaVersion: 1,
    kind: 'narration-full-listen',
    releaseId: candidate.releaseId,
    edition: candidate.edition,
    disclosure: candidate.disclosure,
    configurationHash: candidate.configurationHash,
    manuscriptHash: candidate.manuscriptHash,
    pilotProfileHash: candidate.pilotProfileHash,
    passageCount: candidate.passageCount,
    totalDurationSeconds: candidate.totalDurationSeconds,
    orderedPassageProfileSha256: orderedPassageProfileSha256(passages),
    attentionSummary: attentionSummary(passages),
    humanListeningRequired: true,
    passages,
  }
  const manifestBytes = canonicalJson(manifest)
  const playlistBytes = playlist(passages, candidate.releaseId)
  const checklistBytes = checklist(manifest)
  const receiptSchemaBytes = receiptSchema({
    schemaVersion: 1,
    kind: 'narration-full-listen-receipt',
    releaseId: candidate.releaseId,
    reviewManifestSha256: narrationReviewSha256(manifestBytes),
    orderedPassageProfileSha256: manifest.orderedPassageProfileSha256,
    passageCount: manifest.passageCount,
    confirmations: [...narrationFullListenConfirmations],
  })
  const checksums = [
    `${narrationReviewSha256(manifestBytes)}  manifest.json`,
    `${narrationReviewSha256(playlistBytes)}  listen.m3u8`,
    `${narrationReviewSha256(checklistBytes)}  CHECKLIST.md`,
    `${narrationReviewSha256(receiptSchemaBytes)}  receipt.schema.json`,
    ...passages.map((passage) => `${passage.audioSha256}  ${reviewRelativeAudioPath(passage.url, passage.audioSha256)}`),
  ]
  const checksumBytes = `${checksums.join('\n')}\n`
  const expectedReceipt: Omit<NarrationFullListenReceipt, 'completedAt' | 'completedBy'> = {
    schemaVersion: 1,
    kind: 'narration-full-listen-receipt',
    releaseId: candidate.releaseId,
    reviewManifestSha256: narrationReviewSha256(manifestBytes),
    packageChecksumsSha256: narrationReviewSha256(checksumBytes),
    orderedPassageProfileSha256: manifest.orderedPassageProfileSha256,
    passageCount: manifest.passageCount,
    confirmations: [...narrationFullListenConfirmations],
  }
  return {
    directoryName: candidate.releaseId,
    manifest,
    expectedReceipt,
    files: {
      'manifest.json': manifestBytes,
      'checksums.sha256': checksumBytes,
      'listen.m3u8': playlistBytes,
      'CHECKLIST.md': checklistBytes,
      'receipt.schema.json': receiptSchemaBytes,
    },
  }
}

export function createNarrationFullListenReceipt(
  expected: Omit<NarrationFullListenReceipt, 'completedAt' | 'completedBy'>,
  completedBy: string,
  completedAt = new Date().toISOString(),
): NarrationFullListenReceipt {
  if (!completedBy.trim()) throw new Error('A non-empty full-listen listener name is required.')
  if (!isExactIsoTimestamp(completedAt)) throw new Error('The full-listen completion time is invalid.')
  return { ...expected, completedAt, completedBy: completedBy.trim() }
}

export function narrationFullListenReceiptProblems(
  receipt: unknown,
  expected: Omit<NarrationFullListenReceipt, 'completedAt' | 'completedBy'>,
) {
  const problems: string[] = []
  if (!receipt || typeof receipt !== 'object') return ['full-listen receipt is missing or is not an object']
  const candidate = receipt as Partial<NarrationFullListenReceipt>
  const expectedKeys = [
    'completedAt',
    'completedBy',
    'confirmations',
    'kind',
    'orderedPassageProfileSha256',
    'packageChecksumsSha256',
    'passageCount',
    'releaseId',
    'reviewManifestSha256',
    'schemaVersion',
  ]
  if (JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(expectedKeys)) problems.push('full-listen receipt schema has missing or unexpected fields')
  for (const key of ['schemaVersion', 'kind', 'releaseId', 'reviewManifestSha256', 'packageChecksumsSha256', 'orderedPassageProfileSha256', 'passageCount'] as const) {
    if (candidate[key] !== expected[key]) problems.push(`full-listen receipt ${key} does not match the exact review package`)
  }
  if (!isExactIsoTimestamp(candidate.completedAt)) problems.push('full-listen receipt completion time is invalid')
  if (typeof candidate.completedBy !== 'string' || !candidate.completedBy.trim()) problems.push('full-listen receipt listener is missing')
  if (
    !Array.isArray(candidate.confirmations)
    || candidate.confirmations.length !== expected.confirmations.length
    || candidate.confirmations.some((confirmation, index) => confirmation !== expected.confirmations[index])
  ) problems.push('full-listen receipt confirmation is incomplete or altered')
  return problems
}

export function narrationFullListenApprovalEvidence(receipt: NarrationFullListenReceipt): NarrationFullListenApprovalEvidence {
  return {
    receiptSha256: narrationReviewSha256(narrationFullListenReceiptMaterial(receipt)),
    receipt,
  }
}

export function narrationFullListenApprovalEvidenceProblems(
  evidence: unknown,
  expected: Omit<NarrationFullListenReceipt, 'completedAt' | 'completedBy'>,
) {
  if (!evidence || typeof evidence !== 'object') return ['full-listen approval evidence is missing']
  const candidate = evidence as Partial<NarrationFullListenApprovalEvidence>
  const problems = narrationFullListenReceiptProblems(candidate.receipt, expected)
  if (!candidate.receipt || candidate.receiptSha256 !== narrationReviewSha256(narrationFullListenReceiptMaterial(candidate.receipt))) {
    problems.push('full-listen receipt checksum is invalid')
  }
  return problems
}

function releaseUrlToRepositoryPath(url: string, label: string) {
  assertSafeText(url, label)
  if (!url.startsWith('/audio/narration/') || url.includes('\\')) throw new Error(`${label} is outside the narration asset directory.`)
  const relativeUrl = url.slice(1)
  if (relativeUrl.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${label} contains an unsafe path segment.`)
  }
  return `public/${relativeUrl}`
}

export function narrationReleaseStagingPaths(manifest: NarrationManifest, assetDirectory: string) {
  assertSafeText(manifest.releaseId, 'Narration release id')
  assertSafeText(assetDirectory, 'Narration edition asset directory')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(assetDirectory)) throw new Error('Narration edition asset directory is unsafe.')
  if (manifest.approved !== true || !manifest.approval) throw new Error('Only an approved narration release can be staged.')
  const expectedVersionedPath = `public/audio/narration/releases/${manifest.releaseId}.json`
  const versionedPath = releaseUrlToRepositoryPath(manifest.releaseManifestUrl, 'Narration release manifest URL')
  if (versionedPath !== expectedVersionedPath) throw new Error('Narration versioned manifest path does not match its release id.')
  if (manifest.passageCount !== manifest.passages.length || manifest.passages.length === 0) throw new Error('Narration release passage list is incomplete.')
  const paths = [
    'public/audio/narration/manifest.json',
    versionedPath,
    ...manifest.passages.map((entry) => {
      assertDigest(entry.sha256, `Narration passage ${entry.id} audio hash`)
      const match = entry.url.match(new RegExp(`^/audio/narration/${assetDirectory}/(\\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*-([a-f0-9]{64})\\.mp3)$`))
      if (!match || match[2] !== entry.sha256) throw new Error(`Narration passage ${entry.id} has an unsafe or mismatched asset URL.`)
      const audioPath = releaseUrlToRepositoryPath(entry.url, `Narration passage ${entry.id} audio URL`)
      return audioPath
    }),
  ]
  if (new Set(paths).size !== paths.length) throw new Error('Narration release staging paths are not unique.')
  return paths
}

export function narrationUnexpectedStagedPaths(plannedPaths: readonly string[], stagedPaths: readonly string[]) {
  const planned = new Set(plannedPaths)
  return stagedPaths.filter((filePath) => filePath.startsWith('public/audio/narration/') && !planned.has(filePath))
}
