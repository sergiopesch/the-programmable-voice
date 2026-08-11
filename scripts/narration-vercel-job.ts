import { randomBytes } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  narrationApprovalChecklistVersion,
  narrationBritishVoiceComparison,
  narrationEditionAssetDirectory,
  narrationEditionConfiguration,
  narrationPassageHashMaterial,
  narrationPilotPassageIds,
} from '../src/data/narrationEdition'
import { bookNarrationPassages } from '../src/lib/narration'
import {
  narrationPilotApprovalIsComplete,
  narrationPilotProfileMaterial,
  type NarrationComparisonManifest,
  type NarrationManifestEntry,
  type NarrationPilotApproval,
  type NarrationPilotManifest,
} from '../src/lib/narrationRelease'
import {
  assertNarrationComparisonManifestMatchesCurrent,
  narrationComparisonApprovalName,
  narrationComparisonDirectory,
  narrationComparisonManifestName,
  removeNarrationComparisonApproval,
  requireSelectedNarrationComparison,
} from './narration-comparison-contract'
import {
  assertArchivePath,
  assertSafeImportPath,
  containsCredentialLikeMaterial,
  containsLikelyStagingSecret,
  decodeChunk,
  encodeChunk,
  parseDeploymentListIds,
  parseDeploymentOutput,
  partitionForChunks,
  sha256,
  validateExportManifest,
  type ChunkDescriptor,
  type ExportFileDescriptor,
  type NarrationExportManifest,
  type NarrationJobMode,
} from './narration-job-lib'

const projectRoot = path.resolve(import.meta.dirname, '..')
const canonicalLinkPath = path.join(projectRoot, '.vercel/project.json')
const canonicalProject = {
  projectId: 'prj_hXeTOVMWYJzMcfRl6YTdDmY7wAuP',
  orgId: 'team_WqyLoLLRUpatE3Jb2T7MK0H8',
  projectName: 'the-programmable-voice',
} as const
const ffmpegPackage = 'ffmpeg-static'
const ffmpegPackageVersion = '5.3.0'
const ffprobePackage = 'ffprobe-static'
const ffprobePackageVersion = '3.1.0'
const vercelCliVersion = '58.5.1'
const maximumPilotExportBytes = 256 * 1024 * 1024
const maximumFullExportBytes = 2 * 1024 * 1024 * 1024
const metadataNames = ['generation-state.json', 'pilot-manifest.json', 'pilot-approval.json', 'candidate-manifest.json'] as const
const temporaryVercelIgnoreEntries = [
  '.git',
  '.vercel',
  '.env*',
  'node_modules',
  'dist',
  'playwright-report',
  'test-results',
  'coverage',
  'public/narration-export',
] as const

interface CommandResult {
  code: number
  stdout: string
  stderr: string
}

interface JobOptions {
  mode: NarrationJobMode
  dryRun: boolean
  worker: boolean
  jobId: string
  chunkBytes: number
  sourceCommit: string
}

interface ExportSource extends ExportFileDescriptor {
  sourcePath: string
}

interface GenerationStateInput {
  configurationHash: string
  entries: Record<string, Pick<NarrationManifestEntry, 'textHash' | 'url' | 'sha256'>>
}

type VercelRunner = (args: readonly string[], options: { cwd: string; forward?: boolean }) => Promise<CommandResult>

const activeChildren = new Set<ChildProcessWithoutNullStreams>()
let activeChildKillTimer: NodeJS.Timeout | null = null

function line(message: string) {
  process.stdout.write(`${message}\n`)
}

function vercelCliArguments(args: readonly string[]) {
  return ['--yes', `--package=vercel@${vercelCliVersion}`, 'vercel', ...args]
}

function deploymentArguments(jobId: string) {
  return [
    'deploy', '--project', canonicalProject.projectId, '--prod', '--skip-domain', '--yes', '--force', '--json', '--meta', `pvNarrationJobId=${jobId}`,
  ]
}

function vercelCurlArguments(deploymentUrl: string, remotePath: string, destination: string, maximumBytes: number) {
  return [
    'curl', remotePath,
    '--deployment', deploymentUrl,
    '--yes', '--', '--fail', '--silent', '--show-error', '--output', destination,
    '--max-filesize', String(maximumBytes), '--max-time', '1800',
  ]
}

async function runCommand(
  command: string,
  args: readonly string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; forward?: boolean },
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      detached: process.platform !== 'win32',
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })
    activeChildren.add(child)
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk)
      if (options.forward) process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk)
      if (options.forward) process.stderr.write(chunk)
    })
    child.on('error', (error) => {
      activeChildren.delete(child)
      reject(error)
    })
    child.on('close', (code) => {
      activeChildren.delete(child)
      if (activeChildren.size === 0 && activeChildKillTimer) {
        clearTimeout(activeChildKillTimer)
        activeChildKillTimer = null
      }
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      })
    })
  })
}

function killCommandTree(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals) {
  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall through to the portable direct-child signal.
    }
  }
  child.kill(signal)
}

function interruptActiveCommand() {
  const children = [...activeChildren]
  if (children.length === 0) return
  for (const child of children) killCommandTree(child, 'SIGTERM')
  activeChildKillTimer = setTimeout(() => {
    for (const child of children) if (activeChildren.has(child)) killCommandTree(child, 'SIGKILL')
  }, 2_000)
  activeChildKillTimer.unref()
}

function installInterruptionHandlers(
  target: Pick<NodeJS.Process, 'on' | 'off'>,
  onSignal: (signal: NodeJS.Signals) => void,
) {
  const handleSigint = () => onSignal('SIGINT')
  const handleSigterm = () => onSignal('SIGTERM')
  target.on('SIGINT', handleSigint)
  target.on('SIGTERM', handleSigterm)
  return () => {
    target.off('SIGINT', handleSigint)
    target.off('SIGTERM', handleSigterm)
  }
}

async function runVercelCommand(args: readonly string[], options: { cwd: string; forward?: boolean }) {
  return runCommand('npx', vercelCliArguments(args), options)
}

async function runVercelRequired(args: readonly string[], options: { cwd: string; forward?: boolean }) {
  const result = await runVercelCommand(args, options)
  if (result.code !== 0) throw new Error(`Pinned Vercel CLI command ${args[0] ?? ''} failed with exit code ${result.code}.`)
  return result
}

async function runRequired(
  command: string,
  args: readonly string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; forward?: boolean },
) {
  const result = await runCommand(command, args, options)
  if (result.code !== 0) throw new Error(`${command} ${args[0] ?? ''} failed with exit code ${result.code}.`)
  return result
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T
}

async function atomicWrite(filePath: string, bytes: string | Uint8Array) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporaryPath, bytes)
  await fs.rename(temporaryPath, filePath)
}

function safeRepositoryPath(relativePath: string) {
  if (
    relativePath.length === 0
    || path.isAbsolute(relativePath)
    || relativePath.includes('\\')
    || relativePath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) throw new Error(`Unsafe repository path: ${relativePath}.`)
  return relativePath
}

