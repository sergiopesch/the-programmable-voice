export type BookFace = 'Front cover' | 'Fore edge' | 'Back cover' | 'Spine'

export function normaliseDegrees(value: number) {
  return ((value % 360) + 360) % 360
}

export function bookFaceFromAzimuth(value: number): BookFace {
  const angle = normaliseDegrees(value)

  if (angle < 45 || angle >= 315) return 'Front cover'
  if (angle < 135) return 'Fore edge'
  if (angle < 225) return 'Back cover'
  return 'Spine'
}

export function cameraAzimuthDegrees(x: number, z: number) {
  return normaliseDegrees(Math.atan2(x, z) * (180 / Math.PI))
}

export function shortestAngleDelta(from: number, to: number) {
  const fullTurn = Math.PI * 2
  return ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
}
