import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  narrationComparisonApprovalChecklistVersion,
  narrationComparisonApprovalConfirmations,
} from '../src/data/narrationEdition'
import {
  narrationComparisonApprovalIsComplete,
  type NarrationComparisonApproval,
} from '../src/lib/narrationRelease'
import {
  narrationComparisonApprovalName,
  narrationComparisonDirectory,
  narrationComparisonManifestName,
  readNarrationComparisonManifest,
} from './narration-comparison-contract'

const projectRoot = path.resolve(import.meta.dirname, '..')

function argumentValue(name: string) {
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1).trim()
}

async function atomicWrite(filePath: string, data: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporaryPath, data)
  await fs.rename(temporaryPath, filePath)
}

async function main() {
  const approver = argumentValue('--approver')
  const selectedLabel = argumentValue('--select')?.toUpperCase()
  const rejectAll = process.argv.includes('--reject-all')
  if (!approver) throw new Error('Comparison approval requires --approver=<name>.')
  if (Number(Boolean(selectedLabel)) + Number(rejectAll) !== 1) {
    throw new Error('Choose exactly one comparison decision: --select=A (or B/C) or --reject-all.')
  }

  const requiredConfirmations = rejectAll
    ? narrationComparisonApprovalConfirmations.slice(0, 2)
    : narrationComparisonApprovalConfirmations
  const missing = requiredConfirmations.filter(({ flag }) => !process.argv.includes(flag)).map(({ flag }) => flag)
  if (missing.length > 0) throw new Error(`Comparison decision requires ${missing.join(', ')}.`)

  // Verify the exact manifest and every candidate before replacing any older
  // human decision receipt.
  const approvalPath = path.join(projectRoot, narrationComparisonDirectory, narrationComparisonApprovalName)
  const manifest = await readNarrationComparisonManifest(projectRoot, true)
  const manifestPath = path.join(projectRoot, narrationComparisonDirectory, narrationComparisonManifestName)

  const selected = selectedLabel ? manifest.candidates.find(({ label }) => label === selectedLabel) : undefined
  if (selectedLabel && !selected) throw new Error(`Comparison candidate ${selectedLabel} does not exist.`)
  const approval: NarrationComparisonApproval = {
    schemaVersion: 1,
    decidedAt: new Date().toISOString(),
    decidedBy: approver,
    checklistVersion: narrationComparisonApprovalChecklistVersion,
    comparisonId: manifest.comparisonId,
    comparisonProfileHash: manifest.comparisonProfileHash,
    decision: selected
      ? { kind: 'selected', candidateLabel: selected.label, voice: selected.voice }
      : { kind: 'reject-all' },
    confirmations: requiredConfirmations.map(({ label }) => label),
  }
  if (!narrationComparisonApprovalIsComplete(approval)) throw new Error('Comparison approval receipt is incomplete.')
  await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await atomicWrite(approvalPath, `${JSON.stringify(approval, null, 2)}\n`)
  process.stdout.write(selected
    ? `Approved British voice candidate ${selected.label} (${selected.voice}). Set narrationEditionConfiguration.voice to ${selected.voice} before generating the pilot.\n`
    : 'Recorded rejection of all British voice candidates. Generate a new comparison before producing a pilot.\n')
}

await main()
