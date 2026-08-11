import { createHash } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { sections } from '../src/data/book'
import {
  narrationApprovalChecklistVersion,
  narrationDisclosure,
  narrationEditionAssetDirectory,
  narrationEditionConfiguration,
  narrationPassageHashMaterial,
  narrationReleaseApprovalConfirmations,
} from '../src/data/narrationEdition'
import { sources } from '../src/data/sources'
import { bookNarrationPassages, bookNarrationUnits } from '../src/lib/narration'
import {
  narrationReleaseId,
  narrationReleaseIdentityMaterial,
  narrationReleaseManifestUrl,
  type NarrationManifest,
} from '../src/lib/narrationRelease'

const surfaces = ['#opening', '#media-tape-editable-time', '#sound-laboratory', '#representation-ladder']
const axeSurfaces = [
  '#opening',
  '#fdn-disturbance-world',
  '#fdn-memory-without-recording',
  '#media-before-hello',
  '#media-electric-studio',
  '#media-tape-editable-time',
  '#media-voice-packets',
  '#templates-to-probabilities',
  '#voice-becomes-tokens',
  '#conversation-becomes-stream',
  '#air-again',
  '#sound-laboratory',
  '#representation-ladder',
  '#trust-after-voice',
]

async function expectNoDocumentOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(0)
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function approvedNarrationManifest() {
  const configurationHash = sha256(JSON.stringify(narrationEditionConfiguration))
  const passages = bookNarrationPassages.map((passage, index) => {
    const textHash = sha256(narrationPassageHashMaterial(configurationHash, passage.id, passage.text))
    const audioHash = sha256(`test-audio-${index}`)
    const durationSeconds = 31
    const words = passage.text.trim().split(/\s+/).filter(Boolean).length
    return {
      id: passage.id,
      sectionId: passage.sectionId,
      targetId: passage.targetId,
      textHash,
      url: `/audio/narration/${narrationEditionAssetDirectory}/${String(index + 1).padStart(4, '0')}-${audioHash}.mp3`,
      sha256: audioHash,
      durationSeconds,
      generatedAt: '2026-08-11T00:00:00.000Z',
      qcStatus: 'technical-qc-passed' as const,
      technicalQc: {
        durationExpectedSeconds: Number(((words / narrationEditionConfiguration.targetWordsPerMinute) * 60).toFixed(3)),
        durationMeasuredSeconds: durationSeconds,
        wordsPerMinute: Number(((words / durationSeconds) * 60).toFixed(1)),
        integratedLoudnessLufs: -18,
        loudnessRangeLu: 3,
        truePeakDbtp: -2,
        leadingSilenceSeconds: 0.08,
        trailingSilenceSeconds: 0.18,
        normalisationVersion: narrationEditionConfiguration.normalisation.version,
        fullDecodePassed: true as const,
      },
    }
  })
  const manuscriptHash = sha256(JSON.stringify(passages.map(({ id, textHash }) => ({ id, textHash }))))
  const identity = {
    schemaVersion: 1 as const,
    edition: narrationEditionConfiguration.edition,
    model: narrationEditionConfiguration.model,
    voice: narrationEditionConfiguration.voice,
    disclosure: narrationDisclosure,
    configurationHash,
    manuscriptHash,
    pilotProfileHash: sha256('approved-test-pilot'),
    generatedAt: '2026-08-11T00:00:00.000Z',
    generationScope: { mode: 'full' as const, requestedPassageCount: passages.length },
    complete: true,
    passageCount: passages.length,
    totalDurationSeconds: passages.length * 31,
    passages,
  }
  const releaseId = narrationReleaseId(identity.edition, sha256(narrationReleaseIdentityMaterial(identity)))
  return {
    ...identity,
    releaseId,
    releaseManifestUrl: narrationReleaseManifestUrl(releaseId),
    approved: true,
    approval: {
      approvedAt: '2026-08-11T00:00:00.000Z',
      approvedBy: 'Editorial QA',
      checklistVersion: narrationApprovalChecklistVersion,
      confirmations: narrationReleaseApprovalConfirmations.map(({ label }) => label),
    },
  } satisfies NarrationManifest
}

