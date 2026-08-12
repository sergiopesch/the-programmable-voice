export const narrationPositionSchemaVersion = 4

export interface NarrationSavedPosition {
  version: typeof narrationPositionSchemaVersion
  edition: string
  releaseId: string
  passageId: string
  currentTime: number
}

export function parseNarrationSavedPosition(
  value: string | null,
  edition: string,
  releaseId: string | null,
  passageIds: readonly string[],
): NarrationSavedPosition | null {
  if (!releaseId) return null
  try {
    const stored = JSON.parse(value ?? '{}') as Partial<NarrationSavedPosition>
    if (
      stored.version !== narrationPositionSchemaVersion
      || stored.edition !== edition
      || stored.releaseId !== releaseId
      || typeof stored.passageId !== 'string'
      || typeof stored.currentTime !== 'number'
      || !Number.isFinite(stored.currentTime)
      || stored.currentTime < 0
      || !passageIds.includes(stored.passageId)
    ) return null
    return stored as NarrationSavedPosition
  } catch {
    return null
  }
}

export function createNarrationSavedPosition(
  edition: string,
  releaseId: string | null,
  passageId: string,
  currentTime: number,
): NarrationSavedPosition | null {
  if (!releaseId || !Number.isFinite(currentTime)) return null
  return {
    version: narrationPositionSchemaVersion,
    edition,
    releaseId,
    passageId,
    currentTime: Math.max(0, currentTime),
  }
}
