import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const projectRoot = path.resolve(import.meta.dirname, '..')
const configuration = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'))
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
let fixtureRoot: string

beforeAll(async () => {
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'voice-release-build-'))
  await Promise.all([
    cp(path.join(projectRoot, 'src'), path.join(fixtureRoot, 'src'), { recursive: true }),
    cp(path.join(projectRoot, 'scripts'), path.join(fixtureRoot, 'scripts'), { recursive: true }),
    symlink(path.join(projectRoot, 'node_modules'), path.join(fixtureRoot, 'node_modules'), 'junction'),
  ])
  // Retain the actual release command chain and verifier, replacing only the
  // compiler with a sentinel. Never copy or fabricate narration approval.
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({
    ...packageJson,
    scripts: { ...packageJson.scripts, 'build:app': 'node compiler-sentinel.mjs' },
  }))
  await writeFile(path.join(fixtureRoot, 'compiler-sentinel.mjs'),
    "console.log('APPLICATION_COMPILER_REACHED')\n")
})

afterAll(async () => {
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true })
})

describe('Vercel release build', () => {
  it('pins the approved-release build rather than inheriting a dashboard app-only command', () => {
    expect(configuration.buildCommand).toBe('npm run build')
  })

  it.each([
    { label: 'production CI', context: { VERCEL: '1', VERCEL_ENV: 'production', CI: '1' } },
    { label: 'unknown Vercel target in CI', context: { VERCEL: '1', CI: '1' } },
    { label: 'system variables not exposed', context: {} },
  ])('blocks a release with no approved manifest before compilation: $label', ({ context }) => {
    const [command, ...args] = configuration.buildCommand.split(' ')
    const result = spawnSync(command, args, {
      cwd: fixtureRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH,
        HOME: fixtureRoot,
        npm_config_offline: 'true',
        npm_config_update_notifier: 'false',
        ...context,
      },
    })
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBe(0)
    const output = `${result.stdout}${result.stderr}`
    expect(output).toContain('Narration release is unavailable: public/audio/narration/manifest.json')
    expect(output).not.toContain('APPLICATION_COMPILER_REACHED')
  }, 35_000)

  it('keeps the application-only build usable without approving a release', () => {
    const result = spawnSync('npm', ['run', 'build:app'], {
      cwd: fixtureRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH,
        HOME: fixtureRoot,
        npm_config_offline: 'true',
        npm_config_update_notifier: 'false',
      },
    })
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('APPLICATION_COMPILER_REACHED')
  }, 35_000)
})
