import { describe, expect, it } from 'vitest'
import {
  narrationApprovalChecklistVersion,
  narrationComparisonApprovalChecklistVersion,
  narrationComparisonApprovalConfirmations,
  narrationPilotApprovalConfirmations,
  narrationReleaseApprovalConfirmations,
} from '../data/narrationEdition'
import {
  narrationComparisonApprovalIsComplete,
  narrationComparisonProfileMaterial,
  narrationPilotApprovalIsComplete,
  narrationReleaseApprovalIsComplete,
  narrationReleaseId,
  narrationReleaseIdentityMaterial,
  narrationReleaseManifestUrl,
  type NarrationManifest,
  type NarrationComparisonApproval,
  type NarrationComparisonManifest,
  type NarrationPilotApproval,
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
