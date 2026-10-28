import { AxeBuilder } from '@axe-core/playwright'
import { test as base, expect, type Page } from '@playwright/test'

// Every test fails on a console error, which includes any content security policy or Trusted
// Types violation, and on an uncaught exception. A page's own status, like the 404 page's, is
// for the test to check.
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (message) => {
        const ownStatus =
          message.text().startsWith('Failed to load resource') &&
          message.location().url === page.url()
        if (message.type() === 'error' && !ownStatus) errors.push(message.text())
      })
      page.on('pageerror', (error) => errors.push(error.message))
      await use(errors)
      expect(errors).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export async function expectAccessible(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) }))).toEqual(
    [],
  )
}

// On a phone the reader shows its panels one at a time.
export async function showPanel(page: Page, name: 'File' | 'History'): Promise<void> {
  const toggle = page.getByRole('group', { name: 'Show' }).getByRole('button', { name })
  if (await toggle.isVisible()) await toggle.click()
}
