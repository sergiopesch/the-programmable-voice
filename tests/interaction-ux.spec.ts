import { expect, test, type Locator, type Page } from '@playwright/test'
import { artefactNarrationText, soundArtefacts } from '../src/data/artefacts'

async function expectControlChangeStopsPlayback(page: Page, control: Locator) {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  await control.press('ArrowRight')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
}

test('sound-affecting lab changes stop playback before the plot changes', async ({ page }) => {
  await page.goto('/#sound-laboratory')

  await expectControlChangeStopsPlayback(page, page.getByRole('slider', { name: /Frequency/ }))
  await expectControlChangeStopsPlayback(page, page.getByRole('slider', { name: /Amplitude/ }))

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'String' }).click()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()

  await page.getByRole('tab', { name: 'Sample' }).click()
  await expectControlChangeStopsPlayback(page, page.getByRole('slider', { name: /Sample rate/ }))

  await page.getByRole('tab', { name: 'Codec' }).click()
  await expectControlChangeStopsPlayback(page, page.getByRole('slider', { name: /Bit depth/ }))

  await page.getByRole('tab', { name: 'Voice' }).click()
  await expectControlChangeStopsPlayback(page, page.getByRole('slider', { name: /Response delay/ }))
})

test('mobile plots and diagrams either fit their leaf or remain keyboard-pannable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/#sound-laboratory')

  const plot = page.locator('.lab-plot')
  await expect(plot).toHaveClass(/horizontal-scroll-region/)
  await expect(plot).toHaveAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight')
  expect(await plot.evaluate((element) => element.scrollWidth)).toBeGreaterThan(await plot.evaluate((element) => element.clientWidth))
  await plot.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => plot.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  await expect(page).toHaveURL(/#sound-laboratory$/)

  await page.goto('/#media-broadcast-voice')
  const diagram = page.locator('.scientific-figure__viewport').first()
  await expect(diagram).toHaveClass(/horizontal-scroll-region/)
  await expect(diagram).toHaveAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight')
  const diagramGeometry = await diagram.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(diagramGeometry.scrollWidth).toBeLessThanOrEqual(diagramGeometry.clientWidth)
  await expect(page).toHaveURL(/#media-broadcast-voice$/)
})

test('the representation rail uses concise names, roving focus, and linked details', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#representation-ladder')

  const rail = page.getByRole('list', { name: 'Sound representation timeline' })
  await expect(rail).toHaveClass(/horizontal-scroll-region/)
  const buttons = rail.getByRole('button')
  await expect(buttons).toHaveCount(soundArtefacts.length)

  const first = buttons.nth(0)
  const second = buttons.nth(1)
  await expect(first).toHaveAccessibleName(`${soundArtefacts[0]!.year}: ${soundArtefacts[0]!.title}`)
  await expect(first).not.toHaveAccessibleName(artefactNarrationText(soundArtefacts[0]!))
  await expect(first).toHaveAttribute('tabindex', '0')
  await expect(second).toHaveAttribute('tabindex', '-1')
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  expect(await first.textContent()).toContain(artefactNarrationText(soundArtefacts[0]!))

  const detailId = await first.getAttribute('aria-describedby')
  expect(detailId).toBeTruthy()
  await expect(page.locator(`#${detailId}`)).toContainText(soundArtefacts[0]!.detail)

  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(second).toBeFocused()
  await expect(first).toHaveAttribute('tabindex', '-1')
  await expect(second).toHaveAttribute('tabindex', '0')
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await expect(second).toHaveAttribute('aria-describedby', detailId!)
  await expect(page.locator(`#${detailId}`)).toContainText(soundArtefacts[1]!.detail)

  await page.keyboard.press('End')
  await expect(buttons.last()).toBeFocused()
  await page.keyboard.press('Home')
  await expect(first).toBeFocused()

  const scrubber = page.getByRole('slider', { name: 'Choose a representation by date' })
  await expect(scrubber).toHaveAttribute('aria-controls', detailId!)
  await expect(scrubber).toHaveAttribute('aria-describedby', detailId!)
})

test('the quiet utility strip keeps the laboratory discoverable and page navigation focused', async ({ page }) => {
  await page.goto('/#media-before-hello')

  const wordmark = page.getByRole('link', { name: 'The Programmable Voice' })
  await expect(wordmark).toHaveAttribute('href', '#opening')
  await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Dark|Light)$/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Page navigation' })).toBeVisible()

  await page.getByRole('button', { name: 'Contents' }).click()
  const contents = page.getByRole('dialog', { name: 'Contents' })
  await contents.getByRole('button', { name: /Sound Laboratory/ }).click()
  await expect(page).toHaveURL(/#sound-laboratory$/)
  await expect(page.locator('#reader')).toBeFocused()
})

test('the 390px laboratory loop is contained and its diagram remains reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#sound-laboratory')

  const loop = page.locator('.live-loop')
  const diagram = loop.locator('.scientific-figure__viewport')
  const containment = await loop.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      left: bounds.left,
      right: bounds.right,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }
  })
  expect(containment.left).toBeGreaterThanOrEqual(0)
  expect(containment.right).toBeLessThanOrEqual(containment.viewportWidth)
  expect(containment.documentWidth).toBeLessThanOrEqual(containment.viewportWidth)
  await expect(diagram).toBeVisible()
  expect(await diagram.evaluate((element) => element.scrollWidth)).toBeGreaterThan(await diagram.evaluate((element) => element.clientWidth))
  await diagram.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => diagram.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
})

test('diagram labels retain a legible canvas at spread breakpoint edges', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto('/#fdn-disturbance-world')

  const chapterDiagram = page.locator('.scientific-figure__viewport').first()
  const chapterGeometry = await chapterDiagram.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    svgWidth: element.querySelector('svg')!.getBoundingClientRect().width,
    cueDisplay: getComputedStyle(element, '::after').display,
  }))
  expect(chapterGeometry.scrollWidth).toBeLessThanOrEqual(chapterGeometry.clientWidth)
  expect(chapterGeometry.svgWidth).toBeCloseTo(chapterGeometry.clientWidth, 0)
  expect(chapterGeometry.cueDisplay).toBe('none')

  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/#sound-laboratory')
  const loopDiagram = page.locator('.live-loop .scientific-figure__viewport')
  expect(await loopDiagram.evaluate((element) => element.scrollWidth)).toBeGreaterThan(await loopDiagram.evaluate((element) => element.clientWidth))
  expect(await loopDiagram.locator('svg').evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(672)
})
