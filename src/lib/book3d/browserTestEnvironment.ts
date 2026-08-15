import { vi } from 'vitest'

export interface BookBrowserTestEnvironment {
  navigator: {
    deviceMemory: number
    hardwareConcurrency: number
    webdriver: boolean
  }
  setMediaMatcher: (matcher: (query: string) => boolean) => void
  setSearch: (search: string) => void
}

export function installBookBrowserTestEnvironment(): BookBrowserTestEnvironment {
  let search = ''
  let mediaMatcher: (query: string) => boolean = () => false
  const navigatorState = {
    deviceMemory: 16,
    hardwareConcurrency: 16,
    webdriver: false,
  }
  const matchMedia = (query: string) => ({
    matches: mediaMatcher(query),
    media: query,
  }) as MediaQueryList
  const windowState = {
    devicePixelRatio: 1,
    innerHeight: 800,
    innerWidth: 1200,
    location: {
      get search() {
        return search
      },
    },
    matchMedia,
  }

  vi.stubGlobal('matchMedia', matchMedia)
  vi.stubGlobal('navigator', navigatorState)
  vi.stubGlobal('window', windowState)

  return {
    navigator: navigatorState,
    setMediaMatcher: (matcher) => {
      mediaMatcher = matcher
    },
    setSearch: (nextSearch) => {
      search = nextSearch
    },
  }
}
