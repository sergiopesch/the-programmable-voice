import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  narrationBritishVoiceComparison,
  narrationEditionConfiguration,
  narrationInstructionsFor,
} from '../src/data/narrationEdition'
import { bookNarrationPassages } from '../src/lib/narration'
import {
  narrationComparisonApprovalIsComplete,
  narrationComparisonProfileMaterial,
  type NarrationComparisonApproval,
  type NarrationComparisonManifest,
} from '../src/lib/narrationRelease'

export const narrationComparisonDirectory = '.narration-work/british-voice-comparison'
export const narrationComparisonManifestName = 'manifest.json'
export const narrationComparisonApprovalName = 'approval.json'

export function narrationComparisonSha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

export function narrationComparisonProfileHash(manifest: NarrationComparisonManifest) {
  return narrationComparisonSha256(narrationComparisonProfileMaterial(manifest))
}

export async function removeNarrationComparisonApproval(root: string) {
  await fs.rm(path.join(root, narrationComparisonDirectory, narrationComparisonApprovalName), { force: true })
}

function currentComparisonPassage() {
  const passage = bookNarrationPassages.find(({ id }) => id === narrationBritishVoiceComparison.passageId)
  if (!passage) throw new Error('The configured British-voice comparison passage is not in the manuscript.')
  return passage
}

export function upgradeNarrationComparisonManifest(raw: unknown): NarrationComparisonManifest {
  if (!raw || typeof raw !== 'object') throw new Error('The British voice comparison manifest schema is unsupported.')
  const record = raw as Record<string, unknown>
  if (record.schemaVersion === 2) return raw as NarrationComparisonManifest
  if (record.schemaVersion !== 1) throw new Error('The British voice comparison manifest schema is unsupported.')
  const expectedLegacyConfigurationHash = narrationComparisonSha256(JSON.stringify(narrationEditionConfiguration))
  if (record.configurationHash !== expectedLegacyConfigurationHash) {
    throw new Error('The legacy British voice comparison cannot be upgraded because its narration configuration has changed. Generate a new comparison.')
  }
  const migrated = {
    ...record,
    schemaVersion: 2,
    responseFormat: narrationEditionConfiguration.responseFormat,
    speechSpeed: 1,
    normalisation: { ...narrationEditionConfiguration.normalisation },
    comparisonProfileHash: '',
  } as unknown as NarrationComparisonManifest
  migrated.comparisonProfileHash = narrationComparisonProfileHash(migrated)
  return migrated
}

function assertTechnicalQc(manifest: NarrationComparisonManifest) {
  const settings = narrationEditionConfiguration.normalisation
  for (const candidate of manifest.candidates) {
    const qc = candidate.technicalQc
    if (
      !qc
      || !Number.isFinite(qc.durationSeconds)
      || qc.durationSeconds < 1
      || !Number.isFinite(qc.wordsPerMinute)
      || qc.wordsPerMinute < 105
      || qc.wordsPerMinute > 175
      || !Number.isFinite(qc.integratedLoudnessLufs)
      || qc.integratedLoudnessLufs < -20.5
      || qc.integratedLoudnessLufs > -15.5
      || !Number.isFinite(qc.loudnessRangeLu)
      || qc.loudnessRangeLu < 0
      || qc.loudnessRangeLu > 12
      || !Number.isFinite(qc.truePeakDbtp)
      || qc.truePeakDbtp > -1
      || qc.sampleRateHz !== settings.sampleRateHz
      || qc.channels !== settings.channels
      || Math.abs(qc.bitrateKbps - settings.bitrateKbps) > 2
      || qc.fullDecodePassed !== true
    ) throw new Error(`British voice candidate ${candidate.label || '(unlabelled)'} has invalid technical-QC metadata.`)
  }
}

