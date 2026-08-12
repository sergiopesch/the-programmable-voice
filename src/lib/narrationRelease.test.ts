import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  narrationApprovalChecklistVersion,
  narrationComparisonApprovalChecklistVersion,
  narrationComparisonApprovalConfirmations,
  narrationGenerationProvenance,
  narrationPilotApprovalConfirmations,
  narrationReleaseApprovalConfirmations,
} from '../data/narrationEdition'
import {
  narrationComparisonApprovalIsComplete,
  narrationComparisonProfileMaterial,
  narrationFullListenConfirmations,
  narrationFullListenReceiptMaterial,
  narrationPilotApprovalIsComplete,
  narrationPilotProfileMaterial,
  narrationReleaseApprovalIsComplete,
  narrationReleaseId,
  narrationReleaseIdentityMaterial,
  narrationReleaseManifestUrl,
  type NarrationApproval,
  type NarrationManifest,
  type NarrationComparisonApproval,
  type NarrationComparisonManifest,
  type NarrationPilotApproval,
  type NarrationFullListenReceipt,
} from './narrationRelease'

function comparisonManifest(): NarrationComparisonManifest {
  const technicalQc = {
    durationSeconds: 40,
    wordsPerMinute: 140,
    integratedLoudnessLufs: -18,
    loudnessRangeLu: 4,
    truePeakDbtp: -2,
    sampleRateHz: 44_100,
    channels: 1,
    bitrateKbps: 128,
    fullDecodePassed: true as const,
  }
  return {
    schemaVersion: 2,
    comparisonId: 'british-voice-comparison-2026-08-11-aaaaaaaaaa',
    generatedAt: '2026-08-11T00:00:00.000Z',
    disclosure: 'AI-generated.',
    edition: '2026.1',
    model: 'pinned-model',
    configurationHash: 'a'.repeat(64),
    manuscriptHash: 'b'.repeat(64),
    provisionalProductionVoice: 'shimmer',
    voiceProfile: 'warm British documentary narrator',
    instructions: 'Read exactly in modern Standard Southern British English.',
    responseFormat: 'mp3',
    speechSpeed: 1,
    normalisation: {
      version: 'loudnorm-2026.1',
      integratedLoudnessLufs: -18,
      loudnessRangeLu: 7,
      truePeakDbtp: -2,
      sampleRateHz: 44_100,
      channels: 1,
      bitrateKbps: 128,
    },
    passage: { id: 'passage:opening:block-1-paragraph', text: 'The same exact passage.', sha256: 'c'.repeat(64) },
    candidates: [
      { label: 'A', voice: 'shimmer', filename: `candidate-a-${'d'.repeat(64)}.mp3`, sha256: 'd'.repeat(64), technicalQc },
      { label: 'B', voice: 'nova', filename: `candidate-b-${'e'.repeat(64)}.mp3`, sha256: 'e'.repeat(64), technicalQc: { ...technicalQc } },
    ],
    comparisonProfileHash: 'f'.repeat(64),
    humanApprovalRequired: true,
    approvalCriteria: ['human listening required'],
  }
}

function identityFields(): Omit<NarrationManifest, 'releaseId' | 'releaseManifestUrl' | 'approved' | 'approval'> {
  const passage = {
    id: 'passage:opening:section-title',
    sectionId: 'opening',
    targetId: 'narration-opening-header',
    textHash: 'd'.repeat(64),
    url: `/audio/narration/edition-2026-1/0001-${'e'.repeat(64)}.mp3`,
    sha256: 'e'.repeat(64),
    durationSeconds: 10,
    generatedAt: '2026-08-11T00:00:00.000Z',
    qcStatus: 'technical-qc-passed' as const,
    technicalQc: {
      durationExpectedSeconds: 10,
      durationMeasuredSeconds: 10,
      wordsPerMinute: 145,
      integratedLoudnessLufs: -18,
      loudnessRangeLu: 3,
      truePeakDbtp: -2,
      leadingSilenceSeconds: 0.08,
      trailingSilenceSeconds: 0.18,
      normalisationVersion: 'loudnorm-2026.1',
      fullDecodePassed: true as const,
    },
  }
  const pilotManifest = {
    schemaVersion: 1 as const,
    edition: '2026.1',
    model: 'pinned-model',
    voice: 'fixed-voice',
    provenance: narrationGenerationProvenance,
    configurationHash: 'a'.repeat(64),
    manuscriptHash: 'b'.repeat(64),
    generatedAt: '2026-08-11T00:00:00.000Z',
    complete: true,
    passageCount: 1,
    passages: [passage],
  }
  const pilotProfileHash = createHash('sha256').update(narrationPilotProfileMaterial(pilotManifest)).digest('hex')
  return {
    schemaVersion: 1,
    edition: '2026.1',
    model: 'pinned-model',
    voice: 'fixed-voice',
    provenance: narrationGenerationProvenance,
    disclosure: 'AI-generated.',
    configurationHash: 'a'.repeat(64),
    manuscriptHash: 'b'.repeat(64),
    pilotProfileHash,
    pilotReceipt: {
      manifest: pilotManifest,
      approval: {
        schemaVersion: 1,
        approvedAt: '2026-08-11T00:00:00.000Z',
        approvedBy: 'Editorial QA',
        checklistVersion: narrationApprovalChecklistVersion,
        configurationHash: 'a'.repeat(64),
        manuscriptHash: 'b'.repeat(64),
        pilotProfileHash,
        passageIds: [passage.id],
        confirmations: narrationPilotApprovalConfirmations.map(({ label }) => label),
      },
    },
    generatedAt: '2026-08-11T00:00:00.000Z',
    generationScope: { mode: 'full', requestedPassageCount: 1 },
    complete: true,
    passageCount: 1,
    totalDurationSeconds: 10,
    passages: [passage],
  }
}

