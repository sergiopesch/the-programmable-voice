import {
  narrationApprovalChecklistVersion,
  narrationPilotApprovalConfirmations,
  narrationReleaseApprovalConfirmations,
} from '../data/narrationEdition'

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
  disclosure: string
  configurationHash: string
  manuscriptHash: string
  pilotProfileHash: string
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
  configurationHash: string
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
  manuscriptHash: string
  pilotProfileHash: string
  passageIds: string[]
  confirmations: string[]
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

/** Stable JSON material proving exactly which pilot assets were auditioned. */
export function narrationPilotProfileMaterial(manifest: NarrationPilotManifest) {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    edition: manifest.edition,
    model: manifest.model,
    voice: manifest.voice,
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
    disclosure: manifest.disclosure,
    configurationHash: manifest.configurationHash,
    manuscriptHash: manifest.manuscriptHash,
    pilotProfileHash: manifest.pilotProfileHash,
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
