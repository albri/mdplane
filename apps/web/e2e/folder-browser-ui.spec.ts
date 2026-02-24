import { test, expect } from '@playwright/test';
import { TEST_KEYS, BACKEND_URL } from './fixtures';

/**
 * Folder Browser UI E2E Tests
 *
 * Tests for the read-only folder browser UX in the ReaderDocsLayout.
 * The new layout has a sidebar with FileTree navigation.
 * Navigation is through folder items in the main content area or sidebar.
 */

test.describe('Folder Browser UI', () => {
  test('should show folder listing with sidebar', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}/docs`);
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    await expect(page.getByRole('button', { name: 'docs' })).toBeVisible();
  });

  test('should show folder view in main content', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}`);
    await page.waitForLoadState('networkidle');

    const folderView = page.locator('[data-testid="folder-view"]');
    await expect(folderView).toBeVisible({ timeout: 15000 });

    const folderItems = page.locator('[data-testid="folder-item"]');
    await expect(folderItems.first()).toBeVisible();
  });

  test('should show file list in main content', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}`);
    await page.waitForLoadState('networkidle');

    const folderItem = page.locator('[data-testid="folder-item"]').first();
    await expect(folderItem).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to folder when clicking folder item', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}`);
    await page.waitForLoadState('networkidle');

    const docsFolder = page.locator('[data-testid="folder-item"]').filter({ hasText: 'docs' }).first();
    await expect(docsFolder).toBeVisible({ timeout: 15000 });
    await docsFolder.click();

    await expect(page).toHaveURL(/\/r\/.*\/docs$/);
  });

  test('should navigate to file viewer when clicking file', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}/docs`);
    await page.waitForLoadState('networkidle');

    const readmeFile = page.locator('[data-testid="folder-item"]').filter({ hasText: /getting-started\.md/i }).first();
    await expect(readmeFile).toBeVisible({ timeout: 15000 });
    await readmeFile.click();

    await expect(page).toHaveURL(/\/r\/.*\/docs\/getting-started\.md$/);
  });

  test('should show 404 state for non-existent folder', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}/nonexistent-folder`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('404 Not Found')).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText('The folder you are looking for does not exist or you do not have access to it.')
    ).toBeVisible();

    await expect(page.getByText('Sign in')).not.toBeVisible();
  });

  test('should show empty state for empty folder', async ({ page }) => {
    const folderName = `__e2e_empty_${Date.now()}`;

    const createResponse = await page.request.post(`${BACKEND_URL}/w/${TEST_KEYS.writeKey}/folders`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name: folderName, path: '' },
    });
    expect(createResponse.ok()).toBe(true);

    await page.goto(`/r/${TEST_KEYS.readKey}/${folderName}`);
    await page.waitForLoadState('networkidle');

    const emptyState = page.locator('[data-testid="folder-empty"]');
    await expect(emptyState).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('This folder is empty')).toBeVisible();

    await page.request.delete(`${BACKEND_URL}/w/${TEST_KEYS.writeKey}/folders/${encodeURIComponent(folderName)}`).catch(() => {});
  });

  test('should show guided onboarding state for empty workspace root with commands and claim affordance', async ({ page }) => {
    const bootstrapResponse = await page.request.post(`${BACKEND_URL}/bootstrap`, {
      headers: { 'Content-Type': 'application/json' },
      data: { workspaceName: `e2e-runtime-onboarding-${Date.now()}` },
    });
    expect(bootstrapResponse.ok()).toBe(true);
    const bootstrapBody = await bootstrapResponse.json() as {
      ok: boolean
      data?: { keys: { read: string } }
    };
    expect(bootstrapBody.ok).toBe(true);
    const readKey = bootstrapBody.data?.keys.read;
    expect(readKey).toBeTruthy();

    await page.goto(`/r/${readKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('folder-empty-onboarding')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Workspace is empty')).toBeVisible();
    const commandTabs = page.getByTestId('runtime-onboarding-command-tabs');
    await expect(commandTabs).toBeVisible();
    await expect(commandTabs.getByRole('tab', { name: 'API (curl)' }).first()).toBeVisible();
    await expect(commandTabs.getByRole('tab', { name: 'CLI' }).first()).toBeVisible();
    await expect(commandTabs.getByText(/curl -X PUT/i).first()).toBeVisible();
    await commandTabs.getByRole('tab', { name: 'CLI' }).first().click();
    await expect(commandTabs.getByText(/mdplane write/i).first()).toBeVisible();
    const claimButton = page.getByTestId('claim-workspace-button');
    await expect(claimButton).toBeVisible();
    await expect(claimButton).toHaveText(/^claim$/i);
    await expect(page.getByTestId('sidebar-empty-state')).toBeVisible();
  });

  test('should provide recovery actions on folder load failure', async ({ page }) => {
    await page.route(/\/r\/[^/]+\/folders(?:\/.*)?(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch folder contents' },
        }),
      });
    });

    await page.goto(`/r/${TEST_KEYS.readKey}/docs`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Error loading content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('a[href="/launch"]').filter({ hasText: /workspace launcher/i })).toBeVisible();
    await expect(page.locator('a[href="/bootstrap"]').filter({ hasText: /create workspace/i })).toBeVisible();
  });
});
