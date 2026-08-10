import type { BookSection } from '../types'
import { ArrowIcon } from './Icons'

interface SectionNavigationProps {
  previous: BookSection | null
  next: BookSection | null
  onNavigate: (id: string) => void
}

export function SectionNavigation({ previous, next, onNavigate }: SectionNavigationProps) {
  return (
    <nav className="section-navigation" aria-label="Section navigation">
      {previous ? (
        <button type="button" onClick={() => onNavigate(previous.id)}>
          <ArrowIcon direction="left" />
          <span><small>Previous</small><strong>{previous.title}</strong></span>
        </button>
      ) : <span />}
      {next ? (
        <button type="button" onClick={() => onNavigate(next.id)}>
          <span><small>Next</small><strong>{next.title}</strong></span>
          <ArrowIcon />
        </button>
      ) : <span />}
    </nav>
  )
}
