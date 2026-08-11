import type { MouseEvent as ReactMouseEvent } from 'react'
import type { BookSection } from '../types'
import { ArrowIcon } from './Icons'

interface SectionNavigationProps {
  previous: BookSection | null
  next: BookSection | null
  onNavigate: (id: string) => void
}

export function SectionNavigation({ previous, next, onNavigate }: SectionNavigationProps) {
  const followSection = (event: ReactMouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    event.preventDefault()
    onNavigate(id)
  }

  return (
    <nav className="section-navigation" aria-label="Section navigation">
      {previous ? (
        <a className="section-navigation__link" href={`#${previous.id}`} onClick={(event) => followSection(event, previous.id)}>
          <ArrowIcon direction="left" />
          <span><small>Previous</small><strong>{previous.title}</strong></span>
        </a>
      ) : <span />}
      {next ? (
        <a className="section-navigation__link" href={`#${next.id}`} onClick={(event) => followSection(event, next.id)}>
          <span><small>Next</small><strong>{next.title}</strong></span>
          <ArrowIcon />
        </a>
      ) : <span />}
    </nav>
  )
}