test('opening communicates the book and begins the reading flow', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('The Programmable Voice')
  await expect(page.getByRole('heading', { level: 1, name: 'The Programmable Voice' })).toBeVisible()
  await expect(page.locator('.opening__cover-inner > p')).toHaveText('A material history of sound, music and the human voice—from vibrating air to machines that listen and answer.')
  await page.getByRole('button', { name: 'Open the book' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'A voice returns' })).toBeVisible()
  await page.getByRole('button', { name: 'Begin chapter one' }).click()
  await expect(page).toHaveURL(/#fdn-disturbance-world$/)
  await expect(page.getByRole('heading', { level: 1, name: 'A disturbance in the world' })).toBeVisible()
  await expect(page.locator('#reader')).toBeFocused()
})

test('the hardback stays contained and settles into one readable spread', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1052 })
  await page.goto('/')

  const cover = page.locator('.opening__cover')
  const coverTitle = cover.getByRole('heading', { level: 1 })
  const closedGeometry = await cover.evaluate((element) => {
    const coverBounds = element.getBoundingClientRect()
    const titleBounds = element.querySelector('h1')!.getBoundingClientRect()
    return {
      cover: { top: coverBounds.top, right: coverBounds.right, bottom: coverBounds.bottom, left: coverBounds.left },
      title: { top: titleBounds.top, right: titleBounds.right, bottom: titleBounds.bottom, left: titleBounds.left },
      viewport: { width: innerWidth, height: innerHeight },
    }
  })
  expect(closedGeometry.cover.left).toBeGreaterThanOrEqual(0)
  expect(closedGeometry.cover.right).toBeLessThanOrEqual(closedGeometry.viewport.width)
  expect(closedGeometry.cover.top).toBeGreaterThanOrEqual(0)
  expect(closedGeometry.cover.bottom).toBeLessThanOrEqual(closedGeometry.viewport.height)
  expect(closedGeometry.title.left).toBeGreaterThanOrEqual(closedGeometry.cover.left)
  expect(closedGeometry.title.right).toBeLessThanOrEqual(closedGeometry.cover.right)
  expect(closedGeometry.title.top).toBeGreaterThanOrEqual(closedGeometry.cover.top)
  expect(closedGeometry.title.bottom).toBeLessThanOrEqual(closedGeometry.cover.bottom)
  await expect(coverTitle).toBeVisible()
  await expect(page.locator('#opening-pages')).toBeHidden()
  await expect(page.getByRole('heading', { level: 2, name: 'A voice returns' })).toBeHidden()
  await expect(page.locator('.page-turn')).not.toHaveClass(/page-turn--/)

  await page.getByRole('button', { name: 'Open the book' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'A voice returns' })).toBeVisible()
  await expect(page.locator('#opening-prologue')).toBeFocused()
  await expect(page.locator('.opening__pages > article:visible')).toHaveCount(2)
  await expect(cover).toBeHidden()
  await expect(page.getByRole('button', { name: 'Begin chapter one' })).toBeInViewport()
  const openedGeometry = await page.locator('#opening-pages').evaluate((element) => {
    const pageBounds = element.getBoundingClientRect()
    const leaves = [...element.querySelectorAll(':scope > article')].map((leaf) => {
      const bounds = leaf.getBoundingClientRect()
      return { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left }
    })
    const actionBounds = element.querySelector('.opening__begin')!.getBoundingClientRect()
    return {
      page: { top: pageBounds.top, right: pageBounds.right, bottom: pageBounds.bottom, left: pageBounds.left },
      leaves,
      action: { top: actionBounds.top, right: actionBounds.right, bottom: actionBounds.bottom, left: actionBounds.left },
    }
  })
  for (const leaf of openedGeometry.leaves) {
    expect(leaf.left).toBeGreaterThanOrEqual(openedGeometry.page.left)
    expect(leaf.right).toBeLessThanOrEqual(openedGeometry.page.right)
    expect(leaf.top).toBeGreaterThanOrEqual(openedGeometry.page.top)
    expect(leaf.bottom).toBeLessThanOrEqual(openedGeometry.page.bottom)
  }
  expect(openedGeometry.action.left).toBeGreaterThanOrEqual(openedGeometry.page.left)
  expect(openedGeometry.action.right).toBeLessThanOrEqual(openedGeometry.page.right)
  expect(openedGeometry.action.bottom).toBeLessThanOrEqual(openedGeometry.page.bottom)
  await expectNoDocumentOverflow(page)

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open the book' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'A voice returns' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'The Programmable Voice' })).toBeVisible()
  await expectNoDocumentOverflow(page)

  await page.setViewportSize({ width: 568, height: 320 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Open the book' })).toBeInViewport()
  await expectNoDocumentOverflow(page)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open the book' }).click()
  await expect(page.locator('.opening__cover')).toHaveCount(0)
})

