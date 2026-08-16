import { expect, test } from '@playwright/test'

test('search matches unaccented input, reports a count, shows context and reveals the match', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Search' }).click()
  const dialog = page.getByRole('dialog', { name: 'Search the book' })

  await dialog.getByRole('searchbox').fill('Yoruba')
  await expect(dialog.getByRole('status')).toHaveText('1 section found')
  const result = dialog.getByRole('button', { name: /Memory without recording/ })
  await expect(result).toContainText('Yorùbá')
  await result.click()

  await expect(page).toHaveURL(/#fdn-memory-without-recording$/)
  await expect(page.locator('.chapter-article--flow p', { hasText: 'Yorùbá' })).toBeInViewport()
})

test('Contents scrolls its active entry into view without taking focus from the dialog', async ({ page }) => {
  await page.goto('/#trust-after-voice')
  await page.getByRole('button', { name: 'Contents' }).click()
  const dialog = page.getByRole('dialog', { name: 'Contents' })
  const activeEntry = dialog.getByRole('button', { name: /Trust after the voice/ })

  await expect(activeEntry).toHaveAttribute('aria-current', 'page')
  await expect(activeEntry).toBeInViewport()
  await expect(dialog.getByRole('button', { name: 'Close Contents' })).toBeFocused()
})
