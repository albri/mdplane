/**
 * Owner Banner E2E Tests
 *
 * Tests the subtle banner shown to workspace owners when viewing
 * their own content via capability URLs.
 */

import { test, expect, publicTest } from './fixtures'

test.describe('Owner Banner - Authenticated Owner', () => {
  test('shows owner banner when logged-in owner views capability URL', async ({ page, readKey }) => {
    await page.goto(`/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const banner = page.locator('[data-testid="owner-banner"]')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('You own this workspace')
    await expect(banner).toContainText('Go to Control Panel')
  })

  test('owner banner links to control with workspace context', async ({ page, readKey, workspaceId }) => {
    await page.goto(`/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const controlLink = page.locator('[data-testid="owner-banner"] a')
    await expect(controlLink).toBeVisible()
    await expect(controlLink).toHaveAttribute('href', `/control/${workspaceId}`)
  })

  test('owner banner appears on file pages', async ({ page, readKey }) => {
    await page.goto(`/r/${readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    const banner = page.locator('[data-testid="owner-banner"]')
    await expect(banner).toBeVisible()
  })

  test('owner banner appears on subfolder pages', async ({ page, readKey }) => {
    await page.goto(`/r/${readKey}/docs`)
    await page.waitForLoadState('networkidle')

    const banner = page.locator('[data-testid="owner-banner"]')
    await expect(banner).toBeVisible()
  })
})

publicTest.describe('Owner Banner - Anonymous Users', () => {
  publicTest('does not show owner banner for anonymous users', async ({ page, readKey }) => {
    await page.context().clearCookies()
    await page.goto(`/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const banner = page.locator('[data-testid="owner-banner"]')
    await expect(banner).not.toBeVisible()
  })

  publicTest('does not flash owner banner for anonymous users', async ({ page, readKey }) => {
    await page.context().clearCookies()
    await page.goto(`/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const banner = page.locator('[data-testid="owner-banner"]')
    await expect(banner).toBeHidden({ timeout: 2000 })
  })
})


