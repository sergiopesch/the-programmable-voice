import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  narrationApprovalChecklistVersion,
  narrationDisclosure,
  narrationEditionAssetDirectory,
  narrationEditionConfiguration,
  narrationGenerationProvenance,
  narrationPassageHashMaterial,
  narrationPilotApprovalConfirmations,
  narrationPilotPassageIds,
  narrationReleaseApprovalConfirmations,
} from '../src/data/narrationEdition'
import { bookNarrationPassages, type NarrationPassage } from '../src/lib/narration'
import {
  narrationPilotApprovalIsComplete,
  narrationPilotProfileMaterial,
  narrationReleaseApprovalIsComplete,
  narrationReleaseId,
  narrationReleaseIdentityMaterial,
  narrationReleaseManifestUrl,
  type NarrationManifest,
  type NarrationManifestEntry,
  type NarrationPilotApproval,
  type NarrationPilotManifest,
} from '../src/lib/narrationRelease'

const execFileAsync = promisify(execFile)
const ffmpegBinary = process.env.FFMPEG_PATH?.trim() || 'ffmpeg'
const ffprobeBinary = process.env.FFPROBE_PATH?.trim() || 'ffprobe'
const projectRoot = path.resolve(import.meta.dirname, '..')
const publicRoot = path.join(projectRoot, 'public')
const releasePath = path.join(publicRoot, 'audio/narration/manifest.json')
const candidatePath = path.join(projectRoot, '.narration-work/candidate-manifest.json')
const pilotManifestPath = path.join(projectRoot, '.narration-work/pilot-manifest.json')
const pilotApprovalPath = path.join(projectRoot, '.narration-work/pilot-approval.json')

interface CandidateManifest extends Omit<NarrationManifest, 'releaseId' | 'releaseManifestUrl' | 'generationScope'> {
  releaseId: string | null
  releaseManifestUrl: string | null
  generationScope: { mode: 'full' | 'subset'; requestedPassageCount: number }
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

async function atomicWrite(filePath: string, data: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporaryPath, data)
  await fs.rename(temporaryPath, filePath)
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readJson<T>(filePath: string, label: string): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T
  } catch {
    throw new Error(`${label} is unavailable: ${path.relative(projectRoot, filePath)} does not contain valid JSON.`)
  }
}

async function runPool<T>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      if (item !== undefined) await worker(item)
    }
  }))
}

function expectedManuscript() {
  const configurationHash = sha256(JSON.stringify(narrationEditionConfiguration))
  const passages = bookNarrationPassages.map((passage) => ({
    passage,
    textHash: sha256(narrationPassageHashMaterial(configurationHash, passage.id, passage.text)),
  }))
  return {
    configurationHash,
    passages,
    manuscriptHash: sha256(JSON.stringify(passages.map(({ passage, textHash }) => ({ id: passage.id, textHash })))),
  }
}

function assertTechnicalQcShape(entry: NarrationManifestEntry, passage: NarrationPassage) {
  const qc = entry.technicalQc
  const words = passage.text.trim().split(/\s+/).filter(Boolean).length
  const expectedDurationSeconds = Number(((words / narrationEditionConfiguration.targetWordsPerMinute) * 60).toFixed(3))
  const expectedWordsPerMinute = (words / entry.durationSeconds) * 60
  const [minimumWordsPerMinute, maximumWordsPerMinute] = words < 6
    ? [45, 240]
    : words < 20
      ? [90, 195]
      : [100, 180]
  const finite = [
    entry.durationSeconds,
    qc.durationExpectedSeconds,
    qc.durationMeasuredSeconds,
    qc.wordsPerMinute,
    qc.integratedLoudnessLufs,
    qc.loudnessRangeLu,
    qc.truePeakDbtp,
    qc.leadingSilenceSeconds,
    qc.trailingSilenceSeconds,
  ].every(Number.isFinite)
  if (
    !finite
    || entry.durationSeconds <= 0
    || Math.abs(entry.durationSeconds - qc.durationMeasuredSeconds) > 0.02
    || Math.abs(qc.durationExpectedSeconds - expectedDurationSeconds) > 0.01
    || Math.abs(qc.wordsPerMinute - expectedWordsPerMinute) > 0.15
    || qc.wordsPerMinute < minimumWordsPerMinute
    || qc.wordsPerMinute > maximumWordsPerMinute
    || qc.integratedLoudnessLufs < -20.5
    || qc.integratedLoudnessLufs > -15.5
    || qc.loudnessRangeLu < 0
    || qc.loudnessRangeLu > 12
    || qc.truePeakDbtp > -1
    || qc.leadingSilenceSeconds < 0
    || qc.leadingSilenceSeconds > 0.35
    || qc.trailingSilenceSeconds < 0
    || qc.trailingSilenceSeconds > 0.5
    || qc.normalisationVersion !== narrationEditionConfiguration.normalisation.version
    || qc.fullDecodePassed !== true
  ) {
    throw new Error(`${entry.id} has incomplete or inconsistent technical-QC metadata.`)
  }
}

