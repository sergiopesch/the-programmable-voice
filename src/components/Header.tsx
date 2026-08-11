import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Theme } from '../hooks/usePreferences'
import { MenuIcon, MoonIcon, SearchIcon, SpeakerIcon, SunIcon } from './Icons'

interface HeaderProps {
  theme: Theme
  onToggleTheme: () => void
  onOpenContents: () => void
  onOpenSearch: () => void
  onHome: () => void
  onLab: () => void
}

export function Header({ theme, onToggleTheme, onOpenContents, onOpenSearch, onHome, onLab }: HeaderProps) {
  const followSection = (event: ReactMouseEvent<HTMLAnchorElement>, navigate: () => void) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    event.preventDefault()
    navigate()
  }

  return (
    <header className="site-header">
      <a className="wordmark" href="#opening" onClick={(event) => followSection(event, onHome)} aria-label="The Programmable Voice">
        <span className="wordmark__long">The Programmable Voice</span>
        <span className="wordmark__short" aria-hidden="true">TPV</span>
      </a>
      <nav className="site-header__actions" aria-label="Book controls">
        <button className="header-control" type="button" onClick={onOpenContents} aria-label="Contents">
          <MenuIcon />
          <span>Contents</span>
        </button>
        <button className="header-control header-control--search" type="button" onClick={onOpenSearch} aria-label="Search">
          <SearchIcon />
          <span>Search</span>
        </button>
        <a className="header-control header-control--lab" href="#sound-laboratory" onClick={(event) => followSection(event, onLab)} aria-label="Sound laboratory">
          <SpeakerIcon />
          <span>Sound laboratory</span>
        </a>
        <button className="header-control" type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Light' : 'Dark'}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </nav>
    </header>
  )
}
