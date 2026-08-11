import { promises as fs } from 'node:fs'
import { EventEmitter } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  narrationBritishVoiceComparison,
  narrationComparisonApprovalChecklistVersion,
  narrationComparisonApprovalConfirmations,
  narrationDisclosure,
  narrationEditionAssetDirectory,
  narrationEditionConfiguration,
  narrationInstructionsFor,
  narrationPilotPassageIds,
} from '../src/data/narrationEdition'
import { bookNarrationPassages } from '../src/lib/narration'
import type { NarrationComparisonApproval, NarrationComparisonManifest } from '../src/lib/narrationRelease'
import {
  narrationComparisonApprovalName,
  narrationComparisonDirectory,
  narrationComparisonManifestName,
  narrationComparisonProfileHash,
} from './narration-comparison-contract'
import { sha256 } from './narration-job-lib'
import {
  assertNonSecretStagingPath,
  assertNoLiveSecretInFile,
  canonicalProject,
  cleanupDisposableDeployments,
  comparisonPrerequisiteProblems,
  copyFileIntoStage,
  copyNarrationInputs,
  deploymentArguments,
  deploymentListArguments,
  installInterruptionHandlers,
  referencedAudioSources,
  temporaryVercelIgnoreEntries,
  untrackedPathMayEnterStage,
  validateDownloadedNarrationMetadata,
  vercelCurlArguments,
  vercelCliArguments,
} from './narration-vercel-job'

const temporaryRoots: string[] = []

async function temporaryRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-narration-job-test-'))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

async function writeComparisonApproval(root: string, selectedVoice = narrationEditionConfiguration.voice) {
  const passage = bookNarrationPassages.find(({ id }) => id === narrationBritishVoiceComparison.passageId)!
  const comparisonRoot = path.join(root, narrationComparisonDirectory)
  const technicalQc = {
    durationSeconds: 40,
    wordsPerMinute: 140,
    integratedLoudnessLufs: -18,
    loudnessRangeLu: 4,
    truePeakDbtp: -2,
    sampleRateHz: narrationEditionConfiguration.normalisation.sampleRateHz,
    channels: narrationEditionConfiguration.normalisation.channels,
    bitrateKbps: narrationEditionConfiguration.normalisation.bitrateKbps,
    fullDecodePassed: true as const,
  }
  const candidateFiles = narrationBritishVoiceComparison.candidates.map((candidate) => {
    const bytes = Buffer.from(`comparison-${candidate.label}`)
    const digest = sha256(bytes)
    return {
      metadata: {
        ...candidate,
        filename: `candidate-${candidate.label.toLowerCase()}-${digest}.mp3`,
        sha256: digest,
        technicalQc: { ...technicalQc },
      },
      bytes,
    }
  })
  const manifest: NarrationComparisonManifest = {
    schemaVersion: 2,
    comparisonId: 'british-voice-comparison-2026-08-11-aaaaaaaaaa',
    generatedAt: '2026-08-11T00:00:00.000Z',
    disclosure: narrationDisclosure,
    edition: narrationEditionConfiguration.edition,
    model: narrationEditionConfiguration.model,
    configurationHash: 'a'.repeat(64),
    manuscriptHash: 'b'.repeat(64),
    provisionalProductionVoice: 'placeholder',
    voiceProfile: narrationEditionConfiguration.voiceProfile,
    instructions: narrationInstructionsFor(passage.id),
    responseFormat: narrationEditionConfiguration.responseFormat,
    speechSpeed: 1,
    normalisation: { ...narrationEditionConfiguration.normalisation },
    passage: { id: passage.id, text: passage.text, sha256: sha256(passage.text) },
    candidates: candidateFiles.map(({ metadata }) => metadata),
    comparisonProfileHash: '',
    humanApprovalRequired: true,
    approvalCriteria: ['human listening required'],
  }
  manifest.comparisonProfileHash = narrationComparisonProfileHash(manifest)
  const selected = manifest.candidates.find(({ voice }) => voice === selectedVoice) ?? manifest.candidates[0]!
  const approval: NarrationComparisonApproval = {
    schemaVersion: 1,
    decidedAt: '2026-08-11T00:00:00.000Z',
    decidedBy: 'Narration editor',
    checklistVersion: narrationComparisonApprovalChecklistVersion,
    comparisonId: manifest.comparisonId,
    comparisonProfileHash: manifest.comparisonProfileHash,
    decision: { kind: 'selected', candidateLabel: selected.label, voice: selected.voice },
    confirmations: narrationComparisonApprovalConfirmations.map(({ label }) => label),
  }
  await fs.mkdir(comparisonRoot, { recursive: true })
  await fs.writeFile(path.join(comparisonRoot, narrationComparisonManifestName), JSON.stringify(manifest))
  await fs.writeFile(path.join(comparisonRoot, narrationComparisonApprovalName), JSON.stringify(approval))
  for (const candidate of candidateFiles) await fs.writeFile(path.join(comparisonRoot, candidate.metadata.filename), candidate.bytes)
  return { manifest, approval }
}