test('contents restores focus and selecting the active section refocuses the reader', async ({ page }) => {
  await page.goto('/#media-tape-editable-time')
  const contents = page.getByRole('button', { name: 'Contents' })
  await contents.click()
  await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(contents).toBeFocused()

  await contents.click()
  await page.getByRole('button', { name: /Tape makes time editable/ }).click()
  await expect(page.locator('#reader')).toBeFocused()
  await expect(page).toHaveURL(/#media-tape-editable-time$/)
})

test('search finds manuscript text and navigates to the result', async ({ page }) => {
  await page.goto('/')
  const searchButton = page.getByRole('button', { name: 'Search' })
  await searchButton.click()
  const dialog = page.getByRole('dialog', { name: 'Search the book' })
  await expect(dialog.getByRole('searchbox')).toBeFocused()
  await dialog.getByRole('searchbox').fill('definitely absent phrase')
  await expect(dialog.getByText(/No sections match/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(searchButton).toBeFocused()

  await searchButton.click()
  await dialog.getByRole('searchbox').fill('idempotence')
  await dialog.getByRole('button', { name: /Trust after the voice/ }).click()
  await expect(page).toHaveURL(/#trust-after-voice$/)
})

test('theme and reader preferences persist across reloads', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Dark' }).click()
  await page.getByRole('button', { name: 'Contents' }).click()
  await page.getByRole('button', { name: 'large' }).click()
  await page.getByRole('checkbox', { name: 'Reduce motion' }).check()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large')
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
})

test('the operating-system reduced-motion setting overrides a stored full-motion preference', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.setItem('pv:preferences:v1', JSON.stringify({ version: 1, textSize: 'default', reduceMotion: false })))
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
  await context.close()
})

test('claim citations open focused evidence on desktop and a sheet on mobile', async ({ page }) => {
  await page.goto('/#fdn-disturbance-world')
  const citation = page.locator('.citation').first()
  await citation.click()
  await expect(page.locator('.source-entry--selected')).toHaveCount(1)
  await expect(page.locator('.source-entry--selected')).toBeFocused()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#media-before-hello')
  await page.locator('.citation').first().click()
  const dialog = page.getByRole('dialog', { name: 'Evidence' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('link', { name: /Open source:/ }).first()).toBeVisible()
})

test('laboratory tabs keep arrow keys local and expose truthful A/B controls', async ({ page }) => {
  await page.goto('/#sound-laboratory')
  const wave = page.getByRole('tab', { name: 'Wave' })
  await wave.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/#sound-laboratory$/)
  await expect(page.getByRole('tab', { name: 'String' })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'String' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'Voice' })).toBeFocused()
  await page.getByRole('button', { name: 'B / Processed' }).click()
  await expect(page.getByRole('button', { name: 'B / Processed' })).toHaveAttribute('aria-pressed', 'true')
  for (const tab of await page.getByRole('tab').all()) {
    const controls = await tab.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    await expect(page.locator(`#${controls}`)).toHaveCount(1)
  }
})

test('arrow keys inside a scientific figure do not turn the page', async ({ page }) => {
  await page.goto('/#media-broadcast-voice')
  const figure = page.locator('.scientific-figure__viewport').first()
  await figure.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/#media-broadcast-voice$/)
  await expect(figure).toBeFocused()
})

