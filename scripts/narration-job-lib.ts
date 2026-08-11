import { createHash } from 'node:crypto'

const CHUNK_MAGIC = Buffer.from('PVNAR001', 'ascii')
const MAX_HEADER_BYTES = 64 * 1024

export type NarrationJobMode = 'comparison' | 'pilot' | 'full'

export interface ExportFileDescriptor {
  destinationPath: string
  archivePath: string
  size: number
  sha256: string
}

export interface ChunkDescriptor {
  filename: string
  size: number
  sha256: string
  fileCount: number
  files: ExportFileDescriptor[]
}

export interface NarrationExportManifest {
  schemaVersion: 1
  jobId: string
  mode: NarrationJobMode
  sourceCommit: string
  projectId: string
  orgId: string
  edition: string
  configurationHash: string
  manuscriptHash: string
  createdAt: string
  fileCount: number
  totalBytes: number
  chunkBytesLimit: number
  chunks: ChunkDescriptor[]
}

export interface ChunkInput extends ExportFileDescriptor {
  bytes: Uint8Array
}

export function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

export function assertSafeImportPath(relativePath: string) {
  if (
    relativePath.length === 0
    || relativePath.startsWith('/')
    || relativePath.includes('\\')
    || relativePath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) throw new Error(`Unsafe narration import path: ${relativePath || '(empty)'}.`)

  const audioPath = /^public\/audio\/narration\/edition-[a-z0-9-]+\/[a-z0-9][a-z0-9-]*-[a-f0-9]{64}\.mp3$/
  const metadataPath = /^\.narration-work\/(generation-state|pilot-manifest|pilot-approval|candidate-manifest)\.json$/
  const comparisonPath = /^\.narration-work\/british-voice-comparison\/(?:manifest\.json|approval\.json|candidate-[a-z]-[a-f0-9]{64}\.mp3)$/
  if (!audioPath.test(relativePath) && !metadataPath.test(relativePath) && !comparisonPath.test(relativePath)) {
    throw new Error(`Narration import path is outside the allowlist: ${relativePath}.`)
  }
  return relativePath
}

export function assertArchivePath(relativePath: string) {
  if (!/^files\/\d{6}\.(mp3|json)$/.test(relativePath)) throw new Error(`Unsafe chunk member path: ${relativePath}.`)
  return relativePath
}

export function containsCredentialLikeMaterial(bytes: Uint8Array) {
  const text = Buffer.from(bytes).toString('utf8')
  return /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}/.test(text)
    || /"OPENAI_API_KEY"\s*:/.test(text)
    || /authorization\s*:\s*bearer\s+/i.test(text)
}

export function containsLikelyStagingSecret(bytes: Uint8Array) {
  const text = Buffer.from(bytes).toString('utf8')
  return /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/.test(text)
    || /\bAKIA[0-9A-Z]{16}\b/.test(text)
    || /\bgh[pousr]_[A-Za-z0-9]{24,}\b/.test(text)
    || /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/.test(text)
    || /\bAIza[0-9A-Za-z_-]{30,}\b/.test(text)
    || /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(text)
    || /(?:^|\n)\s*(?:_authToken|npmAuthToken|password)\s*=\s*[^\s$<{][^\r\n]*/i.test(text)
}

export function partitionForChunks(files: readonly ExportFileDescriptor[], maximumBytes: number) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1024) throw new Error('Chunk size must be an integer of at least 1,024 bytes.')
  const chunks: ExportFileDescriptor[][] = []
  let current: ExportFileDescriptor[] = []
  let currentBytes = CHUNK_MAGIC.length + 4

  for (const file of files) {
    assertSafeImportPath(file.destinationPath)
    assertArchivePath(file.archivePath)
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > maximumBytes) {
      throw new Error(`${file.destinationPath} cannot fit in a ${maximumBytes}-byte chunk.`)
    }
    const estimatedHeaderBytes = Buffer.byteLength(JSON.stringify(file)) + 4
    const estimatedBytes = estimatedHeaderBytes + file.size
    if (CHUNK_MAGIC.length + 4 + estimatedBytes > maximumBytes) {
      throw new Error(`${file.destinationPath} cannot fit in a ${maximumBytes}-byte chunk with its authenticated header.`)
    }
    if (current.length > 0 && currentBytes + estimatedBytes > maximumBytes) {
      chunks.push(current)
      current = []
      currentBytes = CHUNK_MAGIC.length + 4
    }
    current.push(file)
    currentBytes += estimatedBytes
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