export function assertNarrationComparisonManifestMatchesCurrent(manifest: NarrationComparisonManifest) {
  const passage = currentComparisonPassage()
  const expectedCandidates = narrationBritishVoiceComparison.candidates
  const expectedInstructions = narrationInstructionsFor(passage.id)
  const settings = narrationEditionConfiguration.normalisation
  const normalisationMatches = Boolean(
    manifest.normalisation
    && manifest.normalisation.version === settings.version
    && manifest.normalisation.integratedLoudnessLufs === settings.integratedLoudnessLufs
    && manifest.normalisation.loudnessRangeLu === settings.loudnessRangeLu
    && manifest.normalisation.truePeakDbtp === settings.truePeakDbtp
    && manifest.normalisation.sampleRateHz === settings.sampleRateHz
    && manifest.normalisation.channels === settings.channels
    && manifest.normalisation.bitrateKbps === settings.bitrateKbps,
  )
  if (
    !manifest
    || manifest.schemaVersion !== 2
    || !/^british-voice-comparison-\d{4}-\d{2}-\d{2}-[a-f0-9]{10}$/.test(manifest.comparisonId)
    || manifest.model !== narrationEditionConfiguration.model
    || manifest.voiceProfile !== narrationEditionConfiguration.voiceProfile
    || manifest.instructions !== expectedInstructions
    || manifest.responseFormat !== narrationEditionConfiguration.responseFormat
    || manifest.speechSpeed !== 1
    || !normalisationMatches
    || !manifest.passage
    || manifest.passage.id !== passage.id
    || manifest.passage.text !== passage.text
    || manifest.passage.sha256 !== narrationComparisonSha256(passage.text)
    || !Array.isArray(manifest.candidates)
    || manifest.candidates.length !== expectedCandidates.length
    || manifest.humanApprovalRequired !== true
  ) throw new Error('The British voice comparison profile does not match the current narration direction or exact comparison passage.')

  for (let index = 0; index < expectedCandidates.length; index += 1) {
    const expected = expectedCandidates[index]!
    const candidate = manifest.candidates[index]!
    const expectedFilename = `candidate-${expected.label.toLowerCase()}-${candidate.sha256}.mp3`
    if (
      candidate.label !== expected.label
      || candidate.voice !== expected.voice
      || !/^[a-f0-9]{64}$/.test(candidate.sha256)
      || candidate.filename !== expectedFilename
    ) throw new Error(`British voice candidate ${expected.label} does not match the ordered comparison contract.`)
  }
  assertTechnicalQc(manifest)
  const profileHash = narrationComparisonProfileHash(manifest)
  if (manifest.comparisonProfileHash !== profileHash) throw new Error('The British voice comparison profile hash is invalid.')
  return manifest
}

async function readJson<T>(filePath: string, label: string): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T
  } catch {
    throw new Error(`${label} is unavailable or is not valid JSON.`)
  }
}

export async function readNarrationComparisonManifest(root: string, verifyCandidateAudio = true) {
  const comparisonRoot = path.join(root, narrationComparisonDirectory)
  const manifest = assertNarrationComparisonManifestMatchesCurrent(upgradeNarrationComparisonManifest(await readJson<unknown>(
    path.join(comparisonRoot, narrationComparisonManifestName),
    'British voice comparison manifest',
  )))
  if (verifyCandidateAudio) {
    for (const candidate of manifest.candidates) {
      const bytes = new Uint8Array(await fs.readFile(path.join(comparisonRoot, candidate.filename)))
      if (narrationComparisonSha256(bytes) !== candidate.sha256) {
        throw new Error(`British voice candidate ${candidate.label} failed its audio checksum.`)
      }
    }
  }
  return manifest
}

export async function readNarrationComparisonRecord(root: string, verifyCandidateAudio = true) {
  const comparisonRoot = path.join(root, narrationComparisonDirectory)
  const manifest = await readNarrationComparisonManifest(root, verifyCandidateAudio)
  const approval = await readJson<NarrationComparisonApproval>(
    path.join(comparisonRoot, narrationComparisonApprovalName),
    'British voice comparison approval',
  )
  return { manifest, approval }
}

export function assertNarrationComparisonApproval(
  manifest: NarrationComparisonManifest,
  approval: NarrationComparisonApproval,
  currentProductionVoice: string,
) {
  if (
    !narrationComparisonApprovalIsComplete(approval)
    || approval.comparisonId !== manifest.comparisonId
    || approval.comparisonProfileHash !== manifest.comparisonProfileHash
  ) throw new Error('The British voice comparison has no valid human decision for this exact candidate profile.')
  if (approval.decision.kind === 'reject-all') {
    throw new Error('All British voice comparison candidates were rejected. Generate and approve a new comparison before producing a pilot.')
  }
  const selected = manifest.candidates.find(({ label }) => label === approval.decision.candidateLabel)
  if (!selected || selected.voice !== approval.decision.voice) {
    throw new Error('The selected British voice does not belong to this comparison.')
  }
  if (currentProductionVoice !== selected.voice) {
    throw new Error(`The approved comparison selected candidate ${selected.label} (${selected.voice}), but narrationEditionConfiguration.voice is ${currentProductionVoice}. Update the configuration before producing a pilot.`)
  }
  return selected
}

export async function requireSelectedNarrationComparison(root: string) {
  const { manifest, approval } = await readNarrationComparisonRecord(root, true)
  const selected = assertNarrationComparisonApproval(manifest, approval, narrationEditionConfiguration.voice)
  return { manifest, approval, selected }
}
