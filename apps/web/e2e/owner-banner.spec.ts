/**
 * Owned Indicator E2E Tests
 *
 * Tests the owned indicator shown to workspace owners when viewing
 * their own content via capability URLs.
 */

import { test, expect, publicTest } from './fixtures'

test.describe('Owned Indicator - Authenticated Owner', () => {
  test('shows owned indicator when logged-in owner views capability URL', async ({ page, readKey }) => {
    await page.goto(`/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const ownedButton = page.locator('[data-testid="claimed-workspace-button"]')
    await expect(ownedButton).toBeVisible()
    await expect(ownedButton).toContainText('Owned')
  })

  test('owned indicator popover links to control panel', async ({ page, readKey, workspaceId }) => {
    await page.goto(`/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const ownedButton = page.locator('[data-testid="claimed-workspace-button"]')
    await ownedButton.click()

    const controlLink = page.getByRole('link', { name: /open control panel/i })
    await expect(controlLink).toBeVisible()
    await expect(controlLink).toHaveAttribute('href', `/control/${workspaceId}`)
  })

  test('owned indicator appears on file pages', async ({ page, readKey }) => {
    await page.goto(`/r/${readKey}/README.md`)
    await page.waitForLoadState('networkidle')

    const ownedButton = page.locator('[data-testid="claimed-workspace-button"]')
    await expect(ownedButton).toBeVisible()
  })
})

publicTest.describe('Owned Indicator - Anonymous Users', () => {
  publicTest('does not show owned indicator for anonymous users', async ({ page, readKey }) => {
    await page.context().clearCookies()
    await page.goto(`/r/${readKey}`)
    await page.waitForLoadState('networkidle')

    const ownedButton = page.locator('[data-testid="claimed-workspace-button"]')
    await expect(ownedButton).not.toBeVisible()
  })
})


