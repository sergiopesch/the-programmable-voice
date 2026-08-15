import { expect, test } from '@playwright/test'

test('the physical hardback remains inspectable and hands off to the semantic spread', async ({ page }) => {
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
  await expect(stage.locator('canvas')).toHaveCount(1)

  const layout = await page.evaluate(() => {
    const stageElement = document.querySelector<HTMLElement>('.book3d-stage')!
    const cover = document.querySelector<HTMLElement>('.opening__cover')!
    const controls = document.querySelector<HTMLElement>('.book3d-stage__controls')!
    const openAction = document.querySelector<HTMLElement>('.opening__cover .primary-action')!
    const stageBounds = stageElement.getBoundingClientRect()
    const coverBounds = cover.getBoundingClientRect()
    const controlsBounds = controls.getBoundingClientRect()
    const openBounds = openAction.getBoundingClientRect()
    const controlsAndOpenOverlap = controlsBounds.left < openBounds.right
      && controlsBounds.right > openBounds.left
      && controlsBounds.top < openBounds.bottom
      && controlsBounds.bottom > openBounds.top

    return {
      controlsAndOpenOverlap,
      coverBackground: getComputedStyle(cover).backgroundColor,
      coverWidth: coverBounds.width,
      stageWidth: stageBounds.width,
    }
  })
  expect(layout.coverWidth).toBeCloseTo(layout.stageWidth, 0)
  expect(layout.coverBackground).toBe('rgba(0, 0, 0, 0)')
  expect(layout.controlsAndOpenOverlap).toBe(false)

  await stage.focus()
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowRight')
  await expect(stage).toHaveAttribute('data-book-view', 'Back cover')

  await page.getByRole('button', { name: 'Open the book' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'A voice returns' })).toBeVisible({ timeout: 7_000 })
  await expect(page.locator('#opening-prologue')).toBeFocused()
  await expect(stage).toHaveCount(0)

  await page.getByRole('button', { name: 'Begin chapter one' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'A disturbance in the world' })).toBeVisible()
  await page.getByRole('link', { name: /Next The listening body/ }).click()

  const pageTurn = page.locator('.page-turn-overlay')
  await expect(pageTurn).toHaveAttribute('data-page-turn-direction', 'forward')
  await expect(pageTurn.locator('[data-page-turn-face="front"] strong')).toHaveText('A disturbance in the world')
  await expect(pageTurn.locator('[data-page-turn-face="back"] strong')).toHaveText('The listening body')
  await expect(pageTurn).toHaveCount(0, { timeout: 2_000 })
  await expect(page).toHaveURL(/\?book3d=1#fdn-listening-body$/)
  await expect(page.getByRole('heading', { level: 1, name: 'The listening body' })).toBeVisible()
  await expect(page.locator('#reader')).toBeFocused()
  expect(runtimeErrors).toEqual([])
})
