import { createHash } from 'node:crypto'
import {
  narrationPilotApprovalIsComplete,
  narrationPilotProfileMaterial,
  type NarrationPilotApproval,
  type NarrationPilotManifest,
  type NarrationPilotReceipt,
} from '../src/lib/narrationRelease'

export interface CurrentNarrationPilotIdentity {
  configurationHash: string
  /**
   * The current whole-book digest is deliberately informational here. Pilot
   * validity is scoped to the ordered pilot passages below, so an unrelated
   * manuscript or reading-note edit does not erase an exact listening record.
  */
  manuscriptHash: string
  passages: readonly { id: string; sectionId: string; targetId: string; textHash: string }[]
}

export interface NarrationApprovedPilotEntryIdentity {
  id: string
  textHash: string
  url: string
  sha256: string
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}

/**
 * Checks the immutable generated pilot against the current pilot scope. The
 * manifest's whole-manuscript hash remains a historical generation snapshot;
 * current validity comes from the ordered per-passage hashes, which include
 * each passage's reading note through narrationPassageHashMaterial.
 */
export function narrationPilotManifestProblems(
  manifest: NarrationPilotManifest,
  current: CurrentNarrationPilotIdentity,
) {
  const problems: string[] = []
  if (manifest.schemaVersion !== 1) problems.push('pilot manifest schema is unsupported')
  if (!manifest.complete) problems.push('pilot manifest is incomplete')
  if (manifest.configurationHash !== current.configurationHash) problems.push('pilot configuration does not match this workspace')
  if (!isSha256(manifest.manuscriptHash)) problems.push('pilot historical manuscript snapshot is invalid')

  const manifestPassages = Array.isArray(manifest.passages) ? manifest.passages : []
  if (manifest.passageCount !== current.passages.length || manifestPassages.length !== current.passages.length) {
    problems.push('pilot passage count does not match this workspace')
  }
  for (let index = 0; index < current.passages.length; index += 1) {
    const expected = current.passages[index]!
    const actual = manifestPassages[index]
    if (
      !actual
      || actual.id !== expected.id
      || actual.sectionId !== expected.sectionId
      || actual.targetId !== expected.targetId
      || actual.textHash !== expected.textHash
    ) {
      problems.push(`pilot passage identity does not match this workspace at ${expected.id}`)
    }
  }
  return problems
}

/**
 * Extends the pilot-manifest check with the exact human approval. Changes to
 * approved audio hashes or technical QC alter pilotProfileHash and therefore
 * invalidate the approval even though unrelated whole-book edits do not.
 */
export function narrationPilotApprovalProblems(
  manifest: NarrationPilotManifest,
  approval: NarrationPilotApproval,
  current: CurrentNarrationPilotIdentity,
) {
  const problems = narrationPilotManifestProblems(manifest, current)
  const pilotProfileHash = sha256(narrationPilotProfileMaterial(manifest))
  const expectedIds = current.passages.map(({ id }) => id)

  if (approval.schemaVersion !== 1 || !isIsoTimestamp(approval.approvedAt)) problems.push('pilot approval schema or timestamp is invalid')
  if (approval.configurationHash !== current.configurationHash) problems.push('pilot approval configuration does not match this workspace')
  if (approval.manuscriptHash !== manifest.manuscriptHash) problems.push('pilot approval does not retain the historical manuscript snapshot')
  if (approval.pilotProfileHash !== pilotProfileHash) problems.push('pilot approval digest does not match the pilot manifest')
  if (
    !Array.isArray(approval.passageIds)
    || approval.passageIds.length !== expectedIds.length
    || approval.passageIds.some((id, index) => id !== expectedIds[index])
  ) problems.push('pilot approval passage order does not match this workspace')
  if (!narrationPilotApprovalIsComplete(approval)) problems.push('pilot listening approval is incomplete or obsolete')

  return { pilotProfileHash, problems }
}

/**
 * Requires the exact approved pilot audio to remain embedded in a generation
 * state, full candidate or released edition. Text identity alone is not
 * enough: changing either the immutable URL or its checksum means the bytes
 * are no longer the ones that received representative-pilot approval.
 */
export function narrationApprovedPilotParityProblems(
  pilot: NarrationPilotManifest,
  entries: readonly NarrationApprovedPilotEntryIdentity[],
) {
  const problems: string[] = []
  const pilotPassages = Array.isArray(pilot.passages) ? pilot.passages : []
  const pilotIds = new Set(pilotPassages.map(({ id }) => id))
  const entryById = new Map<string, NarrationApprovedPilotEntryIdentity>()
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!pilotIds.has(entry.id)) continue
    if (entryById.has(entry.id)) problems.push(`full narration repeats approved pilot passage ${entry.id}`)
    entryById.set(entry.id, entry)
  }

  for (const approved of pilotPassages) {
    const actual = entryById.get(approved.id)
    if (
      !actual
      || actual.id !== approved.id
      || actual.textHash !== approved.textHash
      || actual.url !== approved.url
      || actual.sha256 !== approved.sha256
    ) {
      problems.push(`full narration changed approved pilot audio ${approved.id}`)
    }
  }
  return problems
}

/** Validates a self-contained approved-pilot receipt and its full-edition use. */
export function narrationPilotReceiptProblems(
  receipt: NarrationPilotReceipt | null | undefined,
  current: CurrentNarrationPilotIdentity,
  declaredPilotProfileHash: string,
  entries: readonly NarrationApprovedPilotEntryIdentity[],
) {
  if (!receipt?.manifest || !receipt.approval) {
    return { pilotProfileHash: '', problems: ['approved pilot receipt is missing or malformed'] }
  }
  const { pilotProfileHash, problems } = narrationPilotApprovalProblems(receipt.manifest, receipt.approval, current)
  if (declaredPilotProfileHash !== pilotProfileHash) problems.push('full narration pilot profile does not match its embedded receipt')
  problems.push(...narrationApprovedPilotParityProblems(receipt.manifest, entries))
  return { pilotProfileHash, problems }
}

export function narrationPilotVerificationMessage(
  passageCount: number,
  approval: NarrationPilotApproval | null,
) {
  return approval
    ? `Verified approved voice pilot ${approval.pilotProfileHash}: ${passageCount} technically valid samples; human listening approved by ${approval.approvedBy} on ${approval.approvedAt}.\n`
    : `Verified pending voice pilot: ${passageCount} technically valid samples; no valid human approval is recorded.\n`
}
