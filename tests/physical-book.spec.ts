import { expect, test } from '@playwright/test'

async function turnToNextSection(page: import('@playwright/test').Page, sectionTitle: string) {
  for (let guard = 0; guard < 24; guard += 1) {
    const nextSpread = page.getByRole('button', { name: /^Next spread/ })
    if (await nextSpread.count() === 0) break
    await nextSpread.click()
  }
  await page.getByRole('button', { name: `Next section, ${sectionTitle}` }).click()
}

test('the physical hardback opens onto the semantic spread without a second book', async ({ page }) => {
  test.setTimeout(45_000)
  const runtimeErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?book3d=1')

  const stage = page.locator('.book3d-stage')
  await expect(stage).toHaveClass(/book3d-stage--ready/, { timeout: 30_000 })
  await expect(stage).toHaveAttribute('data-output-tier', 'adaptive')
  await expect(stage).toHaveAttribute('data-texture-tier', '2k')
  await expect(stage).toHaveAttribute('data-environment-tier', '2k')
  await expect(stage).toHaveAttribute('data-textures-ready', 'true')
  await expect(stage).toHaveAttribute('data-entrance-phase', /arrive|settled/)
  await expect(stage).toHaveAttribute('data-render-mode', 'settled')
  await expect(stage).toHaveAttribute('tabindex', '0')
  await expect(stage.locator('canvas')).toHaveCount(1)
  await expect(page.locator('.book3d-stage__controls')).toHaveCount(0)
  await expect(page.getByText(/Drag to turn/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open the book' })).toBeVisible()

  await stage.focus()
  for (let index = 0; index < 6; index += 1) await stage.press('ArrowRight')
  await expect(stage).toHaveAttribute('data-book-view', 'Fore edge')
  await stage.press('Home')
  await expect(stage).toHaveAttribute('data-book-view', 'Front cover')

  const layout = await page.evaluate(() => {
    const stageElement = document.querySelector<HTMLElement>('.book3d-stage')!
    const cover = document.querySelector<HTMLElement>('.opening__cover')!
    const openAction = document.querySelector<HTMLElement>('.opening__cover .primary-action')!
    const stageBounds = stageElement.getBoundingClientRect()
    const coverBounds = cover.getBoundingClientRect()
    const openBounds = openAction.getBoundingClientRect()
    return {
      coverBackground: getComputedStyle(cover).backgroundColor,
      coverWidth: coverBounds.width,
      stageWidth: stageBounds.width,
      openInsideStage: openBounds.left >= stageBounds.left - 1
        && openBounds.right <= stageBounds.right + 1
        && openBounds.bottom <= stageBounds.bottom + 1,
    }
  })
  expect(layout.coverWidth).toBeCloseTo(layout.stageWidth, 0)
  expect(layout.coverBackground).toBe('rgba(0, 0, 0, 0)')
  expect(layout.openInsideStage).toBe(true)

  await page.getByRole('button', { name: 'Open the book' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'A voice returns' })).toBeVisible({ timeout: 7_000 })
  await expect(page.locator('#opening-prologue')).toBeFocused()
  await expect(stage).toHaveCount(0)
  await expect(page.locator('.book3d-stage')).toHaveCount(0)
  const settledSpread = await page.locator('.opening__pages').boundingBox()
  expect(settledSpread).not.toBeNull()
  expect(settledSpread!.x).toBeCloseTo(170, 0)
  expect(settledSpread!.y).toBeCloseTo(118, 0)
  expect(settledSpread!.width).toBeCloseTo(928, 0)
  expect(settledSpread!.height).toBeCloseTo(646, 0)

  await page.getByRole('button', { name: 'Begin chapter one' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'A disturbance in the world' })).toBeVisible()
  await turnToNextSection(page, 'The listening body')

  const leaf = page.locator('.page-turn-stage')
  // The uncached journey proves lifecycle completion. Intermediate ownership
  // and geometry are held deterministically in the sampled-frame tests below,
  // avoiding a race between browser assertions and a deliberately brief leaf.
  await expect(leaf).toHaveCount(0, { timeout: 2_500 })
  await expect(page.locator('.page-turn')).toHaveClass(/page-turn--forward/)
  await expect(page).toHaveURL(/\?book3d=1#fdn-listening-body$/)
  await expect(page.getByRole('heading', { level: 1, name: 'The listening body' })).toBeVisible()
  await expect(page.locator('#reader')).toBeFocused()
  expect(runtimeErrors).toEqual([])
})

test('the physical page-turn exposes both manuscript faces at its authored midpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?book3d=1&bookQuality=2k&pageTurnSeek=0.5#fdn-disturbance-world')
  await turnToNextSection(page, 'The listening body')

  const leaf = page.locator('.page-turn-stage')
  await expect(leaf).toHaveAttribute('data-page-turn-progress', '0.500', { timeout: 15_000 })
  await expect(leaf).toHaveAttribute('data-page-turn-phase', 'cross')
  await expect(leaf).toHaveAttribute('data-page-turn-source', 'fdn-disturbance-world')
  await expect(leaf).toHaveAttribute('data-page-turn-target', 'fdn-listening-body')
  await expect(leaf).toHaveAttribute('data-page-turn-front-role', 'body')
  await expect(leaf).toHaveAttribute('data-page-turn-back-role', 'title')
  await expect(leaf).toHaveAttribute('data-page-turn-front-section', 'fdn-disturbance-world')
  await expect(leaf).toHaveAttribute('data-page-turn-back-section', 'fdn-listening-body')
  await expect(leaf).toHaveAttribute('data-page-turn-left-section', 'fdn-disturbance-world')
  await expect(leaf).toHaveAttribute('data-page-turn-right-section', 'fdn-listening-body')
  await expect(leaf.locator('canvas')).toHaveCSS('opacity', '1')
  await expect(page.getByRole('heading', { level: 1, name: 'A disturbance in the world' })).toBeVisible()
  await expect(page).toHaveURL(/#fdn-disturbance-world$/)
})

