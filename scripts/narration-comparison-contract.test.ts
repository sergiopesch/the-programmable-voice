import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  narrationBritishVoiceComparison,
  narrationComparisonApprovalChecklistVersion,
  narrationComparisonApprovalConfirmations,
  narrationDisclosure,
  narrationEditionConfiguration,
  narrationInstructionsFor,
} from '../src/data/narrationEdition'
import { bookNarrationPassages } from '../src/lib/narration'
import type { NarrationComparisonApproval, NarrationComparisonManifest } from '../src/lib/narrationRelease'
import {
  assertNarrationComparisonApproval,
  assertNarrationComparisonManifestMatchesCurrent,
  narrationComparisonApprovalName,
  narrationComparisonDirectory,
  narrationComparisonManifestName,
  narrationComparisonProfileHash,
  narrationComparisonSha256,
  readNarrationComparisonRecord,
  removeNarrationComparisonApproval,
  upgradeNarrationComparisonManifest,
} from './narration-comparison-contract'

const temporaryRoots: string[] = []

async function temporaryRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-comparison-contract-test-'))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

function currentManifest() {
  const passage = bookNarrationPassages.find(({ id }) => id === narrationBritishVoiceComparison.passageId)!
  const technicalQc = {
    durationSeconds: 40,
    wordsPerMinute: 140,
    integratedLoudnessLufs: -18,
    loudnessRangeLu: 4,
    truePeakDbtp: -2,
    sampleRateHz: narrationEditionConfiguration.normalisation.sampleRateHz,
    channels: narrationEditionConfiguration.normalisation.channels,
    bitrateKbps: narrationEditionConfiguration.normalisation.bitrateKbps,
    fullDecodePassed: true as const,
  }
  const candidates = narrationBritishVoiceComparison.candidates.map((candidate) => {
    const bytes = Buffer.from(`candidate-${candidate.label}`)
    const digest = narrationComparisonSha256(bytes)
    return {
      ...candidate,
      filename: `candidate-${candidate.label.toLowerCase()}-${digest}.mp3`,
      sha256: digest,
      technicalQc: { ...technicalQc },
      bytes,
    }
  })
  const manifest: NarrationComparisonManifest = {
    schemaVersion: 2,
    comparisonId: 'british-voice-comparison-2026-08-11-aaaaaaaaaa',
    generatedAt: '2026-08-11T00:00:00.000Z',
    disclosure: narrationDisclosure,
    edition: narrationEditionConfiguration.edition,
    model: narrationEditionConfiguration.model,
    configurationHash: 'a'.repeat(64),
    manuscriptHash: 'b'.repeat(64),
    provisionalProductionVoice: 'an-unapproved-placeholder',
    voiceProfile: narrationEditionConfiguration.voiceProfile,
    instructions: narrationInstructionsFor(passage.id),
    responseFormat: narrationEditionConfiguration.responseFormat,
    speechSpeed: 1,
    normalisation: { ...narrationEditionConfiguration.normalisation },
    passage: { id: passage.id, text: passage.text, sha256: narrationComparisonSha256(passage.text) },
    candidates: candidates.map(({ label, voice, filename, sha256, technicalQc }) => ({
      label,
      voice,
      filename,
      sha256,
      technicalQc,
    })),
    comparisonProfileHash: '',
    humanApprovalRequired: true,
    approvalCriteria: ['human listening required'],
  }
  manifest.comparisonProfileHash = narrationComparisonProfileHash(manifest)
  return { manifest, candidates }
}

function selectedApproval(manifest: NarrationComparisonManifest, label: string): NarrationComparisonApproval {
  const candidate = manifest.candidates.find((item) => item.label === label)!
  return {
    schemaVersion: 1,
    decidedAt: '2026-08-11T00:00:00.000Z',
    decidedBy: 'Narration editor',
    checklistVersion: narrationComparisonApprovalChecklistVersion,
    comparisonId: manifest.comparisonId,
    comparisonProfileHash: manifest.comparisonProfileHash,
    decision: { kind: 'selected', candidateLabel: candidate.label, voice: candidate.voice },
    confirmations: narrationComparisonApprovalConfirmations.map(({ label: confirmation }) => confirmation),
  }
}

