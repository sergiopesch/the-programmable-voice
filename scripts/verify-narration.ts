import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual, promisify } from 'node:util'
import {
  narrationApprovalChecklistVersion,
  narrationDisclosure,
  narrationEditionAssetDirectory,
  narrationEditionConfiguration,
  narrationGenerationProvenance,
  narrationNormalisationVersionFor,
  narrationPassageHashMaterial,
  narrationPilotApprovalConfirmations,
  narrationPilotPassageIds,
  narrationReleaseApprovalConfirmations,
  narrationSpokenTextFor,
} from '../src/data/narrationEdition'
import { bookNarrationPassages, type NarrationPassage } from '../src/lib/narration'
import {
  narrationFullListenReceiptMaterial,
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
  type NarrationPilotReceipt,
} from '../src/lib/narrationRelease'
import {
  narrationPilotApprovalProblems,
  narrationPilotManifestProblems,
  narrationPilotReceiptProblems,
  narrationPilotVerificationMessage,
  type CurrentNarrationPilotIdentity,
} from './narration-pilot-contract'
import {
  narrationCharacterPacingBounds,
  narrationCharactersPerSecond,
  narrationReportedWordsPerMinute,
} from './narration-pacing'
import { narrationLoudnessIsWithinBounds } from './narration-loudness'
import { decodedAudioDurationSeconds } from './narration-media'
import {
  buildNarrationFullListenPackage,
  createNarrationFullListenReceipt,
  narrationFullListenApprovalEvidence,
  narrationFullListenApprovalEvidenceProblems,
  narrationFullListenReceiptProblems,
  type NarrationFullListenApprovalEvidence,
  type NarrationFullListenReceipt,
} from './narration-review-contract'

const execFileAsync = promisify(execFile)
const ffmpegBinary = process.env.FFMPEG_PATH?.trim() || 'ffmpeg'
const projectRoot = path.resolve(import.meta.dirname, '..')
const publicRoot = path.join(projectRoot, 'public')
const narrationAssetRoot = path.join(publicRoot, 'audio/narration', narrationEditionAssetDirectory)
const releasePath = path.join(publicRoot, 'audio/narration/manifest.json')
const candidatePath = path.join(projectRoot, '.narration-work/candidate-manifest.json')
const pilotManifestPath = path.join(projectRoot, '.narration-work/pilot-manifest.json')
const pilotApprovalPath = path.join(projectRoot, '.narration-work/pilot-approval.json')
const fullListenRoot = path.join(projectRoot, '.narration-work/full-listen')

interface CandidateManifest extends Omit<NarrationManifest, 'releaseId' | 'releaseManifestUrl' | 'generationScope'> {
  releaseId: string | null
  releaseManifestUrl: string | null
  generationScope: { mode: 'full' | 'subset'; requestedPassageCount: number }
}

interface VerifiedCandidateManifest extends CandidateManifest {
  releaseId: string
  releaseManifestUrl: string
  generationScope: { mode: 'full'; requestedPassageCount: number }
  complete: true
  approved: false
  approval: null
}

type NarrationApprovalWithFullListen = NonNullable<NarrationManifest['approval']> & {
  fullListen: NarrationFullListenApprovalEvidence
}

type NarrationManifestWithFullListen = Omit<NarrationManifest, 'approval'> & {
  approval: NarrationApprovalWithFullListen | null
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

async function immutableWrite(filePath: string, data: string, label: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporaryPath, data, { flag: 'wx' })
  try {
    await fs.link(temporaryPath, filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const existing = await fs.readFile(filePath, 'utf8')
    if (existing !== data) throw new Error(`Refusing to overwrite ${label}: ${path.relative(projectRoot, filePath)}.`)
  } finally {
    await fs.rm(temporaryPath, { force: true })
  }
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
  const spokenText = narrationSpokenTextFor(passage.id, passage.text)
  const words = spokenText.trim().split(/\s+/).filter(Boolean).length
  const expectedDurationSeconds = Number(((words / narrationEditionConfiguration.targetWordsPerMinute) * 60).toFixed(3))
  const expectedWordsPerMinute = narrationReportedWordsPerMinute((words / entry.durationSeconds) * 60)
  const expectedCharactersPerSecond = narrationCharactersPerSecond(spokenText, entry.durationSeconds)
  const { minimumCharactersPerSecond, maximumCharactersPerSecond } = narrationCharacterPacingBounds(spokenText)
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
    || expectedCharactersPerSecond < minimumCharactersPerSecond
    || expectedCharactersPerSecond > maximumCharactersPerSecond
    || !narrationLoudnessIsWithinBounds({
      durationSeconds: qc.durationMeasuredSeconds,
      integratedLoudnessLufs: qc.integratedLoudnessLufs,
      loudnessRangeLu: qc.loudnessRangeLu,
      truePeakDbtp: qc.truePeakDbtp,
      targetTruePeakDbtp: narrationEditionConfiguration.normalisation.truePeakDbtp,
    })
    || qc.leadingSilenceSeconds < 0
    || qc.leadingSilenceSeconds > 0.35
    || qc.trailingSilenceSeconds < 0
    || qc.trailingSilenceSeconds > 0.5
    || qc.normalisationVersion !== narrationNormalisationVersionFor(passage.id)
    || qc.fullDecodePassed !== true
  ) {
    throw new Error(`${entry.id} has incomplete or inconsistent technical-QC metadata.`)
  }
}

