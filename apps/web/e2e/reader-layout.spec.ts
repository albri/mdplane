import { test, expect, TEST_KEYS, FRONTEND_URL } from './fixtures'

test.describe('Reader Layout', () => {
  test.describe('Layout Structure', () => {
    test('renders reader layout with sidebar on desktop', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/README.md`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="reader-layout"]')).toBeVisible()
      await expect(page.locator('#app-sidebar')).toBeVisible()
    })

    test('sidebar contains file tree navigation', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/README.md`)
      await page.waitForLoadState('networkidle')

      const sidebar = page.locator('#app-sidebar')
      await expect(sidebar).toBeVisible()
      await expect(page.getByTestId('reader-workspace-heading')).toBeVisible()
      await expect(page.getByRole('button', { name: 'docs' })).toBeVisible({ timeout: 10000 })
    })

    test('sidebar footer shows theme toggle', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/README.md`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible()
    })

    test('shows sticky table of contents for documents with more than two headings', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs/getting-started.md`)
      await page.waitForLoadState('networkidle')

      const toc = page.getByRole('navigation', { name: 'Table of contents' })
      await expect(toc).toBeVisible()
      const stickyContainer = page.locator('[data-testid="reader-toc"]')
      await expect(stickyContainer).toBeVisible()
      await expect(stickyContainer).toHaveCSS('position', 'sticky')
      await expect(page.locator('#reader-toc')).toBeVisible()
      await expect(page.locator('#toc-title')).toContainText('On this page')
      await expect(page.locator('#reader-toc [data-testid="toc-depth-guide"]')).toBeVisible()
    })

    test('toc links update the hash and scroll to heading', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs/getting-started.md`)
      await page.waitForLoadState('networkidle')

      const tocLink = page.locator('#reader-toc a[href="#quick-start"]').first()
      await expect(tocLink).toBeVisible()
      await tocLink.click()
      await expect(page).toHaveURL(/#quick-start$/)
    })

    test('keeps sidebar fixed while main content scrolls', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs/getting-started.md`)
      await page.waitForLoadState('networkidle')

      const sidebar = page.locator('#app-sidebar')
      const stickyContainer = page.locator('[data-sidebar-placeholder]')

      await expect(stickyContainer).toHaveCSS('position', 'sticky')
      await expect(sidebar).toBeVisible()

      await page.evaluate(() => {
        window.scrollTo({ top: 1200, behavior: 'auto' })
      })

      await expect(sidebar).toBeVisible()
    })

    test('hides table of contents for short documents', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs/xss-test.md`)
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('navigation', { name: 'Table of contents' })).toHaveCount(0)
    })

    test('markdown heading anchors and links use docs-style treatment', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs/getting-started.md`)
      await page.waitForLoadState('networkidle')

      const headingAnchor = page.locator('article h2 a[href="#quick-start"]').first()
      await expect(headingAnchor).toBeVisible()
      await expect(headingAnchor).toHaveAttribute('data-card', '')

      const docLink = page.locator('article a[href="/docs/api-reference.md"]').first()
      await expect(docLink).toBeVisible()
      await expect(docLink).toHaveClass(/underline/)
      await expect(docLink).toHaveClass(/decoration-primary/)
    })
  })

  test.describe('Sidebar Navigation', () => {
    test('sidebar provides navigation via file tree', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('#app-sidebar')).toBeVisible()
      const docsFolder = page.getByRole('button', { name: 'docs' })
      await docsFolder.click()
      await expect(page.getByRole('link', { name: 'getting-started' })).toBeVisible({ timeout: 5000 })
    })

    test('clicking file in sidebar navigates to file', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}`)
      await page.waitForLoadState('networkidle')

      const docsFolder = page.getByRole('button', { name: 'docs' })
      await docsFolder.click()
      const fileLink = page.getByRole('link', { name: 'getting-started' })
      await fileLink.click()
      await expect(page).toHaveURL(/getting-started/)
    })

    test('logo links to capability root', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs/getting-started.md`)
      await page.waitForLoadState('networkidle')

      const logo = page.locator('#app-sidebar').locator('a:has-text("mdplane")')
      await logo.click()
      await expect(page).toHaveURL(new RegExp(`/r/${TEST_KEYS.readKey}$`))
    })
  })

  test.describe('Sidebar Footer Elements', () => {
    test('shows theme toggle button', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/README.md`)
      await page.waitForLoadState('networkidle')

      const themeToggle = page.locator('[data-testid="theme-toggle"]')
      await expect(themeToggle).toBeVisible()
    })
  })

  test.describe('Responsive Layout', () => {
    test('layout works on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/README.md`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="reader-layout"]')).toBeVisible()
      await expect(page.locator('#app-sidebar-mobile')).toBeHidden()
      await expect(page.locator('article h1').first()).toBeVisible()
    })

    test('shows mobile toc popover for long documents', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs/getting-started.md`)
      await page.waitForLoadState('networkidle')

      const tocPopover = page.locator('[data-toc-popover]').first()
      await expect(tocPopover).toBeVisible()
      await page.getByRole('button', { name: /on this page|quick start/i }).click()
      await expect(tocPopover.getByRole('link', { name: 'Quick Start' })).toBeVisible()
    })
  })
})

