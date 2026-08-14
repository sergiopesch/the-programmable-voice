import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  narrationApprovalChecklistVersion,
  narrationGenerationProvenance,
  narrationPilotApprovalConfirmations,
  narrationReleaseApprovalConfirmations,
} from '../data/narrationEdition'
import {
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
  type NarrationPilotApproval,
  type NarrationFullListenReceipt,
} from './narrationRelease'

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
