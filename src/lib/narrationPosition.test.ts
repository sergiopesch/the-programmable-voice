import { describe, expect, it } from 'vitest'
import {
  createNarrationSavedPosition,
  narrationPositionSchemaVersion,
  parseNarrationSavedPosition,
} from './narrationPosition'

const edition = '2026.2'
const releaseId = `2026-2-${'a'.repeat(64)}`
const passageId = 'narration:opening:section-title'

describe('saved narration position identity', () => {
  it('round-trips only against the exact release', () => {
    const position = createNarrationSavedPosition(edition, releaseId, passageId, 12.5)
    const value = JSON.stringify(position)
    expect(parseNarrationSavedPosition(value, edition, releaseId, [passageId])).toEqual(position)
    expect(parseNarrationSavedPosition(value, edition, `2026-2-${'b'.repeat(64)}`, [passageId])).toBeNull()
  })

  it('fails closed until a manifest release id is known', () => {
    const value = JSON.stringify(createNarrationSavedPosition(edition, releaseId, passageId, 12.5))
    expect(parseNarrationSavedPosition(value, edition, null, [passageId])).toBeNull()
    expect(createNarrationSavedPosition(edition, null, passageId, 12.5)).toBeNull()
  })

  it('rejects the previous edition-only position schema', () => {
    const previous = {
      version: narrationPositionSchemaVersion - 1,
      edition,
      passageId,
      currentTime: 12.5,
    }
    expect(parseNarrationSavedPosition(JSON.stringify(previous), edition, releaseId, [passageId])).toBeNull()
  })
})
