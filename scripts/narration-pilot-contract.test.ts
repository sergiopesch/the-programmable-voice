import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  narrationApprovalChecklistVersion,
  narrationGenerationProvenance,
  narrationPilotApprovalConfirmations,
} from '../src/data/narrationEdition'
import {
  narrationPilotProfileMaterial,
  type NarrationManifestEntry,
  type NarrationPilotApproval,
  type NarrationPilotManifest,
} from '../src/lib/narrationRelease'
import {
  narrationApprovedPilotParityProblems,
  narrationPilotApprovalProblems,
  narrationPilotReceiptProblems,
  narrationPilotVerificationMessage,
  type CurrentNarrationPilotIdentity,
} from './narration-pilot-contract'

const configurationHash = 'a'.repeat(64)
const historicalManuscriptHash = 'b'.repeat(64)

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function entry(id: string, textHash: string, audioHash: string): NarrationManifestEntry {
  return {
    id,
    sectionId: 'section',
    targetId: `target-${id}`,
    textHash,
    url: `/audio/narration/edition-2026-2/${audioHash}.mp3`,
    sha256: audioHash,
    durationSeconds: 10,
    generatedAt: '2026-08-11T00:00:00.000Z',
    qcStatus: 'technical-qc-passed',
    technicalQc: {
      durationExpectedSeconds: 10,
      durationMeasuredSeconds: 10,
      wordsPerMinute: 132,
      integratedLoudnessLufs: -18,
      loudnessRangeLu: 3,
      truePeakDbtp: -2,
      leadingSilenceSeconds: 0.08,
      trailingSilenceSeconds: 0.18,
      normalisationVersion: 'loudnorm-2026.2-24khz-48kbps',
      fullDecodePassed: true,
    },
  }
}

function fixture() {
  const passages = [
    entry('pilot-one', '1'.repeat(64), '3'.repeat(64)),
    entry('pilot-two', '2'.repeat(64), '4'.repeat(64)),
  ]
  const manifest: NarrationPilotManifest = {
    schemaVersion: 1,
    edition: '2026.2',
    model: 'pinned-model',
    voice: 'bf_emma',
    provenance: narrationGenerationProvenance,
    configurationHash,
    manuscriptHash: historicalManuscriptHash,
    generatedAt: '2026-08-11T00:00:00.000Z',
    complete: true,
    passageCount: passages.length,
    passages,
  }
  const approval: NarrationPilotApproval = {
    schemaVersion: 1,
    approvedAt: '2026-08-11T19:57:01.526Z',
    approvedBy: 'project owner',
    checklistVersion: narrationApprovalChecklistVersion,
    configurationHash,
    manuscriptHash: historicalManuscriptHash,
    pilotProfileHash: sha256(narrationPilotProfileMaterial(manifest)),
    passageIds: passages.map(({ id }) => id),
    confirmations: narrationPilotApprovalConfirmations.map(({ label }) => label),
  }
  const current: CurrentNarrationPilotIdentity = {
    configurationHash,
    // Deliberately differs: an unrelated non-pilot passage or note changed.
    manuscriptHash: '9'.repeat(64),
    passages: passages.map(({ id, sectionId, targetId, textHash }) => ({ id, sectionId, targetId, textHash })),
  }
  return { manifest, approval, current }
}

