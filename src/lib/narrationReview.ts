import { narrationReleaseApprovalIsComplete, type NarrationManifest } from './narrationRelease'

export const narrationReviewQueryParameter = 'narration-review'
export const narrationReviewManifestUrl = '/__narration-review/candidate-manifest.json'

type NarrationManifestApprovalState = Pick<NarrationManifest, 'approved' | 'approval' | 'passageCount' | 'releaseId'>

export function narrationReviewModeRequested(search: string, development: boolean) {
  if (!development) return false
  const values = new URLSearchParams(search).getAll(narrationReviewQueryParameter)
  return values.length === 1 && values[0] === '1'
}

export function narrationManifestApprovalIsPlayable(
  manifest: NarrationManifestApprovalState,
  reviewMode: boolean,
  development: boolean,
  receiptSha256: string | null,
) {
  if (reviewMode) {
    return development && manifest.approved === false && manifest.approval === null
  }
  return manifest.approved === true
    && receiptSha256 !== null
    && narrationReleaseApprovalIsComplete(manifest.approval, {
      releaseId: manifest.releaseId,
      passageCount: manifest.passageCount,
      receiptSha256,
    })
}
