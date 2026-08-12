import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { narrationPassageNormalisationOverrides } from '../src/data/narrationEdition'
import {
  narrationFullListenConfirmations,
  narrationFullListenReceiptMaterial,
  type NarrationFullListenReceipt,
  type NarrationManifest,
  type NarrationManifestEntry,
} from '../src/lib/narrationRelease'
import {
  buildNarrationFullListenPackage,
  createNarrationFullListenReceipt,
  currentNarrationReviewSources,
  narrationFullListenApprovalEvidence,
  narrationFullListenApprovalEvidenceProblems,
  narrationFullListenReceiptProblems,
  narrationReviewAttentionFlags,
  narrationReleaseStagingPaths,
  narrationUnexpectedStagedPaths,
  type NarrationReviewSourcePassage,
} from './narration-review-contract'
import { assertNarrationStagingRegularFiles } from './stage-narration-release'
import { resolveAudioPath } from './verify-narration'

const releaseId = `2026-2-${'a'.repeat(64)}`
const assetDirectory = 'edition-2026-2'

function entry(ordinal: number, id: string, textHash: string, audioHash: string): NarrationManifestEntry {
  return {
    id,
    sectionId: `section-${ordinal}`,
    targetId: `target-${ordinal}`,
    textHash,
    url: `/audio/narration/${assetDirectory}/${String(ordinal).padStart(4, '0')}-${id}-${audioHash}.mp3`,
    sha256: audioHash,
    durationSeconds: ordinal * 10,
    generatedAt: '2026-08-11T00:00:00.000Z',
    qcStatus: 'technical-qc-passed',
    technicalQc: {
      durationExpectedSeconds: ordinal * 10,
      durationMeasuredSeconds: ordinal * 10,
      wordsPerMinute: 140,
      integratedLoudnessLufs: -18,
      loudnessRangeLu: 3,
      truePeakDbtp: -2,
      leadingSilenceSeconds: 0.08,
      trailingSilenceSeconds: 0.18,
      normalisationVersion: 'normalisation-v1',
      fullDecodePassed: true,
    },
  }
}

function release(): NarrationManifest {
  const passages = [
    entry(1, 'first-passage', '1'.repeat(64), '3'.repeat(64)),
    entry(2, 'second-passage', '2'.repeat(64), '4'.repeat(64)),
  ]
  const receipt: NarrationFullListenReceipt = {
    schemaVersion: 1 as const,
    kind: 'narration-full-listen-receipt' as const,
    releaseId,
    reviewManifestSha256: '8'.repeat(64),
    packageChecksumsSha256: '9'.repeat(64),
    orderedPassageProfileSha256: 'a'.repeat(64),
    passageCount: passages.length,
    completedAt: '2026-08-11T00:00:00.000Z',
    completedBy: 'Listener',
    confirmations: [...narrationFullListenConfirmations],
  }
  return {
    schemaVersion: 1,
    releaseId,
    releaseManifestUrl: `/audio/narration/releases/${releaseId}.json`,
    edition: '2026.2',
    model: 'pinned-model',
    voice: 'bf_emma',
    provenance: {} as NarrationManifest['provenance'],
    disclosure: 'AI-generated recorded narration.',
    configurationHash: '5'.repeat(64),
    manuscriptHash: '6'.repeat(64),
    pilotProfileHash: '7'.repeat(64),
    pilotReceipt: {} as NarrationManifest['pilotReceipt'],
    generatedAt: '2026-08-11T00:00:00.000Z',
    generationScope: { mode: 'full', requestedPassageCount: passages.length },
    complete: true,
    approved: true,
    approval: {
      approvedAt: '2026-08-11T01:00:00.000Z',
      approvedBy: 'Editor',
      checklistVersion: 'checklist-v1',
      confirmations: ['confirmed'],
      fullListen: {
        receiptSha256: createHash('sha256').update(narrationFullListenReceiptMaterial(receipt)).digest('hex'),
        receipt,
      },
    },
    passageCount: passages.length,
    totalDurationSeconds: 30,
    passages,
  }
}

