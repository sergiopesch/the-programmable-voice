import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  narrationEditionConfiguration,
  narrationNormalisationVersionFor,
  narrationPassageHashMaterial,
  narrationVoiceSelectionReceipt,
} from '../src/data/narrationEdition'
import { bookNarrationPassages } from '../src/lib/narration'
import type { NarrationTechnicalQc } from '../src/lib/narrationRelease'
import {
  assertExactSegmentText,
  concatenateSamples,
  float32Wave,
  narrationNormalisationFilterForPassage,
  narrationRuntimeInstallCommand,
  readIsolatedRuntimePackage,
  safeModelRelativePath,
  technicalQcMatches,
} from './generate-narration'

const projectRoot = path.resolve(import.meta.dirname, '..')

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('local Emma narration contract', () => {
  it('keeps the pinned synthesiser outside the root application dependency tree', async () => {
    const rootPackage = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const rootLock = JSON.parse(await fs.readFile(path.join(projectRoot, 'package-lock.json'), 'utf8')) as {
      packages?: Record<string, { version?: string }>
    }
    const toolPackage = JSON.parse(await fs.readFile(path.join(projectRoot, 'tools', 'narration', 'package.json'), 'utf8')) as {
      private?: boolean
      dependencies?: Record<string, string>
    }
    const toolLock = JSON.parse(await fs.readFile(path.join(projectRoot, 'tools', 'narration', 'package-lock.json'), 'utf8')) as {
      packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>
    }
    const vercelIgnore = (await fs.readFile(path.join(projectRoot, '.vercelignore'), 'utf8')).split(/\r?\n/)
    expect(rootPackage.dependencies?.['kokoro-js']).toBeUndefined()
    expect(rootPackage.devDependencies?.['kokoro-js']).toBeUndefined()
    expect(rootLock.packages?.['node_modules/kokoro-js']).toBeUndefined()
    expect(toolPackage.private).toBe(true)
    expect(toolPackage.dependencies?.['kokoro-js']).toBe(narrationEditionConfiguration.runtimeVersion)
    expect(toolLock.packages?.['']?.dependencies?.['kokoro-js']).toBe(narrationEditionConfiguration.runtimeVersion)
    expect(toolLock.packages?.['node_modules/kokoro-js']?.version).toBe(narrationEditionConfiguration.runtimeVersion)
    expect(narrationRuntimeInstallCommand).toBe('npm ci --prefix tools/narration')
    expect(vercelIgnore).toContain('tools')
  })

  it('gives a clean-clone install command when the isolated runtime is absent', async () => {
    const absentPackage = path.join(projectRoot, 'tools', 'narration', 'missing-runtime', 'package.json')
    await expect(readIsolatedRuntimePackage(absentPackage)).rejects.toThrow(
      `Run "${narrationRuntimeInstallCommand}" from the project root.`,
    )
  })

  it('binds speaker selection to the tracked diagnostic on a clean clone', async () => {
    const auditionPath = path.resolve(projectRoot, narrationVoiceSelectionReceipt.auditionPath)
    expect(auditionPath.startsWith(`${path.join(projectRoot, 'docs', 'narration', 'voice-selection')}${path.sep}`)).toBe(true)
    expect(sha256(new Uint8Array(await fs.readFile(auditionPath)))).toBe(narrationVoiceSelectionReceipt.auditionSha256)
    expect(narrationVoiceSelectionReceipt.approvalScope).toBe('speaker-selection-only')
    expect(narrationVoiceSelectionReceipt.doesNotApprove).toContain('representative voice-pilot listening')
  })

  it('pins every remote model asset and the bundled Emma voice by SHA-256', () => {
    expect(narrationEditionConfiguration.modelRevision).toMatch(/^[a-f0-9]{40}$/)
    expect(narrationEditionConfiguration.voiceFileSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(narrationEditionConfiguration.modelFiles).toHaveLength(4)
    for (const descriptor of narrationEditionConfiguration.modelFiles) {
      expect(safeModelRelativePath(descriptor.path)).toBe(descriptor.path)
      expect(descriptor.sha256).toMatch(/^[a-f0-9]{64}$/)
    }
    for (const unsafe of ['', '/tmp/model.onnx', '../model.onnx', 'onnx\\model.onnx', 'onnx//model.onnx']) {
      expect(() => safeModelRelativePath(unsafe)).toThrow(/Unsafe narration model path/)
    }
  })

  it('refuses sentence segmentation that drops or changes the exact synthesiser input', () => {
    const text = 'One sentence. A second sentence.'
    expect(() => assertExactSegmentText(text, ['One sentence.', 'A second sentence.'])).not.toThrow()
    expect(() => assertExactSegmentText(text, ['One sentence.'])).toThrow(/without changing its exact synthesiser input/)
    expect(() => assertExactSegmentText(text, ['One sentence.', 'A changed sentence.'])).toThrow(/without changing its exact synthesiser input/)
  })

  it('concatenates samples in order and emits a valid mono float WAV header', () => {
    const samples = concatenateSamples([new Float32Array([0.25, -0.5]), new Float32Array([1])])
    expect([...samples]).toEqual([0.25, -0.5, 1])
    const wave = float32Wave(samples, 24_000)
    const view = new DataView(wave.buffer, wave.byteOffset, wave.byteLength)
    expect(new TextDecoder().decode(wave.slice(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(wave.slice(8, 12))).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(3)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(24_000)
    expect(view.getUint32(40, true)).toBe(samples.byteLength)
  })

  it('keeps ordinary mastering exact and scopes codec compensation to passage 472', () => {
    const ordinaryPassageId = narrationVoiceSelectionReceipt.passageId
    expect(narrationNormalisationFilterForPassage(
      ordinaryPassageId,
      narrationEditionConfiguration.normalisation,
    )).toBe('loudnorm=I=-18:LRA=7:TP=-2')
    expect(narrationNormalisationFilterForPassage(
      'passage:access-restoration-agency:block-2-heading',
      narrationEditionConfiguration.normalisation,
    )).toBe('loudnorm=I=-18:LRA=7:TP=-1.25')
    expect(narrationNormalisationFilterForPassage(
      'passage:air-again:block-5-heading',
      narrationEditionConfiguration.normalisation,
    )).toBe(
      'loudnorm=I=-18:LRA=7:TP=-2,volume=2dB,alimiter=limit=0.8413951416451951:attack=5:release=50:asc=false:level=false:latency=false',
    )
  })

  it('excludes the legacy passage-472 asset by both passage hash and QC version', () => {
    const passageId = 'passage:access-restoration-agency:block-2-heading'
    const passage = bookNarrationPassages.find((candidate) => candidate.id === passageId)!
    const configurationHash = createHash('sha256')
      .update(JSON.stringify(narrationEditionConfiguration))
      .digest('hex')
    const legacyTextHash = createHash('sha256')
      .update(`${configurationHash}\n\n${passage.text}`)
      .digest('hex')
    const currentTextHash = createHash('sha256')
      .update(narrationPassageHashMaterial(configurationHash, passage.id, passage.text))
      .digest('hex')
    expect(currentTextHash).not.toBe(legacyTextHash)

    const overrideVersion = narrationNormalisationVersionFor(passageId)
    const qc: NarrationTechnicalQc = {
      durationExpectedSeconds: 3.636,
      durationMeasuredSeconds: 2.783,
      wordsPerMinute: 172.5,
      integratedLoudnessLufs: -20.6,
      loudnessRangeLu: 0,
      truePeakDbtp: -2.3,
      leadingSilenceSeconds: 0,
      trailingSilenceSeconds: 0,
      normalisationVersion: overrideVersion,
      fullDecodePassed: true,
    }
    expect(overrideVersion).not.toBe(narrationEditionConfiguration.normalisation.version)
    expect(technicalQcMatches({
      ...qc,
      normalisationVersion: narrationEditionConfiguration.normalisation.version,
    }, qc, passageId)).toBe(false)
    expect(technicalQcMatches(qc, qc, passageId)).toBe(true)
  })
})
