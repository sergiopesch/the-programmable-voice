import { expect, test } from '@playwright/test'
import { sections } from '../src/data/book'

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 568, height: 320 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 901, height: 900 },
  { width: 1100, height: 900 },
  { width: 1440, height: 1000 },
]

for (const viewport of viewports) {
  test(`all sections remain readable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('pv:preferences:v1', JSON.stringify({ version: 1, textSize: 'large', reduceMotion: true }))
    })
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large')
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')

    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((nextTheme) => localStorage.setItem('pv:theme', nextTheme), theme)
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

      for (const section of sections) {
        await page.evaluate((id) => {
          window.location.hash = id
        }, section.id)
        await expect.poll(async () => {
          const title = await page.locator('#reader h1').textContent()
          return title?.replace(/\s/g, '')
        }).toBe(section.title.replace(/\s/g, ''))

        const audit = await page.evaluate(() => {
          const idCounts = new Map<string, number>()
          for (const element of document.querySelectorAll<HTMLElement>('[id]')) {
            idCounts.set(element.id, (idCounts.get(element.id) ?? 0) + 1)
          }

          const undersizedTargets = [...document.querySelectorAll<HTMLElement>('button, a, input, [tabindex]')]
            .filter((element) => {
              const style = getComputedStyle(element)
              const rect = element.getBoundingClientRect()
              return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
            })
            .filter((element) => {
              const rect = element.getBoundingClientRect()
              return rect.width < 43.5 || rect.height < 43.5
            })
            .map((element) => `${element.tagName.toLowerCase()}.${element.className}:${Math.round(element.getBoundingClientRect().width)}×${Math.round(element.getBoundingClientRect().height)}`)

          return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            duplicateIds: [...idCounts.entries()].filter(([, count]) => count > 1),
            undersizedTargets,
            clippedHeadings: [...document.querySelectorAll<HTMLElement>('.opening h1, .chapter-header h1, .sound-lab h1')]
              .filter((heading) => {
                const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT)
                let textNode = walker.nextNode()
                while (textNode) {
                  const range = document.createRange()
                  range.selectNodeContents(textNode)
                  const clipped = [...range.getClientRects()].some((rect) => rect.left < -1 || rect.right > document.documentElement.clientWidth + 1)
                  if (clipped) return true
                  textNode = walker.nextNode()
                }
                return false
              })
              .map((heading) => heading.textContent),
          }
        })

        expect(audit.documentWidth, section.id).toBeLessThanOrEqual(audit.viewportWidth)
        expect(audit.duplicateIds, section.id).toEqual([])
        expect(audit.undersizedTargets, section.id).toEqual([])
        expect(audit.clippedHeadings, section.id).toEqual([])
      }
    }
  })
}
