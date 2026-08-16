import { expect, test, type Page } from '@playwright/test'

async function visibleTextByLeaf(page: Page) {
  return page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('.chapter-spread')!
    const bounds = viewport.getBoundingClientRect()
    const midpoint = bounds.left + bounds.width / 2
    const counts = { left: 0, right: 0 }
    const walker = document.createTreeWalker(
      document.querySelector<HTMLElement>('.chapter-article--flow')!,
      NodeFilter.SHOW_TEXT,
    )
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      for (const rect of range.getClientRects()) {
        if (rect.bottom <= bounds.top || rect.top >= bounds.bottom) continue
        if (rect.right <= bounds.left || rect.left >= bounds.right) continue
        if (rect.left < midpoint) counts.left += 1
        if (rect.right > midpoint) counts.right += 1
      }
    }
    return counts
  })
}

test('desktop manuscript flows across two contained pages and advances by spread', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?book3d=0#fdn-disturbance-world')

  const layout = page.locator('.chapter-layout--paginated')
  const viewport = page.locator('.chapter-spread')
  await expect(layout).toHaveAttribute('data-reader-spread', '1')
  await expect(layout).toHaveAttribute('data-reader-spread-count', /^[2-9]\d*|[2-9]$/)
  expect(await visibleTextByLeaf(page)).toMatchObject({ left: expect.any(Number), right: expect.any(Number) })
  const firstLeafText = await visibleTextByLeaf(page)
  expect(firstLeafText.left).toBeGreaterThan(3)
  expect(firstLeafText.right).toBeGreaterThan(3)

  const contained = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: document.documentElement.clientHeight,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))
  expect(contained.documentHeight).toBeLessThanOrEqual(contained.viewportHeight)
  expect(contained.documentWidth).toBeLessThanOrEqual(contained.viewportWidth)

  const chapterHash = page.url()
  await page.getByRole('button', { name: /^Next spread/ }).click()
  await expect(layout).toHaveAttribute('data-reader-spread', '2')
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(1_000)
  expect(page.url()).toBe(chapterHash)
  const secondLeafText = await visibleTextByLeaf(page)
  expect(secondLeafText.left).toBeGreaterThan(1)
  expect(secondLeafText.right).toBeGreaterThan(1)

  await page.getByRole('button', { name: /^Previous spread/ }).click()
  await expect(layout).toHaveAttribute('data-reader-spread', '1')
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeLessThan(2)
})

test('single-leaf layouts remain readable without document scrolling', async ({ page }) => {
  for (const viewportSize of [
    { width: 390, height: 844 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewportSize)
    await page.goto('/?book3d=0#media-tape-editable-time')
    const geometry = await page.evaluate(() => ({
      columns: getComputedStyle(document.querySelector<HTMLElement>('.chapter-article--flow')!).columnCount,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      paragraphFontSize: Number.parseFloat(getComputedStyle(document.querySelector<HTMLElement>('.chapter-paragraph')!).fontSize),
    }))
    expect(geometry.columns).toBe('1')
    expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.viewportHeight)
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth)
    expect(geometry.paragraphFontSize).toBeGreaterThanOrEqual(16)
    await expect(page.getByRole('navigation', { name: 'Page navigation' })).toBeInViewport()
    await expect(page.getByRole('button', { name: /^Next spread/ })).toBeVisible()
  }
})

test('pagination preserves one semantic copy of every manuscript target', async ({ page }) => {
  await page.goto('/?book3d=0#fdn-memory-without-recording')
  const identity = await page.evaluate(() => {
    const ids = [...document.querySelectorAll<HTMLElement>('[id^="narration-"]')].map((element) => element.id)
    return { count: ids.length, unique: new Set(ids).size }
  })
  expect(identity.count).toBeGreaterThan(0)
  expect(identity.unique).toBe(identity.count)
})