function reviewSources(manifest: NarrationManifest): NarrationReviewSourcePassage[] {
  return manifest.passages.map((passage, index) => ({
    id: passage.id,
    visibleText: index === 0 ? 'First visible passage.' : 'Second visible passage.',
    spokenText: index === 0 ? 'First visible passage.' : 'Second visible passage.',
    readingNote: '',
    spokenReplacements: [],
  }))
}

function reviewPackage(manifest: NarrationManifest, sources = reviewSources(manifest)) {
  return buildNarrationFullListenPackage(manifest, sources)
}

describe('checksum-bound full-listen contract', () => {
  it('builds deterministic review files bound to ordered passage ids, text and audio hashes', () => {
    const first = release()
    const firstPackage = reviewPackage(first)
    const administrativelyUpdated = release()
    administrativelyUpdated.generatedAt = '2030-01-01T00:00:00.000Z'
    const repeated = reviewPackage(administrativelyUpdated)
    expect(repeated).toEqual(firstPackage)
    expect(firstPackage.directoryName).toBe(releaseId)
    expect(firstPackage.files['listen.m3u8'].indexOf('first-passage')).toBeLessThan(
      firstPackage.files['listen.m3u8'].indexOf('second-passage'),
    )
    expect(firstPackage.files['checksums.sha256'].trim().split('\n')).toHaveLength(first.passageCount + 4)
    expect(firstPackage.files['receipt.schema.json']).toContain(firstPackage.expectedReceipt.orderedPassageProfileSha256)

    const reordered = release()
    reordered.passages.reverse()
    expect(reviewPackage(reordered).manifest.orderedPassageProfileSha256)
      .not.toBe(firstPackage.manifest.orderedPassageProfileSha256)

    const changedText = release()
    changedText.passages[0] = { ...changedText.passages[0]!, textHash: '8'.repeat(64) }
    expect(reviewPackage(changedText).manifest.orderedPassageProfileSha256)
      .not.toBe(firstPackage.manifest.orderedPassageProfileSha256)

    const changedAudio = release()
    changedAudio.passages[0] = {
      ...changedAudio.passages[0]!,
      sha256: '9'.repeat(64),
      url: `/audio/narration/${assetDirectory}/0001-first-passage-${'9'.repeat(64)}.mp3`,
    }
    expect(reviewPackage(changedAudio).manifest.orderedPassageProfileSha256)
      .not.toBe(firstPackage.manifest.orderedPassageProfileSha256)
  })

  it('binds visible text, exact speech input, reading direction, replacements and attention inventory', () => {
    const manifest = release()
    const sources = reviewSources(manifest)
    sources[0] = {
      id: manifest.passages[0]!.id,
      visibleText: 'A and A.',
      spokenText: 'Ay and Ay.',
      readingNote: 'Keep both letter names distinct.',
      spokenReplacements: [{ from: 'A', to: 'Ay', expectedOccurrences: 2 }],
    }
    const packageWithDirection = reviewPackage(manifest, sources)
    const first = packageWithDirection.manifest.passages[0]!
    expect(first).toMatchObject({
      visibleText: 'A and A.',
      spokenText: 'Ay and Ay.',
      readingNote: 'Keep both letter names distinct.',
      spokenReplacements: [{ from: 'A', to: 'Ay', expectedOccurrences: 2 }],
    })
    expect(first.attentionFlags.map(({ code }) => code)).toEqual([
      'reading-note',
      'spoken-normalisation',
      'complex-spoken-normalisation',
    ])
    expect(packageWithDirection.manifest.attentionSummary).toMatchObject({
      attentionPassageCount: 1,
      readingNotePassages: 1,
      spokenNormalisationPassages: 1,
      complexSpokenNormalisationPassages: 1,
    })
    expect(packageWithDirection.files['CHECKLIST.md']).toContain('## Priority attention')
    expect(packageWithDirection.files['CHECKLIST.md']).toContain('Keep both letter names distinct.')
    expect(packageWithDirection.files['CHECKLIST.md']).toContain('"A" → "Ay" × 2')

    const changedDirection = sources.map((source) => ({ ...source, spokenReplacements: source.spokenReplacements.map((rule) => ({ ...rule })) }))
    changedDirection[0] = { ...changedDirection[0]!, readingNote: 'A different exact reading direction.' }
    expect(reviewPackage(manifest, changedDirection).manifest.orderedPassageProfileSha256)
      .not.toBe(packageWithDirection.manifest.orderedPassageProfileSha256)
  })

  it('fails closed when exact spoken text and the declared replacement plan diverge', () => {
    const manifest = release()
    const sources = reviewSources(manifest)
    sources[0] = {
      id: manifest.passages[0]!.id,
      visibleText: 'A and A.',
      spokenText: 'A and A.',
      readingNote: '',
      spokenReplacements: [{ from: 'A', to: 'Ay', expectedOccurrences: 2 }],
    }
    expect(() => reviewPackage(manifest, sources)).toThrow(/spoken text does not match/)
    sources[0] = { ...sources[0], spokenText: 'Ay and Ay.', spokenReplacements: [{ from: 'A', to: 'Ay', expectedOccurrences: 1 }] }
    expect(() => reviewPackage(manifest, sources)).toThrow(/expected 1 occurrence.*found 2/)
  })

  it('automatically prioritises low-level and near-CPS-bound passages', () => {
    const manifest = release()
    const first = manifest.passages[0]!
    manifest.passages[0] = {
      ...first,
      durationSeconds: 5.05,
      technicalQc: {
        ...first.technicalQc,
        durationMeasuredSeconds: 5.05,
        integratedLoudnessLufs: -20.6,
      },
    }
    manifest.totalDurationSeconds = 25.05
    const sources = reviewSources(manifest)
    sources[0] = { ...sources[0]!, visibleText: 'x'.repeat(100), spokenText: 'x'.repeat(100) }
    const attentionPackage = reviewPackage(manifest, sources)
    expect(attentionPackage.manifest.passages[0]!.attentionFlags.map(({ code }) => code)).toEqual([
      'below-ordinary-loudness-floor',
      'near-character-pacing-bound',
    ])
    expect(attentionPackage.manifest.attentionSummary).toMatchObject({
      priorityPassageCount: 1,
      belowOrdinaryLoudnessFloorPassages: 1,
      nearCharacterPacingBoundPassages: 1,
    })
    expect(attentionPackage.files['CHECKLIST.md']).toContain('Measured integrated loudness -20.6 LUFS')
    expect(attentionPackage.files['CHECKLIST.md']).toContain('near a CPS bound: 1')
  })

  it('prioritises every passage-local mastering override with method-specific continuity and artefact checks', () => {
    const manifest = release()
    const currentSources = currentNarrationReviewSources()
    const cases = [
      {
        id: 'passage:access-restoration-agency:block-2-heading',
        method: 'codec-compensated-single-pass-loudnorm',
        version: 'loudnorm-codec-compensated-single-pass-2026.2-24khz-48kbps',
        phrases: ['-1.25 dBTP', 'both adjacent hand-offs', 'codec ringing', 'softened consonant attacks'],
      },
      {
        id: 'passage:air-again:block-5-heading',
        method: 'post-normalisation-gain-limiter',
        version: 'loudnorm-post-gain-limiter-2026.2-24khz-48kbps',
        phrases: ['2.0 dB', 'limit=0.8413951416451951', 'attack=5 ms', 'release=50 ms', 'pumping'],
      },
    ] as const
    expect(cases.map(({ id }) => id).sort()).toEqual(Object.keys(narrationPassageNormalisationOverrides).sort())
    const sources = cases.map(({ id }) => {
      const source = currentSources.find((candidate) => candidate.id === id)
      expect(source).toBeDefined()
      return source!
    })
    for (const [index, item] of cases.entries()) {
      const passage = manifest.passages[index]!
      passage.id = item.id
      passage.technicalQc.normalisationVersion = item.version
    }

    const masteringPackage = reviewPackage(manifest, sources)
    for (const [index, item] of cases.entries()) {
      const flags = masteringPackage.manifest.passages[index]!.attentionFlags
      expect(flags.map(({ code }) => code)).toEqual(['passage-normalisation-override'])
      expect(flags[0]).toMatchObject({ priority: 'priority' })
      expect(flags[0]!.rationale).toContain(item.method)
      expect(flags[0]!.rationale).toContain(item.version)
      for (const phrase of item.phrases) expect(flags[0]!.rationale).toContain(phrase)
    }
    expect(masteringPackage.manifest.attentionSummary).toMatchObject({
      attentionPassageCount: 2,
      flagCount: 2,
      priorityPassageCount: 2,
      passageNormalisationOverridePassages: 2,
    })
    expect(masteringPackage.files['CHECKLIST.md']).toContain('passage-local mastering overrides: 2')
    expect(masteringPackage.files['CHECKLIST.md']).toContain('mandatory transition check')
    expect(masteringPackage.files['CHECKLIST.md']).toContain(cases[0].version)
    expect(masteringPackage.files['CHECKLIST.md']).toContain(cases[1].version)
  })

  it('retains the audited 68/53/32 direction inventory and all seven known QC passage flags', () => {
    const sources = currentNarrationReviewSources()
    expect(sources.filter(({ readingNote }) => Boolean(readingNote))).toHaveLength(68)
    expect(sources.filter(({ spokenReplacements }) => spokenReplacements.length > 0)).toHaveLength(53)
    expect(sources.filter(({ spokenReplacements }) => (
      spokenReplacements.length > 1 || spokenReplacements.some(({ expectedOccurrences }) => (expectedOccurrences ?? 1) > 1)
    ))).toHaveLength(32)
    expect(sources.find(({ id }) => id === 'passage:fdn-disturbance-world:block-4-list-item-1')?.spokenReplacements[0]).toEqual({
      from: 'v = fλ',
      to: 'vee equals eff lambda',
    })

    const known = [
      { ordinal: 46, id: 'passage:fdn-string-tension:block-4-list-item-3', code: 'known-qc-46', duration: 6.904, wpm: 182.5, lufs: -19.1, peak: -2.6, phrase: 'pacing audit' },
      { ordinal: 56, id: 'passage:fdn-rooms-membranes-resonances:block-1-heading', code: 'known-qc-56', duration: 3.316, wpm: 235.2, lufs: -18.4, peak: -2.6, phrase: 'short function words' },
      { ordinal: 86, id: 'passage:fdn-music-before-machines:block-11-list-item-2', code: 'known-qc-86', duration: 5.037, wpm: 190.6, lufs: -19.3, peak: -2.4, phrase: 'upper bound' },
      { ordinal: 146, id: 'passage:fdn-machines-imagine-speech:block-12-list-item-0', code: 'known-qc-146', duration: 2.361, wpm: 177.9, lufs: -21.2, peak: -2.5, phrase: 'peak-limited' },
      { ordinal: 385, id: 'passage:templates-to-probabilities:block-2-heading', code: 'known-qc-385', duration: 2.706, wpm: 221.7, lufs: -19.2, peak: -2.4, phrase: 'visible question was reordered' },
      { ordinal: 453, id: 'passage:conversation-becomes-stream:block-2-heading', code: 'known-qc-453', duration: 2.991, wpm: 220.7, lufs: -18.4, peak: -2.7, phrase: 'speak-and-wait contrast' },
      { ordinal: 506, id: 'passage:air-again:block-2-heading', code: 'known-qc-506', duration: 3.039, wpm: 177.7, lufs: -18.9, peak: -2.5, phrase: 'audible two-beat thesis question' },
    ] as const
    for (const item of known) {
      const source = sources[item.ordinal - 1]!
      expect(source.id).toBe(item.id)
      const reviewEntry = entry(item.ordinal, 'known-qc-passage', '1'.repeat(64), '3'.repeat(64))
      reviewEntry.id = item.id
      reviewEntry.durationSeconds = item.duration
      reviewEntry.technicalQc = {
        ...reviewEntry.technicalQc,
        durationMeasuredSeconds: item.duration,
        wordsPerMinute: item.wpm,
        integratedLoudnessLufs: item.lufs,
        truePeakDbtp: item.peak,
      }
      const flag = narrationReviewAttentionFlags(reviewEntry, source, item.ordinal).find(({ code }) => code === item.code)
      expect(flag?.priority).toBe('priority')
      expect(flag?.rationale).toContain(item.phrase)
    }
  })

  it('rejects unsafe, duplicate and non-checksum-addressed review entries', () => {
    const traversal = release()
    traversal.passages[0] = {
      ...traversal.passages[0]!,
      url: `/audio/narration/${assetDirectory}/../edition-2026-1/0001-first-passage-${'3'.repeat(64)}.mp3`,
    }
    expect(() => reviewPackage(traversal)).toThrow(/unsafe audio URL/)

    const wrongHash = release()
    wrongHash.passages[0] = { ...wrongHash.passages[0]!, sha256: '9'.repeat(64) }
    expect(() => reviewPackage(wrongHash)).toThrow(/unsafe audio URL/)

    const duplicate = release()
    duplicate.passages[1] = { ...duplicate.passages[1]!, id: duplicate.passages[0]!.id }
    expect(() => reviewPackage(duplicate)).toThrow(/duplicate passage id/)
  })

  it('accepts only a canonical human receipt for the exact package and confirmation order', () => {
    const exactPackage = reviewPackage(release())
    const receipt = createNarrationFullListenReceipt(
      exactPackage.expectedReceipt,
      '  Listening editor  ',
      '2026-08-11T02:00:00.000Z',
    )
    expect(receipt.completedBy).toBe('Listening editor')
    expect(narrationFullListenReceiptProblems(receipt, exactPackage.expectedReceipt)).toEqual([])
    expect(narrationFullListenApprovalEvidenceProblems(
      narrationFullListenApprovalEvidence(receipt),
      exactPackage.expectedReceipt,
    )).toEqual([])

    expect(narrationFullListenReceiptProblems({ ...receipt, releaseId: `2026-2-${'b'.repeat(64)}` }, exactPackage.expectedReceipt))
      .toContain('full-listen receipt releaseId does not match the exact review package')
    expect(narrationFullListenReceiptProblems({ ...receipt, completedAt: 'not-a-time' }, exactPackage.expectedReceipt))
      .toContain('full-listen receipt completion time is invalid')
    expect(narrationFullListenReceiptProblems({ ...receipt, completedBy: '   ' }, exactPackage.expectedReceipt))
      .toContain('full-listen receipt listener is missing')
    expect(narrationFullListenReceiptProblems({ ...receipt, confirmations: [...receipt.confirmations].reverse() }, exactPackage.expectedReceipt))
      .toContain('full-listen receipt confirmation is incomplete or altered')
    expect(narrationFullListenReceiptProblems({ ...receipt, unexpected: true }, exactPackage.expectedReceipt))
      .toContain('full-listen receipt schema has missing or unexpected fields')

    const reordered = release()
    reordered.passages.reverse()
    const receiptForDifferentOrder = createNarrationFullListenReceipt(
      reviewPackage(reordered).expectedReceipt,
      'Listening editor',
      '2026-08-11T02:00:00.000Z',
    )
    expect(narrationFullListenReceiptProblems(receiptForDifferentOrder, exactPackage.expectedReceipt))
      .toContain('full-listen receipt orderedPassageProfileSha256 does not match the exact review package')

    const changedReceipt = { ...receipt, completedBy: 'Someone else' }
    const staleEvidence = narrationFullListenApprovalEvidence(receipt)
    staleEvidence.receipt = changedReceipt
    expect(narrationFullListenApprovalEvidenceProblems(staleEvidence, exactPackage.expectedReceipt))
      .toContain('full-listen receipt checksum is invalid')
  })
})

