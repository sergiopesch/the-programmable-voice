const ordinaryMinimumIntegratedLoudnessLufs = -20.5
const absoluteMinimumIntegratedLoudnessLufs = -21.5
const maximumIntegratedLoudnessLufs = -15.5
const maximumLoudnessRangeLu = 12
const maximumTruePeakDbtp = -1
const shortClipRelaxationEndsSeconds = 3.5
const peakConvergenceAllowanceDb = 0.5

export interface NarrationLoudnessMeasurement {
  durationSeconds: number
  integratedLoudnessLufs: number
  loudnessRangeLu: number
  truePeakDbtp: number
  targetTruePeakDbtp: number
}

function reportedOneDecimal(value: number) {
  return Number(value.toFixed(1))
}

/**
 * Short, transient-heavy phrases can be limited by the configured true-peak
 * target before loudnorm reaches the ordinary integrated-loudness floor. The
 * relaxation is intentionally bounded by duration, an absolute floor, and the
 * loudest level that pure gain could reach without exceeding the target peak.
 */
export function narrationMinimumIntegratedLoudnessLufs(
  measurement: NarrationLoudnessMeasurement,
) {
  const {
    durationSeconds,
    integratedLoudnessLufs,
    loudnessRangeLu,
    truePeakDbtp,
    targetTruePeakDbtp,
  } = measurement
  if (
    !Number.isFinite(durationSeconds)
    || durationSeconds <= 0
    || !Number.isFinite(integratedLoudnessLufs)
    || !Number.isFinite(loudnessRangeLu)
    || !Number.isFinite(truePeakDbtp)
    || !Number.isFinite(targetTruePeakDbtp)
  ) {
    throw new RangeError('Narration loudness requires finite measurements and a positive duration.')
  }

  const durationFloor = ordinaryMinimumIntegratedLoudnessLufs
    - Math.min(1, Math.max(0, shortClipRelaxationEndsSeconds - durationSeconds))
  if (durationFloor === ordinaryMinimumIntegratedLoudnessLufs || truePeakDbtp > targetTruePeakDbtp) {
    return ordinaryMinimumIntegratedLoudnessLufs
  }

  const crestFactorDb = truePeakDbtp - integratedLoudnessLufs
  const peakFeasibleIntegratedLoudnessLufs = targetTruePeakDbtp - crestFactorDb
  const peakLimitedFloor = Math.min(
    ordinaryMinimumIntegratedLoudnessLufs,
    reportedOneDecimal(peakFeasibleIntegratedLoudnessLufs - peakConvergenceAllowanceDb),
  )
  return Math.max(absoluteMinimumIntegratedLoudnessLufs, durationFloor, peakLimitedFloor)
}

export function narrationLoudnessIsWithinBounds(measurement: NarrationLoudnessMeasurement) {
  try {
    const minimumIntegratedLoudnessLufs = narrationMinimumIntegratedLoudnessLufs(measurement)
    return measurement.integratedLoudnessLufs >= minimumIntegratedLoudnessLufs
      && measurement.integratedLoudnessLufs <= maximumIntegratedLoudnessLufs
      && measurement.loudnessRangeLu >= 0
      && measurement.loudnessRangeLu <= maximumLoudnessRangeLu
      && measurement.truePeakDbtp <= maximumTruePeakDbtp
  } catch {
    return false
  }
}