export function encodeChunk(files: readonly ChunkInput[]) {
  const parts: Buffer[] = [CHUNK_MAGIC]
  for (const file of files) {
    assertSafeImportPath(file.destinationPath)
    assertArchivePath(file.archivePath)
    const bytes = Buffer.from(file.bytes)
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) throw new Error(`Chunk input failed digest validation: ${file.destinationPath}.`)
    const header = Buffer.from(JSON.stringify({
      destinationPath: file.destinationPath,
      archivePath: file.archivePath,
      size: file.size,
      sha256: file.sha256,
    }), 'utf8')
    if (header.length > MAX_HEADER_BYTES) throw new Error(`Chunk header is too large for ${file.destinationPath}.`)
    const length = Buffer.allocUnsafe(4)
    length.writeUInt32BE(header.length)
    parts.push(length, header, bytes)
  }
  const terminator = Buffer.alloc(4)
  parts.push(terminator)
  return Buffer.concat(parts)
}

export function decodeChunk(bytes: Uint8Array, expectedFiles: readonly ExportFileDescriptor[]) {
  const chunk = Buffer.from(bytes)
  if (chunk.length < CHUNK_MAGIC.length + 4 || !chunk.subarray(0, CHUNK_MAGIC.length).equals(CHUNK_MAGIC)) {
    throw new Error('Narration chunk has an invalid magic header.')
  }
  let offset = CHUNK_MAGIC.length
  const decoded: ChunkInput[] = []
  const destinations = new Set<string>()
  let terminated = false
  while (offset + 4 <= chunk.length) {
    const headerLength = chunk.readUInt32BE(offset)
    offset += 4
    if (headerLength === 0) {
      if (offset !== chunk.length) throw new Error('Narration chunk has trailing bytes.')
      terminated = true
      break
    }
    if (headerLength > MAX_HEADER_BYTES || offset + headerLength > chunk.length) throw new Error('Narration chunk header is truncated or oversized.')
    let header: ExportFileDescriptor
    try {
      header = JSON.parse(chunk.subarray(offset, offset + headerLength).toString('utf8')) as ExportFileDescriptor
    } catch {
      throw new Error('Narration chunk header is not valid JSON.')
    }
    offset += headerLength
    assertSafeImportPath(header.destinationPath)
    assertArchivePath(header.archivePath)
    if (!Number.isSafeInteger(header.size) || header.size < 0 || offset + header.size > chunk.length) throw new Error(`Narration chunk member is truncated: ${header.destinationPath}.`)
    if (!/^[a-f0-9]{64}$/.test(header.sha256)) throw new Error(`Narration chunk member has an invalid digest: ${header.destinationPath}.`)
    if (destinations.has(header.destinationPath)) throw new Error(`Narration chunk repeats ${header.destinationPath}.`)
    destinations.add(header.destinationPath)
    const fileBytes = chunk.subarray(offset, offset + header.size)
    offset += header.size
    if (sha256(fileBytes) !== header.sha256) throw new Error(`Narration chunk member failed digest validation: ${header.destinationPath}.`)
    decoded.push({ ...header, bytes: fileBytes })
  }
  if (!terminated || offset !== chunk.length) throw new Error('Narration chunk is missing its terminator.')
  if (decoded.length !== expectedFiles.length) throw new Error('Narration chunk member count does not match its manifest.')
  for (let index = 0; index < expectedFiles.length; index += 1) {
    const expected = expectedFiles[index]!
    const actual = decoded[index]!
    if (
      actual.destinationPath !== expected.destinationPath
      || actual.archivePath !== expected.archivePath
      || actual.size !== expected.size
      || actual.sha256 !== expected.sha256
    ) throw new Error(`Narration chunk member ${index + 1} does not match its manifest.`)
  }
  return decoded
}

function deploymentPair(value: unknown): { id: string; url: string } | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = typeof record.id === 'string'
    ? record.id
    : typeof record.uid === 'string'
      ? record.uid
      : typeof record.deploymentId === 'string'
        ? record.deploymentId
        : null
  const rawUrl = typeof record.url === 'string' ? record.url : typeof record.deploymentUrl === 'string' ? record.deploymentUrl : null
  if (id && /^dpl_[A-Za-z0-9]+$/.test(id) && rawUrl) {
    const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/i.test(url)) return { id, url: url.replace(/\/$/, '') }
  }
  for (const nested of Object.values(record)) {
    const found = deploymentPair(nested)
    if (found) return found
  }
  return null
}