const allowedUntrackedTopLevelFiles = new Set([
  'eslint.config.js',
  'index.html',
  'package-lock.json',
  'package.json',
  'playwright.config.ts',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vercel.json',
  'vite.config.ts',
])
const allowedUntrackedRoots = ['build/', 'public/', 'scripts/', 'src/'] as const
const allowedUntrackedExtensions = new Set([
  '.cjs', '.css', '.html', '.ico', '.jpeg', '.jpg', '.js', '.json', '.mjs', '.mp3',
  '.png', '.svg', '.ts', '.tsx', '.txt', '.webmanifest', '.woff', '.woff2',
])

function untrackedPathMayEnterStage(relativePath: string) {
  return allowedUntrackedTopLevelFiles.has(relativePath)
    || (allowedUntrackedRoots.some((root) => relativePath.startsWith(root)) && allowedUntrackedExtensions.has(path.extname(relativePath).toLowerCase()))
}

function assertNonSecretStagingPath(relativePath: string) {
  const basename = path.posix.basename(relativePath).toLowerCase()
  const extension = path.posix.extname(basename)
  if (
    ['.npmrc', '.yarnrc', '.netrc', 'credentials.json', 'service-account.json'].includes(basename)
    || ['.key', '.p12', '.pfx', '.pem'].includes(extension)
    || /(?:^|[-_.])(credential|private-key|secret)(?:[-_.]|$)/.test(basename)
  ) throw new Error(`Refusing to stage a secret-prone path: ${relativePath}.`)
  return relativePath
}

async function assertNoLiveSecretInFile(sourcePath: string, relativePath: string, rejectOversizedUntracked = false) {
  const stat = await fs.lstat(sourcePath)
  if (!stat.isFile()) throw new Error(`Only regular files may enter the disposable build: ${relativePath}.`)
  if (rejectOversizedUntracked && stat.size > 16 * 1024 * 1024) {
    throw new Error(`Refusing an oversized untracked deployment input: ${relativePath}.`)
  }
  const bytes = new Uint8Array(await fs.readFile(sourcePath))
  if (containsLikelyStagingSecret(bytes)) throw new Error(`Credential-like material detected in staged source ${relativePath}.`)
}

