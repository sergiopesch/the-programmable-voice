import { createHash, randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  narrationBritishVoiceComparison,
  narrationDisclosure,
  narrationEditionConfiguration,
  narrationInstructionsFor,
  narrationPassageHashMaterial,
} from '../src/data/narrationEdition'
import { bookNarrationPassages } from '../src/lib/narration'
import type { NarrationComparisonManifest } from '../src/lib/narrationRelease'
import {
  narrationComparisonProfileHash,
  removeNarrationComparisonApproval,
} from './narration-comparison-contract'

const execFileAsync = promisify(execFile)
const projectRoot = path.resolve(import.meta.dirname, '..')
const ffmpegBinary = process.env.FFMPEG_PATH?.trim() || 'ffmpeg'
const ffprobeBinary = process.env.FFPROBE_PATH?.trim() || 'ffprobe'
const comparisonId = `british-voice-comparison-${new Date().toISOString().slice(0, 10)}-${randomBytes(5).toString('hex')}`
const outputRoot = path.join(projectRoot, '.narration-work', 'british-voice-comparison')
const configuration = narrationEditionConfiguration

interface TechnicalQc {
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

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

async function atomicWrite(filePath: string, bytes: string | Uint8Array) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporaryPath, bytes)
  await fs.rename(temporaryPath, filePath)
}

async function requestSpeech(voice: string, text: string) {
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
        voice,
        input: text,
        instructions: narrationInstructionsFor(narrationBritishVoiceComparison.passageId),
        response_format: configuration.responseFormat,
        speed: 1,
      }),
    })
    if (!response.ok) {
      const requestId = response.headers.get('x-request-id')
      throw new Error(`Speech generation failed with HTTP ${response.status}${requestId ? ` (${requestId})` : ''}.`)
    }
    return new Uint8Array(await response.arrayBuffer())
  } finally {
    clearTimeout(timeout)
  }
}

async function normaliseAudio(rawBytes: Uint8Array, label: string, temporaryRoot: string) {
  const rawPath = path.join(temporaryRoot, `candidate-${label.toLowerCase()}-raw.mp3`)
  const normalisedPath = path.join(temporaryRoot, `candidate-${label.toLowerCase()}-normalised.mp3`)
  await fs.writeFile(rawPath, rawBytes)
  const settings = configuration.normalisation
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
}

async function technicalQc(filePath: string, text: string): Promise<TechnicalQc> {
  const { stdout: mediaJson } = await execFileAsync(ffprobeBinary, [
    '-v', 'error',
    '-show_entries', 'stream=sample_rate,channels,bit_rate:format=duration,bit_rate',
    '-of', 'json',
    filePath,
  ])
  const media = JSON.parse(mediaJson) as {
    streams?: Array<{ sample_rate?: string; channels?: number; bit_rate?: string }>
    format?: { duration?: string; bit_rate?: string }
  }
  const stream = media.streams?.[0]
  const durationSeconds = Number(media.format?.duration)
  const sampleRateHz = Number(stream?.sample_rate)
  const channels = Number(stream?.channels)
  const bitrateKbps = Math.round(Number(stream?.bit_rate ?? media.format?.bit_rate) / 1000)
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const wordsPerMinute = (wordCount / durationSeconds) * 60

  const settings = configuration.normalisation
  const { stderr } = await execFileAsync(ffmpegBinary, [
    '-hide_banner', '-nostats', '-i', filePath,
    '-af', `loudnorm=I=${settings.integratedLoudnessLufs}:LRA=${settings.loudnessRangeLu}:TP=${settings.truePeakDbtp}:print_format=json`,
    '-f', 'null', '-',
  ], { maxBuffer: 2_000_000 })
  const loudnessBlock = [...stderr.matchAll(/\{\s*"input_i"[\s\S]*?\}/g)].at(-1)?.[0]
  const loudness = JSON.parse(loudnessBlock ?? '{}') as Record<string, string>
  const integratedLoudnessLufs = Number(loudness.input_i)
  const loudnessRangeLu = Number(loudness.input_lra)
  const truePeakDbtp = Number(loudness.input_tp)

  await execFileAsync(ffmpegBinary, ['-v', 'error', '-i', filePath, '-f', 'null', '-'], { maxBuffer: 1_000_000 })
  if (
    !Number.isFinite(durationSeconds)
    || durationSeconds < 1
    || wordsPerMinute < 105
    || wordsPerMinute > 175
    || sampleRateHz !== settings.sampleRateHz
    || channels !== settings.channels
    || Math.abs(bitrateKbps - settings.bitrateKbps) > 2
    || !Number.isFinite(integratedLoudnessLufs)
    || integratedLoudnessLufs < -20.5
    || integratedLoudnessLufs > -15.5
    || !Number.isFinite(loudnessRangeLu)
    || loudnessRangeLu > 12
    || !Number.isFinite(truePeakDbtp)
    || truePeakDbtp > -1
  ) throw new Error(`Technical QC failed for ${path.basename(filePath)}.`)

  return {
    durationSeconds: Number(durationSeconds.toFixed(3)),
    wordsPerMinute: Number(wordsPerMinute.toFixed(1)),
    integratedLoudnessLufs: Number(integratedLoudnessLufs.toFixed(1)),
    loudnessRangeLu: Number(loudnessRangeLu.toFixed(1)),
    truePeakDbtp: Number(truePeakDbtp.toFixed(1)),
    sampleRateHz,
    channels,
    bitrateKbps,
    fullDecodePassed: true,
  }
}

