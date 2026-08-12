import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  narrationApprovalChecklistVersion,
  narrationReleaseApprovalConfirmations,
} from '../data/narrationEdition'
import {
  narrationFullListenConfirmations,
  narrationFullListenReceiptMaterial,
  type NarrationApproval,
  type NarrationFullListenReceipt,
} from './narrationRelease'
import {
  narrationManifestApprovalIsPlayable,
  narrationReviewModeRequested,
} from './narrationReview'

const releaseId = `2026-2-${'a'.repeat(64)}`
const passageCount = 625
const receipt: NarrationFullListenReceipt = {
  schemaVersion: 1 as const,
  kind: 'narration-full-listen-receipt' as const,
  releaseId,
  reviewManifestSha256: 'b'.repeat(64),
  packageChecksumsSha256: 'c'.repeat(64),
  orderedPassageProfileSha256: 'd'.repeat(64),
  passageCount,
  completedAt: '2026-08-10T23:00:00.000Z',
  completedBy: 'Listening editor',
  confirmations: [...narrationFullListenConfirmations],
}
const receiptSha256 = createHash('sha256').update(narrationFullListenReceiptMaterial(receipt)).digest('hex')
const completeApproval: NarrationApproval = {
  approvedAt: '2026-08-11T00:00:00.000Z',
  approvedBy: 'Editorial QA',
  checklistVersion: narrationApprovalChecklistVersion,
  confirmations: narrationReleaseApprovalConfirmations.map(({ label }) => label),
  fullListen: { receiptSha256, receipt },
}

describe('unreleased narration review gate', () => {
  it('requires one exact query flag in development', () => {
    expect(narrationReviewModeRequested('?narration-review=1', true)).toBe(true)
    expect(narrationReviewModeRequested('?narration-review=0', true)).toBe(false)
    expect(narrationReviewModeRequested('?narration-review=1&narration-review=1', true)).toBe(false)
    expect(narrationReviewModeRequested('', true)).toBe(false)
  })

  it('cannot be enabled by a production query string', () => {
    expect(narrationReviewModeRequested('?narration-review=1', false)).toBe(false)
    expect(narrationManifestApprovalIsPlayable({ approved: false, approval: null, passageCount, releaseId }, true, false, null)).toBe(false)
  })

  it('accepts an unapproved candidate only inside explicit development review', () => {
    const candidate = { approved: false, approval: null, passageCount, releaseId }
    expect(narrationManifestApprovalIsPlayable(candidate, false, true, null)).toBe(false)
    expect(narrationManifestApprovalIsPlayable(candidate, true, true, null)).toBe(true)
  })

  it('keeps approved releases on the ordinary player path', () => {
    const release = { approved: true, approval: completeApproval, passageCount, releaseId }
    expect(narrationManifestApprovalIsPlayable(release, false, true, receiptSha256)).toBe(true)
    expect(narrationManifestApprovalIsPlayable(release, true, true, receiptSha256)).toBe(false)
    expect(narrationManifestApprovalIsPlayable({
      ...release,
      approval: { ...completeApproval, fullListen: undefined as never },
    }, false, true, receiptSha256)).toBe(false)
    expect(narrationManifestApprovalIsPlayable({
      ...release,
      approval: {
        ...completeApproval,
        fullListen: {
          ...completeApproval.fullListen,
          receipt: { ...receipt, completedBy: 'Someone else' },
        },
      },
    }, false, true, createHash('sha256').update(narrationFullListenReceiptMaterial({
      ...receipt,
      completedBy: 'Someone else',
    })).digest('hex'))).toBe(false)
  })
})