describe('narration release contracts', () => {
  it('derives an edition-scoped immutable URL from a content digest', () => {
    const digest = 'f'.repeat(64)
    const releaseId = narrationReleaseId('2026.1', digest)
    expect(releaseId).toBe(`2026-1-${digest}`)
    expect(narrationReleaseManifestUrl(releaseId)).toBe(`/audio/narration/releases/${releaseId}.json`)
  })

  it('keeps timestamps and editorial approval outside the content identity', () => {
    const first = identityFields()
    const later = { ...identityFields(), generatedAt: '2027-01-01T00:00:00.000Z' }
    expect(narrationReleaseIdentityMaterial(first)).toBe(narrationReleaseIdentityMaterial(later))

    const changedAsset = identityFields()
    changedAsset.passages[0] = { ...changedAsset.passages[0]!, sha256: '9'.repeat(64) }
    expect(narrationReleaseIdentityMaterial(changedAsset)).not.toBe(narrationReleaseIdentityMaterial(first))

    const changedProvenance = {
      ...identityFields(),
      provenance: { ...narrationGenerationProvenance, modelRevision: '0'.repeat(40) },
    }
    expect(narrationReleaseIdentityMaterial(changedProvenance)).not.toBe(narrationReleaseIdentityMaterial(first))

    const changedPilotReceipt = identityFields()
    changedPilotReceipt.pilotReceipt.approval = {
      ...changedPilotReceipt.pilotReceipt.approval,
      approvedBy: 'Another editor',
    }
    expect(narrationReleaseIdentityMaterial(changedPilotReceipt)).not.toBe(narrationReleaseIdentityMaterial(first))
  })

  it('binds comparison approval to the voice profile and ordered audio, not the provisional voice or unrelated manuscript', () => {
    const first = comparisonManifest()
    const changedAdministrativeFields = {
      ...comparisonManifest(),
      generatedAt: '2027-01-01T00:00:00.000Z',
      configurationHash: '1'.repeat(64),
      manuscriptHash: '2'.repeat(64),
      provisionalProductionVoice: 'nova',
    }
    expect(narrationComparisonProfileMaterial(changedAdministrativeFields)).toBe(narrationComparisonProfileMaterial(first))

    const changedInstructions = { ...comparisonManifest(), instructions: 'A different delivery.' }
    expect(narrationComparisonProfileMaterial(changedInstructions)).not.toBe(narrationComparisonProfileMaterial(first))

    const changedAudio = comparisonManifest()
    changedAudio.candidates[1] = { ...changedAudio.candidates[1]!, sha256: '9'.repeat(64) }
    expect(narrationComparisonProfileMaterial(changedAudio)).not.toBe(narrationComparisonProfileMaterial(first))

    const reordered = comparisonManifest()
    reordered.candidates.reverse()
    expect(narrationComparisonProfileMaterial(reordered)).not.toBe(narrationComparisonProfileMaterial(first))
  })

  it('records either a selected comparison candidate or an explicit rejection of all', () => {
    const base = {
      schemaVersion: 1 as const,
      decidedAt: '2026-08-11T00:00:00.000Z',
      decidedBy: 'Narration editor',
      checklistVersion: narrationComparisonApprovalChecklistVersion,
      comparisonId: 'british-voice-comparison-2026-08-11-aaaaaaaaaa',
      comparisonProfileHash: 'f'.repeat(64),
    }
    const selected: NarrationComparisonApproval = {
      ...base,
      decision: { kind: 'selected', candidateLabel: 'B', voice: 'nova' },
      confirmations: narrationComparisonApprovalConfirmations.map(({ label }) => label),
    }
    const rejected: NarrationComparisonApproval = {
      ...base,
      decision: { kind: 'reject-all' },
      confirmations: narrationComparisonApprovalConfirmations.slice(0, 2).map(({ label }) => label),
    }
    expect(narrationComparisonApprovalIsComplete(selected)).toBe(true)
    expect(narrationComparisonApprovalIsComplete(rejected)).toBe(true)
    expect(narrationComparisonApprovalIsComplete({ ...selected, confirmations: selected.confirmations.slice(1) })).toBe(false)
    expect(narrationComparisonApprovalIsComplete({
      ...selected,
      confirmations: selected.confirmations.filter((confirmation) => confirmation !== narrationComparisonApprovalConfirmations[1].label),
    })).toBe(false)
    expect(narrationComparisonApprovalIsComplete({ ...rejected, confirmations: rejected.confirmations.slice(0, 1) })).toBe(false)
    expect(narrationComparisonApprovalIsComplete({ ...selected, decidedAt: 'not-a-timestamp' })).toBe(false)
    expect(narrationComparisonApprovalIsComplete({ ...selected, decidedAt: '2026-02-30T00:00:00.000Z' })).toBe(false)
    expect(narrationComparisonApprovalIsComplete({ ...selected, schemaVersion: 2 as 1 })).toBe(false)
    expect(narrationComparisonApprovalIsComplete({ ...selected, decision: undefined as never, confirmations: [] })).toBe(false)
  })

  it('requires every versioned release-listening confirmation in exact order', () => {
    const releaseId = `2026-2-${'a'.repeat(64)}`
    const passageCount = 625
    const receipt: NarrationFullListenReceipt = {
      schemaVersion: 1 as const,
      kind: 'narration-full-listen-receipt' as const,
      releaseId,
      reviewManifestSha256: 'b'.repeat(64),
      packageChecksumsSha256: 'c'.repeat(64),
      orderedPassageProfileSha256: 'd'.repeat(64),
      passageCount,
      completedAt: '2026-08-10T23:00:00.000Z',
      completedBy: 'Listening editor',
      confirmations: [...narrationFullListenConfirmations],
    }
    const approval: NarrationApproval = {
      approvedAt: '2026-08-11T00:00:00.000Z',
      approvedBy: 'Editorial QA',
      checklistVersion: narrationApprovalChecklistVersion,
      confirmations: narrationReleaseApprovalConfirmations.map(({ label }) => label),
      fullListen: {
        receiptSha256: createHash('sha256').update(narrationFullListenReceiptMaterial(receipt)).digest('hex'),
        receipt,
      },
    }
    const verificationFor = (candidate: typeof approval) => ({
      releaseId,
      passageCount,
      receiptSha256: createHash('sha256')
        .update(narrationFullListenReceiptMaterial(candidate.fullListen.receipt))
        .digest('hex'),
    })
    expect(narrationReleaseApprovalIsComplete(approval, verificationFor(approval))).toBe(true)
    expect(narrationReleaseApprovalIsComplete(
      { ...approval, confirmations: approval.confirmations.slice(1) },
      verificationFor(approval),
    )).toBe(false)
    expect(narrationReleaseApprovalIsComplete({ ...approval, checklistVersion: 'old' }, verificationFor(approval))).toBe(false)

    const missingEvidence = { ...approval, fullListen: undefined }
    expect(narrationReleaseApprovalIsComplete(missingEvidence as never, verificationFor(approval))).toBe(false)
    const tamperedReceipt = {
      ...approval,
      fullListen: {
        ...approval.fullListen,
        receipt: { ...receipt, completedBy: 'Someone else' },
      },
    }
    expect(narrationReleaseApprovalIsComplete(tamperedReceipt, verificationFor(tamperedReceipt))).toBe(false)
    const wrongCount = {
      ...approval,
      fullListen: {
        ...approval.fullListen,
        receipt: { ...receipt, passageCount: passageCount - 1 },
      },
    }
    expect(narrationReleaseApprovalIsComplete(wrongCount, verificationFor(wrongCount))).toBe(false)
    const futureReceipt = {
      ...approval,
      fullListen: {
        ...approval.fullListen,
        receipt: { ...receipt, completedAt: '2026-08-11T00:00:00.001Z' },
      },
    }
    expect(narrationReleaseApprovalIsComplete(futureReceipt, verificationFor(futureReceipt))).toBe(false)
  })

  it('requires every voice-pilot identity and delivery confirmation', () => {
    const approval: NarrationPilotApproval = {
      schemaVersion: 1,
      approvedAt: '2026-08-11T00:00:00.000Z',
      approvedBy: 'Editorial QA',
      checklistVersion: narrationApprovalChecklistVersion,
      configurationHash: 'a'.repeat(64),
      manuscriptHash: 'b'.repeat(64),
      pilotProfileHash: 'c'.repeat(64),
      passageIds: ['one'],
      confirmations: narrationPilotApprovalConfirmations.map(({ label }) => label),
    }
    expect(narrationPilotApprovalIsComplete(approval)).toBe(true)
    expect(narrationPilotApprovalIsComplete({ ...approval, confirmations: [...approval.confirmations].reverse() })).toBe(false)
  })
})
