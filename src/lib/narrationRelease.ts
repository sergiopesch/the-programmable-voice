import {
  narrationApprovalChecklistVersion,
  narrationComparisonApprovalChecklistVersion,
  narrationComparisonApprovalConfirmations,
  narrationPilotApprovalConfirmations,
  narrationReleaseApprovalConfirmations,
} from '../data/narrationEdition'

export interface NarrationComparisonTechnicalQc {
  durationSeconds: number
  wordsPerMinute: number
  integratedLoudnessLufs: number
  loudnessRangeLu: number
  truePeakDbtp: number
  sampleRateHz: number
  channels: number
  bitrateKbps: number
  fullDecodePassed: true
}

export interface NarrationComparisonCandidate {
  label: string
  voice: string
  filename: string
  sha256: string
  technicalQc: NarrationComparisonTechnicalQc
}

export interface NarrationComparisonManifest {
  schemaVersion: 2
  comparisonId: string
  generatedAt: string
  disclosure: string
  edition: string
  model: string
  configurationHash: string
  manuscriptHash: string
  provisionalProductionVoice: string
  voiceProfile: string
  instructions: string
  responseFormat: string
  speechSpeed: number
  normalisation: {
    version: string
    integratedLoudnessLufs: number
    loudnessRangeLu: number
    truePeakDbtp: number
    sampleRateHz: number
    channels: number
    bitrateKbps: number
  }
  passage: { id: string; text: string; sha256: string }
  candidates: NarrationComparisonCandidate[]
  comparisonProfileHash: string
  humanApprovalRequired: true
  approvalCriteria: string[]
}

export type NarrationComparisonDecision =
  | { kind: 'selected'; candidateLabel: string; voice: string }
  | { kind: 'reject-all' }

export interface NarrationComparisonApproval {
  schemaVersion: 1
  decidedAt: string
  decidedBy: string
  checklistVersion: string
  comparisonId: string
  comparisonProfileHash: string
  decision: NarrationComparisonDecision
  confirmations: string[]
}

export interface NarrationTechnicalQc {
  durationExpectedSeconds: number
  durationMeasuredSeconds: number
  wordsPerMinute: number
  integratedLoudnessLufs: number
  loudnessRangeLu: number
  truePeakDbtp: number
  leadingSilenceSeconds: number
  trailingSilenceSeconds: number
  normalisationVersion: string
  fullDecodePassed: true
}

export interface NarrationGenerationProvenance {
  provider: string
  modelRevision: string
  runtime: string
  runtimeVersion: string
  quantization: string
  device: string
  sourceLicense: string
  sourceUrl: string
  modelFiles: readonly { path: string; sha256: string }[]
  voiceFileSha256: string
  voiceLocale: string
  voiceGenderCatalogLabel: string
  speed: number
  output: {
    responseFormat: string
    sampleRateHz: number
    channels: number
    bitrateKbps: number
    normalisationVersion: string
  }
}

export interface NarrationManifestEntry {
  id: string
  sectionId: string
  targetId: string
  textHash: string
  url: string
  sha256: string
  durationSeconds: number
  generatedAt: string
  qcStatus: 'technical-qc-passed'
  technicalQc: NarrationTechnicalQc
}

export interface NarrationApproval {
  approvedAt: string
  approvedBy: string
  checklistVersion: string
  confirmations: string[]
}

export interface NarrationManifest {
  schemaVersion: 1
  releaseId: string
  releaseManifestUrl: string
  edition: string
  model: string
  voice: string
  provenance: NarrationGenerationProvenance
  disclosure: string
  configurationHash: string
  manuscriptHash: string
  pilotProfileHash: string
  pilotReceipt: NarrationPilotReceipt
  generatedAt: string
  generationScope: { mode: 'full'; requestedPassageCount: number }
  complete: boolean
  approved: boolean
  approval: NarrationApproval | null
  passageCount: number
  totalDurationSeconds: number
  passages: NarrationManifestEntry[]
}

export interface NarrationPilotManifest {
  schemaVersion: 1
  edition: string
  model: string
  voice: string
  provenance: NarrationGenerationProvenance
  configurationHash: string
  /** Whole-book digest at generation time; current pilot validity is passage-scoped. */
  manuscriptHash: string
  generatedAt: string
  complete: boolean
  passageCount: number
  passages: NarrationManifestEntry[]
}

