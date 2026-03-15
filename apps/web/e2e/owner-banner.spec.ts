/**
 * Claimed Indicator E2E Tests
 *
 * Tests the claimed indicator shown to workspace owners when viewing
 * their own content via capability URLs.
 */

import { test, expect, publicTest } from './fixtures'

test.describe('Claimed Indicator - Authenticated Owner', () => {
  test('shows claimed indicator when logged-in owner views capability URL', async ({ page, readKey }) => {
    await page.goto(`/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const claimedButton = page.locator('[data-testid="claimed-workspace-button"]')
    await expect(claimedButton).toBeVisible()
    await expect(claimedButton).toContainText('Claimed')
  })

  test('claimed indicator popover links to control panel', async ({ page, readKey, workspaceId }) => {
    await page.goto(`/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const claimedButton = page.locator('[data-testid="claimed-workspace-button"]')
    await claimedButton.click()

    const controlLink = page.getByRole('link', { name: /control panel/i })
    await expect(controlLink).toBeVisible()
    await expect(controlLink).toHaveAttribute('href', `/control/${workspaceId}`)
  })

  test('claimed indicator appears on file pages', async ({ page, readKey }) => {
    await page.goto(`/r/${readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    const claimedButton = page.locator('[data-testid="claimed-workspace-button"]')
    await expect(claimedButton).toBeVisible()
  })
})

publicTest.describe('Claimed Indicator - Anonymous Users', () => {
  publicTest('does not show claimed indicator for anonymous users', async ({ page, readKey }) => {
    await page.context().clearCookies()
    await page.goto(`/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const claimedButton = page.locator('[data-testid="claimed-workspace-button"]')
    await expect(claimedButton).not.toBeVisible()
  })
})


