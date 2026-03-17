import { test, expect, FRONTEND_URL } from './fixtures'

test.describe('Capability Reader - Sidebar Navigation', () => {
  test('sidebar shows FileTree with folders', async ({ page, readKey }) => {
    await page.goto(`${FRONTEND_URL}/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('#app-sidebar')).toBeVisible()

    await expect(page.getByRole('button', { name: 'docs' })).toBeVisible({ timeout: 10000 })
  })

  test('folder expand/collapse works', async ({ page, readKey }) => {
    await page.goto(`${FRONTEND_URL}/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const docsFolder = page.getByRole('button', { name: 'docs' })
    await docsFolder.click()

    await expect(page.getByRole('link', { name: 'getting-started' })).toBeVisible({ timeout: 5000 })
  })

  test('clicking file in sidebar navigates to file', async ({ page, readKey }) => {
    await page.goto(`${FRONTEND_URL}/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'docs' }).click()

    await page.getByRole('link', { name: 'getting-started' }).click()

    await expect(page).toHaveURL(new RegExp(`/r/${readKey}/docs/getting-started\\.md$`))
  })
})

test.describe('Capability Reader - Content Display', () => {
  test('file header shows filename and keeps markdown h1 in document body', async ({ page, readKey }) => {
    await page.goto(`${FRONTEND_URL}/r/${readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[data-testid="reader-file-title"]')).toHaveText('README')
    await expect(page.locator('article .prose-reader h1#e2e-test-workspace')).toBeVisible()
  })

  test('file content is rendered as markdown', async ({ page, readKey }) => {
    await page.goto(`${FRONTEND_URL}/r/${readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('article h1').first()).toBeVisible()
  })

  test('code blocks are rendered', async ({ page, readKey }) => {
    await page.goto(`${FRONTEND_URL}/r/${readKey}/src/index.ts`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('article')).toContainText('console.log')
  })
})

test.describe('Capability Reader - Theme Toggle', () => {
  test('theme toggle button is visible', async ({ page, readKey }) => {
    await page.goto(`${FRONTEND_URL}/r/${readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    const themeButton = page.locator('[data-testid="theme-toggle"]')
    await expect(themeButton).toBeVisible()
  })

  test('clicking theme toggle cycles themes', async ({ page, readKey }) => {
    await page.goto(`${FRONTEND_URL}/r/${readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    const themeButton = page.locator('[data-testid="theme-toggle"]')
    await themeButton.click()

    await expect(themeButton).toBeVisible()
  })
})

test.describe('Capability Reader - LLM Copy', () => {
  test('copy button copies markdown body, not JSON envelope', async ({ page, readKey }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __copiedText: string }).__copiedText = ''
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            ;(window as unknown as { __copiedText: string }).__copiedText = value
          },
          readText: async () => (window as unknown as { __copiedText: string }).__copiedText,
        },
      })
    })

    await page.goto(`${FRONTEND_URL}/r/${readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    await page.locator('[data-testid="llm-copy-button"]').click()

    await expect.poll(async () => {
      return page.evaluate(() => (window as unknown as { __copiedText: string }).__copiedText)
    }).toContain('# E2E Test Workspace')

    await expect.poll(async () => {
      const copied = await page.evaluate(
        () => (window as unknown as { __copiedText: string }).__copiedText
      )
      return copied.trim().startsWith('{')
    }).toBe(false)
  })

  test('LLM copy button is visible for files', async ({ page, readKey }) => {
    await page.goto(`${FRONTEND_URL}/r/${readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    const copyButton = page.locator('[data-testid="llm-copy-button"]')
    await expect(copyButton).toBeVisible()
  })
})