export interface NarrationPilotApproval {
  schemaVersion: 1
  approvedAt: string
  approvedBy: string
  checklistVersion: string
  configurationHash: string
  /** Historical snapshot copied from the exact pilot manifest that was heard. */
  manuscriptHash: string
  pilotProfileHash: string
  passageIds: string[]
  confirmations: string[]
}

/** Self-contained proof of the exact representative pilot approved by a human. */
export interface NarrationPilotReceipt {
  manifest: NarrationPilotManifest
  approval: NarrationPilotApproval
}

function narrationTechnicalQcIdentity(qc: NarrationTechnicalQc) {
  return {
    durationExpectedSeconds: qc.durationExpectedSeconds,
    durationMeasuredSeconds: qc.durationMeasuredSeconds,
    wordsPerMinute: qc.wordsPerMinute,
    integratedLoudnessLufs: qc.integratedLoudnessLufs,
    loudnessRangeLu: qc.loudnessRangeLu,
    truePeakDbtp: qc.truePeakDbtp,
    leadingSilenceSeconds: qc.leadingSilenceSeconds,
    trailingSilenceSeconds: qc.trailingSilenceSeconds,
    normalisationVersion: qc.normalisationVersion,
    fullDecodePassed: qc.fullDecodePassed,
  }
}

function narrationComparisonTechnicalQcIdentity(qc: NarrationComparisonTechnicalQc) {
  return {
    durationSeconds: qc.durationSeconds,
    wordsPerMinute: qc.wordsPerMinute,
    integratedLoudnessLufs: qc.integratedLoudnessLufs,
    loudnessRangeLu: qc.loudnessRangeLu,
    truePeakDbtp: qc.truePeakDbtp,
    sampleRateHz: qc.sampleRateHz,
    channels: qc.channels,
    bitrateKbps: qc.bitrateKbps,
    fullDecodePassed: qc.fullDecodePassed,
  }
}

/**
 * Stable material proving exactly which voice profile and equal-text candidate
 * files were compared. The provisional production voice, whole-manuscript
 * digest, job id and timestamps are deliberately outside this identity.
 */
export function narrationComparisonProfileMaterial(manifest: NarrationComparisonManifest) {
  return JSON.stringify({
    profileVersion: 1,
    model: manifest.model,
    instructions: manifest.instructions,
    voiceProfile: manifest.voiceProfile,
    responseFormat: manifest.responseFormat,
    speechSpeed: manifest.speechSpeed,
    normalisation: {
      version: manifest.normalisation.version,
      integratedLoudnessLufs: manifest.normalisation.integratedLoudnessLufs,
      loudnessRangeLu: manifest.normalisation.loudnessRangeLu,
      truePeakDbtp: manifest.normalisation.truePeakDbtp,
      sampleRateHz: manifest.normalisation.sampleRateHz,
      channels: manifest.normalisation.channels,
      bitrateKbps: manifest.normalisation.bitrateKbps,
    },
    passage: {
      id: manifest.passage.id,
      text: manifest.passage.text,
      sha256: manifest.passage.sha256,
    },
    candidates: manifest.candidates.map((candidate) => ({
      label: candidate.label,
      voice: candidate.voice,
      filename: candidate.filename,
      sha256: candidate.sha256,
      technicalQc: narrationComparisonTechnicalQcIdentity(candidate.technicalQc),
    })),
  })
}

/** Stable JSON material proving exactly which pilot assets were auditioned. */
export function narrationPilotProfileMaterial(manifest: NarrationPilotManifest) {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    edition: manifest.edition,
    model: manifest.model,
    voice: manifest.voice,
    provenance: manifest.provenance,
    configurationHash: manifest.configurationHash,
    manuscriptHash: manifest.manuscriptHash,
    passageCount: manifest.passageCount,
    passages: manifest.passages.map((entry) => ({
      id: entry.id,
      textHash: entry.textHash,
      url: entry.url,
      sha256: entry.sha256,
      durationSeconds: entry.durationSeconds,
      qcStatus: entry.qcStatus,
      technicalQc: narrationTechnicalQcIdentity(entry.technicalQc),
    })),
  })
}

