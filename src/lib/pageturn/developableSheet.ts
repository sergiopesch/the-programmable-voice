/**
 * A point on the undeformed page. The binding is `u = 0`; `u` increases
 * towards the fore edge and `v` runs from `-height / 2` to `height / 2`.
 */
export interface DevelopableSheetPoint {
  u: number
  v: number
}

export interface DevelopableSheetPosition {
  x: number
  y: number
  z: number
}

export interface DevelopableSheetOptions {
  width: number
  height: number
  /** Normalised turn progress. Values outside [0, 1] settle at an endpoint. */
  progress: number
  floor?: number
  leadingCorner?: 'top' | 'bottom'
  apexOffset?: number
  /** Cone strength in [0, 0.55]. Zero produces a rigid, flat leaf. */
  curl?: number
}

export interface DevelopableSheetFrame {
  readonly rotation: number
  readonly progress: number
  position(point: DevelopableSheetPoint): DevelopableSheetPosition
}

const MAX_CURL = 0.55

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const smoothstep = (value: number) => value * value * (3 - 2 * value)

function requireFinite(name: string, value: number) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`)
}

function requirePositive(name: string, value: number) {
  requireFinite(name, value)
  if (value <= 0) throw new RangeError(`${name} must be greater than zero`)
}

/**
 * Prepare one immutable page-turn frame. The deformation is an exact isometry
 * in continuous space: the sheet bends onto a cone and then rotates about the
 * binding, so the first fundamental form remains `dr² + r²dθ²`.
 */
export function createDevelopableSheetFrame(
  options: DevelopableSheetOptions,
): DevelopableSheetFrame {
  const { width, height } = options
  requirePositive('width', width)
  requirePositive('height', height)
  requireFinite('progress', options.progress)

  const floor = options.floor ?? 0
  const leadingCorner = options.leadingCorner ?? 'top'
  const apexOffset = options.apexOffset ?? height * 0.28
  const curl = options.curl ?? 0.42

  requireFinite('floor', floor)
  requirePositive('apexOffset', apexOffset)
  requireFinite('curl', curl)
  if (curl < 0 || curl > MAX_CURL) {
    throw new RangeError(`curl must be between 0 and ${MAX_CURL}`)
  }

  const progress = clamp01(options.progress)
  const easedProgress = smoothstep(progress)
  const rotation = Math.PI * easedProgress

  if (progress === 0 || progress === 1) {
    const direction = progress === 0 ? 1 : -1
    return Object.freeze({
      progress,
      rotation,
      position(point: DevelopableSheetPoint) {
        const { u, v } = normalisePoint(point, width, height)
        return { x: u === 0 ? 0 : direction * u, y: v, z: floor }
      },
    })
  }

  const sinRotation = Math.sin(rotation)
  const cosRotation = Math.cos(rotation)
  const coneAxisComponent = curl * sinRotation
  const coneRadiusComponent = Math.sqrt(1 - coneAxisComponent * coneAxisComponent)
  const apexY = leadingCorner === 'top'
    ? height / 2 + apexOffset
    : -height / 2 - apexOffset
  const bindingDirection = leadingCorner === 'top' ? -1 : 1

  return Object.freeze({
    progress,
    rotation,
    position(point: DevelopableSheetPoint) {
      const { u, v } = normalisePoint(point, width, height)
      if (u === 0) return { x: 0, y: v, z: floor }

      const alongBinding = Math.abs(v - apexY)
      const radius = Math.hypot(u, alongBinding)
      const theta = Math.atan2(u, alongBinding)
      const coneAngle = theta / coneRadiusComponent
      const sinCone = Math.sin(coneAngle)
      const cosCone = Math.cos(coneAngle)

      const tangentComponent = coneRadiusComponent * sinCone
      const normalComponent = coneRadiusComponent * coneAxisComponent * (1 - cosCone)
      const bindingComponent = coneAxisComponent * coneAxisComponent
        + coneRadiusComponent * coneRadiusComponent * cosCone

      const x = radius * (
        tangentComponent * cosRotation - normalComponent * sinRotation
      )
      const y = apexY + bindingDirection * radius * bindingComponent
      const rawZ = floor + radius * (
        tangentComponent * sinRotation + normalComponent * cosRotation
      )

      return { x, y, z: Math.max(floor, rawZ) }
    },
  })
}

export function developableSheetPosition(
  point: DevelopableSheetPoint,
  options: DevelopableSheetOptions,
): DevelopableSheetPosition {
  return createDevelopableSheetFrame(options).position(point)
}

function normalisePoint(
  { u, v }: DevelopableSheetPoint,
  width: number,
  height: number,
): DevelopableSheetPoint {
  requireFinite('u', u)
  requireFinite('v', v)
  const tolerance = Number.EPSILON * Math.max(width, height) * 8
  if (u < -tolerance || u > width + tolerance) {
    throw new RangeError(`u must be between 0 and ${width}`)
  }
  if (v < -height / 2 - tolerance || v > height / 2 + tolerance) {
    throw new RangeError(`v must be between ${-height / 2} and ${height / 2}`)
  }
  return {
    u: Math.min(width, Math.max(0, u)),
    v: Math.min(height / 2, Math.max(-height / 2, v)),
  }
}