test('the representation companion heading keeps a readable mobile measure', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 812 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/#representation-ladder')

    const geometry = await page.locator('#reader h1').evaluate((heading) => {
      const range = document.createRange()
      range.selectNodeContents(heading)
      const lineRects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
      const bounds = heading.getBoundingClientRect()
      return {
        height: bounds.height,
        lineCount: lineRects.length,
        width: bounds.width,
      }
    })

    expect(geometry.width, `${viewport.width}px heading width`).toBeGreaterThanOrEqual(viewport.width * 0.65)
    expect(geometry.height, `${viewport.width}px heading height`).toBeLessThan(viewport.height * 0.45)
    expect(geometry.lineCount, `${viewport.width}px heading line count`).toBeGreaterThanOrEqual(2)
    expect(geometry.lineCount, `${viewport.width}px heading line count`).toBeLessThanOrEqual(4)
  }
})

test('browser history closes dialogs and returns focus to the reader', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open the book' }).click()
  await page.getByRole('button', { name: 'Begin chapter one' }).click()
  await page.getByRole('button', { name: 'Contents' }).click()
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Contents' })).not.toBeVisible()
  await expect(page.locator('#reader')).toBeFocused()
})

test('all sections resolve with unique IDs and valid evidence references', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Contents' }).click()
  await expect(page.locator('.contents-list button')).toHaveCount(sections.length)
  await page.keyboard.press('Escape')

  for (const hash of surfaces) {
    await page.goto(`/${hash}`)
    const duplicates = await page.evaluate(() => {
      const counts = new Map<string, number>()
      for (const element of document.querySelectorAll<HTMLElement>('[id]')) counts.set(element.id, (counts.get(element.id) ?? 0) + 1)
      return [...counts.entries()].filter(([, count]) => count > 1)
    })
    expect(duplicates, hash).toEqual([])
  }
})

test('special-layout narration targets contain their exact manuscript strings', async ({ page }) => {
  for (const sectionId of ['opening', 'sound-laboratory', 'representation-ladder']) {
    await page.goto(`/#${sectionId}`)
    const units = bookNarrationUnits.filter((unit) => unit.sectionId === sectionId)

    for (const unit of units) {
      const target = page.locator(`#${unit.targetId}`)
      await expect(target, unit.id).toHaveCount(1)
      expect(await target.textContent(), unit.id).toContain(unit.text)
    }
  }
})

test('representative surfaces pass automated WCAG checks in both themes', async ({ page }) => {
  test.setTimeout(120_000)
  for (const hash of axeSurfaces) {
    await page.goto(`/${hash}`)
    for (const theme of ['light', 'dark'] as const) {
      const currentTheme = await page.locator('html').getAttribute('data-theme')
      if (currentTheme !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light' }).click()
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      expect(results.violations, `${hash} in ${theme}`).toEqual([])
    }
  }
})

test('mobile controls retain names and pass WCAG checks in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  for (const hash of ['#opening', '#media-tape-editable-time', '#sound-laboratory']) {
    await page.goto(`/${hash}`)
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Dark|Light)$/ })).toBeVisible()
    for (const theme of ['light', 'dark'] as const) {
      const currentTheme = await page.locator('html').getAttribute('data-theme')
      if (currentTheme !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light' }).click()
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
      expect(results.violations, `${hash} in mobile ${theme}`).toEqual([])
    }
  }
})