describe('disposable Vercel narration staging', () => {
  it('honours working-tree deletions instead of failing on missing tracked files', async () => {
    const root = await temporaryRoot()
    await expect(copyFileIntoStage(path.join(root, 'deleted.ts'), path.join(root, 'stage/deleted.ts'), true)).resolves.toBe(false)
    await expect(fs.access(path.join(root, 'stage/deleted.ts'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('stages pilot state, approval and MP3 inputs without ignoring them from deployment', async () => {
    const source = await temporaryRoot()
    const stage = path.join(source, 'stage')
    const audioBytes = Buffer.from('pilot audio')
    const audioHash = sha256(audioBytes)
    const audioName = `0001-sample-${audioHash}.mp3`
    const audioUrl = `/audio/narration/${narrationEditionAssetDirectory}/${audioName}`
    await fs.mkdir(path.join(source, 'public/audio/narration', narrationEditionAssetDirectory), { recursive: true })
    await fs.mkdir(path.join(source, '.narration-work'), { recursive: true })
    await fs.writeFile(path.join(source, 'public/audio/narration', narrationEditionAssetDirectory, audioName), audioBytes)
    await fs.writeFile(path.join(source, 'public/audio/narration', narrationEditionAssetDirectory, `9999-orphan-${'a'.repeat(64)}.mp3`), 'orphan')
    await fs.writeFile(path.join(source, '.narration-work/generation-state.json'), JSON.stringify({
      entries: { sample: { url: audioUrl, sha256: audioHash } },
    }))
    await fs.writeFile(path.join(source, '.narration-work/pilot-manifest.json'), JSON.stringify({
      passages: [{ url: audioUrl, sha256: audioHash }],
    }))
    await fs.writeFile(path.join(source, '.narration-work/pilot-approval.json'), '{}')
    const comparison = await writeComparisonApproval(source)

    await copyNarrationInputs(source, stage, true)
    await expect(fs.access(path.join(stage, 'public/audio/narration', narrationEditionAssetDirectory, audioName))).resolves.toBeUndefined()
    await expect(fs.access(path.join(stage, '.narration-work/generation-state.json'))).resolves.toBeUndefined()
    await expect(fs.access(path.join(stage, '.narration-work/pilot-manifest.json'))).resolves.toBeUndefined()
    await expect(fs.access(path.join(stage, '.narration-work/pilot-approval.json'))).resolves.toBeUndefined()
    await expect(fs.access(path.join(stage, narrationComparisonDirectory, narrationComparisonManifestName))).resolves.toBeUndefined()
    await expect(fs.access(path.join(stage, narrationComparisonDirectory, narrationComparisonApprovalName))).resolves.toBeUndefined()
    for (const candidate of comparison.manifest.candidates) {
      await expect(fs.access(path.join(stage, narrationComparisonDirectory, candidate.filename))).resolves.toBeUndefined()
    }
    await expect(fs.access(path.join(stage, 'public/audio/narration', narrationEditionAssetDirectory, `9999-orphan-${'a'.repeat(64)}.mp3`))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(temporaryVercelIgnoreEntries).toContain('.vercel')
    expect(temporaryVercelIgnoreEntries.some((entry) => entry.includes('.narration-work') || entry.includes('public/audio/narration'))).toBe(false)
  })

  it('blocks a remote pilot locally when the selected comparison voice differs from configuration', async () => {
    const root = await temporaryRoot()
    const anotherVoice = narrationBritishVoiceComparison.candidates.find(({ voice }) => voice !== narrationEditionConfiguration.voice)!.voice
    await writeComparisonApproval(root, anotherVoice)
    await expect(comparisonPrerequisiteProblems(root)).resolves.toEqual([
      expect.stringMatching(/approved comparison selected candidate/),
    ])
  })

  it('exports only audio referenced by the completed pilot manifest', async () => {
    const root = await temporaryRoot()
    const assetRoot = path.join(root, 'public/audio/narration', narrationEditionAssetDirectory)
    await fs.mkdir(assetRoot, { recursive: true })
    const passages = []
    for (let index = 0; index < narrationPilotPassageIds.length; index += 1) {
      const bytes = Buffer.from(`pilot-${index}`)
      const digest = sha256(bytes)
      const filename = `${String(index + 1).padStart(4, '0')}-pilot-${digest}.mp3`
      await fs.writeFile(path.join(assetRoot, filename), bytes)
      passages.push({
        id: narrationPilotPassageIds[index]!,
        url: `/audio/narration/${narrationEditionAssetDirectory}/${filename}`,
        sha256: digest,
      })
    }
    const orphanBytes = Buffer.from('orphan')
    const orphanDigest = sha256(orphanBytes)
    await fs.writeFile(path.join(assetRoot, `9999-orphan-${orphanDigest}.mp3`), orphanBytes)

    const sources = await referencedAudioSources('pilot', {
      complete: true,
      passageCount: passages.length,
      passages,
    }, root)
    expect(sources).toHaveLength(passages.length)
    expect(sources.some(({ sourcePath }) => sourcePath.includes('orphan'))).toBe(false)
  })

  it('pins the CLI, scopes deployment discovery, and excludes secret-prone untracked inputs', () => {
    expect(vercelCliArguments(['deploy'])).toEqual(['--yes', '--package=vercel@58.5.1', 'vercel', 'deploy'])
    expect(deploymentArguments('a'.repeat(24))).toEqual([
      'deploy', '--project', canonicalProject.projectId, '--prod', '--skip-domain', '--yes', '--force', '--json', '--meta', `pvNarrationJobId=${'a'.repeat(24)}`,
    ])
    expect(deploymentListArguments('a'.repeat(24))).toEqual([
      'list', canonicalProject.projectName, '--meta', `pvNarrationJobId=${'a'.repeat(24)}`, '--json', '--limit', '100', '--yes',
    ])
    expect(untrackedPathMayEnterStage('src/new-chapter.ts')).toBe(true)
    expect(untrackedPathMayEnterStage('public/cover.jpg')).toBe(true)
    expect(untrackedPathMayEnterStage('notes/private.txt')).toBe(false)
    expect(() => assertNonSecretStagingPath('.npmrc')).toThrow(/secret-prone/)
    expect(() => assertNonSecretStagingPath('src/private-key.pem')).toThrow(/secret-prone/)
    expect(vercelCurlArguments('https://job.vercel.app', '/chunk', '/tmp/chunk', 4096)).toContain('4096')
  })

  it('rejects a live credential pattern inside an otherwise allowlisted source file', async () => {
    const root = await temporaryRoot()
    const sourcePath = path.join(root, 'new-source.ts')
    await fs.writeFile(sourcePath, `export const credential = 'sk-proj-${'x'.repeat(40)}'`)
    await expect(assertNoLiveSecretInFile(sourcePath, 'src/new-source.ts', true)).rejects.toThrow(/Credential-like/)
  })

  it('removes only metadata-matched deployment ids and proves absence with a successful list', async () => {
    const root = await temporaryRoot()
    const calls: string[][] = []
    let listCount = 0
    await cleanupDisposableDeployments(root, 'a'.repeat(24), [], async (args) => {
      calls.push([...args])
      if (args[0] === 'list') {
        listCount += 1
        return {
          code: 0,
          stdout: JSON.stringify({ deployments: listCount === 1 ? [{ id: 'dpl_Matched' }] : [] }),
          stderr: '',
        }
      }
      return { code: 0, stdout: '', stderr: '' }
    })
    expect(calls.filter(([command]) => command === 'remove')).toEqual([['remove', 'dpl_Matched', '--yes']])
    expect(calls.filter(([command]) => command === 'list')).toHaveLength(3)
  })

  it('treats a deployment that remains in the scoped proof query as cleanup failure', async () => {
    const root = await temporaryRoot()
    await expect(cleanupDisposableDeployments(root, 'b'.repeat(24), [], async (args) => ({
      code: 0,
      stdout: args[0] === 'list' ? JSON.stringify({ deployments: [{ id: 'dpl_StillThere' }] }) : '',
      stderr: '',
    }))).rejects.toThrow(/cleanup failed/)
  })

  it('recovers a deployment id from metadata after the first scoped lookup fails', async () => {
    const root = await temporaryRoot()
    let listCount = 0
    const removed: string[] = []
    await cleanupDisposableDeployments(root, 'c'.repeat(24), [], async (args) => {
      if (args[0] === 'remove') {
        removed.push(args[1]!)
        return { code: 0, stdout: '', stderr: '' }
      }
      listCount += 1
      if (listCount === 1) return { code: 1, stdout: '', stderr: 'transient failure' }
      return {
        code: 0,
        stdout: JSON.stringify({ deployments: listCount === 2 ? [{ id: 'dpl_Recovered' }] : [] }),
        stderr: '',
      }
    })
    expect(removed).toEqual(['dpl_Recovered'])
  })

  it('installs removable SIGINT and SIGTERM cleanup hooks', () => {
    const emitter = new EventEmitter()
    const received: string[] = []
    const remove = installInterruptionHandlers(
      emitter as unknown as Pick<NodeJS.Process, 'on' | 'off'>,
      (signal) => received.push(signal),
    )
    emitter.emit('SIGINT')
    emitter.emit('SIGTERM')
    remove()
    emitter.emit('SIGINT')
    expect(received).toEqual(['SIGINT', 'SIGTERM'])
  })

  it('rejects downloaded narration metadata for another manuscript before import', async () => {
    const root = await temporaryRoot()
    const pilotPath = path.join(root, 'pilot.json')
    const statePath = path.join(root, 'state.json')
    const pilotBytes = Buffer.from(JSON.stringify({
      schemaVersion: 1,
      edition: '2026.1',
      model: 'gpt-4o-mini-tts-2025-12-15',
      voice: 'marin',
      configurationHash: 'a'.repeat(64),
      manuscriptHash: 'b'.repeat(64),
      complete: true,
      passageCount: narrationPilotPassageIds.length,
      passages: [],
    }))
    const stateBytes = Buffer.from('{"configurationHash":"wrong","entries":{}}')
    await fs.writeFile(pilotPath, pilotBytes)
    await fs.writeFile(statePath, stateBytes)
    const validated = new Map([
      ['.narration-work/pilot-manifest.json', { path: pilotPath, sha256: sha256(pilotBytes) }],
      ['.narration-work/generation-state.json', { path: statePath, sha256: sha256(stateBytes) }],
    ])
    await expect(validateDownloadedNarrationMetadata(validated, {
      mode: 'pilot',
      dryRun: false,
      worker: false,
      jobId: 'a'.repeat(24),
      chunkBytes: 24 * 1024 * 1024,
      sourceCommit: 'b'.repeat(40),
    })).rejects.toThrow(/does not match this narration job/)
  })
})
