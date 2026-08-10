import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
export type TextSize = 'compact' | 'default' | 'large'

interface SavedPreferences {
  version: 1
  textSize: TextSize
  reduceMotion: boolean
}

const PREFERENCES_KEY = 'pv:preferences:v1'

function initialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function initialPreferences(): SavedPreferences {
  const fallback: SavedPreferences = {
    version: 1,
    textSize: 'default',
    // This stores the reader's explicit choice. The operating-system setting
    // is tracked independently and always wins when it requests less motion.
    reduceMotion: false,
  }

  try {
    const stored = localStorage.getItem(PREFERENCES_KEY)
    if (!stored) return fallback
    const parsed = JSON.parse(stored) as Partial<SavedPreferences>
    if (
      parsed.version === 1 &&
      (parsed.textSize === 'compact' || parsed.textSize === 'default' || parsed.textSize === 'large') &&
      typeof parsed.reduceMotion === 'boolean'
    ) {
      return parsed as SavedPreferences
    }
  } catch {
    // A blocked or malformed localStorage should not prevent reading.
  }

  return fallback
}

export function usePreferences() {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [preferences, setPreferences] = useState<SavedPreferences>(initialPreferences)
  const [systemReduceMotion, setSystemReduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const reduceMotion = preferences.reduceMotion || systemReduceMotion

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReduceMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#000000' : '#ffffff',
    )
    try {
      localStorage.setItem('pv:theme', theme)
    } catch {
      // Persistence is optional; the active theme still works.
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.textSize = preferences.textSize
    document.documentElement.dataset.motion = reduceMotion ? 'reduced' : 'full'
  }, [preferences.textSize, reduceMotion])

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
    } catch {
      // Persistence is optional; the active preferences still work.
    }
  }, [preferences])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }, [])

  const setTextSize = useCallback((textSize: TextSize) => {
    setPreferences((current) => ({ ...current, textSize }))
  }, [])

  const setReduceMotion = useCallback((reduceMotion: boolean) => {
    setPreferences((current) => ({ ...current, reduceMotion }))
  }, [])

  return {
    theme,
    toggleTheme,
    textSize: preferences.textSize,
    setTextSize,
    reduceMotion,
    setReduceMotion,
  }
}
