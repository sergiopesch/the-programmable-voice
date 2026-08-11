import { describe, expect, it } from 'vitest'
import {
  narrationApprovalChecklistVersion,
  narrationPilotApprovalConfirmations,
  narrationReleaseApprovalConfirmations,
} from '../data/narrationEdition'
import {
  narrationPilotApprovalIsComplete,
  narrationReleaseApprovalIsComplete,
  narrationReleaseId,
  narrationReleaseIdentityMaterial,
  narrationReleaseManifestUrl,
  type NarrationManifest,
  type NarrationPilotApproval,
} from './narrationRelease'

function identityFields(): Omit<NarrationManifest, 'releaseId' | 'releaseManifestUrl' | 'approved' | 'approval'> {
  return {
    schemaVersion: 1,
    edition: '2026.1',
    model: 'pinned-model',
    voice: 'fixed-voice',
    disclosure: 'AI-generated.',
    configurationHash: 'a'.repeat(64),
    manuscriptHash: 'b'.repeat(64),
    pilotProfileHash: 'c'.repeat(64),
    generatedAt: '2026-08-11T00:00:00.000Z',
    generationScope: { mode: 'full', requestedPassageCount: 1 },
    complete: true,
    passageCount: 1,
    totalDurationSeconds: 10,
    passages: [{
      id: 'passage:opening:section-title',
      sectionId: 'opening',
      targetId: 'narration-opening-header',
      textHash: 'd'.repeat(64),
      url: `/audio/narration/edition-2026-1/0001-${'e'.repeat(64)}.mp3`,
      sha256: 'e'.repeat(64),
      durationSeconds: 10,
      generatedAt: '2026-08-11T00:00:00.000Z',
      qcStatus: 'technical-qc-passed',
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
        fullDecodePassed: true,
      },
    }],
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
  })

  it('requires every versioned release-listening confirmation in exact order', () => {
    const approval = {
      approvedAt: '2026-08-11T00:00:00.000Z',
      approvedBy: 'Editorial QA',
      checklistVersion: narrationApprovalChecklistVersion,
      confirmations: narrationReleaseApprovalConfirmations.map(({ label }) => label),
    }
    expect(narrationReleaseApprovalIsComplete(approval)).toBe(true)
    expect(narrationReleaseApprovalIsComplete({ ...approval, confirmations: approval.confirmations.slice(1) })).toBe(false)
    expect(narrationReleaseApprovalIsComplete({ ...approval, checklistVersion: 'old' })).toBe(false)
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
