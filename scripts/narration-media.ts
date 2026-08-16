import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export function durationFromDecodedFrameSamples(frameSamples: string, sampleRateHz: number) {
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) {
    throw new RangeError('Decoded audio duration requires a positive finite sample rate.')
  }

  const sampleCounts = frameSamples
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number(line))

  if (sampleCounts.length === 0 || sampleCounts.some((count) => !Number.isSafeInteger(count) || count <= 0)) {
    throw new Error('Decoded audio duration could not be measured from frame samples.')
  }

  return sampleCounts.reduce((total, count) => total + count, 0) / sampleRateHz
}

export async function decodedAudioDurationSeconds(
  filePath: string,
  sampleRateHz: number,
  ffprobeBinary = process.env.FFPROBE_PATH?.trim() || 'ffprobe',
) {
  const { stdout } = await execFileAsync(ffprobeBinary, [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'frame=nb_samples',
    '-of', 'csv=p=0',
    filePath,
  ], { maxBuffer: 2_000_000 })

  return durationFromDecodedFrameSamples(stdout, sampleRateHz)
}
