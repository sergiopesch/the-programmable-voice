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
  narrationInstructionsFor,
  narrationPassageHashMaterial,
  narrationPilotApprovalConfirmations,
  narrationPilotPassageIds,
} from '../src/data/narrationEdition'
import { bookNarrationPassages, type NarrationPassage } from '../src/lib/narration'
import {
  narrationPilotApprovalIsComplete,
  narrationPilotProfileMaterial,
  narrationReleaseId,
  narrationReleaseIdentityMaterial,
  narrationReleaseManifestUrl,
  type NarrationManifest,
  type NarrationManifestEntry,
  type NarrationPilotApproval,
  type NarrationPilotManifest,
  type NarrationTechnicalQc,
} from '../src/lib/narrationRelease'

const execFileAsync = promisify(execFile)
const ffmpegBinary = process.env.FFMPEG_PATH?.trim() || 'ffmpeg'
const ffprobeBinary = process.env.FFPROBE_PATH?.trim() || 'ffprobe'
const projectRoot = path.resolve(import.meta.dirname, '..')
const outputRoot = path.join(projectRoot, 'public/audio/narration')
const assetRoot = path.join(outputRoot, narrationEditionAssetDirectory)
const workRoot = path.join(projectRoot, '.narration-work')
const candidateManifestPath = path.join(workRoot, 'candidate-manifest.json')
const pilotManifestPath = path.join(workRoot, 'pilot-manifest.json')
const pilotApprovalPath = path.join(workRoot, 'pilot-approval.json')
const statePath = path.join(workRoot, 'generation-state.json')
const configuration = narrationEditionConfiguration

interface GenerationState {
  configurationHash: string
  entries: Record<string, NarrationManifestEntry>
}

interface CandidateManifest extends Omit<NarrationManifest, 'releaseId' | 'releaseManifestUrl' | 'generationScope'> {
  releaseId: string | null
  releaseManifestUrl: string | null
  generationScope: { mode: 'full' | 'subset'; requestedPassageCount: number }
}

class SpeechRequestError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly retryAfterMs = 0) {
    super(message)
  }
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function passageTextHash(configurationHash: string, passage: Pick<NarrationPassage, 'id' | 'text'>) {
  return sha256(narrationPassageHashMaterial(configurationHash, passage.id, passage.text))
}

function safeFilename(index: number, id: string, audioHash: string) {
  const slug = id.replace(/^passage:/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 64)
  return `${String(index + 1).padStart(4, '0')}-${slug}-${audioHash}.mp3`
}

async function atomicWrite(filePath: string, data: string | Uint8Array) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporaryPath, data)
  await fs.rename(temporaryPath, filePath)
}