test('the released narration manifest drives one persistent ended-chain and restores an ordinary saved start', async ({ page }) => {
  const manifest = approvedNarrationManifest()
  const sectionPassages = manifest.passages.filter(({ sectionId }) => sectionId === 'fdn-disturbance-world')
  expect(sectionPassages.length).toBeGreaterThan(3)
  await page.route('**/audio/narration/manifest.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manifest) }))
  await page.addInitScript(() => {
    class TestAudio extends EventTarget {
      static instances: TestAudio[] = []
      preload = ''
      src = ''
      currentTime = 0
      duration = 31
      playbackRate = 1
      paused = true
      constructor() { super(); TestAudio.instances.push(this) }
      play() { this.paused = false; queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata'))); return Promise.resolve() }
      pause() { this.paused = true }
      load() {}
      removeAttribute(name: string) { if (name === 'src') this.src = '' }
    }
    Object.defineProperty(window, 'Audio', { configurable: true, value: TestAudio })
    Object.defineProperty(window, '__narrationTestAudio', { configurable: true, value: TestAudio })
  })
  await page.goto('/#fdn-disturbance-world')
  const listen = page.getByRole('button', { name: 'Listen from this section' })
  await expect(listen).toBeEnabled()
  await listen.click()
  const player = page.getByRole('region', { name: 'Recorded narration player' })
  await expect(player).toBeVisible()
  await expect(player.getByText('AI-generated, not human · generated once and editorially fixed')).toBeVisible()
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()
  await player.getByRole('button', { name: 'Pause' }).click()
  await expect(player.getByRole('button', { name: 'Resume' })).toBeVisible()
  await player.getByRole('button', { name: 'Resume' }).click()
  await expect(player.getByText(/01 \/ \d+ passages/)).toBeVisible()
  await page.evaluate(() => (window as unknown as { __narrationTestAudio: { instances: EventTarget[] } }).__narrationTestAudio.instances[0]?.dispatchEvent(new Event('ended')))
  await expect(player.getByText(/02 \/ \d+ passages/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __narrationTestAudio: { instances: { src: string }[] } }).__narrationTestAudio.instances[0]?.src)).toBe(sectionPassages[1]!.url)
  await page.evaluate(() => (window as unknown as { __narrationTestAudio: { instances: EventTarget[] } }).__narrationTestAudio.instances[0]?.dispatchEvent(new Event('ended')))
  await expect(player.getByText(/03 \/ \d+ passages/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __narrationTestAudio: { instances: { src: string }[] } }).__narrationTestAudio.instances[0]?.src)).toBe(sectionPassages[2]!.url)
  expect(await page.evaluate(() => (window as unknown as { __narrationTestAudio: { instances: unknown[] } }).__narrationTestAudio.instances.length)).toBe(1)

  await page.evaluate(() => {
    const audio = (window as unknown as { __narrationTestAudio: { instances: ({ currentTime: number } & EventTarget)[] } }).__narrationTestAudio.instances[0]!
    audio.currentTime = 12.5
    audio.dispatchEvent(new Event('timeupdate'))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Listen from this section' }).click()
  await expect(page.getByRole('region', { name: 'Recorded narration player' }).getByText(/03 \/ \d+ passages/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const audio = (window as unknown as { __narrationTestAudio: { instances: { currentTime: number; src: string }[] } }).__narrationTestAudio.instances[0]
    return audio ? { currentTime: audio.currentTime, src: audio.src } : null
  })).toEqual({ currentTime: 12.5, src: sectionPassages[2]!.url })
  expect(await page.evaluate(() => (window as unknown as { __narrationTestAudio: { instances: unknown[] } }).__narrationTestAudio.instances.length)).toBe(1)
})

test('recorded narration fails closed with a friendly message when no approved release exists', async ({ page }) => {
  await page.goto('/#fdn-disturbance-world')
  const unavailable = page.getByRole('status').filter({ hasText: 'Narration in preparation' })
  await expect(unavailable).toBeVisible()
  await expect(unavailable).toHaveAttribute('title', 'The approved recorded edition is not available yet.')
  await expect(page.getByRole('button', { name: /Recorded edition awaiting release/i })).toHaveCount(0)
})

test('the complete manuscript remains readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page).toHaveURL(/\/manuscript\.html$/)
  await expect(page.getByRole('heading', { level: 1, name: 'The Programmable Voice' })).toBeVisible()
  await expect(page.locator('main article')).toHaveCount(sections.length)
  await expect(page.locator('.sources li')).toHaveCount(sources.length)
  await context.close()
})

test('mobile, tablet and desktop widths do not overflow after page motion settles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const viewports = [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 1000 },
  ]
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const hash of surfaces) {
      await page.goto(`/${hash}`)
      await test.step(`${viewport.width}×${viewport.height} ${hash}`, async () => expectNoDocumentOverflow(page))
    }
  }
})
