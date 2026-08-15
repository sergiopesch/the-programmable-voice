import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installBookBrowserTestEnvironment, type BookBrowserTestEnvironment } from './browserTestEnvironment'
import { shouldUsePhysicalBook } from './shouldUsePhysicalBook'

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
})