describe('British narration comparison contract', () => {
  it('upgrades the existing schema-one comparison without regenerating its audio', () => {
    const { manifest } = currentManifest()
    const legacy: Record<string, unknown> = {
      ...manifest,
      schemaVersion: 1,
      configurationHash: narrationComparisonSha256(JSON.stringify(narrationEditionConfiguration)),
      manuscriptHash: 'an-obsolete-whole-manuscript-hash',
    }
    delete legacy.responseFormat
    delete legacy.speechSpeed
    delete legacy.normalisation
    delete legacy.comparisonProfileHash
    const upgraded = upgradeNarrationComparisonManifest(legacy)
    expect(upgraded.schemaVersion).toBe(2)
    expect(upgraded.responseFormat).toBe(narrationEditionConfiguration.responseFormat)
    expect(upgraded.comparisonProfileHash).toBe(narrationComparisonProfileHash(upgraded))
    expect(upgraded.manuscriptHash).toBe('an-obsolete-whole-manuscript-hash')
  })

  it('binds the selected candidate while ignoring unrelated manuscript changes', () => {
    const { manifest } = currentManifest()
    const approval = selectedApproval(manifest, 'A')
    const selectedVoice = manifest.candidates[0]!.voice
    expect(assertNarrationComparisonApproval(manifest, approval, selectedVoice).voice).toBe(selectedVoice)
    expect(() => assertNarrationComparisonApproval(manifest, approval, 'different-voice')).toThrow(/selected candidate A/)
    expect(() => assertNarrationComparisonApproval(manifest, {
      ...approval,
      decision: { kind: 'selected', candidateLabel: 'A', voice: 'different-voice' },
    }, 'different-voice')).toThrow(/does not belong/)
    expect(() => assertNarrationComparisonApproval(manifest, {
      ...approval,
      comparisonProfileHash: '0'.repeat(64),
    }, selectedVoice)).toThrow(/exact candidate profile/)

    const unrelatedManuscriptEdit = { ...manifest, manuscriptHash: '9'.repeat(64), provisionalProductionVoice: 'different-voice' }
    expect(() => assertNarrationComparisonManifestMatchesCurrent(unrelatedManuscriptEdit)).not.toThrow()
    expect(() => assertNarrationComparisonApproval(unrelatedManuscriptEdit, approval, selectedVoice)).not.toThrow()

    const changedComparisonPassage = {
      ...manifest,
      passage: { ...manifest.passage, text: `${manifest.passage.text} Changed.` },
    }
    expect(() => assertNarrationComparisonManifestMatchesCurrent(changedComparisonPassage)).toThrow(/exact comparison passage/)
  })

  it('verifies every compared audio file and preserves an explicit reject-all decision', async () => {
    const root = await temporaryRoot()
    const comparisonRoot = path.join(root, narrationComparisonDirectory)
    const { manifest, candidates } = currentManifest()
    const approval: NarrationComparisonApproval = {
      ...selectedApproval(manifest, 'A'),
      decision: { kind: 'reject-all' },
      confirmations: narrationComparisonApprovalConfirmations.slice(0, 2).map(({ label }) => label),
    }
    await fs.mkdir(comparisonRoot, { recursive: true })
    await fs.writeFile(path.join(comparisonRoot, narrationComparisonManifestName), JSON.stringify(manifest))
    await fs.writeFile(path.join(comparisonRoot, narrationComparisonApprovalName), JSON.stringify(approval))
    for (const candidate of candidates) await fs.writeFile(path.join(comparisonRoot, candidate.filename), candidate.bytes)

    const record = await readNarrationComparisonRecord(root, true)
    expect(record.approval.decision).toEqual({ kind: 'reject-all' })
    expect(() => assertNarrationComparisonApproval(record.manifest, record.approval, narrationEditionConfiguration.voice)).toThrow(/were rejected/)

    await removeNarrationComparisonApproval(root)
    await expect(fs.access(path.join(comparisonRoot, narrationComparisonApprovalName))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