function resolveAudioPath(entry: NarrationManifestEntry) {
  if (!entry.url.startsWith(`/audio/narration/${narrationEditionAssetDirectory}/`)) throw new Error(`${entry.id} has an unexpected asset URL.`)
  if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`${entry.id} has an invalid audio checksum.`)
  const filePath = path.resolve(publicRoot, entry.url.replace(/^\//, ''))
  if (!filePath.startsWith(`${publicRoot}${path.sep}`)) throw new Error(`${entry.id} escapes the public asset directory.`)
  if (!path.basename(filePath).includes(entry.sha256)) throw new Error(`${entry.id} is not addressed by its audio checksum.`)
  return filePath
}

async function verifyFileLightweight(entry: NarrationManifestEntry) {
  const filePath = resolveAudioPath(entry)
  const bytes = new Uint8Array(await fs.readFile(filePath))
  if (sha256(bytes) !== entry.sha256) throw new Error(`${entry.id} failed checksum verification.`)
}

function boundarySilence(stderr: string, durationSeconds: number) {
  const events = [...stderr.matchAll(/silence_(start|end):\s*([\d.]+)/g)].map((match) => ({ type: match[1], time: Number(match[2]) }))
  const leading = events[0]?.type === 'start' && events[0].time <= 0.02 && events[1]?.type === 'end' ? events[1].time : 0
  const finalEvent = events.at(-1)
  const penultimateEvent = events.at(-2)
  const trailing = finalEvent?.type === 'end' && finalEvent.time >= durationSeconds - 0.06 && penultimateEvent?.type === 'start'
    ? durationSeconds - penultimateEvent.time
    : 0
  return { leading: Math.max(0, leading), trailing: Math.max(0, trailing) }
}

async function verifyFileFull(entry: NarrationManifestEntry, passage: NarrationPassage) {
  await verifyFileLightweight(entry)
  const filePath = resolveAudioPath(entry)
  const { stdout } = await execFileAsync(ffprobeBinary, [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
  ])
  const duration = Number(stdout.trim())
  if (!Number.isFinite(duration) || Math.abs(duration - entry.durationSeconds) > 0.02) {
    throw new Error(`${entry.id} failed duration verification.`)
  }
  await execFileAsync(ffmpegBinary, ['-v', 'error', '-i', filePath, '-f', 'null', '-'], { maxBuffer: 1_000_000 })

  const normalisation = narrationEditionConfiguration.normalisation
  const { stderr: loudnessStderr } = await execFileAsync(ffmpegBinary, [
    '-hide_banner', '-nostats', '-i', filePath,
    '-af', `loudnorm=I=${normalisation.integratedLoudnessLufs}:LRA=${normalisation.loudnessRangeLu}:TP=${normalisation.truePeakDbtp}:print_format=json`,
    '-f', 'null', '-',
  ], { maxBuffer: 2_000_000 })
  const loudnessBlock = [...loudnessStderr.matchAll(/\{\s*"input_i"[\s\S]*?\}/g)].at(-1)?.[0]
  const loudness = JSON.parse(loudnessBlock ?? '{}') as Record<string, string>
  const measuredLoudness = Number(loudness.input_i)
  const measuredRange = Number(loudness.input_lra)
  const measuredPeak = Number(loudness.input_tp)

  const { stderr: silenceStderr } = await execFileAsync(ffmpegBinary, [
    '-hide_banner', '-nostats', '-i', filePath,
    '-af', 'silencedetect=noise=-50dB:d=0.05', '-f', 'null', '-',
  ], { maxBuffer: 2_000_000 })
  const silence = boundarySilence(silenceStderr, duration)
  const words = passage.text.trim().split(/\s+/).filter(Boolean).length
  const measuredWordsPerMinute = (words / duration) * 60
  const qc = entry.technicalQc
  if (
    !Number.isFinite(measuredLoudness)
    || Math.abs(measuredLoudness - qc.integratedLoudnessLufs) > 0.15
    || Math.abs(measuredRange - qc.loudnessRangeLu) > 0.15
    || Math.abs(measuredPeak - qc.truePeakDbtp) > 0.15
    || Math.abs(silence.leading - qc.leadingSilenceSeconds) > 0.06
    || Math.abs(silence.trailing - qc.trailingSilenceSeconds) > 0.06
    || Math.abs(measuredWordsPerMinute - qc.wordsPerMinute) > 0.15
  ) {
    throw new Error(`${entry.id} failed full media-QC verification.`)
  }
}

function assertEntrySequence(entries: readonly NarrationManifestEntry[], expected: ReturnType<typeof expectedManuscript>['passages']) {
  if (new Set(entries.map((entry) => entry.id)).size !== expected.length) throw new Error('Narration passage ids are not unique.')
  if (new Set(entries.map((entry) => entry.url)).size !== expected.length) throw new Error('Narration asset URLs are not unique.')
  for (let index = 0; index < expected.length; index += 1) {
    const { passage, textHash } = expected[index]!
    const entry = entries[index]
    if (
      !entry
      || entry.id !== passage.id
      || entry.sectionId !== passage.sectionId
      || entry.targetId !== passage.targetId
      || entry.textHash !== textHash
      || entry.qcStatus !== 'technical-qc-passed'
    ) {
      throw new Error(`Narration entry ${index + 1} does not match ${passage.id}.`)
    }
    assertTechnicalQcShape(entry, passage)
  }
}

function assertReleaseCore(manifest: CandidateManifest | NarrationManifest) {
  const expected = expectedManuscript()
  if (
    !manifest
    || manifest.schemaVersion !== 1
    || !manifest.generationScope
    || !Array.isArray(manifest.passages)
    || typeof manifest.releaseId !== 'string'
    || typeof manifest.releaseManifestUrl !== 'string'
  ) throw new Error('Narration manifest schema is unsupported.')
  if (manifest.configurationHash !== expected.configurationHash) throw new Error('Narration configuration does not match this build.')
  if (manifest.manuscriptHash !== expected.manuscriptHash) throw new Error('Narration manuscript digest does not match this build.')
  if (
    !manifest.complete
    || manifest.generationScope.mode !== 'full'
    || manifest.generationScope.requestedPassageCount !== expected.passages.length
    || manifest.passageCount !== expected.passages.length
    || manifest.passages.length !== expected.passages.length
  ) {
    throw new Error(`Narration is incomplete or came from a subset run: ${manifest.passages.length}/${expected.passages.length} passages are present.`)
  }
  if (
    manifest.edition !== narrationEditionConfiguration.edition
    || manifest.model !== narrationEditionConfiguration.model
    || manifest.voice !== narrationEditionConfiguration.voice
    || JSON.stringify(manifest.provenance) !== JSON.stringify(narrationGenerationProvenance)
  ) {
    throw new Error('Narration edition metadata does not match the pinned configuration.')
  }
  if (manifest.disclosure !== narrationDisclosure) throw new Error('Narration disclosure is missing or altered.')
  if (!/^[a-f0-9]{64}$/.test(manifest.pilotProfileHash)) throw new Error('Narration release is not tied to an approved voice pilot.')
  assertEntrySequence(manifest.passages, expected.passages)
  const measuredTotal = Number(manifest.passages.reduce((total, entry) => total + entry.durationSeconds, 0).toFixed(3))
  if (Math.abs(measuredTotal - manifest.totalDurationSeconds) > 0.01) throw new Error('Narration total duration is inconsistent.')

  const { releaseId, releaseManifestUrl, approved, approval, ...identityFields } = manifest
  void approved
  void approval
  const expectedReleaseId = narrationReleaseId(manifest.edition, sha256(narrationReleaseIdentityMaterial(identityFields)))
  if (releaseId !== expectedReleaseId || releaseManifestUrl !== narrationReleaseManifestUrl(expectedReleaseId)) {
    throw new Error('Narration release identity does not match its immutable content.')
  }
  return expected
}

function requestedApprover() {
  return process.argv.find((argument) => argument.startsWith('--approver='))?.slice('--approver='.length).trim()
}

function requireApprovalFlags(confirmations: readonly { flag: string; label: string }[]) {
  const approver = requestedApprover()
  const missing = confirmations.filter(({ flag }) => !process.argv.includes(flag)).map(({ flag }) => flag)
  if (!approver || missing.length > 0) {
    throw new Error(`Approval requires --approver=<name>${missing.length > 0 ? ` and ${missing.join(', ')}` : ''}.`)
  }
  return approver
}

async function verifyEntries(
  entries: readonly NarrationManifestEntry[],
  expected: readonly { passage: NarrationPassage }[],
  lightweight: boolean,
) {
  const passageById = new Map(expected.map(({ passage }) => [passage.id, passage]))
  await runPool(entries, lightweight ? 4 : 2, async (entry) => {
    const passage = passageById.get(entry.id)
    if (!passage) throw new Error(`${entry.id} is not part of this manuscript.`)
    if (lightweight) await verifyFileLightweight(entry)
    else await verifyFileFull(entry, passage)
  })
}

async function verifyPilot() {
  const manifest = await readJson<NarrationPilotManifest>(pilotManifestPath, 'Narration voice pilot')
  const expected = expectedManuscript()
  const expectedPilot = narrationPilotPassageIds.map((id) => expected.passages.find(({ passage }) => passage.id === id)).filter((item): item is { passage: NarrationPassage; textHash: string } => Boolean(item))
  if (
    manifest.schemaVersion !== 1
    || !manifest.complete
    || manifest.configurationHash !== expected.configurationHash
    || manifest.manuscriptHash !== expected.manuscriptHash
    || manifest.edition !== narrationEditionConfiguration.edition
    || manifest.model !== narrationEditionConfiguration.model
    || manifest.voice !== narrationEditionConfiguration.voice
    || JSON.stringify(manifest.provenance) !== JSON.stringify(narrationGenerationProvenance)
    || expectedPilot.length !== narrationPilotPassageIds.length
    || manifest.passageCount !== expectedPilot.length
    || manifest.passages.length !== expectedPilot.length
  ) {
    throw new Error('The voice pilot is incomplete or does not match this narration edition.')
  }
  assertEntrySequence(manifest.passages, expectedPilot)
  await verifyEntries(manifest.passages, expectedPilot, false)
  process.stdout.write(`Verified pending voice pilot: ${manifest.passageCount} technically valid samples; no human approval was recorded.\n`)
  return { manifest, expected }
}

async function approvePilot() {
  const approver = requireApprovalFlags(narrationPilotApprovalConfirmations)
  const { manifest, expected } = await verifyPilot()
  const pilotProfileHash = sha256(narrationPilotProfileMaterial(manifest))
  const approval: NarrationPilotApproval = {
    schemaVersion: 1,
    approvedAt: new Date().toISOString(),
    approvedBy: approver,
    checklistVersion: narrationApprovalChecklistVersion,
    configurationHash: expected.configurationHash,
    manuscriptHash: expected.manuscriptHash,
    pilotProfileHash,
    passageIds: [...narrationPilotPassageIds],
    confirmations: narrationPilotApprovalConfirmations.map(({ label }) => label),
  }
  if (!narrationPilotApprovalIsComplete(approval)) throw new Error('Voice-pilot approval checklist is incomplete.')
  await atomicWrite(pilotApprovalPath, `${JSON.stringify(approval, null, 2)}\n`)
  process.stdout.write(`Approved voice pilot ${pilotProfileHash}: ${manifest.passageCount} technically verified samples.\n`)
}

async function approveRelease() {
  const approver = requireApprovalFlags(narrationReleaseApprovalConfirmations)
  const candidate = await readJson<CandidateManifest>(candidatePath, 'Narration candidate')
  const expected = assertReleaseCore(candidate)
  await verifyEntries(candidate.passages, expected.passages, false)
  if (!candidate.releaseId || !candidate.releaseManifestUrl) throw new Error('The complete candidate has no immutable release identity.')

  let existing: NarrationManifest | null = null
  if (await pathExists(releasePath)) {
    existing = await readJson<NarrationManifest>(releasePath, 'Existing narration release')
    if (existing.edition === candidate.edition && existing.releaseId !== candidate.releaseId) {
      throw new Error(`Edition ${candidate.edition} is already released as ${existing.releaseId}. Bump the edition before publishing different audio or manuscript content.`)
    }
  }

  if (existing?.edition === candidate.edition && existing.releaseId === candidate.releaseId) {
    assertReleaseCore(existing)
    if (!existing.approved || !narrationReleaseApprovalIsComplete(existing.approval)) throw new Error('The existing same-edition release is not valid and will not be overwritten.')
    await verifyEntries(existing.passages, expected.passages, false)
    process.stdout.write(`Narration release ${existing.releaseId} is already approved; no immutable file was changed.\n`)
    return
  }

  const release: NarrationManifest = {
    ...candidate,
    releaseId: candidate.releaseId,
    releaseManifestUrl: candidate.releaseManifestUrl,
    generationScope: { mode: 'full', requestedPassageCount: candidate.generationScope.requestedPassageCount },
    approved: true,
    approval: {
      approvedAt: new Date().toISOString(),
      approvedBy: approver,
      checklistVersion: narrationApprovalChecklistVersion,
      confirmations: narrationReleaseApprovalConfirmations.map(({ label }) => label),
    },
  }
  if (!narrationReleaseApprovalIsComplete(release.approval)) throw new Error('Narration release approval checklist is incomplete.')
  assertReleaseCore(release)

  const versionedPath = path.join(publicRoot, release.releaseManifestUrl.replace(/^\//, ''))
  const releaseBytes = `${JSON.stringify(release, null, 2)}\n`
  if (await pathExists(versionedPath)) {
    const existingBytes = await fs.readFile(versionedPath, 'utf8')
    if (existingBytes !== releaseBytes) throw new Error(`Refusing to overwrite immutable release manifest ${path.relative(projectRoot, versionedPath)}.`)
  } else {
    await atomicWrite(versionedPath, releaseBytes)
  }
  await atomicWrite(releasePath, releaseBytes)
  process.stdout.write(`Approved narration release ${release.releaseId}: ${release.passageCount} immutable audio files.\n`)
}

async function verifyRelease(lightweight: boolean) {
  const manifest = await readJson<NarrationManifest>(releasePath, 'Narration release')
  const expected = assertReleaseCore(manifest)
  if (!manifest.approved || !narrationReleaseApprovalIsComplete(manifest.approval)) {
    throw new Error('Narration files exist but this edition has not received the complete editorial listening approval.')
  }
  await verifyEntries(manifest.passages, expected.passages, lightweight)
  const versionedPath = path.join(publicRoot, manifest.releaseManifestUrl.replace(/^\//, ''))
  if (!versionedPath.startsWith(`${publicRoot}${path.sep}`)) throw new Error('Narration release manifest URL escapes the public directory.')
  const [pointerBytes, versionedBytes] = await Promise.all([
    fs.readFile(releasePath, 'utf8'),
    fs.readFile(versionedPath, 'utf8'),
  ])
  if (pointerBytes !== versionedBytes) throw new Error('The release pointer differs from its immutable versioned manifest.')
  process.stdout.write(`Verified approved narration release ${manifest.releaseId}: ${manifest.passageCount} immutable files (${lightweight ? 'deployment' : 'full media'} checks).\n`)
}

async function main() {
  const approve = process.argv.includes('--approve')
  const approvePilotMode = process.argv.includes('--approve-pilot')
  const verifyPilotMode = process.argv.includes('--verify-pilot')
  const lightweight = process.argv.includes('--lightweight')
  if (Number(approve) + Number(approvePilotMode) + Number(verifyPilotMode) > 1) throw new Error('Choose one of --approve, --approve-pilot or --verify-pilot.')
  if (lightweight && (approve || approvePilotMode || verifyPilotMode)) throw new Error('Pilot and approval checks require full local FFmpeg verification; remove --lightweight.')
  if (verifyPilotMode) return verifyPilot()
  if (approvePilotMode) return approvePilot()
  if (approve) return approveRelease()
  return verifyRelease(lightweight)
}

await main()