test('the reverse physical turn preserves source and target page causality', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?book3d=1&bookQuality=2k&pageTurnSeek=0.5#fdn-listening-body')
  await page.getByRole('button', { name: 'Dark' }).click()
  await page.getByRole('button', { name: 'Previous section, A disturbance in the world' }).click()

  const leaf = page.locator('.page-turn-stage')
  await expect(leaf).toHaveAttribute('data-page-turn-progress', '0.500', { timeout: 15_000 })
  await expect(leaf).toHaveAttribute('data-page-turn-direction', 'backward')
  await expect(leaf).toHaveAttribute('data-page-turn-source', 'fdn-listening-body')
  await expect(leaf).toHaveAttribute('data-page-turn-target', 'fdn-disturbance-world')
  await expect(leaf).toHaveAttribute('data-page-turn-front-role', 'body')
  await expect(leaf).toHaveAttribute('data-page-turn-back-role', 'title')
  await expect(leaf).toHaveAttribute('data-page-turn-front-section', 'fdn-disturbance-world')
  await expect(leaf).toHaveAttribute('data-page-turn-back-section', 'fdn-listening-body')
  await expect(leaf).toHaveAttribute('data-page-turn-left-section', 'fdn-disturbance-world')
  await expect(leaf).toHaveAttribute('data-page-turn-right-section', 'fdn-listening-body')
  await expect(leaf).toHaveAttribute('data-page-turn-theme', 'dark')
  await expect(leaf.locator('canvas')).toHaveCSS('opacity', '1')
  await expect(page.getByRole('heading', { level: 1, name: 'The listening body' })).toBeVisible()
  await expect(page).toHaveURL(/#fdn-listening-body$/)
})

test('single-page navigation never overflows during its transition', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#fdn-disturbance-world')
  await page.getByRole('button', { name: /^Next (spread|section)/ }).click()
  await page.waitForTimeout(80)

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    stageCount: document.querySelectorAll('.page-turn-stage').length,
  }))
  expect(layout.stageCount).toBe(0)
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)
})

test('a cross-section search reveals its exact passage after the physical turn', async ({ page }) => {
  test.setTimeout(30_000)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?book3d=1&bookQuality=2k#fdn-disturbance-world')
  await page.getByRole('button', { name: 'Search' }).click()
  const dialog = page.getByRole('dialog', { name: 'Search the book' })
  await dialog.getByRole('searchbox').fill('idempotence')
  await dialog.getByRole('button', { name: /Trust after the voice/ }).click()

  await expect(page.locator('.page-turn-stage')).toHaveCount(1)
  await expect(page).toHaveURL(/#trust-after-voice$/, { timeout: 10_000 })
  await expect(page.locator('.chapter-article--flow p', { hasText: 'idempotence' })).toBeInViewport()
})

test('dark and late opening frames retain a fully visible physical surface', async ({ page }) => {
  test.setTimeout(45_000)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?book3d=1&bookQuality=2k&bookMotion=slow&bookOpeningSeek=0.96')
  const stage = page.locator('.book3d-stage')
  await expect(stage).toHaveClass(/book3d-stage--ready/, { timeout: 30_000 })
  await page.getByRole('button', { name: 'Dark' }).click()
  await expect(stage).toHaveAttribute('data-opening-page-theme', 'dark')
  await page.getByRole('button', { name: 'Open the book' }).click()

  await expect(stage).toHaveAttribute('data-opening-progress', '0.960', { timeout: 15_000 })
  await expect(stage.locator('canvas')).toHaveCSS('opacity', '1')
})

test('page-turn context loss commits the target and unlocks the reader immediately', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?book3d=1&bookQuality=2k&pageTurnSeek=0.5#fdn-disturbance-world')
  await turnToNextSection(page, 'The listening body')
  const stage = page.locator('.page-turn-stage')
  await expect(stage).toHaveAttribute('data-page-turn-progress', '0.500', { timeout: 15_000 })

  await stage.locator('canvas').dispatchEvent('webglcontextlost')

  await expect(stage).toHaveCount(0)
  await expect(page).toHaveURL(/#fdn-listening-body$/)
  await expect(page.locator('#reader')).toBeFocused()
  await expect(page.locator('#reader')).not.toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('html')).not.toHaveClass(/page-turn-active/)
})

test('a navigation intent during a turn is queued and committed once', async ({ page }) => {
  test.setTimeout(30_000)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?book3d=1&bookQuality=2k#fdn-disturbance-world')
  await turnToNextSection(page, 'The listening body')
  await expect(page.locator('.page-turn-stage')).toHaveCount(1)
  await page.getByRole('link', { name: 'The Programmable Voice', exact: true }).click()

  await expect(page).toHaveURL(/#opening$/, { timeout: 10_000 })
  await expect(page.locator('.page-turn-stage')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'The Programmable Voice' })).toBeVisible()
})