async function writeImmutable(filePath: string, bytes: Uint8Array) {
  try {
    const stored = new Uint8Array(await fs.readFile(filePath))
    if (sha256(stored) !== sha256(bytes)) throw new Error(`Refusing to overwrite immutable narration asset ${path.relative(projectRoot, filePath)}.`)
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await atomicWrite(filePath, bytes)
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T
}

async function readState(): Promise<GenerationState> {
  try {
    return await readJson<GenerationState>(statePath)
  } catch {
    return { configurationHash: '', entries: {} }
  }
}

function expectedDurationSeconds(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Number(((words / configuration.targetWordsPerMinute) * 60).toFixed(3))
}

function boundarySilence(stderr: string, durationSeconds: number) {
  const events = [...stderr.matchAll(/silence_(start|end):\s*([\d.]+)/g)].map((match) => ({
    type: match[1],
    time: Number(match[2]),
  }))
  let leadingSilenceSeconds = 0
  if (events[0]?.type === 'start' && events[0].time <= 0.02 && events[1]?.type === 'end') {
    leadingSilenceSeconds = events[1].time
  }
  let trailingSilenceSeconds = 0
  const finalEvent = events.at(-1)
  const penultimateEvent = events.at(-2)
  if (finalEvent?.type === 'end' && finalEvent.time >= durationSeconds - 0.06 && penultimateEvent?.type === 'start') {
    trailingSilenceSeconds = durationSeconds - penultimateEvent.time
  }
  return {
    leadingSilenceSeconds: Number(Math.max(0, leadingSilenceSeconds).toFixed(3)),
    trailingSilenceSeconds: Number(Math.max(0, trailingSilenceSeconds).toFixed(3)),
  }
}

async function technicalQc(filePath: string, text: string): Promise<NarrationTechnicalQc> {
  const { stdout } = await execFileAsync(ffprobeBinary, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ])
  const durationMeasuredSeconds = Number(stdout.trim())
  const durationExpectedSeconds = expectedDurationSeconds(text)
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const wordsPerMinute = (wordCount / durationMeasuredSeconds) * 60
  const [minimumWordsPerMinute, maximumWordsPerMinute] = wordCount < 6
    ? [45, 240]
    : wordCount < 20
      ? [90, 195]
      : [115, 175]
  if (
    !Number.isFinite(durationMeasuredSeconds)
    || durationMeasuredSeconds < 0.35
    || !Number.isFinite(wordsPerMinute)
    || wordsPerMinute < minimumWordsPerMinute
    || wordsPerMinute > maximumWordsPerMinute
  ) {
    throw new Error(`Pacing QC failed for ${path.basename(filePath)}: ${wordsPerMinute.toFixed(1)} words per minute.`)
  }

  const normalisation = configuration.normalisation
  const { stderr: loudnessStderr } = await execFileAsync(ffmpegBinary, [
    '-hide_banner', '-nostats', '-i', filePath,
    '-af', `loudnorm=I=${normalisation.integratedLoudnessLufs}:LRA=${normalisation.loudnessRangeLu}:TP=${normalisation.truePeakDbtp}:print_format=json`,
    '-f', 'null', '-',
  ], { maxBuffer: 2_000_000 })
  const loudnessBlocks = [...loudnessStderr.matchAll(/\{\s*"input_i"[\s\S]*?\}/g)]
  const loudness = JSON.parse(loudnessBlocks.at(-1)?.[0] ?? '{}') as Record<string, string>
  const integratedLoudnessLufs = Number(loudness.input_i)
  const loudnessRangeLu = Number(loudness.input_lra)
  const truePeakDbtp = Number(loudness.input_tp)
  if (
    !Number.isFinite(integratedLoudnessLufs)
    || integratedLoudnessLufs < -20.5
    || integratedLoudnessLufs > -15.5
    || !Number.isFinite(loudnessRangeLu)
    || loudnessRangeLu > 12
    || !Number.isFinite(truePeakDbtp)
    || truePeakDbtp > -1
  ) {
    throw new Error(`Loudness QC failed for ${path.basename(filePath)}: ${integratedLoudnessLufs.toFixed(1)} LUFS, ${truePeakDbtp.toFixed(1)} dBTP.`)
  }

  const { stderr: silenceStderr } = await execFileAsync(ffmpegBinary, [
    '-hide_banner', '-nostats', '-i', filePath,
    '-af', 'silencedetect=noise=-50dB:d=0.05',
    '-f', 'null', '-',
  ], { maxBuffer: 2_000_000 })
  const silence = boundarySilence(silenceStderr, durationMeasuredSeconds)
  if (silence.leadingSilenceSeconds > 0.35 || silence.trailingSilenceSeconds > 0.5) {
    throw new Error(`Boundary-silence QC failed for ${path.basename(filePath)}.`)
  }

  await execFileAsync(ffmpegBinary, ['-v', 'error', '-i', filePath, '-f', 'null', '-'], { maxBuffer: 1_000_000 })
  return {
    durationExpectedSeconds,
    durationMeasuredSeconds: Number(durationMeasuredSeconds.toFixed(3)),
    wordsPerMinute: Number(wordsPerMinute.toFixed(1)),
    integratedLoudnessLufs: Number(integratedLoudnessLufs.toFixed(1)),
    loudnessRangeLu: Number(loudnessRangeLu.toFixed(1)),
    truePeakDbtp: Number(truePeakDbtp.toFixed(1)),
    ...silence,
    normalisationVersion: normalisation.version,
    fullDecodePassed: true,
  }
}