describe('representative-pilot scope contract', () => {
  it('retains an exact approved pilot across unrelated whole-manuscript or reading-note edits', () => {
    const { manifest, approval, current } = fixture()
    expect(current.manuscriptHash).not.toBe(manifest.manuscriptHash)
    expect(narrationPilotApprovalProblems(manifest, approval, current).problems).toEqual([])
  })

  it('invalidates changes to configuration, ordered pilot targets, or pilot text/note hashes', () => {
    const first = fixture()
    expect(narrationPilotApprovalProblems(first.manifest, first.approval, {
      ...first.current,
      configurationHash: '8'.repeat(64),
    }).problems).not.toEqual([])

    const second = fixture()
    expect(narrationPilotApprovalProblems(second.manifest, second.approval, {
      ...second.current,
      passages: [...second.current.passages].reverse(),
    }).problems).not.toEqual([])

    const third = fixture()
    const changedTarget = third.current.passages.map((passage, index) => index === 0
      ? { ...passage, targetId: 'different-visible-target' }
      : passage)
    expect(narrationPilotApprovalProblems(third.manifest, third.approval, {
      ...third.current,
      passages: changedTarget,
    }).problems).not.toEqual([])

    const fourth = fixture()
    const changedPilotTextOrNote = fourth.current.passages.map((passage, index) => index === 0
      ? { ...passage, textHash: '7'.repeat(64) }
      : passage)
    expect(narrationPilotApprovalProblems(fourth.manifest, fourth.approval, {
      ...fourth.current,
      passages: changedPilotTextOrNote,
    }).problems).not.toEqual([])
  })

  it('invalidates approved audio, technical-QC, or approval mutations', () => {
    const changedAudio = fixture()
    changedAudio.manifest.passages[0] = { ...changedAudio.manifest.passages[0]!, sha256: '6'.repeat(64) }
    expect(narrationPilotApprovalProblems(changedAudio.manifest, changedAudio.approval, changedAudio.current).problems).toContain(
      'pilot approval digest does not match the pilot manifest',
    )

    const changedQc = fixture()
    changedQc.manifest.passages[0] = {
      ...changedQc.manifest.passages[0]!,
      technicalQc: { ...changedQc.manifest.passages[0]!.technicalQc, integratedLoudnessLufs: -17 },
    }
    expect(narrationPilotApprovalProblems(changedQc.manifest, changedQc.approval, changedQc.current).problems).toContain(
      'pilot approval digest does not match the pilot manifest',
    )

    const changedApproval = fixture()
    changedApproval.approval.confirmations = changedApproval.approval.confirmations.slice(1)
    expect(narrationPilotApprovalProblems(changedApproval.manifest, changedApproval.approval, changedApproval.current).problems).toContain(
      'pilot listening approval is incomplete or obsolete',
    )

    const changedApprovalSnapshot = fixture()
    changedApprovalSnapshot.approval.manuscriptHash = '5'.repeat(64)
    expect(narrationPilotApprovalProblems(
      changedApprovalSnapshot.manifest,
      changedApprovalSnapshot.approval,
      changedApprovalSnapshot.current,
    ).problems).toContain('pilot approval does not retain the historical manuscript snapshot')
  })

  it('requires full narration to retain the exact approved pilot URLs and bytes', () => {
    const exact = fixture()
    const fullEntries = [
      entry('non-pilot', '5'.repeat(64), '6'.repeat(64)),
      ...exact.manifest.passages,
    ]
    expect(narrationApprovedPilotParityProblems(exact.manifest, fullEntries)).toEqual([])

    const changedSha = fullEntries.map((candidate) => candidate.id === 'pilot-one'
      ? { ...candidate, sha256: '7'.repeat(64) }
      : candidate)
    expect(narrationApprovedPilotParityProblems(exact.manifest, changedSha)).toContain(
      'full narration changed approved pilot audio pilot-one',
    )

    const changedUrl = fullEntries.map((candidate) => candidate.id === 'pilot-two'
      ? { ...candidate, url: `/audio/narration/edition-2026-2/${'8'.repeat(64)}.mp3` }
      : candidate)
    expect(narrationApprovedPilotParityProblems(exact.manifest, changedUrl)).toContain(
      'full narration changed approved pilot audio pilot-two',
    )

    expect(narrationPilotReceiptProblems(
      { manifest: exact.manifest, approval: exact.approval },
      exact.current,
      exact.approval.pilotProfileHash,
      fullEntries,
    ).problems).toEqual([])
    expect(narrationPilotReceiptProblems(
      { manifest: exact.manifest, approval: exact.approval },
      exact.current,
      '9'.repeat(64),
      fullEntries,
    ).problems).toContain('full narration pilot profile does not match its embedded receipt')
  })

  it('reports approval only for a receipt already validated by the scoped contract', () => {
    const { approval } = fixture()
    expect(narrationPilotVerificationMessage(14, approval)).toContain('Verified approved voice pilot')
    expect(narrationPilotVerificationMessage(14, approval)).toContain('human listening approved by project owner')
    expect(narrationPilotVerificationMessage(14, null)).toBe(
      'Verified pending voice pilot: 14 technically valid samples; no valid human approval is recorded.\n',
    )
  })
})
