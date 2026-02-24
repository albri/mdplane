/**
 * Folder View E2E Tests
 *
 * Tests for the FolderView component in capability views.
 * Verifies folder listing, navigation, metadata display, and empty states.
 */

import { publicTest as test, expect, FRONTEND_URL, TEST_KEYS, TEST_FOLDERS } from './fixtures'

test.describe('Folder View', () => {
  test.describe('Folder Listing', () => {
    test('displays folder view component', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="folder-view"]')).toBeVisible()
    })

    test('lists folder items', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="folder-view"]')).toBeVisible({ timeout: 10000 })
      const items = page.locator('[data-testid="folder-item"]')
      await expect.poll(async () => items.count(), { timeout: 10000 }).toBeGreaterThanOrEqual(2)
    })

    test('shows item count footer', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="folder-count"]')).toBeVisible()
      await expect(page.locator('[data-testid="folder-count"]')).toContainText('items')
    })
  })

  test.describe('Sort Order', () => {
    test('folders appear before files', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="folder-view"]')).toBeVisible({ timeout: 10000 })

      const items = page.locator('[data-testid="folder-item"]')
      const firstItem = items.first()
      await expect(firstItem).toBeVisible({ timeout: 5000 })

      await expect(firstItem.locator('[data-testid="folder-icon"]')).toBeVisible()
    })
  })

  test.describe('Navigation', () => {
    test('clicking folder navigates into it', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="folder-view"]')).toBeVisible({ timeout: 10000 })
      const docsFolder = page.locator('[data-testid="folder-item"]:has-text("docs")')
      await expect(docsFolder).toBeVisible({ timeout: 5000 })

      await docsFolder.click()
      await page.waitForLoadState('networkidle')

      await expect(page).toHaveURL(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs`)
    })

    test('clicking file opens file view', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs`)
      await page.waitForLoadState('networkidle')

      await page.click('[data-testid="folder-item"]:has-text("getting-started.md")')
      await page.waitForLoadState('networkidle')

      await expect(page.locator('article h1#getting-started')).toBeVisible()
    })
  })

  test.describe('File Icons', () => {
    test('folders show folder icon', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="folder-view"]')).toBeVisible({ timeout: 10000 })

      const folderItem = page.locator('[data-testid="folder-item"]:has-text("docs")')
      await expect(folderItem).toBeVisible({ timeout: 5000 })
      await expect(folderItem.locator('[data-testid="folder-icon"]')).toBeVisible()
    })

    test('files show file icon', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs`)
      await page.waitForLoadState('networkidle')

      // Wait for folder view to be visible
      await expect(page.locator('[data-testid="folder-view"]')).toBeVisible({ timeout: 10000 })

      // Find a file item and check it has file icon
      const fileItem = page.locator('[data-testid="folder-item"]:has-text(".md")').first()
      await expect(fileItem).toBeVisible({ timeout: 5000 })
      await expect(fileItem.locator('[data-testid="file-icon"]')).toBeVisible()
    })
  })

  test.describe('Metadata Display', () => {
    test('items show updated time', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}/docs`)
      await page.waitForLoadState('networkidle')

      // Items should show "Updated" text
      const firstItem = page.locator('[data-testid="folder-item"]').first()
      await expect(firstItem).toContainText('Updated')
    })
  })
})

