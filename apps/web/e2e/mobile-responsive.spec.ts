import { test as unauthTest, expect } from '@playwright/test'
import { test, TEST_KEYS } from './fixtures'

unauthTest.describe('Mobile Responsive - Reader Layout', () => {
  unauthTest.use({ viewport: { width: 375, height: 812 } })

  unauthTest('should show reader layout on mobile', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}`)
    await page.waitForLoadState('networkidle')

    const layout = page.locator('[data-testid="reader-layout"]')
    await expect(layout).toBeVisible()

    const mobileSidebar = page.locator('#app-sidebar-mobile')
    await expect(mobileSidebar).toBeHidden()

    await expect(page.locator('[data-testid="folder-view"]')).toBeVisible()
  })

  unauthTest('should show folder view on mobile', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[data-testid="folder-view"]')).toBeVisible()
    await expect(page.locator('[data-testid="folder-item"]').first()).toBeVisible({ timeout: 15000 })
  })

  unauthTest('should navigate via folder items on mobile', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}`)
    await page.waitForLoadState('networkidle')

    const docsFolder = page.locator('[data-testid="folder-item"]').filter({ hasText: 'docs' }).first()
    await expect(docsFolder).toBeVisible({ timeout: 15000 })
    await docsFolder.click()

    await expect(page).toHaveURL(/\/r\/.*\/docs$/, { timeout: 15000 })
  })

  unauthTest('should show file view on mobile', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[data-testid="reader-main"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="reader-main"] h1').first()).toBeVisible()
  })

  unauthTest('should show article content on file page', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    const content = page.locator('article h1, article h2, article p')
    await expect(content.first()).toBeVisible()
  })

  unauthTest('should open mobile sidebar menu', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Toggle menu' }).click()

    await expect(page.locator('#app-sidebar-mobile')).toBeVisible()
  })
})

test.describe('Mobile Responsive - Control', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('should show hamburger menu on mobile', async ({ page }) => {
    await page.goto('/control')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('#app-sidebar')).toBeHidden()

    await expect(page.getByRole('button', { name: 'Toggle menu' })).toBeVisible()
  })

  test('should open mobile menu when hamburger is clicked', async ({ page }) => {
    await page.goto('/control')
    await page.waitForLoadState('networkidle')

    const menuButton = page.getByRole('button', { name: 'Toggle menu' })
    await menuButton.click()

    const sheet = page.locator('#app-sidebar-mobile')
    await expect(sheet).toBeVisible()

    await expect(sheet.getByText('Welcome')).toBeVisible()
    await expect(sheet.getByText('Orchestration')).toBeVisible()
    await expect(sheet.getByText('Settings')).toBeVisible()
  })

  test('should navigate and close menu on link click', async ({ page }) => {
    await page.goto('/control')
    await page.waitForLoadState('networkidle')

    const menuButton = page.getByRole('button', { name: 'Toggle menu' })
    await menuButton.click()

    const sheet = page.locator('#app-sidebar-mobile')
    await sheet.getByText('Orchestration').click()

    await expect(page).toHaveURL(/\/control\/ws_[^/]+\/orchestration$/)
    await expect(sheet).toBeHidden()
  })

  test('should show compact mobile header controls', async ({ page }) => {
    await page.goto('/control')
    await page.waitForLoadState('networkidle')

    const header = page.locator('header').first()
    await expect(header).toBeVisible()
    await expect(header.getByRole('link', { name: /mdplane/i })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Toggle menu' })).toBeVisible()
  })

  test('should show single column grid on mobile', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/orchestration`)
    await page.waitForLoadState('networkidle')

    const grid = page.locator('.grid.gap-4')
    if (await grid.count() > 0) {
      const gridBox = await grid.first().boundingBox()
      const cards = grid.locator('> *')
      const cardCount = await cards.count()

      if (cardCount > 0 && gridBox) {
        const firstCard = cards.first()
        const cardBox = await firstCard.boundingBox()
        if (cardBox) {
          expect(cardBox.width).toBeGreaterThan(gridBox.width * 0.8)
        }
      }
    }
  })
})