async function normaliseAudio(bytes: Uint8Array, passageId: string) {
  const safeId = passageId.replace(/[^a-z0-9]+/gi, '-').slice(0, 72)
  const unique = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const rawPath = path.join(workRoot, 'temporary', `${safeId}-${unique}-raw.mp3`)
  const normalisedPath = path.join(workRoot, 'temporary', `${safeId}-${unique}-normalised.mp3`)
  await fs.mkdir(path.dirname(rawPath), { recursive: true })
  await fs.writeFile(rawPath, bytes)
  const settings = configuration.normalisation
  try {
    await execFileAsync(ffmpegBinary, [
      '-v', 'error', '-y', '-i', rawPath,
      '-af', [
        'silenceremove=start_periods=1:start_duration=0.12:start_silence=0.08:start_threshold=-50dB',
        'areverse',
        'silenceremove=start_periods=1:start_duration=0.25:start_silence=0.18:start_threshold=-50dB',
        'areverse',
        `loudnorm=I=${settings.integratedLoudnessLufs}:LRA=${settings.loudnessRangeLu}:TP=${settings.truePeakDbtp}`,
      ].join(','),
      '-map_metadata', '-1', '-vn',
      '-ar', String(settings.sampleRateHz),
      '-ac', String(settings.channels),
      '-codec:a', 'libmp3lame',
      '-b:a', `${settings.bitrateKbps}k`,
      normalisedPath,
    ], { maxBuffer: 2_000_000 })
    return new Uint8Array(await fs.readFile(normalisedPath))
  } finally {
    await Promise.all([
      fs.rm(rawPath, { force: true }),
      fs.rm(normalisedPath, { force: true }),
    ])
  }
}

async function requestSpeech(passage: NarrationPassage) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: configuration.model,
        voice: configuration.voice,
        instructions: narrationInstructionsFor(passage.id),
        response_format: configuration.responseFormat,
        speed: 1,
        input: passage.text,
      }),
    })
    if (!response.ok) {
      const requestId = response.headers.get('x-request-id')
      const retryAfter = Number(response.headers.get('retry-after') ?? 0)
      throw new SpeechRequestError(
        `Speech generation failed with HTTP ${response.status}${requestId ? ` (${requestId})` : ''}`,
        response.status === 429 || response.status >= 500,
        Number.isFinite(retryAfter) ? retryAfter * 1_000 : 0,
      )
    }
    return new Uint8Array(await response.arrayBuffer())
  } catch (error) {
    if (error instanceof SpeechRequestError) throw error
    throw new SpeechRequestError(error instanceof Error ? error.message : 'Speech request failed.', true)
  } finally {
    clearTimeout(timeout)
  }
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 4): Promise<T> {
  let latestError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      latestError = error
      if (error instanceof SpeechRequestError && !error.retryable) break
      if (attempt === attempts) break
      const retryAfter = error instanceof SpeechRequestError ? error.retryAfterMs : 0
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter, 700 * 2 ** (attempt - 1))))
    }
  }
  throw latestError
}

async function runPool<T>(items: readonly T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      const item = items[index]
      if (item !== undefined) await worker(item, index)
    }
  })
  await Promise.all(runners)
}

function technicalQcMatches(stored: NarrationTechnicalQc, measured: NarrationTechnicalQc) {
  const numericKeys = [
    'durationMeasuredSeconds',
    'wordsPerMinute',
    'integratedLoudnessLufs',
    'loudnessRangeLu',
    'truePeakDbtp',
    'leadingSilenceSeconds',
    'trailingSilenceSeconds',
  ] as const
  return stored.normalisationVersion === configuration.normalisation.version
    && stored.fullDecodePassed === true
    && numericKeys.every((key) => Math.abs(stored[key] - measured[key]) <= (key === 'durationMeasuredSeconds' ? 0.02 : 0.15))
}

