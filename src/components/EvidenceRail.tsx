import { useEffect } from 'react'
import { sourceById, sourceNumberById } from '../data/sources'
import type { BookSection } from '../types'
import { sectionSourceIds } from '../lib/book'
import { SourceEntry } from './Citations'
import { Modal } from './Modal'

interface EvidenceDrawerProps {
  open: boolean
  section: BookSection
  selectedSourceId: string | null
  onClose: () => void
}

export function EvidenceDrawer({ open, section, selectedSourceId, onClose }: EvidenceDrawerProps) {
  const sourceIds = sectionSourceIds(section)

  useEffect(() => {
    if (!open || !selectedSourceId) return
    const frame = requestAnimationFrame(() => {
      const entry = document.getElementById(`drawer-source-${selectedSourceId}`)
      entry?.scrollIntoView({ block: 'nearest' })
      entry?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, selectedSourceId])

  return (
    <Modal
      id="evidence-drawer"
      open={open}
      title={`Evidence · ${sourceIds.length} sources`}
      onClose={onClose}
      className="evidence-drawer"
    >
      <div className="evidence-drawer__intro">
        <p>Claim-level sources for this section. Primary records, scholarship, standards and disclosures remain distinct.</p>
      </div>
      <div className="evidence-drawer__list">
        {sourceIds.map((id) => {
          const source = sourceById.get(id)
          if (!source) return null
          return (
            <SourceEntry
              key={id}
              source={source}
              number={sourceNumberById.get(id) ?? 0}
              selected={selectedSourceId === id}
              idPrefix="drawer-source"
            />
          )
        })}
      </div>
    </Modal>
  )
}