/** Stable JSON material used to derive the immutable release identity. */
export function narrationReleaseIdentityMaterial(manifest: Omit<NarrationManifest, 'releaseId' | 'releaseManifestUrl' | 'approved' | 'approval'>) {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    edition: manifest.edition,
    model: manifest.model,
    voice: manifest.voice,
    provenance: manifest.provenance,
    disclosure: manifest.disclosure,
    configurationHash: manifest.configurationHash,
    manuscriptHash: manifest.manuscriptHash,
    pilotProfileHash: manifest.pilotProfileHash,
    pilotReceipt: manifest.pilotReceipt,
    generationScope: manifest.generationScope,
    complete: manifest.complete,
    passageCount: manifest.passageCount,
    totalDurationSeconds: manifest.totalDurationSeconds,
    passages: manifest.passages.map((entry) => ({
      id: entry.id,
      sectionId: entry.sectionId,
      targetId: entry.targetId,
      textHash: entry.textHash,
      url: entry.url,
      sha256: entry.sha256,
      durationSeconds: entry.durationSeconds,
      qcStatus: entry.qcStatus,
      technicalQc: narrationTechnicalQcIdentity(entry.technicalQc),
    })),
  })
}

export function narrationReleaseId(edition: string, identityHash: string) {
  const safeEdition = edition.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return `${safeEdition}-${identityHash}`
}

export function narrationReleaseManifestUrl(releaseId: string) {
  return `/audio/narration/releases/${releaseId}.json`
}

export function narrationReleaseApprovalIsComplete(approval: NarrationApproval | null) {
  return Boolean(
    approval
    && typeof approval.approvedBy === 'string'
    && approval.approvedBy.trim()
    && Array.isArray(approval.confirmations)
    && approval.checklistVersion === narrationApprovalChecklistVersion
    && approval.confirmations.length === narrationReleaseApprovalConfirmations.length
    && narrationReleaseApprovalConfirmations.every(({ label }, index) => approval.confirmations[index] === label),
  )
}

export function narrationPilotApprovalIsComplete(approval: NarrationPilotApproval | null) {
  return Boolean(
    approval
    && typeof approval.approvedBy === 'string'
    && approval.approvedBy.trim()
    && Array.isArray(approval.confirmations)
    && approval.checklistVersion === narrationApprovalChecklistVersion
    && approval.confirmations.length === narrationPilotApprovalConfirmations.length
    && narrationPilotApprovalConfirmations.every(({ label }, index) => approval.confirmations[index] === label),
  )
}

export function narrationComparisonApprovalIsComplete(approval: NarrationComparisonApproval | null) {
  if (
    !approval
    || approval.schemaVersion !== 1
    || typeof approval.decidedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(approval.decidedAt)
    || !Number.isFinite(Date.parse(approval.decidedAt))
    || new Date(approval.decidedAt).toISOString() !== approval.decidedAt
    || typeof approval.decidedBy !== 'string'
    || !approval.decidedBy.trim()
    || typeof approval.comparisonId !== 'string'
    || !/^british-voice-comparison-\d{4}-\d{2}-\d{2}-[a-f0-9]{10}$/.test(approval.comparisonId)
    || approval.checklistVersion !== narrationComparisonApprovalChecklistVersion
    || !/^[a-f0-9]{64}$/.test(approval.comparisonProfileHash)
    || !Array.isArray(approval.confirmations)
  ) return false

  const decision = approval.decision as NarrationComparisonDecision | null | undefined
  if (!decision || (decision.kind !== 'selected' && decision.kind !== 'reject-all')) return false
  const expectedConfirmations = decision.kind === 'selected'
    ? narrationComparisonApprovalConfirmations.map(({ label }) => label)
    : narrationComparisonApprovalConfirmations.slice(0, 2).map(({ label }) => label)
  return approval.confirmations.length === expectedConfirmations.length
    && expectedConfirmations.every((label, index) => approval.confirmations[index] === label)
    && (decision.kind === 'reject-all' || (
      typeof decision.candidateLabel === 'string'
      && decision.candidateLabel.length > 0
      && typeof decision.voice === 'string'
      && decision.voice.length > 0
    ))
}