export function parseDeploymentOutput(stdout: string) {
  const candidates = [stdout.trim(), ...stdout.trim().split(/\r?\n/).reverse()]
  for (const candidate of candidates) {
    if (!candidate.startsWith('{')) continue
    try {
      const found = deploymentPair(JSON.parse(candidate))
      if (found) return found
    } catch {
      // Continue through JSON or NDJSON candidates.
    }
  }
  throw new Error('Vercel did not return a parseable deployment id and URL.')
}

export function parseDeploymentListIds(stdout: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout.trim())
  } catch {
    throw new Error('Vercel did not return a parseable deployment list.')
  }
  const ids = new Set<string>()
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const record = value as Record<string, unknown>
    const id = typeof record.id === 'string'
      ? record.id
      : typeof record.uid === 'string'
        ? record.uid
        : typeof record.deploymentId === 'string'
          ? record.deploymentId
          : null
    if (id && /^dpl_[A-Za-z0-9]+$/.test(id)) ids.add(id)
    if (Array.isArray(record.deployments)) visit(record.deployments)
  }
  visit(parsed)
  return [...ids]
}

export function validateExportManifest(
  manifest: NarrationExportManifest,
  expected: {
    jobId: string
    mode: NarrationJobMode
    projectId: string
    orgId: string
    sourceCommit: string
    edition: string
    configurationHash: string
    manuscriptHash: string
    chunkBytesLimit: number
    fileCount: number
    maximumTotalBytes: number
  },
) {
  if (
    !manifest
    || manifest.schemaVersion !== 1
    || manifest.jobId !== expected.jobId
    || manifest.mode !== expected.mode
    || manifest.projectId !== expected.projectId
    || manifest.orgId !== expected.orgId
    || manifest.sourceCommit !== expected.sourceCommit
    || manifest.edition !== expected.edition
    || manifest.configurationHash !== expected.configurationHash
    || manifest.manuscriptHash !== expected.manuscriptHash
    || typeof manifest.createdAt !== 'string'
    || Number.isNaN(Date.parse(manifest.createdAt))
    || !Array.isArray(manifest.chunks)
    || manifest.chunks.length === 0
    || manifest.chunks.length > 1000
    || manifest.fileCount !== expected.fileCount
    || !Number.isSafeInteger(manifest.totalBytes)
    || manifest.totalBytes < 1
    || manifest.totalBytes > expected.maximumTotalBytes
    || manifest.chunkBytesLimit !== expected.chunkBytesLimit
  ) throw new Error('Narration export manifest does not match this disposable job.')

  const seenFiles = new Set<string>()
  const seenArchivePaths = new Set<string>()
  const seenChunks = new Set<string>()
  let fileCount = 0
  let totalBytes = 0
  let encodedBytes = 0
  for (const chunk of manifest.chunks) {
    if (!/^chunk-\d{4}\.pvchunk$/.test(chunk.filename) || seenChunks.has(chunk.filename)) throw new Error('Narration export contains an unsafe or repeated chunk name.')
    seenChunks.add(chunk.filename)
    if (!/^[a-f0-9]{64}$/.test(chunk.sha256) || !Number.isSafeInteger(chunk.size) || chunk.size < 1 || chunk.size > manifest.chunkBytesLimit) throw new Error(`Narration export chunk metadata is invalid: ${chunk.filename}.`)
    encodedBytes += chunk.size
    if (!Array.isArray(chunk.files) || chunk.fileCount !== chunk.files.length || chunk.files.length === 0) throw new Error(`Narration export chunk member count is invalid: ${chunk.filename}.`)
    for (const file of chunk.files) {
      assertSafeImportPath(file.destinationPath)
      assertArchivePath(file.archivePath)
      if (seenFiles.has(file.destinationPath) || seenArchivePaths.has(file.archivePath) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) {
        throw new Error(`Narration export file metadata is invalid: ${file.destinationPath}.`)
      }
      seenFiles.add(file.destinationPath)
      seenArchivePaths.add(file.archivePath)
      fileCount += 1
      totalBytes += file.size
    }
  }
  if (fileCount !== manifest.fileCount || totalBytes !== manifest.totalBytes) throw new Error('Narration export totals do not match its files.')
  if (encodedBytes > expected.maximumTotalBytes + manifest.fileCount * MAX_HEADER_BYTES) throw new Error('Narration export encoded size exceeds the job safety limit.')
  return manifest
}