async function verifyStoredEntry(entry: NarrationManifestEntry, passage: NarrationPassage) {
  if (!entry.url.startsWith(`/audio/narration/${narrationEditionAssetDirectory}/`)) return false
  const filePath = path.join(projectRoot, 'public', entry.url.replace(/^\//, ''))
  const bytes = new Uint8Array(await fs.readFile(filePath))
  if (sha256(bytes) !== entry.sha256 || !path.basename(filePath).includes(entry.sha256)) return false
  const qc = await technicalQc(filePath, passage.text)
  return Math.abs(qc.durationMeasuredSeconds - entry.durationSeconds) <= 0.02
    && technicalQcMatches(entry.technicalQc, qc)
}

function manuscriptIdentity(configurationHash: string) {
  const expected = bookNarrationPassages.map((passage) => ({ id: passage.id, textHash: passageTextHash(configurationHash, passage) }))
  return {
    expected,
    manuscriptHash: sha256(JSON.stringify(expected)),
  }
}

async function requireApprovedPilot(configurationHash: string, manuscriptHash: string) {
  let manifest: NarrationPilotManifest
  let approval: NarrationPilotApproval
  try {
    ;[manifest, approval] = await Promise.all([
      readJson<NarrationPilotManifest>(pilotManifestPath),
      readJson<NarrationPilotApproval>(pilotApprovalPath),
    ])
  } catch {
    throw new Error('Full narration generation is locked. Run narration:pilot, listen to every sample, then run narration:approve-pilot first.')
  }
  const pilotProfileHash = sha256(narrationPilotProfileMaterial(manifest))
  const expectedIds = [...narrationPilotPassageIds]
  if (
    !manifest.complete
    || manifest.configurationHash !== configurationHash
    || manifest.manuscriptHash !== manuscriptHash
    || manifest.passageCount !== expectedIds.length
    || manifest.passages.map(({ id }) => id).join('\n') !== expectedIds.join('\n')
    || approval.configurationHash !== configurationHash
    || approval.manuscriptHash !== manuscriptHash
    || approval.pilotProfileHash !== pilotProfileHash
    || approval.passageIds.join('\n') !== expectedIds.join('\n')
    || approval.checklistVersion !== narrationApprovalChecklistVersion
    || !narrationPilotApprovalIsComplete(approval)
    || narrationPilotApprovalConfirmations.some(({ label }, index) => approval.confirmations[index] !== label)
  ) {
    throw new Error('The approved voice pilot does not match this model, direction or manuscript. Regenerate and approve the pilot before continuing.')
  }
  return pilotProfileHash
}

function numberArgument(prefix: string, fallback: number) {
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${prefix}${value} is not a valid number.`)
  return parsed
}

async function main() {
  const pilot = process.argv.includes('--pilot')
  const limitArg = process.argv.find((argument) => argument.startsWith('--limit='))
  const sectionArg = process.argv.find((argument) => argument.startsWith('--section='))
  if (pilot && (limitArg || sectionArg)) throw new Error('--pilot cannot be combined with --limit or --section.')
  const limit = Math.max(1, numberArgument('--limit=', Number.POSITIVE_INFINITY))
  const sectionId = sectionArg?.slice('--section='.length)
  const concurrency = Math.min(6, Math.max(1, Math.floor(numberArgument('--concurrency=', pilot ? 2 : 4))))
  const fullRun = !pilot && !limitArg && !sectionArg
  const pilotIds = new Set<string>(narrationPilotPassageIds)
  const selected = (pilot
    ? bookNarrationPassages.filter((passage) => pilotIds.has(passage.id))
    : bookNarrationPassages.filter((passage) => !sectionId || passage.sectionId === sectionId)
  ).slice(0, limit)
  if (pilot && selected.map(({ id }) => id).join('\n') !== narrationPilotPassageIds.join('\n')) {
    throw new Error('The configured voice-pilot passages no longer match this manuscript.')
  }
  if (selected.length === 0) throw new Error('No narration passages matched the requested scope.')
  for (const passage of selected) if (passage.text.length > 4096) throw new Error(`${passage.id} exceeds the Speech API 4,096-character limit.`)

  const configurationHash = sha256(JSON.stringify(configuration))
  const { manuscriptHash } = manuscriptIdentity(configurationHash)
  const pilotProfileHash = pilot ? '' : await requireApprovedPilot(configurationHash, manuscriptHash)
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.length < 16) {
    throw new Error('The production OPENAI_API_KEY is absent or is not a valid OpenAI API credential. Update it in Vercel before generating narration.')
  }

  await fs.mkdir(assetRoot, { recursive: true })
  await fs.mkdir(workRoot, { recursive: true })
  const state = await readState()
  if (state.configurationHash !== configurationHash) {
    state.configurationHash = configurationHash
    state.entries = {}
  }

  let stateWriteQueue = Promise.resolve()
  const persistState = () => {
    const snapshot = `${JSON.stringify(state, null, 2)}\n`
    stateWriteQueue = stateWriteQueue.then(() => atomicWrite(statePath, snapshot))
    return stateWriteQueue
  }

  const verifiedIds = new Set<string>()
  let completed = 0
  await runPool(selected, concurrency, async (passage) => {
    const globalIndex = bookNarrationPassages.findIndex((candidate) => candidate.id === passage.id)
    const expectedTextHash = passageTextHash(configurationHash, passage)
    const existing = state.entries[passage.id]
    if (existing?.textHash === expectedTextHash && await verifyStoredEntry(existing, passage).catch(() => false)) {
      verifiedIds.add(passage.id)
      completed += 1
      process.stdout.write(`reuse ${completed}/${selected.length} ${passage.id}\n`)
      return
    }

    const rawBytes = await withRetry(() => requestSpeech(passage))
    const bytes = await normaliseAudio(rawBytes, passage.id)
    const audioHash = sha256(bytes)
    const filename = safeFilename(globalIndex, passage.id, audioHash)
    const filePath = path.join(assetRoot, filename)
    await writeImmutable(filePath, bytes)
    const qc = await technicalQc(filePath, passage.text)
    const entry: NarrationManifestEntry = {
      id: passage.id,
      sectionId: passage.sectionId,
      targetId: passage.targetId,
      textHash: expectedTextHash,
      url: `/audio/narration/${narrationEditionAssetDirectory}/${filename}`,
      sha256: audioHash,
      durationSeconds: qc.durationMeasuredSeconds,
      generatedAt: new Date().toISOString(),
      qcStatus: 'technical-qc-passed',
      technicalQc: qc,
    }
    state.entries[passage.id] = entry
    verifiedIds.add(passage.id)
    await persistState()
    completed += 1
    process.stdout.write(`write ${completed}/${selected.length} ${passage.id} · ${entry.durationSeconds.toFixed(1)}s · ${qc.wordsPerMinute.toFixed(0)} wpm\n`)
  })
  await stateWriteQueue

  if (pilot) {
    const pilotPassages: NarrationManifestEntry[] = []
    for (const passageId of narrationPilotPassageIds) {
      const passage = bookNarrationPassages.find((candidate) => candidate.id === passageId)
      const entry = state.entries[passageId]
      if (!passage || !entry || entry.textHash !== passageTextHash(configurationHash, passage)) continue
      if (!verifiedIds.has(passage.id) && !await verifyStoredEntry(entry, passage).catch(() => false)) continue
      pilotPassages.push(entry)
    }
    const pilotManifest: NarrationPilotManifest = {
      schemaVersion: 1,
      edition: configuration.edition,
      model: configuration.model,
      voice: configuration.voice,
      configurationHash,
      manuscriptHash,
      generatedAt: new Date().toISOString(),
      complete: pilotPassages.length === narrationPilotPassageIds.length,
      passageCount: pilotPassages.length,
      passages: pilotPassages,
    }
    if (!pilotManifest.complete) throw new Error(`Voice pilot is incomplete: ${pilotPassages.length}/${narrationPilotPassageIds.length} samples passed technical QC.`)
    await atomicWrite(pilotManifestPath, `${JSON.stringify(pilotManifest, null, 2)}\n`)
    await fs.rm(pilotApprovalPath, { force: true })
    process.stdout.write(`pilot ready · ${pilotPassages.length} samples · listen and run narration:approve-pilot before full generation\n`)
    return
  }

  const currentEntries: NarrationManifestEntry[] = []
  for (const passage of bookNarrationPassages) {
    const entry = state.entries[passage.id]
    if (!entry || entry.textHash !== passageTextHash(configurationHash, passage)) continue
    if (!verifiedIds.has(passage.id) && !await verifyStoredEntry(entry, passage).catch(() => false)) continue
    currentEntries.push(entry)
  }
  const complete = fullRun && currentEntries.length === bookNarrationPassages.length
  const candidateBase = {
    schemaVersion: 1 as const,
    edition: configuration.edition,
    model: configuration.model,
    voice: configuration.voice,
    disclosure: narrationDisclosure,
    configurationHash,
    manuscriptHash,
    pilotProfileHash,
    generatedAt: new Date().toISOString(),
    generationScope: { mode: fullRun ? 'full' as const : 'subset' as const, requestedPassageCount: selected.length },
    complete,
    approved: false,
    approval: null,
    passageCount: currentEntries.length,
    totalDurationSeconds: Number(currentEntries.reduce((total, entry) => total + entry.durationSeconds, 0).toFixed(3)),
    passages: currentEntries,
  }
  let releaseId: string | null = null
  let releaseManifestUrl: string | null = null
  if (complete) {
    const identityHash = sha256(narrationReleaseIdentityMaterial(candidateBase as Omit<NarrationManifest, 'releaseId' | 'releaseManifestUrl' | 'approved' | 'approval'>))
    releaseId = narrationReleaseId(configuration.edition, identityHash)
    releaseManifestUrl = narrationReleaseManifestUrl(releaseId)
  }
  const candidate: CandidateManifest = { ...candidateBase, releaseId, releaseManifestUrl }
  await atomicWrite(candidateManifestPath, `${JSON.stringify(candidate, null, 2)}\n`)
  process.stdout.write(`candidate ${complete ? 'complete' : 'partial'} · ${currentEntries.length}/${bookNarrationPassages.length} passages\n`)
  if (complete) process.stdout.write(`Technical QC passed for release ${releaseId}. Complete the full listening checklist, then run narration:approve.\n`)
  else if (fullRun) process.exitCode = 1
}

await main()