async function validateCanonicalLink(linkPath = canonicalLinkPath) {
  const link = await readJson<Record<string, unknown>>(linkPath)
  if (
    link.projectId !== canonicalProject.projectId
    || link.orgId !== canonicalProject.orgId
    || link.projectName !== canonicalProject.projectName
  ) throw new Error('The workspace is not linked to the canonical Vercel project; refusing to link or create another project.')
  return link
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function currentManuscriptIdentity() {
  const configurationHash = sha256(JSON.stringify(narrationEditionConfiguration))
  const expected = bookNarrationPassages.map((passage) => ({
    id: passage.id,
    textHash: sha256(narrationPassageHashMaterial(configurationHash, passage.id, passage.text)),
  }))
  return { configurationHash, expected, manuscriptHash: sha256(JSON.stringify(expected)) }
}

function maximumExportBytes(mode: NarrationJobMode) {
  return mode === 'full' ? maximumFullExportBytes : maximumPilotExportBytes
}

async function fullPrerequisiteProblems(root = projectRoot) {
  const workRoot = path.join(root, '.narration-work')
  const required = ['generation-state.json', 'pilot-manifest.json', 'pilot-approval.json']
  const problems: string[] = []
  for (const name of required) if (!await pathExists(path.join(workRoot, name))) problems.push(`missing .narration-work/${name}`)
  if (problems.length > 0) return problems

  try {
    const [state, manifest, approval, identity] = await Promise.all([
      readJson<GenerationStateInput>(path.join(workRoot, 'generation-state.json')),
      readJson<NarrationPilotManifest>(path.join(workRoot, 'pilot-manifest.json')),
      readJson<NarrationPilotApproval>(path.join(workRoot, 'pilot-approval.json')),
      currentManuscriptIdentity(),
    ])
    const pilotProfileHash = sha256(narrationPilotProfileMaterial(manifest))
    if (state.configurationHash !== identity.configurationHash || !state.entries || typeof state.entries !== 'object') problems.push('generation state does not match this workspace')
    if (!manifest.complete) problems.push('pilot manifest is incomplete')
    if (manifest.configurationHash !== identity.configurationHash || approval.configurationHash !== identity.configurationHash) problems.push('pilot configuration does not match this workspace')
    if (manifest.manuscriptHash !== identity.manuscriptHash || approval.manuscriptHash !== identity.manuscriptHash) problems.push('pilot manuscript does not match this workspace')
    if (approval.pilotProfileHash !== pilotProfileHash) problems.push('pilot approval digest does not match the pilot manifest')
    if (approval.checklistVersion !== narrationApprovalChecklistVersion || !narrationPilotApprovalIsComplete(approval)) problems.push('pilot listening approval is incomplete or obsolete')
    if (manifest.passages.map(({ id }) => id).join('\n') !== narrationPilotPassageIds.join('\n')) problems.push('pilot passage set does not match this workspace')
    for (const entry of manifest.passages) {
      const stateEntry = state.entries?.[entry.id]
      if (!stateEntry || stateEntry.textHash !== entry.textHash || stateEntry.url !== entry.url || stateEntry.sha256 !== entry.sha256) {
        problems.push(`generation state does not retain approved pilot ${entry.id}`)
      }
      const relativeAssetPath = `public/${entry.url.replace(/^\//, '')}`
      assertSafeImportPath(relativeAssetPath)
      if (!relativeAssetPath.startsWith(`public/audio/narration/${narrationEditionAssetDirectory}/`)) {
        problems.push(`pilot audio is outside this edition ${entry.id}`)
        continue
      }
      const assetPath = path.join(root, relativeAssetPath)
      if (!await pathExists(assetPath)) {
        problems.push(`missing pilot audio ${entry.id}`)
        continue
      }
      const bytes = new Uint8Array(await fs.readFile(assetPath))
      if (sha256(bytes) !== entry.sha256) problems.push(`pilot audio checksum mismatch ${entry.id}`)
    }
  } catch {
    problems.push('pilot metadata is not valid JSON')
  }
  return problems
}

async function comparisonPrerequisiteProblems(root = projectRoot) {
  try {
    await requireSelectedNarrationComparison(root)
    return []
  } catch (error) {
    return [error instanceof Error ? error.message : 'British voice comparison approval is unavailable.']
  }
}

async function copyFileIntoStage(source: string, destination: string, allowMissing = false) {
  let stat
  try {
    stat = await fs.lstat(source)
  } catch (error) {
    if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
  if (!stat.isFile()) throw new Error(`Only regular files may enter the disposable build: ${source}.`)
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.copyFile(source, destination)
  return true
}

async function copyNarrationComparisonInputs(sourceRoot: string, stageRoot: string) {
  const { manifest } = await requireSelectedNarrationComparison(sourceRoot)
  const relativePaths = [
    `${narrationComparisonDirectory}/${narrationComparisonManifestName}`,
    `${narrationComparisonDirectory}/${narrationComparisonApprovalName}`,
    ...manifest.candidates.map(({ filename }) => `${narrationComparisonDirectory}/${filename}`),
  ]
  for (const relativePath of relativePaths) {
    assertSafeImportPath(relativePath)
    const sourcePath = path.join(sourceRoot, relativePath)
    const bytes = new Uint8Array(await fs.readFile(sourcePath))
    if (relativePath.endsWith('.json') && (containsCredentialLikeMaterial(bytes) || containsLikelyStagingSecret(bytes))) {
      throw new Error(`Credential-like material detected in narration comparison input ${relativePath}.`)
    }
    await copyFileIntoStage(sourcePath, path.join(stageRoot, relativePath))
  }
}

async function copyNarrationInputs(sourceRoot: string, stageRoot: string, includeComparison = false) {
  const referencedAudio = new Map<string, string>()
  for (const name of metadataNames) {
    const sourcePath = path.join(sourceRoot, '.narration-work', name)
    if (await pathExists(sourcePath)) {
      const bytes = new Uint8Array(await fs.readFile(sourcePath))
      if (containsCredentialLikeMaterial(bytes) || containsLikelyStagingSecret(bytes)) {
        throw new Error(`Credential-like material detected in narration input .narration-work/${name}.`)
      }
      const metadata = JSON.parse(Buffer.from(bytes).toString('utf8')) as {
        entries?: Record<string, { url?: unknown; sha256?: unknown }>
        passages?: Array<{ url?: unknown; sha256?: unknown }>
      }
      const entries = name === 'generation-state.json'
        ? Object.values(metadata.entries ?? {})
        : Array.isArray(metadata.passages) ? metadata.passages : []
      for (const entry of entries) {
        if (typeof entry.url !== 'string' || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
          throw new Error(`Narration input ${name} contains invalid audio metadata.`)
        }
        const relativePath = `public/${entry.url.replace(/^\//, '')}`
        assertSafeImportPath(relativePath)
        if (!relativePath.startsWith(`public/audio/narration/${narrationEditionAssetDirectory}/`) || !path.basename(relativePath).includes(entry.sha256)) {
          throw new Error(`Narration input ${name} references an asset outside this edition.`)
        }
        const previous = referencedAudio.get(relativePath)
        if (previous && previous !== entry.sha256) throw new Error(`Narration inputs disagree about ${relativePath}.`)
        referencedAudio.set(relativePath, entry.sha256)
      }
      await copyFileIntoStage(sourcePath, path.join(stageRoot, '.narration-work', name))
    }
  }
  for (const [relativePath, expectedHash] of referencedAudio) {
    const sourcePath = path.join(sourceRoot, relativePath)
    const bytes = new Uint8Array(await fs.readFile(sourcePath))
    if (sha256(bytes) !== expectedHash) throw new Error(`Narration input checksum failed for ${relativePath}.`)
    await copyFileIntoStage(sourcePath, path.join(stageRoot, relativePath))
  }
  if (includeComparison) await copyNarrationComparisonInputs(sourceRoot, stageRoot)
}

function repositoryPathIsExcluded(relativePath: string) {
  return relativePath === '.env.example'
    || relativePath.startsWith('.env')
    || relativePath === '.gitignore'
    || relativePath.startsWith('.vercel/')
    || relativePath.startsWith('.narration-work/')
    || relativePath.startsWith('public/audio/narration/')
    || relativePath.startsWith('public/narration-export/')
}

async function collectRepositoryStageInputs() {
  const [tracked, untracked] = await Promise.all([
    runRequired('git', ['ls-files', '--cached', '-z'], { cwd: projectRoot }),
    runRequired('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: projectRoot }),
  ])
  const inputs = [
    ...tracked.stdout.split('\0').filter(Boolean).map((relativePath) => ({ relativePath, untracked: false })),
    ...untracked.stdout.split('\0').filter(Boolean).map((relativePath) => ({ relativePath, untracked: true })),
  ]
  const selected: string[] = []
  for (const input of inputs) {
    const untrustedPath = input.relativePath
    const relativePath = safeRepositoryPath(untrustedPath)
    if (repositoryPathIsExcluded(relativePath)) continue
    if (input.untracked && !untrackedPathMayEnterStage(relativePath)) continue
    assertNonSecretStagingPath(relativePath)
    const sourcePath = path.join(projectRoot, relativePath)
    if (!await pathExists(sourcePath)) continue
    await assertNoLiveSecretInFile(sourcePath, relativePath, input.untracked)
    selected.push(relativePath)
  }
  return selected
}

async function stageRepository(stageRoot: string, options: JobOptions) {
  for (const relativePath of await collectRepositoryStageInputs()) {
    const sourcePath = path.join(projectRoot, relativePath)
    await copyFileIntoStage(sourcePath, path.join(stageRoot, relativePath))
  }

  await copyFileIntoStage(canonicalLinkPath, path.join(stageRoot, '.vercel/project.json'))
  await atomicWrite(path.join(stageRoot, 'narration-job-project.json'), `${JSON.stringify(canonicalProject)}\n`)
  await copyNarrationInputs(projectRoot, stageRoot, options.mode !== 'comparison')
  await atomicWrite(path.join(stageRoot, '.vercelignore'), `${temporaryVercelIgnoreEntries.join('\n')}\n`)

  const packagePath = path.join(stageRoot, 'package.json')
  const packageJson = await readJson<Record<string, unknown>>(packagePath)
  const dependencies = { ...(packageJson.dependencies as Record<string, string> | undefined) }
  dependencies[ffmpegPackage] = ffmpegPackageVersion
  dependencies[ffprobePackage] = ffprobePackageVersion
  const scripts = { ...(packageJson.scripts as Record<string, string> | undefined) }
  scripts['narration:remote-worker'] = `tsx scripts/narration-vercel-job.ts --worker --mode=${options.mode} --job-id=${options.jobId} --chunk-bytes=${options.chunkBytes} --source-commit=${options.sourceCommit}`
  await atomicWrite(packagePath, `${JSON.stringify({ ...packageJson, dependencies, scripts }, null, 2)}\n`)

  const vercelPath = path.join(stageRoot, 'vercel.json')
  const vercelConfig = await readJson<Record<string, unknown>>(vercelPath)
  const existingHeaders = Array.isArray(vercelConfig.headers) ? vercelConfig.headers : []
  await atomicWrite(vercelPath, `${JSON.stringify({
    ...vercelConfig,
    buildCommand: 'npm run narration:remote-worker',
    outputDirectory: 'dist',
    headers: [{
      source: '/narration-export/(.*)',
      headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
    }, ...existingHeaders],
  }, null, 2)}\n`)

  await runRequired('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stageRoot, forward: true })
  await validateCanonicalLink(path.join(stageRoot, '.vercel/project.json'))
}

function resolvePackagedBinaries() {
  const require = createRequire(import.meta.url)
  const ffmpegModule = require(ffmpegPackage) as string | { default?: string } | null
  const ffprobeModule = require(ffprobePackage) as { path?: string; default?: { path?: string } } | string
  const ffmpegPath = typeof ffmpegModule === 'string' ? ffmpegModule : ffmpegModule?.default
  const ffprobePath = typeof ffprobeModule === 'string' ? ffprobeModule : ffprobeModule.path ?? ffprobeModule.default?.path
  if (!ffmpegPath || !ffprobePath || !path.isAbsolute(ffmpegPath) || !path.isAbsolute(ffprobePath)) {
    throw new Error('The disposable build could not resolve its packaged FFmpeg binaries.')
  }
  return { ffmpegPath, ffprobePath }
}

interface ExportPassageManifest {
  schemaVersion?: number
  edition?: string
  model?: string
  voice?: string
  configurationHash?: string
  manuscriptHash?: string
  pilotProfileHash?: string
  approved?: boolean
  complete: boolean
  passageCount: number
  generationScope?: { mode?: string; requestedPassageCount?: number }
  passages: Array<{
    id: string
    sectionId?: string
    targetId?: string
    textHash?: string
    url: string
    sha256: string
  }>
}

async function referencedAudioSources(mode: NarrationJobMode, manifest: ExportPassageManifest, root = projectRoot) {
  const expectedIds = mode === 'pilot' ? [...narrationPilotPassageIds] : bookNarrationPassages.map(({ id }) => id)
  if (
    !manifest.complete
    || !Array.isArray(manifest.passages)
    || manifest.passageCount !== expectedIds.length
    || manifest.passages.length !== expectedIds.length
    || manifest.passages.map(({ id }) => id).join('\n') !== expectedIds.join('\n')
    || (mode === 'full' && (manifest.generationScope?.mode !== 'full' || manifest.generationScope.requestedPassageCount !== expectedIds.length))
  ) throw new Error(`Remote ${mode} manifest does not contain the exact expected passage set.`)

  const seenUrls = new Set<string>()
  const sources: ExportSource[] = []
  for (const entry of manifest.passages) {
    if (
      typeof entry.url !== 'string'
      || typeof entry.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || seenUrls.has(entry.url)
    ) throw new Error(`Remote ${mode} manifest contains invalid or repeated audio metadata.`)
    seenUrls.add(entry.url)
    const destinationPath = `public/${entry.url.replace(/^\//, '')}`
    assertSafeImportPath(destinationPath)
    if (!path.basename(destinationPath).includes(entry.sha256)) throw new Error(`Remote ${mode} audio URL is not addressed by its checksum: ${entry.id}.`)
    const sourcePath = path.join(root, destinationPath)
    const bytes = new Uint8Array(await fs.readFile(sourcePath))
    if (sha256(bytes) !== entry.sha256) throw new Error(`Remote ${mode} audio checksum failed before export: ${entry.id}.`)
    sources.push({ destinationPath, archivePath: '', size: bytes.length, sha256: entry.sha256, sourcePath })
  }
  return sources
}

async function collectExportSources(mode: NarrationJobMode) {
  if (mode === 'comparison') {
    const comparisonRoot = path.join(projectRoot, '.narration-work/british-voice-comparison')
    const manifestPath = path.join(comparisonRoot, 'manifest.json')
    const manifestBytes = new Uint8Array(await fs.readFile(manifestPath))
    if (containsCredentialLikeMaterial(manifestBytes) || containsLikelyStagingSecret(manifestBytes)) {
      throw new Error('Credential-like material detected in the British voice comparison manifest.')
    }
    const manifest = assertNarrationComparisonManifestMatchesCurrent(
      JSON.parse(Buffer.from(manifestBytes).toString('utf8')) as NarrationComparisonManifest,
    )
    const expectedCandidates = narrationBritishVoiceComparison.candidates
    if (
      manifest.edition !== narrationEditionConfiguration.edition
      || manifest.model !== narrationEditionConfiguration.model
      || manifest.provisionalProductionVoice !== narrationEditionConfiguration.voice
      || manifest.candidates.length !== expectedCandidates.length
    ) throw new Error('Remote British voice comparison metadata does not match this workspace.')
    const sources: ExportSource[] = []
    for (let index = 0; index < expectedCandidates.length; index += 1) {
      const expected = expectedCandidates[index]!
      const candidate = manifest.candidates[index]!
      if (
        candidate.label !== expected.label
        || candidate.voice !== expected.voice
        || !/^candidate-[a-z]-[a-f0-9]{64}\.mp3$/.test(candidate.filename)
        || !/^[a-f0-9]{64}$/.test(candidate.sha256)
        || !candidate.filename.includes(candidate.sha256)
      ) throw new Error(`Remote British voice candidate ${expected.label} has invalid metadata.`)
      const sourcePath = path.join(comparisonRoot, candidate.filename)
      const bytes = new Uint8Array(await fs.readFile(sourcePath))
      if (sha256(bytes) !== candidate.sha256) throw new Error(`Remote British voice candidate ${expected.label} failed its checksum.`)
      sources.push({
        destinationPath: `.narration-work/british-voice-comparison/${candidate.filename}`,
        archivePath: '',
        size: bytes.length,
        sha256: candidate.sha256,
        sourcePath,
      })
    }
    sources.push({
      destinationPath: '.narration-work/british-voice-comparison/manifest.json',
      archivePath: '',
      size: manifestBytes.length,
      sha256: sha256(manifestBytes),
      sourcePath: manifestPath,
    })
    sources.sort((left, right) => left.destinationPath.localeCompare(right.destinationPath))
    return sources.map((source, index) => ({
      ...source,
      archivePath: `files/${String(index + 1).padStart(6, '0')}.${source.destinationPath.endsWith('.mp3') ? 'mp3' : 'json'}`,
    }))
  }
  const sources: ExportSource[] = []
  const primaryManifestName = mode === 'pilot' ? 'pilot-manifest.json' : 'candidate-manifest.json'
  const primaryManifest = await readJson<ExportPassageManifest>(path.join(projectRoot, '.narration-work', primaryManifestName))
  sources.push(...await referencedAudioSources(mode, primaryManifest))
  const wantedMetadata = mode === 'pilot'
    ? ['generation-state.json', 'pilot-manifest.json']
    : ['generation-state.json', 'pilot-manifest.json', 'pilot-approval.json', 'candidate-manifest.json']
  for (const name of wantedMetadata) {
    const sourcePath = path.join(projectRoot, '.narration-work', name)
    if (!await pathExists(sourcePath)) throw new Error(`Remote narration job did not produce required metadata: ${name}.`)
    const destinationPath = `.narration-work/${name}`
    assertSafeImportPath(destinationPath)
    const bytes = new Uint8Array(await fs.readFile(sourcePath))
    if (containsCredentialLikeMaterial(bytes)) throw new Error(`Credential-like material detected in ${destinationPath}; refusing to export the job.`)
    sources.push({ destinationPath, archivePath: '', size: bytes.length, sha256: sha256(bytes), sourcePath })
  }
  sources.sort((left, right) => left.destinationPath.localeCompare(right.destinationPath))
  return sources.map((source, index) => ({
    ...source,
    archivePath: `files/${String(index + 1).padStart(6, '0')}.${source.destinationPath.endsWith('.mp3') ? 'mp3' : 'json'}`,
  }))
}

async function packageRemoteExport(options: JobOptions) {
  const exportRoot = path.join(projectRoot, 'public/narration-export')
  await fs.rm(exportRoot, { recursive: true, force: true })
  await fs.mkdir(exportRoot, { recursive: true })
  const sources = await collectExportSources(options.mode)
  const groups = partitionForChunks(sources, options.chunkBytes)
  const chunks: ChunkDescriptor[] = []
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]!
    const inputs = await Promise.all(group.map(async (file) => ({ ...file, bytes: new Uint8Array(await fs.readFile((file as ExportSource).sourcePath)) })))
    const chunkBytes = encodeChunk(inputs)
    if (chunkBytes.length > options.chunkBytes) throw new Error('Authenticated narration chunk exceeded its configured size limit.')
    const filename = `chunk-${String(index + 1).padStart(4, '0')}.pvchunk`
    await atomicWrite(path.join(exportRoot, filename), chunkBytes)
    chunks.push({ filename, size: chunkBytes.length, sha256: sha256(chunkBytes), fileCount: group.length, files: group.map(({ destinationPath, archivePath, size, sha256: digest }) => ({ destinationPath, archivePath, size, sha256: digest })) })
  }

  const primaryMetadata = await readJson<{ edition: string; configurationHash: string; manuscriptHash: string }>(
    options.mode === 'comparison'
      ? path.join(projectRoot, '.narration-work/british-voice-comparison/manifest.json')
      : path.join(projectRoot, '.narration-work', options.mode === 'pilot' ? 'pilot-manifest.json' : 'candidate-manifest.json'),
  )
  const manifest: NarrationExportManifest = {
    schemaVersion: 1,
    jobId: options.jobId,
    mode: options.mode,
    sourceCommit: options.sourceCommit,
    projectId: canonicalProject.projectId,
    orgId: canonicalProject.orgId,
    edition: primaryMetadata.edition,
    configurationHash: primaryMetadata.configurationHash,
    manuscriptHash: primaryMetadata.manuscriptHash,
    createdAt: new Date().toISOString(),
    fileCount: sources.length,
    totalBytes: sources.reduce((total, source) => total + source.size, 0),
    chunkBytesLimit: options.chunkBytes,
    chunks,
  }
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`
  await atomicWrite(path.join(exportRoot, 'manifest.json'), manifestBytes)
  await atomicWrite(path.join(exportRoot, 'manifest.sha256'), `${sha256(manifestBytes)}  manifest.json\n`)
  return manifest
}

async function remoteWorker(options: JobOptions) {
  if (process.env.VERCEL !== '1') throw new Error('The narration worker may run only inside a Vercel build.')
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.length < 16) throw new Error('Production OPENAI_API_KEY was not injected into the disposable build.')
  await validateCanonicalLink(path.join(projectRoot, 'narration-job-project.json'))
  const { ffmpegPath, ffprobePath } = resolvePackagedBinaries()
  await Promise.all([fs.access(ffmpegPath), fs.access(ffprobePath)])
  const command = options.mode === 'comparison'
    ? 'narration:compare-british-voices'
    : options.mode === 'pilot'
      ? 'narration:pilot'
      : 'narration:generate'
  await runRequired('npm', ['run', command], {
    cwd: projectRoot,
    env: { ...process.env, FFMPEG_PATH: ffmpegPath, FFPROBE_PATH: ffprobePath },
    forward: true,
  })
  const manifest = await packageRemoteExport(options)
  if (options.mode !== 'comparison') {
    await fs.rm(path.join(projectRoot, 'public/audio/narration', narrationEditionAssetDirectory), { recursive: true, force: true })
  }
  await runRequired('npm', ['run', 'build:app'], { cwd: projectRoot, forward: true })
  line(`Disposable narration export ready: ${manifest.fileCount} files in ${manifest.chunks.length} digest-checked chunks.`)
}

async function downloadWithVercelCurl(
  stageRoot: string,
  deploymentUrl: string,
  remotePath: string,
  destination: string,
  maximumBytes: number,
) {
  await fs.mkdir(path.dirname(destination), { recursive: true })
  const args = vercelCurlArguments(deploymentUrl, remotePath, destination, maximumBytes)
  await runVercelRequired(args, { cwd: stageRoot, forward: true })
}

async function validateAndStageDownloads(downloadRoot: string, options: JobOptions, deploymentUrl: string, stageRoot: string) {
  const manifestPath = path.join(downloadRoot, 'manifest.json')
  const manifestDigestPath = path.join(downloadRoot, 'manifest.sha256')
  await downloadWithVercelCurl(stageRoot, deploymentUrl, '/narration-export/manifest.json', manifestPath, 10 * 1024 * 1024)
  await downloadWithVercelCurl(stageRoot, deploymentUrl, '/narration-export/manifest.sha256', manifestDigestPath, 256)
  const manifestStat = await fs.stat(manifestPath)
  if (manifestStat.size > 10 * 1024 * 1024) throw new Error('Narration export manifest exceeds the 10 MiB safety limit.')
  const [manifestBytes, digestText] = await Promise.all([fs.readFile(manifestPath), fs.readFile(manifestDigestPath, 'utf8')])
  const digestMatch = digestText.match(/^([a-f0-9]{64}) {2}manifest\.json\n?$/)
  if (!digestMatch || digestMatch[1] !== sha256(manifestBytes)) throw new Error('Narration export manifest failed its sidecar digest check.')
  const localIdentity = await currentManuscriptIdentity()
  const manifest = validateExportManifest(JSON.parse(manifestBytes.toString('utf8')) as NarrationExportManifest, {
    jobId: options.jobId,
    mode: options.mode,
    projectId: canonicalProject.projectId,
    orgId: canonicalProject.orgId,
    sourceCommit: options.sourceCommit,
    edition: narrationEditionConfiguration.edition,
    configurationHash: localIdentity.configurationHash,
    manuscriptHash: localIdentity.manuscriptHash,
    chunkBytesLimit: options.chunkBytes,
    fileCount: options.mode === 'comparison'
      ? narrationBritishVoiceComparison.candidates.length + 1
      : options.mode === 'pilot'
        ? narrationPilotPassageIds.length + 2
        : bookNarrationPassages.length + 4,
    maximumTotalBytes: maximumExportBytes(options.mode),
  })
  const validatedRoot = path.join(downloadRoot, 'validated')
  const validated = new Map<string, { path: string; sha256: string }>()
  for (const chunk of manifest.chunks) {
    const chunkPath = path.join(downloadRoot, chunk.filename)
    await downloadWithVercelCurl(stageRoot, deploymentUrl, `/narration-export/${chunk.filename}`, chunkPath, chunk.size)
    const stat = await fs.stat(chunkPath)
    if (stat.size !== chunk.size) throw new Error(`${chunk.filename} size does not match its manifest.`)
    const bytes = new Uint8Array(await fs.readFile(chunkPath))
    if (sha256(bytes) !== chunk.sha256) throw new Error(`${chunk.filename} failed its outer digest check.`)
    for (const file of decodeChunk(bytes, chunk.files)) {
      if (validated.has(file.destinationPath)) throw new Error(`Narration export repeats ${file.destinationPath}.`)
      const validatedPath = path.join(validatedRoot, assertArchivePath(file.archivePath))
      await atomicWrite(validatedPath, file.bytes)
      validated.set(file.destinationPath, { path: validatedPath, sha256: file.sha256 })
    }
  }
  if (validated.size !== manifest.fileCount) throw new Error('Validated narration export does not contain every manifested file.')
  await validateDownloadedNarrationMetadata(validated, options)
  return { manifest, validated }
}

async function readValidatedJson<T>(
  validated: Map<string, { path: string; sha256: string }>,
  relativePath: string,
) {
  const file = validated.get(relativePath)
  if (!file) throw new Error(`Narration export is missing ${relativePath}.`)
  const bytes = new Uint8Array(await fs.readFile(file.path))
  if (sha256(bytes) !== file.sha256 || containsCredentialLikeMaterial(bytes) || containsLikelyStagingSecret(bytes)) {
    throw new Error(`Narration export metadata failed validation: ${relativePath}.`)
  }
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as T
  } catch {
    throw new Error(`Narration export metadata is not valid JSON: ${relativePath}.`)
  }
}

async function validateDownloadedNarrationMetadata(
  validated: Map<string, { path: string; sha256: string }>,
  options: JobOptions,
) {
  const identity = await currentManuscriptIdentity()
  if (options.mode === 'comparison') {
    const manifestPath = '.narration-work/british-voice-comparison/manifest.json'
    const manifest = assertNarrationComparisonManifestMatchesCurrent(
      await readValidatedJson<NarrationComparisonManifest>(validated, manifestPath),
    )
    const expectedCandidates = narrationBritishVoiceComparison.candidates
    const passage = bookNarrationPassages.find(({ id }) => id === narrationBritishVoiceComparison.passageId)
    if (
      !passage
      || !/^british-voice-comparison-\d{4}-\d{2}-\d{2}-[a-f0-9]{10}$/.test(manifest.comparisonId)
      || manifest.edition !== narrationEditionConfiguration.edition
      || manifest.model !== narrationEditionConfiguration.model
      || manifest.provisionalProductionVoice !== narrationEditionConfiguration.voice
      || manifest.configurationHash !== identity.configurationHash
      || manifest.manuscriptHash !== identity.manuscriptHash
      || manifest.passage.id !== passage.id
      || manifest.passage.text !== passage.text
      || manifest.passage.sha256 !== sha256(passage.text)
      || !Array.isArray(manifest.candidates)
      || manifest.candidates.length !== expectedCandidates.length
    ) throw new Error('Downloaded British voice comparison does not match this narration configuration and manuscript.')
    for (let index = 0; index < expectedCandidates.length; index += 1) {
      const expected = expectedCandidates[index]!
      const candidate = manifest.candidates[index]!
      const destinationPath = `.narration-work/british-voice-comparison/${candidate.filename}`
      const audio = validated.get(destinationPath)
      const qc = candidate.technicalQc
      if (
        candidate.label !== expected.label
        || candidate.voice !== expected.voice
        || !/^candidate-[a-z]-[a-f0-9]{64}\.mp3$/.test(candidate.filename)
        || !/^[a-f0-9]{64}$/.test(candidate.sha256)
        || !candidate.filename.includes(candidate.sha256)
        || !audio
        || audio.sha256 !== candidate.sha256
        || !qc
        || !Number.isFinite(qc.durationSeconds)
        || !Number.isFinite(qc.wordsPerMinute)
        || !Number.isFinite(qc.integratedLoudnessLufs)
        || !Number.isFinite(qc.loudnessRangeLu)
        || !Number.isFinite(qc.truePeakDbtp)
        || qc.sampleRateHz !== narrationEditionConfiguration.normalisation.sampleRateHz
        || qc.channels !== narrationEditionConfiguration.normalisation.channels
        || Math.abs(qc.bitrateKbps - narrationEditionConfiguration.normalisation.bitrateKbps) > 2
        || qc.fullDecodePassed !== true
      ) throw new Error(`Downloaded British voice candidate ${expected.label} failed validation.`)
    }
    return
  }
  const primaryName = options.mode === 'pilot' ? 'pilot-manifest.json' : 'candidate-manifest.json'
  const primaryPath = `.narration-work/${primaryName}`
  const primary = await readValidatedJson<ExportPassageManifest>(validated, primaryPath)
  const expectedPassages = options.mode === 'pilot'
    ? narrationPilotPassageIds.map((id) => bookNarrationPassages.find((passage) => passage.id === id))
    : bookNarrationPassages
  if (expectedPassages.some((passage) => !passage)) throw new Error('The configured pilot no longer matches the local manuscript.')
  const resolvedExpected = expectedPassages as typeof bookNarrationPassages
  const textHashes = new Map(identity.expected.map(({ id, textHash }) => [id, textHash]))
  if (
    primary.schemaVersion !== 1
    || primary.edition !== narrationEditionConfiguration.edition
    || primary.model !== narrationEditionConfiguration.model
    || primary.voice !== narrationEditionConfiguration.voice
    || primary.configurationHash !== identity.configurationHash
    || primary.manuscriptHash !== identity.manuscriptHash
    || !primary.complete
    || primary.passageCount !== resolvedExpected.length
    || !Array.isArray(primary.passages)
    || primary.passages.length !== resolvedExpected.length
    || (options.mode === 'full' && (
      primary.generationScope?.mode !== 'full'
      || primary.generationScope.requestedPassageCount !== resolvedExpected.length
      || primary.approved !== false
    ))
  ) throw new Error(`Downloaded ${options.mode} metadata does not match this narration job.`)

  for (let index = 0; index < resolvedExpected.length; index += 1) {
    const expected = resolvedExpected[index]!
    const entry = primary.passages[index]!
    if (typeof entry.id !== 'string' || typeof entry.url !== 'string' || typeof entry.sha256 !== 'string') {
      throw new Error(`Downloaded narration passage metadata is malformed at index ${index}.`)
    }
    const destinationPath = `public/${entry.url.replace(/^\//, '')}`
    const audio = validated.get(destinationPath)
    if (
      entry.id !== expected.id
      || entry.sectionId !== expected.sectionId
      || entry.targetId !== expected.targetId
      || entry.textHash !== textHashes.get(expected.id)
      || !entry.url.startsWith(`/audio/narration/${narrationEditionAssetDirectory}/`)
      || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || !audio
      || audio.sha256 !== entry.sha256
    ) throw new Error(`Downloaded narration passage identity failed: ${expected.id}.`)
  }

  const state = await readValidatedJson<GenerationStateInput>(validated, '.narration-work/generation-state.json')
  if (state.configurationHash !== identity.configurationHash || !state.entries || typeof state.entries !== 'object') {
    throw new Error('Downloaded narration generation state does not match this workspace.')
  }
  for (const entry of primary.passages) {
    const stateEntry = state.entries[entry.id]
    if (!stateEntry || stateEntry.textHash !== entry.textHash || stateEntry.url !== entry.url || stateEntry.sha256 !== entry.sha256) {
      throw new Error(`Downloaded generation state does not retain ${entry.id}.`)
    }
  }

  if (options.mode === 'full') {
    const [pilot, approval] = await Promise.all([
      readValidatedJson<NarrationPilotManifest>(validated, '.narration-work/pilot-manifest.json'),
      readValidatedJson<NarrationPilotApproval>(validated, '.narration-work/pilot-approval.json'),
    ])
    const pilotProfileHash = sha256(narrationPilotProfileMaterial(pilot))
    if (
      !pilot.complete
      || pilot.configurationHash !== identity.configurationHash
      || pilot.manuscriptHash !== identity.manuscriptHash
      || pilot.passages.map(({ id }) => id).join('\n') !== narrationPilotPassageIds.join('\n')
      || approval.configurationHash !== identity.configurationHash
      || approval.manuscriptHash !== identity.manuscriptHash
      || approval.pilotProfileHash !== pilotProfileHash
      || approval.checklistVersion !== narrationApprovalChecklistVersion
      || !narrationPilotApprovalIsComplete(approval)
      || primary.pilotProfileHash !== pilotProfileHash
    ) throw new Error('Downloaded full narration is not bound to the approved local voice pilot.')
    const primaryById = new Map(primary.passages.map((entry) => [entry.id, entry]))
    for (const pilotEntry of pilot.passages) {
      const fullEntry = primaryById.get(pilotEntry.id)
      if (!fullEntry || fullEntry.textHash !== pilotEntry.textHash || fullEntry.url !== pilotEntry.url || fullEntry.sha256 !== pilotEntry.sha256) {
        throw new Error(`Full narration changed approved pilot audio ${pilotEntry.id}.`)
      }
    }
  }
}

async function safeWorkspaceDestination(relativePath: string) {
  assertSafeImportPath(relativePath)
  const destination = path.resolve(projectRoot, relativePath)
  if (!destination.startsWith(`${projectRoot}${path.sep}`)) throw new Error(`Narration import escapes the workspace: ${relativePath}.`)
  await fs.mkdir(path.dirname(destination), { recursive: true })
  const [realRoot, realParent] = await Promise.all([fs.realpath(projectRoot), fs.realpath(path.dirname(destination))])
  if (realParent !== realRoot && !realParent.startsWith(`${realRoot}${path.sep}`)) throw new Error(`Narration import parent escapes the workspace: ${relativePath}.`)
  return destination
}

async function importValidatedFiles(validated: Map<string, { path: string; sha256: string }>) {
  const ordered = [...validated.entries()].toSorted(([left], [right]) => {
    const leftMetadata = left.startsWith('.narration-work/')
    const rightMetadata = right.startsWith('.narration-work/')
    return Number(leftMetadata) - Number(rightMetadata) || left.localeCompare(right)
  })
  for (const [relativePath, file] of ordered) {
    const destination = await safeWorkspaceDestination(relativePath)
    const bytes = new Uint8Array(await fs.readFile(file.path))
    if (sha256(bytes) !== file.sha256) throw new Error(`Validated staging changed before import: ${relativePath}.`)
    if (relativePath.endsWith('.mp3') && await pathExists(destination)) {
      const existing = new Uint8Array(await fs.readFile(destination))
      if (sha256(existing) !== file.sha256) throw new Error(`Refusing to overwrite a different immutable audio asset: ${relativePath}.`)
      continue
    }
    await atomicWrite(destination, bytes)
  }
}

function deploymentListArguments(jobId: string) {
  return ['list', canonicalProject.projectName, '--meta', `pvNarrationJobId=${jobId}`, '--json', '--limit', '100', '--yes']
}

async function listDisposableDeploymentIds(stageRoot: string, jobId: string, runner: VercelRunner) {
  const listed = await runner(deploymentListArguments(jobId), { cwd: stageRoot })
  if (listed.code !== 0) throw new Error(`Could not list disposable narration deployments for job ${jobId}.`)
  return parseDeploymentListIds(listed.stdout)
}

async function cleanupDisposableDeployments(
  stageRoot: string,
  jobId: string,
  knownDeploymentIds: readonly string[] = [],
  runner: VercelRunner = runVercelRequired,
) {
  const candidates = new Set(knownDeploymentIds)
  const removed = new Set<string>()
  const errors: unknown[] = []
  try {
    for (const deploymentId of await listDisposableDeploymentIds(stageRoot, jobId, runner)) candidates.add(deploymentId)
  } catch {
    // A second, mandatory scoped list below can recover from a transient first lookup failure.
  }

  const removeCandidates = async () => {
    for (const deploymentId of candidates) {
      if (removed.has(deploymentId)) continue
      try {
        const result = await runner(['remove', deploymentId, '--yes'], { cwd: stageRoot, forward: true })
        if (result.code !== 0) throw new Error(`Vercel refused to remove ${deploymentId}.`)
        removed.add(deploymentId)
      } catch (error) {
        errors.push(new Error(`Failed to delete disposable deployment ${deploymentId}.`, { cause: error }))
      }
    }
  }

  await removeCandidates()
  for (const deploymentId of await listDisposableDeploymentIds(stageRoot, jobId, runner)) candidates.add(deploymentId)
  await removeCandidates()
  const remaining = await listDisposableDeploymentIds(stageRoot, jobId, runner)
  if (remaining.length > 0) errors.push(new Error(`Disposable narration deployments still exist: ${remaining.join(', ')}.`))
  if (errors.length > 0) throw new AggregateError(errors, `Disposable-deployment cleanup failed for job ${jobId}.`)
  line(removed.size > 0
    ? `Deleted and verified ${removed.size} disposable deployment${removed.size === 1 ? '' : 's'} for job ${jobId}.`
    : `Verified that narration job ${jobId} has no disposable deployments.`)
}

function assertOwnedTemporaryDirectory(temporaryRoot: string) {
  const resolved = path.resolve(temporaryRoot)
  const expectedParent = `${path.resolve(os.tmpdir())}${path.sep}`
  if (!resolved.startsWith(expectedParent) || !path.basename(resolved).startsWith('pv-narration-job-')) {
    throw new Error(`Refusing to clean an unexpected temporary directory: ${resolved}.`)
  }
  return resolved
}

async function localJob(options: JobOptions) {
  await validateCanonicalLink()
  const comparisonProblems = options.mode === 'comparison' ? [] : await comparisonPrerequisiteProblems()
  const pilotProblems = options.mode === 'full' ? await fullPrerequisiteProblems() : []
  const prerequisiteProblems = [...comparisonProblems, ...pilotProblems]
  if (options.dryRun) {
    const stagedSourceFileCount = (await collectRepositoryStageInputs()).length
    line(JSON.stringify({
      dryRun: true,
      mode: options.mode,
      canonicalProject,
      deploy: ['npx', ...vercelCliArguments(deploymentArguments(options.jobId))],
      packagedBuildOnlyDependencies: [`${ffmpegPackage}@${ffmpegPackageVersion}`, `${ffprobePackage}@${ffprobePackageVersion}`],
      chunkBytes: options.chunkBytes,
      stagedSourceFileCount,
      comparisonPrerequisiteProblems: comparisonProblems,
      fullPrerequisiteProblems: pilotProblems,
      aliasesChanged: false,
      keyExported: false,
    }, null, 2))
    return
  }
  if (prerequisiteProblems.length > 0) throw new Error(`${options.mode === 'pilot' ? 'Narration pilot' : 'Full narration job'} is not ready:\n- ${prerequisiteProblems.join('\n- ')}`)

  const temporaryRoot = assertOwnedTemporaryDirectory(await fs.mkdtemp(path.join(os.tmpdir(), 'pv-narration-job-')))
  const stageRoot = path.join(temporaryRoot, 'stage')
  const downloadRoot = path.join(temporaryRoot, 'download')
  let deployment: { id: string; url: string } | null = null
  let deployAttempted = false
  let interruptedSignal: NodeJS.Signals | null = null
  let operationError: unknown = null
  let cleanupError: unknown = null
  const removeInterruptionHandlers = installInterruptionHandlers(process, (signal) => {
    interruptedSignal ??= signal
    interruptActiveCommand()
  })
  line(`Narration job id: ${options.jobId}. Recovery: npm run narration:vercel-job -- --cleanup-job=${options.jobId}`)
  try {
    await fs.mkdir(stageRoot, { recursive: true })
    await stageRepository(stageRoot, options)
    line(`Staged disposable ${options.mode} job for canonical project ${canonicalProject.projectName}.`)
    deployAttempted = true
    const deployResult = await runVercelCommand(deploymentArguments(options.jobId), { cwd: stageRoot, forward: false })
    try {
      deployment = parseDeploymentOutput(deployResult.stdout)
    } catch {
      // A failed CLI call may not have created a deployment to clean up.
    }
    if (deployResult.code !== 0) throw new Error(`Disposable Vercel build failed with exit code ${deployResult.code}.`)
    if (!deployment) throw new Error('Disposable Vercel build completed without a deployment identity; refusing an untracked download.')
    line(`Disposable deployment ready: ${deployment.id}. The canonical alias was not changed.`)
    const { manifest, validated } = await validateAndStageDownloads(downloadRoot, options, deployment.url, stageRoot)
    await importValidatedFiles(validated)
    if (options.mode === 'comparison') {
      await removeNarrationComparisonApproval(projectRoot)
    }
    line(`Imported ${manifest.fileCount} verified ${options.mode} files into the workspace.`)
  } catch (error) {
    operationError = error
  } finally {
    if (deployAttempted) {
      try {
        await cleanupDisposableDeployments(stageRoot, options.jobId, deployment ? [deployment.id] : [])
      } catch (error) {
        cleanupError = error
      }
    }
    try {
      await fs.rm(assertOwnedTemporaryDirectory(temporaryRoot), { recursive: true, force: true })
    } catch (error) {
      cleanupError = cleanupError ? new AggregateError([cleanupError, error], 'Disposable-job cleanup failed.') : error
    }
    removeInterruptionHandlers()
  }
  if (interruptedSignal) {
    const interruptError = new Error(`Narration job ${options.jobId} was interrupted by ${interruptedSignal}. Run the printed recovery command before retrying.`)
    operationError = operationError ? new AggregateError([operationError, interruptError], 'Narration job was interrupted.') : interruptError
  }
  if (operationError && cleanupError) throw new AggregateError([operationError, cleanupError], 'Narration job and cleanup both failed.')
  if (operationError) throw operationError
  if (cleanupError) throw cleanupError
}

function argumentValue(name: string) {
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)
}

async function parseOptions(): Promise<JobOptions> {
  const worker = process.argv.includes('--worker')
  const explicitMode = argumentValue('--mode')
  const comparison = process.argv.includes('--comparison') || explicitMode === 'comparison'
  const pilot = process.argv.includes('--pilot') || explicitMode === 'pilot'
  const full = process.argv.includes('--full') || explicitMode === 'full'
  if (Number(comparison) + Number(pilot) + Number(full) !== 1) {
    throw new Error('Choose exactly one narration job mode: --comparison, --pilot or --full.')
  }
  const chunkMiBText = argumentValue('--chunk-mib')
  const chunkBytesText = argumentValue('--chunk-bytes')
  const chunkBytes = chunkBytesText
    ? Number(chunkBytesText)
    : Math.floor(Number(chunkMiBText ?? 24) * 1024 * 1024)
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 4 * 1024 * 1024 || chunkBytes > 48 * 1024 * 1024) {
    throw new Error('Narration chunk size must be between 4 and 48 MiB.')
  }
  const sourceCommit = argumentValue('--source-commit') ?? (await runRequired('git', ['rev-parse', 'HEAD'], { cwd: projectRoot })).stdout.trim()
  if (!/^[a-f0-9]{7,64}$/.test(sourceCommit)) throw new Error('Narration job source commit is invalid.')
  const jobId = argumentValue('--job-id') ?? randomBytes(12).toString('hex')
  if (!/^[a-f0-9]{16,64}$/.test(jobId)) throw new Error('Narration job id is invalid.')
  return { mode: comparison ? 'comparison' : pilot ? 'pilot' : 'full', dryRun: process.argv.includes('--dry-run'), worker, jobId, chunkBytes, sourceCommit }
}

async function main() {
  const cleanupJobId = argumentValue('--cleanup-job')
  if (cleanupJobId !== undefined) {
    if (!/^[a-f0-9]{16,64}$/.test(cleanupJobId)) throw new Error('Narration cleanup job id is invalid.')
    if (process.argv.includes('--comparison') || process.argv.includes('--pilot') || process.argv.includes('--full') || process.argv.includes('--worker')) {
      throw new Error('--cleanup-job cannot be combined with a generation mode.')
    }
    await validateCanonicalLink()
    await cleanupDisposableDeployments(projectRoot, cleanupJobId)
    return
  }
  if (narrationEditionConfiguration.provider === 'local-open-weight-inference') {
    throw new Error('The disposable OpenAI/Vercel narration generator is retired for edition 2026.2. Run narration:pilot and narration:generate locally; bf_emma is not an OpenAI voice.')
  }
  const options = await parseOptions()
  if (options.worker) await remoteWorker(options)
  else await localJob(options)
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === entryPath) await main()

export {
  assertOwnedTemporaryDirectory,
  assertNonSecretStagingPath,
  assertNoLiveSecretInFile,
  canonicalProject,
  cleanupDisposableDeployments,
  comparisonPrerequisiteProblems,
  copyFileIntoStage,
  copyNarrationComparisonInputs,
  copyNarrationInputs,
  deploymentArguments,
  deploymentListArguments,
  fullPrerequisiteProblems,
  installInterruptionHandlers,
  referencedAudioSources,
  temporaryVercelIgnoreEntries,
  untrackedPathMayEnterStage,
  validateCanonicalLink,
  validateDownloadedNarrationMetadata,
  vercelCurlArguments,
  vercelCliArguments,
}
