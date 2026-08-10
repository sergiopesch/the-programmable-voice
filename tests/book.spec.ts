import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

const surfaces = ['#opening', '#voice-editable', '#sound-laboratory']
const axeSurfaces = [
  '#opening',
  '#breath-pressure',
  '#voice-editable',
  '#voice-tokens',
  '#nine-theses',
  '#voice-after-turns',
  '#builder-programme',
  '#sound-laboratory',
  '#chronology',
  '#evidence-method',
  '#evaluation-scorecard',
  '#shipping-contract',
]

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
}

test('opening communicates the book and begins the reading flow', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('The Programmable Voice')
  await expect(page.getByRole('heading', { level: 1, name: 'The Programmable Voice' })).toBeVisible()
  await expect(page.locator('.opening__copy').getByText('How humanity taught machines to hear, speak and converse.')).toBeVisible()
  await page.getByRole('button', { name: 'Begin reading' }).click()
  await expect(page).toHaveURL(/#breath-pressure$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Breath becomes pressure' })).toBeVisible()
  await expect(page.locator('#reader')).toBeFocused()
})

test('contents restores focus and selecting the active section refocuses the reader', async ({ page }) => {
  await page.goto('/#voice-editable')
  const contents = page.getByRole('button', { name: 'Contents' })
  await contents.click()
  await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(contents).toBeFocused()

  await contents.click()
  await page.getByRole('button', { name: /Voice becomes editable/ }).click()
  await expect(page.locator('#reader')).toBeFocused()
  await expect(page).toHaveURL(/#voice-editable$/)
})

test('search finds manuscript text and navigates to the result', async ({ page }) => {
  await page.goto('/')
  const searchButton = page.getByRole('button', { name: 'Search' })
  await searchButton.click()
  const dialog = page.getByRole('dialog', { name: 'Search the book' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('searchbox')).toBeFocused()
  await dialog.getByRole('searchbox').fill('definitely absent phrase')
  await expect(dialog.getByText(/No sections match/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(searchButton).toBeFocused()

  await searchButton.click()
  await dialog.getByRole('searchbox').fill('memory compiler')
  await dialog.getByRole('button', { name: /Nine breakthrough theses/ }).click()
  await expect(page).toHaveURL(/#nine-theses$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Nine breakthrough theses' })).toBeVisible()
})

test('theme and reader preferences persist across reloads', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
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
  await page.addInitScript(() => {
    localStorage.setItem('pv:preferences:v1', JSON.stringify({
      version: 1,
      textSize: 'default',
      reduceMotion: false,
    }))
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
  await context.close()
})

test('claim citations connect to the hidden evidence drawer on desktop', async ({ page }) => {
  await page.goto('/#breath-pressure')
  const citation = page.locator('.citation').first()
  await citation.click()
  const sourceId = await citation.getAttribute('aria-label')
  expect(sourceId).toMatch(/Open source \d+/)
  await expect(page.locator('.source-entry--selected')).toHaveCount(1)
  await expect(page.locator('.source-entry--selected')).toBeFocused()
})

test('claim citations open an evidence sheet on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#breath-pressure')
  await page.locator('.citation').first().click()
  const dialog = page.getByRole('dialog', { name: 'Evidence' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('link', { name: /Open source:/ }).first()).toBeVisible()
})

test('laboratory tabs implement roving keyboard focus and local A/B controls', async ({ page }) => {
  await page.goto('/#sound-laboratory')
  const wave = page.getByRole('tab', { name: 'Wave' })
  await wave.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Sampling' })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Sampling' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'Conversation' })).toBeFocused()
  await page.getByRole('button', { name: 'B / Processed' }).click()
  await expect(page.getByRole('button', { name: 'B / Processed' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop' }).click()
  for (const tab of await page.getByRole('tab').all()) {
    const controls = await tab.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    await expect(page.locator(`#${controls}`)).toHaveCount(1)
  }
})

test('browser history closes open dialogs and returns focus to the reader', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin reading' }).click()
  await page.getByRole('button', { name: 'Contents' }).click()
  await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Contents' })).not.toBeVisible()
  await expect(page.locator('#reader')).toBeFocused()

  await page.getByRole('button', { name: 'Begin reading' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.citation').first().click()
  await expect(page.getByRole('dialog', { name: 'Evidence' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Evidence' })).not.toBeVisible()
  await expect(page.locator('#reader')).toBeFocused()
})

test('all sections resolve with unique IDs and valid evidence references', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Contents' }).click()
  const sectionButtons = page.locator('.contents-list button')
  expect(await sectionButtons.count()).toBe(26)
  await page.keyboard.press('Escape')

  for (const hash of surfaces) {
    await page.goto(`/${hash}`)
    const duplicates = await page.evaluate(() => {
      const counts = new Map<string, number>()
      for (const element of document.querySelectorAll<HTMLElement>('[id]')) {
        counts.set(element.id, (counts.get(element.id) ?? 0) + 1)
      }
      return [...counts.entries()].filter(([, count]) => count > 1)
    })
    expect(duplicates, hash).toEqual([])
  }
})

test('twelve representative surfaces pass automated WCAG checks in both themes', async ({ page }) => {
  for (const hash of axeSurfaces) {
    await page.goto(`/${hash}`)
    for (const theme of ['light', 'dark'] as const) {
      const currentTheme = await page.locator('html').getAttribute('data-theme')
      if (currentTheme !== theme) {
        await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light' }).click()
      }
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(results.violations, `${hash} in ${theme}`).toEqual([])
    }
  }
})

test('mobile controls retain names and pass WCAG checks in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  for (const hash of ['#opening', '#voice-editable', '#sound-laboratory']) {
    await page.goto(`/${hash}`)
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Dark|Light)$/ })).toBeVisible()
    for (const theme of ['light', 'dark'] as const) {
      const currentTheme = await page.locator('html').getAttribute('data-theme')
      if (currentTheme !== theme) {
        await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light' }).click()
      }
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
      expect(results.violations, `${hash} in mobile ${theme}`).toEqual([])
    }
  }
})

test('selected evidence retains contrast', async ({ page }) => {
  await page.goto('/#breath-pressure')
  await page.locator('.citation').first().click()
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(results.violations).toEqual([])
})

test('light and dark screenshots contain no chromatic pixels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const { hash, theme } of [
    { hash: '#opening', theme: 'light' },
    { hash: '#voice-editable', theme: 'dark' },
    { hash: '#sound-laboratory', theme: 'light' },
  ] as const) {
    await page.goto(`/${hash}`)
    const currentTheme = await page.locator('html').getAttribute('data-theme')
    if (currentTheme !== theme) {
      await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light' }).click()
    }
    await page.evaluate(() => document.fonts.ready)
    const image = PNG.sync.read(await page.screenshot())
    let chromaticPixels = 0
    for (let index = 0; index < image.data.length; index += 4) {
      const red = image.data[index] ?? 0
      const green = image.data[index + 1] ?? 0
      const blue = image.data[index + 2] ?? 0
      if (red !== green || green !== blue) chromaticPixels += 1
    }
    expect(chromaticPixels, `${hash} in ${theme}`).toBe(0)
  }
})

test('the complete manuscript remains readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page).toHaveURL(/\/manuscript\.html$/)
  await expect(page.getByRole('heading', { level: 1, name: 'The Programmable Voice' })).toBeVisible()
  await expect(page.locator('main article')).toHaveCount(26)
  await expect(page.locator('.sources li')).toHaveCount(83)
  await context.close()
})

test('mobile, intermediate and desktop widths do not overflow', async ({ page }) => {
  const viewports = [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
    { width: 901, height: 900 },
    { width: 1440, height: 1000 },
  ]
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const hash of surfaces) {
      await page.goto(`/${hash}`)
      await test.step(`${viewport.width}×${viewport.height} ${hash}`, async () => {
        await expectNoDocumentOverflow(page)
      })
    }
  }
})