describe('exact narration release staging contract', () => {
  it('resolves only an exact current-edition checksum-addressed audio filename', () => {
    const valid = release().passages[0]!
    expect(resolveAudioPath(valid)).toContain(`/public/audio/narration/${assetDirectory}/0001-first-passage-`)
    const unsafeUrls = [
      `/audio/narration/${assetDirectory}/../edition-2026-1/0001-first-passage-${'3'.repeat(64)}.mp3`,
      `/audio/narration/${assetDirectory}/0001-first-passage-${'9'.repeat(64)}.mp3`,
      `/audio/narration/edition-2026-1/0001-first-passage-${'3'.repeat(64)}.mp3`,
    ]
    for (const url of unsafeUrls) {
      expect(() => resolveAudioPath({ ...valid, url })).toThrow(/unexpected or non-checksum-addressed/)
    }
  })

  it('derives only the pointer, immutable manifest and ordered referenced audio', () => {
    const manifest = release()
    const paths = narrationReleaseStagingPaths(manifest, assetDirectory)
    expect(paths).toEqual([
      'public/audio/narration/manifest.json',
      `public/audio/narration/releases/${releaseId}.json`,
      `public/audio/narration/${assetDirectory}/0001-first-passage-${'3'.repeat(64)}.mp3`,
      `public/audio/narration/${assetDirectory}/0002-second-passage-${'4'.repeat(64)}.mp3`,
    ])
    expect(paths).toHaveLength(manifest.passageCount + 2)
    expect(narrationUnexpectedStagedPaths(paths, [
      ...paths,
      'public/audio/narration/.DS_Store',
      `public/audio/narration/edition-2026-1/stale-${'8'.repeat(64)}.mp3`,
      'src/App.tsx',
    ])).toEqual([
      'public/audio/narration/.DS_Store',
      `public/audio/narration/edition-2026-1/stale-${'8'.repeat(64)}.mp3`,
    ])
  })

  it('rejects unapproved releases and every non-literal or mismatched asset path', () => {
    const unapproved = release()
    unapproved.approved = false
    unapproved.approval = null
    expect(() => narrationReleaseStagingPaths(unapproved, assetDirectory)).toThrow(/Only an approved/)

    const unsafeUrls = [
      `/audio/narration/${assetDirectory}/../edition-2026-1/0001-first-passage-${'3'.repeat(64)}.mp3`,
      `/audio/narration/${assetDirectory}\\0001-first-passage-${'3'.repeat(64)}.mp3`,
      `/audio/narration/${assetDirectory}/0001-first%2dpassage-${'3'.repeat(64)}.mp3`,
      `/audio/narration/${assetDirectory}/0001-first-passage-${'3'.repeat(64)}.mp3?download=1`,
      `/audio/narration/edition-2026-1/0001-first-passage-${'3'.repeat(64)}.mp3`,
      `/audio/narration/${assetDirectory}/0001-first-passage-${'9'.repeat(64)}.mp3`,
    ]
    for (const url of unsafeUrls) {
      const manifest = release()
      manifest.passages[0] = { ...manifest.passages[0]!, url }
      expect(() => narrationReleaseStagingPaths(manifest, assetDirectory)).toThrow(/unsafe or mismatched asset URL/)
    }
  })

  it('refuses missing files, symlinks and repository escapes before staging', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'narration-stage-contract-'))
    try {
      await fs.mkdir(path.join(root, 'assets'))
      await fs.writeFile(path.join(root, 'assets/audio.mp3'), 'audio')
      await fs.symlink(path.join(root, 'assets/audio.mp3'), path.join(root, 'assets/link.mp3'))
      await expect(assertNarrationStagingRegularFiles(root, ['assets/audio.mp3'])).resolves.toBeUndefined()
      await expect(assertNarrationStagingRegularFiles(root, ['assets/missing.mp3'])).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(assertNarrationStagingRegularFiles(root, ['assets/link.mp3'])).rejects.toThrow(/not a regular/)
      await expect(assertNarrationStagingRegularFiles(root, ['../escape.mp3'])).rejects.toThrow(/escapes the repository/)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