async function main() {
  if (narrationEditionConfiguration.provider === 'local-open-weight-inference') {
    throw new Error('The OpenAI built-in voice comparison is retired. The project owner selected the checksum-pinned bf_emma diagnostic recorded in narrationVoiceSelectionReceipt.')
  }
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.length < 16) {
    throw new Error('A usable OPENAI_API_KEY was not injected. Run this script only through the authorised Vercel Production environment.')
  }
  const passage = bookNarrationPassages.find(({ id }) => id === narrationBritishVoiceComparison.passageId)
  if (!passage) throw new Error('The configured British-voice comparison passage is not in the manuscript.')
  await Promise.all([execFileAsync(ffmpegBinary, ['-version']), execFileAsync(ffprobeBinary, ['-version'])])
  const configurationHash = sha256(JSON.stringify(configuration))
  const manuscriptIdentity = bookNarrationPassages.map((item) => ({
    id: item.id,
    textHash: sha256(narrationPassageHashMaterial(configurationHash, item.id, item.text)),
  }))
  const manuscriptHash = sha256(JSON.stringify(manuscriptIdentity))
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-british-voice-comparison-'))

  const candidates = []
  try {
    await fs.mkdir(outputRoot, { recursive: true })
    await removeNarrationComparisonApproval(projectRoot)
    for (const candidate of narrationBritishVoiceComparison.candidates) {
      const rawBytes = await requestSpeech(candidate.voice, passage.text)
      const bytes = await normaliseAudio(rawBytes, candidate.label, temporaryRoot)
      const digest = sha256(bytes)
      const filename = `candidate-${candidate.label.toLowerCase()}-${digest}.mp3`
      const filePath = path.join(outputRoot, filename)
      await atomicWrite(filePath, bytes)
      const qc = await technicalQc(filePath, passage.text)
      candidates.push({ ...candidate, filename, sha256: digest, technicalQc: qc })
      process.stdout.write(`Candidate ${candidate.label}: ${qc.durationSeconds.toFixed(1)}s, ${qc.wordsPerMinute.toFixed(0)} wpm, technical QC passed.\n`)
    }

    const manifestBase = {
      schemaVersion: 2 as const,
      comparisonId,
      generatedAt: new Date().toISOString(),
      disclosure: narrationDisclosure,
      edition: configuration.edition,
      model: configuration.model,
      configurationHash,
      manuscriptHash,
      provisionalProductionVoice: configuration.voice,
      voiceProfile: configuration.voiceProfile,
      instructions: narrationInstructionsFor(passage.id),
      responseFormat: configuration.responseFormat,
      speechSpeed: 1,
      normalisation: { ...configuration.normalisation },
      passage: { id: passage.id, text: passage.text, sha256: sha256(passage.text) },
      candidates,
      humanApprovalRequired: true,
      approvalCriteria: [
        'unmistakably natural modern Southern British English throughout',
        'one mature adult woman rather than a youthful, male or ambiguous speaker',
        'warm, intimate literary-documentary delivery without theatricality',
        'comfortable pace, articulation and tonal balance',
      ],
    }
    const manifest: NarrationComparisonManifest = {
      ...manifestBase,
      comparisonProfileHash: narrationComparisonProfileHash(manifestBase as NarrationComparisonManifest),
    }
    const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`
    if (/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}/.test(manifestBytes) || /OPENAI_API_KEY/.test(manifestBytes)) {
      throw new Error('Credential-like material appeared in comparison metadata; refusing to save it.')
    }
    await atomicWrite(path.join(outputRoot, 'manifest.json'), manifestBytes)
    process.stdout.write(`British voice comparison ready at ${path.relative(projectRoot, outputRoot)}.\n`)
  } catch (error) {
    await fs.rm(outputRoot, { recursive: true, force: true })
    throw error
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true })
  }
}

await main()
