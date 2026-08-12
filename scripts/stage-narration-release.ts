import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { narrationEditionAssetDirectory } from '../src/data/narrationEdition'
import {
  narrationReleaseStagingPaths,
  narrationUnexpectedStagedPaths,
} from './narration-review-contract'
import { verifyRelease } from './verify-narration'

const execFileAsync = promisify(execFile)
const projectRoot = path.resolve(import.meta.dirname, '..')
const narrationPathPrefix = 'public/audio/narration/'

async function git(args: readonly string[]) {
  return execFileAsync('git', [...args], { cwd: projectRoot, maxBuffer: 20_000_000 })
}

function nulPaths(stdout: string) {
  return stdout.split('\0').filter(Boolean)
}

async function stagedNarrationPaths() {
  const { stdout } = await git(['diff', '--cached', '--name-only', '-z', '--', narrationPathPrefix])
  return nulPaths(stdout)
}

async function assertNoStagedExtras(plannedPaths: readonly string[]) {
  const extras = narrationUnexpectedStagedPaths(plannedPaths, await stagedNarrationPaths())
  if (extras.length > 0) {
    throw new Error(`Refusing exact narration staging while unrelated narration paths are already staged: ${extras.join(', ')}.`)
  }
}

export async function assertNarrationStagingRegularFiles(root: string, paths: readonly string[]) {
  const resolvedRoot = path.resolve(root)
  const realRoot = await fs.realpath(resolvedRoot)
  for (const repositoryPath of paths) {
    const absolutePath = path.resolve(resolvedRoot, repositoryPath)
    if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`Narration staging path escapes the repository: ${repositoryPath}.`)
    const [stat, realPath] = await Promise.all([fs.lstat(absolutePath), fs.realpath(absolutePath)])
    const expectedRealPath = path.resolve(realRoot, path.relative(resolvedRoot, absolutePath))
    if (!stat.isFile() || stat.isSymbolicLink() || realPath !== expectedRealPath) {
      throw new Error(`Narration staging path is not a regular non-symlinked file: ${repositoryPath}.`)
    }
  }
}

async function assertIndexBytes(paths: readonly string[]) {
  const [{ stdout: objectFormatOutput }, { stdout: indexOutput }] = await Promise.all([
    git(['rev-parse', '--show-object-format']),
    git(['ls-files', '--stage', '-z', '--', narrationPathPrefix]),
  ])
  const objectFormat = objectFormatOutput.trim()
  if (objectFormat !== 'sha1' && objectFormat !== 'sha256') throw new Error(`Unsupported Git object format ${objectFormat}.`)
  const indexHashes = new Map<string, string>()
  for (const record of nulPaths(indexOutput)) {
    const separator = record.indexOf('\t')
    if (separator < 0) continue
    const metadata = record.slice(0, separator).split(' ')
    const repositoryPath = record.slice(separator + 1)
    if (metadata[2] === '0' && metadata[1]) indexHashes.set(repositoryPath, metadata[1])
  }
  for (const repositoryPath of paths) {
    const bytes = await fs.readFile(path.join(projectRoot, repositoryPath))
    const digest = createHash(objectFormat)
      .update(`blob ${bytes.byteLength}\0`)
      .update(bytes)
      .digest('hex')
    if (indexHashes.get(repositoryPath) !== digest) throw new Error(`Git index bytes do not match exact release asset ${repositoryPath}.`)
  }
}

export async function narrationReleaseStagingPlan() {
  const { manifest } = await verifyRelease(true)
  const paths = narrationReleaseStagingPaths(manifest, narrationEditionAssetDirectory)
  await assertNarrationStagingRegularFiles(projectRoot, paths)
  await assertNoStagedExtras(paths)
  return { manifest, paths }
}

async function stageExactPaths(paths: readonly string[]) {
  const workRoot = path.join(projectRoot, '.narration-work')
  await fs.mkdir(workRoot, { recursive: true })
  const pathspecPath = path.join(workRoot, `release-stage-${process.pid}-${Date.now()}.pathspec`)
  await fs.writeFile(pathspecPath, `${paths.join('\0')}\0`, { flag: 'wx' })
  try {
    await git([`--literal-pathspecs`, 'add', `--pathspec-from-file=${pathspecPath}`, '--pathspec-file-nul'])
  } finally {
    await fs.rm(pathspecPath, { force: true })
  }
  await verifyRelease(true)
  await assertNoStagedExtras(paths)
  await assertIndexBytes(paths)
}

async function main() {
  const apply = process.argv.includes('--apply')
  const unknown = process.argv.slice(2).filter((argument) => argument !== '--apply')
  if (unknown.length > 0) throw new Error(`Unknown narration staging option(s): ${unknown.join(', ')}.`)
  const { manifest, paths } = await narrationReleaseStagingPlan()
  if (!apply) {
    process.stdout.write(`Dry run: release ${manifest.releaseId} would stage exactly ${paths.length} paths and no unreferenced narration assets:\n${paths.join('\n')}\n`)
    return
  }
  await stageExactPaths(paths)
  process.stdout.write(`Staged exactly ${paths.length} manifest-derived narration paths for release ${manifest.releaseId}; no extra narration path was staged.\n`)
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === entryPath) await main()
