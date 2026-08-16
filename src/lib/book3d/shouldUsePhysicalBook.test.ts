import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installBookBrowserTestEnvironment, type BookBrowserTestEnvironment } from './browserTestEnvironment'
import {
  shouldUsePhysicalBook,
  shouldInspectPhysicalBook,
  shouldUsePhysicalOpening,
  shouldUsePhysicalPageTurn,
} from './shouldUsePhysicalBook'

describe('physical book enhancement gate', () => {
  let browser: BookBrowserTestEnvironment

  beforeEach(() => {
    browser = installBookBrowserTestEnvironment()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('stays semantic when motion is reduced or forced-colors is active', () => {
    expect(shouldUsePhysicalBook(true)).toBe(false)
    browser.setMediaMatcher((query) => query.includes('forced-colors'))
    expect(shouldUsePhysicalBook(false)).toBe(false)
  })

  it('does not load WebGL under automated browsers unless explicitly requested', () => {
    browser.navigator.webdriver = true
    expect(shouldUsePhysicalBook(false)).toBe(false)
    browser.setSearch('?bookQuality=2k')
    expect(shouldUsePhysicalBook(false)).toBe(true)
  })

  it('keeps phones on the semantic cover unless the physical book is forced', () => {
    browser.setMediaMatcher((query) => query.includes('max-width: 760px'))
    expect(shouldUsePhysicalBook(false)).toBe(false)
    browser.setSearch('?book3d=1')
    expect(shouldUsePhysicalBook(false)).toBe(true)
  })

  it('keeps section turns semantic whenever the reader is a single page', () => {
    browser.setSearch('?book3d=1')
    browser.setMediaMatcher(() => false)
    expect(shouldUsePhysicalBook(false)).toBe(true)
    expect(shouldUsePhysicalPageTurn(false)).toBe(false)
  })

  it('keeps the opening semantic below its paired-page breakpoint', () => {
    browser.setSearch('?book3d=1')
    browser.setMediaMatcher((query) => query.includes('min-width: 981px'))
    expect(shouldUsePhysicalPageTurn(false)).toBe(true)
    expect(shouldUsePhysicalOpening(false)).toBe(false)
  })

  it('makes closed-book inspection the default and retains an explicit opt-out', () => {
    expect(shouldInspectPhysicalBook()).toBe(true)
    browser.setSearch('?inspect=0')
    expect(shouldInspectPhysicalBook()).toBe(false)
  })
})
