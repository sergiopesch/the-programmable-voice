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

export const narrationFullListenConfirmations = [
  'the checksum-bound candidate was listened to once, in manifest order, from the first passage through the last, without skips or substitutions, using the review player or M3U',
  'every listed passage received an accept-or-defect decision for speaker continuity, cadence, level and pronunciation before this receipt was recorded',
] as const

export interface NarrationFullListenReceipt {
  schemaVersion: 1
  kind: 'narration-full-listen-receipt'
  releaseId: string
  reviewManifestSha256: string
  packageChecksumsSha256: string
  orderedPassageProfileSha256: string
  passageCount: number
  completedAt: string
  completedBy: string
  confirmations: [...typeof narrationFullListenConfirmations]
}

export interface NarrationFullListenApprovalEvidence {
  receiptSha256: string
  receipt: NarrationFullListenReceipt
}

export interface NarrationApproval {
  approvedAt: string
  approvedBy: string
  checklistVersion: string
  confirmations: string[]
  fullListen: NarrationFullListenApprovalEvidence
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

function exactIsoTimestamp(value: unknown) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}

function hasExactKeys(value: object, expectedKeys: readonly string[]) {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort())
}

function safeHumanName(value: unknown) {
  return typeof value === 'string'
    && value === value.trim()
    && value.length > 0
    && !/[\r\n\0]/.test(value)
}

export function narrationFullListenReceiptMaterial(receipt: NarrationFullListenReceipt) {
  return JSON.stringify(receipt)
}

export interface NarrationReleaseApprovalVerification {
  releaseId: string
  passageCount: number
  receiptSha256: string
}

export function narrationFullListenApprovalEvidenceIsComplete(
  evidence: unknown,
  verification: NarrationReleaseApprovalVerification,
) {
  if (
    !evidence
    || typeof evidence !== 'object'
    || !hasExactKeys(evidence, ['receiptSha256', 'receipt'])
  ) return false
  const candidate = evidence as Partial<NarrationFullListenApprovalEvidence>
  const receipt = candidate.receipt
  if (
    typeof candidate.receiptSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(candidate.receiptSha256)
    || candidate.receiptSha256 !== verification.receiptSha256
    || !receipt
    || typeof receipt !== 'object'
    || !hasExactKeys(receipt, [
      'schemaVersion',
      'kind',
      'releaseId',
      'reviewManifestSha256',
      'packageChecksumsSha256',
      'orderedPassageProfileSha256',
      'passageCount',
      'completedAt',
      'completedBy',
      'confirmations',
    ])
    || receipt.schemaVersion !== 1
    || receipt.kind !== 'narration-full-listen-receipt'
    || receipt.releaseId !== verification.releaseId
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{64}$/.test(receipt.releaseId)
    || !/^[a-f0-9]{64}$/.test(receipt.reviewManifestSha256)
    || !/^[a-f0-9]{64}$/.test(receipt.packageChecksumsSha256)
    || !/^[a-f0-9]{64}$/.test(receipt.orderedPassageProfileSha256)
    || !Number.isSafeInteger(receipt.passageCount)
    || !Number.isSafeInteger(verification.passageCount)
    || verification.passageCount < 1
    || receipt.passageCount !== verification.passageCount
    || !exactIsoTimestamp(receipt.completedAt)
    || !safeHumanName(receipt.completedBy)
    || !Array.isArray(receipt.confirmations)
    || receipt.confirmations.length !== narrationFullListenConfirmations.length
    || receipt.confirmations.some((confirmation, index) => confirmation !== narrationFullListenConfirmations[index])
  ) return false
  return true
}

export function narrationReleaseApprovalIsComplete(
  approval: NarrationApproval | null,
  verification: NarrationReleaseApprovalVerification,
) {
  return Boolean(
    approval
    && typeof approval === 'object'
    && hasExactKeys(approval, ['approvedAt', 'approvedBy', 'checklistVersion', 'confirmations', 'fullListen'])
    && exactIsoTimestamp(approval.approvedAt)
    && safeHumanName(approval.approvedBy)
    && Array.isArray(approval.confirmations)
    && approval.checklistVersion === narrationApprovalChecklistVersion
    && approval.confirmations.length === narrationReleaseApprovalConfirmations.length
    && narrationReleaseApprovalConfirmations.every(({ label }, index) => approval.confirmations[index] === label)
    && narrationFullListenApprovalEvidenceIsComplete(approval.fullListen, verification)
    && Date.parse(approval.fullListen.receipt.completedAt) <= Date.parse(approval.approvedAt),
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
