import { describe, expect, it } from 'vitest'
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
  type ExportFileDescriptor,
  type NarrationExportManifest,
} from './narration-job-lib'

function file(index: number, text: string, destinationPath = `public/audio/narration/edition-2026-1/000${index}-sample-${'a'.repeat(64)}.mp3`) {
  const bytes = Buffer.from(text)
  return {
    destinationPath,
    archivePath: `files/${String(index).padStart(6, '0')}.${destinationPath.endsWith('.mp3') ? 'mp3' : 'json'}`,
    size: bytes.length,
    sha256: sha256(bytes),
    bytes,
  }
}

function fileDescriptor(input: ReturnType<typeof file>): ExportFileDescriptor {
  return {
    destinationPath: input.destinationPath,
    archivePath: input.archivePath,
    size: input.size,
    sha256: input.sha256,
  }
}

describe('disposable narration-job archive', () => {
  it('round-trips allowlisted files and verifies inner digests', () => {
    const files = [
      file(1, 'audio bytes'),
      file(2, '{"complete":true}', '.narration-work/pilot-manifest.json'),
    ]
    const encoded = encodeChunk(files)
    const decoded = decodeChunk(encoded, files.map(fileDescriptor))
    expect(decoded.map(({ destinationPath, bytes }) => [destinationPath, Buffer.from(bytes).toString('utf8')])).toEqual([
      [files[0]!.destinationPath, 'audio bytes'],
      [files[1]!.destinationPath, '{"complete":true}'],
    ])

    const tampered = Buffer.from(encoded)
    tampered[tampered.length - 5] ^= 1
    expect(() => decodeChunk(tampered, files)).toThrow(/digest validation/)
  })

  it('rejects traversal, unapproved destinations and unsafe member names', () => {
    expect(() => assertSafeImportPath('../.env')).toThrow(/Unsafe/)
    expect(() => assertSafeImportPath('public/audio/narration/manifest.json')).toThrow(/allowlist/)
    expect(assertSafeImportPath(`.narration-work/british-voice-comparison/candidate-a-${'a'.repeat(64)}.mp3`)).toMatch(/candidate-a/)
    expect(assertSafeImportPath('.narration-work/british-voice-comparison/manifest.json')).toMatch(/manifest/)
    expect(() => assertSafeImportPath('.narration-work/british-voice-comparison/notes.txt')).toThrow(/allowlist/)
    expect(() => assertArchivePath('files/../../escape.mp3')).toThrow(/Unsafe/)
  })

  it('partitions deterministically without allowing an oversized member', () => {
    const descriptors: ExportFileDescriptor[] = [
      fileDescriptor(file(1, 'a'.repeat(600))),
      fileDescriptor(file(2, 'b'.repeat(600))),
    ]
    expect(partitionForChunks(descriptors, 1024)).toHaveLength(2)
    expect(() => partitionForChunks([{ ...descriptors[0]!, size: 1025 }], 1024)).toThrow(/cannot fit/)
    expect(() => partitionForChunks([{ ...descriptors[0]!, size: 1000 }], 1024)).toThrow(/authenticated header/)
  })

  it('parses only an exact Vercel deployment id and generated URL', () => {
    expect(parseDeploymentOutput('{"deployment":{"id":"dpl_AbC123","url":"book-job-abc.vercel.app"}}')).toEqual({
      id: 'dpl_AbC123',
      url: 'https://book-job-abc.vercel.app',
    })
    expect(() => parseDeploymentOutput('{"id":"project-name","url":"https://example.com"}')).toThrow(/parseable deployment/)
    expect(parseDeploymentListIds(JSON.stringify({ deployments: [{ uid: 'dpl_One' }, { id: 'dpl_Two' }, { id: 'project' }] }))).toEqual(['dpl_One', 'dpl_Two'])
    expect(parseDeploymentListIds(JSON.stringify({ deployments: [{ uid: 'dpl_One', creator: { id: 'dpl_Unrelated' } }] }))).toEqual(['dpl_One'])
  })

  it('validates export totals, canonical target and credential-like metadata', () => {
    const input = file(1, 'audio bytes')
    const bytes = encodeChunk([input])
    const descriptor = fileDescriptor(input)
    const manifest: NarrationExportManifest = {
      schemaVersion: 1,
      jobId: 'a'.repeat(24),
      mode: 'pilot',
      sourceCommit: 'b'.repeat(40),
      projectId: 'project',
      orgId: 'org',
      edition: '2026.1',
      configurationHash: 'c'.repeat(64),
      manuscriptHash: 'd'.repeat(64),
      createdAt: '2026-08-11T00:00:00.000Z',
      fileCount: 1,
      totalBytes: input.size,
      chunkBytesLimit: 1024,
      chunks: [{ filename: 'chunk-0001.pvchunk', size: bytes.length, sha256: sha256(bytes), fileCount: 1, files: [descriptor] }],
    }
    const expected = {
      jobId: manifest.jobId,
      mode: 'pilot' as const,
      projectId: 'project',
      orgId: 'org',
      sourceCommit: manifest.sourceCommit,
      edition: manifest.edition,
      configurationHash: manifest.configurationHash,
      manuscriptHash: manifest.manuscriptHash,
      chunkBytesLimit: manifest.chunkBytesLimit,
      fileCount: manifest.fileCount,
      maximumTotalBytes: 1024,
    }
    expect(validateExportManifest(manifest, expected)).toBe(manifest)
    expect(() => validateExportManifest({ ...manifest, projectId: 'another-project' }, expected)).toThrow(/does not match/)
    expect(() => validateExportManifest({ ...manifest, manuscriptHash: 'e'.repeat(64) }, expected)).toThrow(/does not match/)
    expect(() => validateExportManifest({ ...manifest, totalBytes: 2048 }, expected)).toThrow(/does not match/)
    expect(containsCredentialLikeMaterial(Buffer.from('{"OPENAI_API_KEY":"redacted"}'))).toBe(true)
    expect(containsCredentialLikeMaterial(Buffer.from('{"configurationHash":"abc"}'))).toBe(false)
    expect(containsLikelyStagingSecret(Buffer.from('token=sk-proj-' + 'x'.repeat(32)))).toBe(true)
    expect(containsLikelyStagingSecret(Buffer.from('const pattern = /sk-(?:proj-)?[A-Za-z]+/'))).toBe(false)
  })
})