export function resolveAudioPath(entry: NarrationManifestEntry) {
  if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`${entry.id} has an invalid audio checksum.`)
  const escapedDirectory = narrationEditionAssetDirectory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = entry.url.match(new RegExp(`^/audio/narration/${escapedDirectory}/(\\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*-([a-f0-9]{64})\\.mp3)$`))
  if (!match || match[2] !== entry.sha256) throw new Error(`${entry.id} has an unexpected or non-checksum-addressed asset URL.`)
  const filePath = path.resolve(narrationAssetRoot, match[1])
  if (path.dirname(filePath) !== narrationAssetRoot) throw new Error(`${entry.id} escapes the narration edition asset directory.`)
  return filePath
}

let verifiedNarrationAssetRoot: Promise<string> | undefined

function requireRegularNarrationAssetRoot() {
  verifiedNarrationAssetRoot ??= Promise.all([
    fs.lstat(narrationAssetRoot),
    fs.realpath(narrationAssetRoot),
  ]).then(([stat, realPath]) => {
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Narration edition asset directory is not a regular directory.')
    return realPath
  })
  return verifiedNarrationAssetRoot
}

async function verifyFileLightweight(entry: NarrationManifestEntry) {
  const filePath = resolveAudioPath(entry)
  const [fileStat, realAssetRoot, realFilePath] = await Promise.all([
    fs.lstat(filePath),
    requireRegularNarrationAssetRoot(),
    fs.realpath(filePath),
  ])
  if (
    !fileStat.isFile()
    || fileStat.isSymbolicLink()
    || path.dirname(realFilePath) !== realAssetRoot
  ) throw new Error(`${entry.id} is not a regular narration audio file inside the edition asset directory.`)
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

interface NarrationFullMediaQcMeasurements {
  integratedLoudnessLufs: number
  loudnessRangeLu: number
  truePeakDbtp: number
  leadingSilenceSeconds: number
  trailingSilenceSeconds: number
  wordsPerMinute: number
  charactersPerSecond: number
  minimumCharactersPerSecond: number
  maximumCharactersPerSecond: number
  loudnessWithinBounds: boolean
}

export function narrationFullMediaQcProblems(
  qc: NarrationManifestEntry['technicalQc'],
  measured: NarrationFullMediaQcMeasurements,
) {
  const problems: string[] = []
  const compare = (label: string, actual: number, recorded: number, tolerance: number) => {
    if (!Number.isFinite(actual)) problems.push(`${label} measurement is not finite`)
    else if (Math.abs(actual - recorded) > tolerance) {
      problems.push(`${label} measured ${actual} but metadata records ${recorded}`)
    }
  }
  compare('integrated loudness', measured.integratedLoudnessLufs, qc.integratedLoudnessLufs, 0.15)
  compare('loudness range', measured.loudnessRangeLu, qc.loudnessRangeLu, 0.15)
  compare('true peak', measured.truePeakDbtp, qc.truePeakDbtp, 0.15)
  compare('leading silence', measured.leadingSilenceSeconds, qc.leadingSilenceSeconds, 0.06)
  compare('trailing silence', measured.trailingSilenceSeconds, qc.trailingSilenceSeconds, 0.06)
  compare('words per minute', measured.wordsPerMinute, qc.wordsPerMinute, 0.15)
  if (
    !Number.isFinite(measured.charactersPerSecond)
    || measured.charactersPerSecond < measured.minimumCharactersPerSecond
    || measured.charactersPerSecond > measured.maximumCharactersPerSecond
  ) {
    problems.push(
      `character pace ${measured.charactersPerSecond} is outside ${measured.minimumCharactersPerSecond}–${measured.maximumCharactersPerSecond}`,
    )
  }
  if (!measured.loudnessWithinBounds) problems.push('loudness is outside the configured bounds')
  return problems
}

async function verifyFileFull(entry: NarrationManifestEntry, passage: NarrationPassage) {
  await verifyFileLightweight(entry)
  const filePath = resolveAudioPath(entry)
  const duration = await decodedAudioDurationSeconds(
    filePath,
    narrationEditionConfiguration.normalisation.sampleRateHz,
  )
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
  const reportedMeasuredLoudness = Number(measuredLoudness.toFixed(1))
  const reportedMeasuredRange = Number(measuredRange.toFixed(1))
  const reportedMeasuredPeak = Number(measuredPeak.toFixed(1))

  const { stderr: silenceStderr } = await execFileAsync(ffmpegBinary, [
    '-hide_banner', '-nostats', '-i', filePath,
    '-af', 'silencedetect=noise=-50dB:d=0.05', '-f', 'null', '-',
  ], { maxBuffer: 2_000_000 })
  const silence = boundarySilence(silenceStderr, duration)
  const spokenText = narrationSpokenTextFor(passage.id, passage.text)
  const words = spokenText.trim().split(/\s+/).filter(Boolean).length
  const recordedDurationSeconds = Number(duration.toFixed(3))
  const measuredWordsPerMinute = narrationReportedWordsPerMinute((words / recordedDurationSeconds) * 60)
  const measuredCharactersPerSecond = narrationCharactersPerSecond(spokenText, recordedDurationSeconds)
  const { minimumCharactersPerSecond, maximumCharactersPerSecond } = narrationCharacterPacingBounds(spokenText)
  const qc = entry.technicalQc
  const problems = narrationFullMediaQcProblems(qc, {
    integratedLoudnessLufs: measuredLoudness,
    loudnessRangeLu: measuredRange,
    truePeakDbtp: measuredPeak,
    leadingSilenceSeconds: silence.leading,
    trailingSilenceSeconds: silence.trailing,
    wordsPerMinute: measuredWordsPerMinute,
    charactersPerSecond: measuredCharactersPerSecond,
    minimumCharactersPerSecond,
    maximumCharactersPerSecond,
    loudnessWithinBounds: narrationLoudnessIsWithinBounds({
      durationSeconds: recordedDurationSeconds,
      integratedLoudnessLufs: reportedMeasuredLoudness,
      loudnessRangeLu: reportedMeasuredRange,
      truePeakDbtp: reportedMeasuredPeak,
      targetTruePeakDbtp: normalisation.truePeakDbtp,
    }),
  })
  if (problems.length > 0) throw new Error(`${entry.id} failed full media-QC verification: ${problems.join('; ')}.`)
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

function expectedPilotScope(expected: ReturnType<typeof expectedManuscript>) {
  const passages = narrationPilotPassageIds
    .map((id) => expected.passages.find(({ passage }) => passage.id === id))
    .filter((item): item is { passage: NarrationPassage; textHash: string } => Boolean(item))
  const current: CurrentNarrationPilotIdentity = {
    configurationHash: expected.configurationHash,
    manuscriptHash: expected.manuscriptHash,
    passages: passages.map(({ passage, textHash }) => ({
      id: passage.id,
      sectionId: passage.sectionId,
      targetId: passage.targetId,
      textHash,
    })),
  }
  return { current, passages }
}

function assertPilotReceiptCore(
  receipt: NarrationPilotReceipt | null | undefined,
  declaredPilotProfileHash: string,
  entries: readonly NarrationManifestEntry[],
  expected: ReturnType<typeof expectedManuscript>,
  label: string,
) {
  if (!receipt?.manifest || !receipt.approval || !Array.isArray(receipt.manifest.passages)) {
    throw new Error(`${label} does not contain a complete approved-pilot receipt.`)
  }
  const { current, passages } = expectedPilotScope(expected)
  const { pilotProfileHash, problems } = narrationPilotReceiptProblems(
    receipt,
    current,
    declaredPilotProfileHash,
    entries,
  )
  if (
    passages.length !== narrationPilotPassageIds.length
    || receipt.manifest.edition !== narrationEditionConfiguration.edition
    || receipt.manifest.model !== narrationEditionConfiguration.model
    || receipt.manifest.voice !== narrationEditionConfiguration.voice
    || JSON.stringify(receipt.manifest.provenance) !== JSON.stringify(narrationGenerationProvenance)
  ) problems.push('approved pilot receipt metadata does not match the pinned narration edition')
  if (problems.length > 0) throw new Error(`${label} failed its approved-pilot contract: ${problems.join('; ')}.`)
  assertEntrySequence(receipt.manifest.passages, passages)
  return pilotProfileHash
}

async function requirePrivatePilotReceipt(
  manifest: CandidateManifest,
  expected: ReturnType<typeof expectedManuscript>,
) {
  const [pilot, approval] = await Promise.all([
    readJson<NarrationPilotManifest>(pilotManifestPath, 'Narration voice pilot'),
    readJson<NarrationPilotApproval>(pilotApprovalPath, 'Narration voice-pilot approval'),
  ])
  const receipt: NarrationPilotReceipt = { manifest: pilot, approval }
  assertPilotReceiptCore(receipt, manifest.pilotProfileHash, manifest.passages, expected, 'Private approved pilot')
  if (!isDeepStrictEqual(receipt, manifest.pilotReceipt)) {
    throw new Error('Narration candidate does not embed the exact current private approved-pilot receipt.')
  }
}

function assertReleaseCore(manifest: CandidateManifest | NarrationManifest) {
  const expected = expectedManuscript()
  if (
    !manifest
    || manifest.schemaVersion !== 1
    || !manifest.generationScope
    || !Array.isArray(manifest.passages)
    || !manifest.pilotReceipt
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
  assertPilotReceiptCore(manifest.pilotReceipt, manifest.pilotProfileHash, manifest.passages, expected, 'Narration release')
  assertEntrySequence(manifest.passages, expected.passages)
  const measuredTotal = Number(manifest.passages.reduce((total, entry) => total + entry.durationSeconds, 0).toFixed(3))
  if (Math.abs(measuredTotal - manifest.totalDurationSeconds) > 0.01) throw new Error('Narration total duration is inconsistent.')

  const { releaseId, releaseManifestUrl, approved, approval, ...identityFields } = manifest
  void approved
  void approval
  const expectedReleaseId = narrationReleaseId(manifest.edition, sha256(narrationReleaseIdentityMaterial(
    identityFields as Omit<NarrationManifest, 'releaseId' | 'releaseManifestUrl' | 'approved' | 'approval'>,
  )))
  if (releaseId !== expectedReleaseId || releaseManifestUrl !== narrationReleaseManifestUrl(expectedReleaseId)) {
    throw new Error('Narration release identity does not match its immutable content.')
  }
  return expected
}

function assertCandidateState(candidate: CandidateManifest): asserts candidate is VerifiedCandidateManifest {
  if (
    candidate.complete !== true
    || candidate.generationScope.mode !== 'full'
    || typeof candidate.releaseId !== 'string'
    || typeof candidate.releaseManifestUrl !== 'string'
    || candidate.approved !== false
    || candidate.approval !== null
  ) {
    throw new Error('Narration candidate is not a complete, unapproved full-edition candidate.')
  }
}

async function readCandidateCore() {
  const candidate = await readJson<CandidateManifest>(candidatePath, 'Narration candidate')
  const expected = assertReleaseCore(candidate)
  assertCandidateState(candidate)
  await requirePrivatePilotReceipt(candidate, expected)
  return { candidate, expected }
}

export async function verifyCandidate() {
  const verified = await readCandidateCore()
  await verifyEntries(verified.candidate.passages, verified.expected.passages, false)
  return verified
}

function expectedFullListenPackage(manifest: VerifiedCandidateManifest | NarrationManifestWithFullListen) {
  return buildNarrationFullListenPackage(manifest)
}

function fullListenDirectory(releaseId: string) {
  const directory = path.resolve(fullListenRoot, releaseId)
  if (path.dirname(directory) !== fullListenRoot) throw new Error('Narration full-listen directory escapes its private root.')
  return directory
}

async function assertFullListenPackage(manifest: VerifiedCandidateManifest | NarrationManifestWithFullListen) {
  const reviewPackage = expectedFullListenPackage(manifest)
  const directory = fullListenDirectory(reviewPackage.directoryName)
  for (const [filename, expectedBytes] of Object.entries(reviewPackage.files)) {
    const filePath = path.join(directory, filename)
    let actualBytes: string
    try {
      actualBytes = await fs.readFile(filePath, 'utf8')
    } catch {
      throw new Error(`Full-listen review package is incomplete: ${path.relative(projectRoot, filePath)} is unavailable.`)
    }
    if (actualBytes !== expectedBytes) throw new Error(`Full-listen review package file ${filename} does not match candidate ${manifest.releaseId}.`)
  }
  return { reviewPackage, directory }
}

async function requireFullListenReceipt(manifest: VerifiedCandidateManifest) {
  const { reviewPackage, directory } = await assertFullListenPackage(manifest)
  const receipt = await readJson<unknown>(path.join(directory, 'receipt.json'), 'Full-listen receipt')
  const problems = narrationFullListenReceiptProblems(receipt, reviewPackage.expectedReceipt)
  if (problems.length > 0) throw new Error(`Full-listen receipt is invalid: ${problems.join('; ')}.`)
  return receipt as NarrationFullListenReceipt
}

function assertReleaseFullListenEvidence(manifest: NarrationManifestWithFullListen) {
  const reviewPackage = expectedFullListenPackage(manifest)
  const evidence = manifest.approval?.fullListen
  const problems = narrationFullListenApprovalEvidenceProblems(evidence, reviewPackage.expectedReceipt)
  if (problems.length > 0) throw new Error(`Narration release failed its full-listen receipt contract: ${problems.join('; ')}.`)
  return evidence as NarrationFullListenApprovalEvidence
}

async function prepareFullListen() {
  const { candidate } = await verifyCandidate()
  const reviewPackage = expectedFullListenPackage(candidate)
  const directory = fullListenDirectory(reviewPackage.directoryName)
  await fs.mkdir(directory, { recursive: true })
  for (const [filename, bytes] of Object.entries(reviewPackage.files)) {
    await immutableWrite(path.join(directory, filename), bytes, 'checksum-bound full-listen package file')
  }
  process.stdout.write(`Prepared checksum-bound full-listen package for ${candidate.releaseId}: ${path.relative(projectRoot, directory)} (${candidate.passageCount} passages).\n`)
}

function requestedListener() {
  return process.argv.find((argument) => argument.startsWith('--listener='))?.slice('--listener='.length).trim()
}

async function recordFullListen() {
  const { candidate, expected } = await readCandidateCore()
  await verifyEntries(candidate.passages, expected.passages, true)
  const { reviewPackage, directory } = await assertFullListenPackage(candidate)
  const listener = requestedListener()
  if (!listener || !process.argv.includes('--confirm-full-listen-complete')) {
    throw new Error('Recording the full listen requires --listener=<name> and --confirm-full-listen-complete.')
  }
  const receiptPath = path.join(directory, 'receipt.json')
  if (await pathExists(receiptPath)) {
    const existing = await readJson<unknown>(receiptPath, 'Full-listen receipt')
    const problems = narrationFullListenReceiptProblems(existing, reviewPackage.expectedReceipt)
    if (problems.length > 0 || (existing as NarrationFullListenReceipt).completedBy !== listener) {
      throw new Error(`Refusing to replace the immutable full-listen receipt${problems.length > 0 ? `: ${problems.join('; ')}` : ' with a different listener'}.`)
    }
    process.stdout.write(`Full-listen receipt for ${candidate.releaseId} is already recorded by ${listener}; no immutable file was changed.\n`)
    return
  }
  const receipt = createNarrationFullListenReceipt(reviewPackage.expectedReceipt, listener)
  await immutableWrite(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'immutable full-listen receipt')
  process.stdout.write(`Recorded full-listen receipt for ${candidate.releaseId}: ${candidate.passageCount} passages listened to by ${receipt.completedBy}.\n`)
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
  const currentPilot: CurrentNarrationPilotIdentity = {
    configurationHash: expected.configurationHash,
    manuscriptHash: expected.manuscriptHash,
    passages: expectedPilot.map(({ passage, textHash }) => ({
      id: passage.id,
      sectionId: passage.sectionId,
      targetId: passage.targetId,
      textHash,
    })),
  }
  const pilotProblems = narrationPilotManifestProblems(manifest, currentPilot)
  if (
    manifest.schemaVersion !== 1
    || !manifest.complete
    || manifest.configurationHash !== expected.configurationHash
    || manifest.edition !== narrationEditionConfiguration.edition
    || manifest.model !== narrationEditionConfiguration.model
    || manifest.voice !== narrationEditionConfiguration.voice
    || JSON.stringify(manifest.provenance) !== JSON.stringify(narrationGenerationProvenance)
    || expectedPilot.length !== narrationPilotPassageIds.length
    || manifest.passageCount !== expectedPilot.length
    || manifest.passages.length !== expectedPilot.length
    || pilotProblems.length > 0
  ) {
    throw new Error('The voice pilot is incomplete or does not match this narration edition.')
  }
  assertEntrySequence(manifest.passages, expectedPilot)
  await verifyEntries(manifest.passages, expectedPilot, false)
  let validApproval: NarrationPilotApproval | null = null
  if (await pathExists(pilotApprovalPath)) {
    try {
      const approval = await readJson<NarrationPilotApproval>(pilotApprovalPath, 'Narration voice-pilot approval')
      if (narrationPilotApprovalProblems(manifest, approval, currentPilot).problems.length === 0) validApproval = approval
    } catch {
      // Pilot verification remains a technical check; invalid approval is reported as pending.
    }
  }
  process.stdout.write(narrationPilotVerificationMessage(manifest.passageCount, validApproval))
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
    // Retain the whole-book snapshot attached to the exact pilot that was heard.
    manuscriptHash: manifest.manuscriptHash,
    pilotProfileHash,
    passageIds: [...narrationPilotPassageIds],
    confirmations: narrationPilotApprovalConfirmations.map(({ label }) => label),
  }
  if (!narrationPilotApprovalIsComplete(approval)) throw new Error('Voice-pilot approval checklist is incomplete.')
  await atomicWrite(pilotApprovalPath, `${JSON.stringify(approval, null, 2)}\n`)
  process.stdout.write(`Approved voice pilot ${pilotProfileHash}: ${manifest.passageCount} technically verified samples.\n`)
}

function versionedManifestPath(manifest: Pick<NarrationManifest, 'releaseId' | 'releaseManifestUrl'>) {
  const expectedUrl = narrationReleaseManifestUrl(manifest.releaseId)
  if (manifest.releaseManifestUrl !== expectedUrl) throw new Error('Narration release manifest URL does not match its release id.')
  const versionedPath = path.resolve(publicRoot, expectedUrl.replace(/^\//, ''))
  if (!versionedPath.startsWith(`${path.join(publicRoot, 'audio/narration/releases')}${path.sep}`)) {
    throw new Error('Narration release manifest URL escapes the release directory.')
  }
  return versionedPath
}

function assertApprovedRelease(manifest: NarrationManifestWithFullListen) {
  if (!manifest.approved) {
    throw new Error('Narration files exist but this edition has not received the complete editorial listening approval.')
  }
  const evidence = assertReleaseFullListenEvidence(manifest)
  if (!narrationReleaseApprovalIsComplete(manifest.approval, {
    releaseId: manifest.releaseId,
    passageCount: manifest.passageCount,
    receiptSha256: sha256(narrationFullListenReceiptMaterial(evidence.receipt)),
  })) {
    throw new Error('Narration files exist but this edition has not received the complete editorial listening approval.')
  }
  const approvedAt = manifest.approval?.approvedAt
  if (
    typeof approvedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(approvedAt)
    || !Number.isFinite(Date.parse(approvedAt))
    || new Date(approvedAt).toISOString() !== approvedAt
  ) throw new Error('Narration release approval time is invalid.')
  if (Date.parse(evidence.receipt.completedAt) > Date.parse(approvedAt)) {
    throw new Error('Narration release approval predates its full-listen receipt.')
  }
}

async function assertVersionedTwin(manifest: NarrationManifestWithFullListen, pointerBytes: string) {
  const versionedPath = versionedManifestPath(manifest)
  const versionedBytes = await fs.readFile(versionedPath, 'utf8')
  if (pointerBytes !== versionedBytes) throw new Error('The release pointer differs from its immutable versioned manifest.')
}

async function approveRelease() {
  const { candidate } = await verifyCandidate()
  const receipt = await requireFullListenReceipt(candidate)
  const approver = requireApprovalFlags(narrationReleaseApprovalConfirmations)

  let existing: NarrationManifestWithFullListen | null = null
  if (await pathExists(releasePath)) {
    existing = await readJson<NarrationManifestWithFullListen>(releasePath, 'Existing narration release')
    if (existing.edition === candidate.edition && existing.releaseId !== candidate.releaseId) {
      throw new Error(`Edition ${candidate.edition} is already released as ${existing.releaseId}. Bump the edition before publishing different audio or manuscript content.`)
    }
  }

  if (existing?.edition === candidate.edition && existing.releaseId === candidate.releaseId) {
    assertReleaseCore(existing)
    assertApprovedRelease(existing)
    if (!isDeepStrictEqual(existing.approval?.fullListen.receipt, receipt)) {
      throw new Error('The existing same-edition release does not embed the current exact full-listen receipt.')
    }
    await assertVersionedTwin(existing, await fs.readFile(releasePath, 'utf8'))
    process.stdout.write(`Narration release ${existing.releaseId} is already approved; no immutable file was changed.\n`)
    return
  }

  const targetVersionedPath = versionedManifestPath(candidate)
  if (await pathExists(targetVersionedPath)) {
    const versionedBytes = await fs.readFile(targetVersionedPath, 'utf8')
    const versioned = JSON.parse(versionedBytes) as NarrationManifestWithFullListen
    assertReleaseCore(versioned)
    assertApprovedRelease(versioned)
    if (versioned.releaseId !== candidate.releaseId || !isDeepStrictEqual(versioned.approval?.fullListen.receipt, receipt)) {
      throw new Error('The existing immutable versioned release does not match this candidate and full-listen receipt.')
    }
    await atomicWrite(releasePath, versionedBytes)
    process.stdout.write(`Restored narration release pointer for already-approved immutable release ${versioned.releaseId}.\n`)
    return
  }

  const release: NarrationManifestWithFullListen = {
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
      fullListen: narrationFullListenApprovalEvidence(receipt),
    },
  }
  assertReleaseCore(release)
  assertApprovedRelease(release)

  const releaseBytes = `${JSON.stringify(release, null, 2)}\n`
  await immutableWrite(targetVersionedPath, releaseBytes, 'immutable release manifest')
  await atomicWrite(releasePath, releaseBytes)
  process.stdout.write(`Approved narration release ${release.releaseId}: ${release.passageCount} immutable audio files.\n`)
}

export async function verifyRelease(lightweight: boolean) {
  const manifest = await readJson<NarrationManifestWithFullListen>(releasePath, 'Narration release')
  const expected = assertReleaseCore(manifest)
  assertApprovedRelease(manifest)
  await verifyEntries(manifest.passages, expected.passages, lightweight)
  const pointerBytes = await fs.readFile(releasePath, 'utf8')
  await assertVersionedTwin(manifest, pointerBytes)
  process.stdout.write(`Verified approved narration release ${manifest.releaseId}: ${manifest.passageCount} immutable files (${lightweight ? 'deployment' : 'full media'} checks).\n`)
  return { manifest, pointerBytes }
}

async function main() {
  const approve = process.argv.includes('--approve')
  const approvePilotMode = process.argv.includes('--approve-pilot')
  const verifyPilotMode = process.argv.includes('--verify-pilot')
  const verifyCandidateMode = process.argv.includes('--verify-candidate')
  const prepareFullListenMode = process.argv.includes('--prepare-full-listen')
  const recordFullListenMode = process.argv.includes('--record-full-listen')
  const lightweight = process.argv.includes('--lightweight')
  const exclusiveModes = [approve, approvePilotMode, verifyPilotMode, verifyCandidateMode, prepareFullListenMode, recordFullListenMode]
  if (exclusiveModes.filter(Boolean).length > 1) throw new Error('Choose one narration verification, review or approval mode.')
  if (lightweight && exclusiveModes.some(Boolean)) throw new Error('Candidate, pilot, review and approval modes select their required verification level; remove --lightweight.')
  if (verifyPilotMode) return verifyPilot()
  if (approvePilotMode) return approvePilot()
  if (verifyCandidateMode) {
    const { candidate } = await verifyCandidate()
    process.stdout.write(`Verified unapproved narration candidate ${candidate.releaseId}: ${candidate.passageCount} immutable files (full media checks).\n`)
    return
  }
  if (prepareFullListenMode) return prepareFullListen()
  if (recordFullListenMode) return recordFullListen()
  if (approve) return approveRelease()
  return verifyRelease(lightweight)
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === entryPath) await main()
