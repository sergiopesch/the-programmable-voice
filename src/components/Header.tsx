import type { Theme } from '../hooks/usePreferences'
import { MenuIcon, MoonIcon, SearchIcon, SunIcon } from './Icons'

interface HeaderProps {
  theme: Theme
  onToggleTheme: () => void
  onOpenContents: () => void
  onOpenSearch: () => void
  onHome: () => void
}

export function Header({ theme, onToggleTheme, onOpenContents, onOpenSearch, onHome }: HeaderProps) {
  return (
    <header className="site-header">
      <button className="wordmark" type="button" onClick={onHome}>
        The Programmable Voice
      </button>
      <nav className="site-header__actions" aria-label="Book controls">
        <button className="header-control" type="button" onClick={onOpenContents} aria-label="Contents">
          <MenuIcon />
          <span>Contents</span>
        </button>
        <button className="header-control header-control--search" type="button" onClick={onOpenSearch} aria-label="Search">
          <SearchIcon />
          <span>Search</span>
        </button>
        <button className="header-control" type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Light' : 'Dark'} aria-pressed={theme === 'dark'}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </nav>
    </header>
  )
}
