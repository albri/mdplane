/**
 * Settings Page E2E Tests
 *
 * Tests for the unified Settings page.
 * See: app-overhaul/epics/01-control-core/stories/1.3-settings-unification
 */

import { test, expect, TEST_KEYS } from './fixtures';

test.describe('Settings Page', () => {
  test.describe('Page Structure', () => {
    test('should load settings page', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 });
    });

    test('should have three sections', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      const main = page.getByRole('main');
      await expect(main.locator('[data-slot="card-title"]', { hasText: /^Workspace$/ }).first()).toBeVisible({ timeout: 10000 });
      await expect(main.locator('[data-slot="card-title"]', { hasText: /^Export$/ }).first()).toBeVisible();
      await expect(main.locator('[data-slot="card-title"]', { hasText: /^Danger Zone$/ }).first()).toBeVisible();
    });
  });

  test.describe('Old Sub-Pages Return 404', () => {
    test('should 404 on old account page', async ({ page }) => {
      const response = await page.goto(`/control/${TEST_KEYS.workspaceId}/settings/account`);
      expect(response?.status()).toBe(404);
    });

    test('should 404 on old workspace page', async ({ page }) => {
      const response = await page.goto(`/control/${TEST_KEYS.workspaceId}/settings/workspace`);
      expect(response?.status()).toBe(404);
    });

    test('should 404 on old data page', async ({ page }) => {
      const response = await page.goto(`/control/${TEST_KEYS.workspaceId}/settings/data`);
      expect(response?.status()).toBe(404);
    });

    test('should 404 on old danger page', async ({ page }) => {
      const response = await page.goto(`/control/${TEST_KEYS.workspaceId}/settings/danger`);
      expect(response?.status()).toBe(404);
    });
  });

  test.describe('Workspace Section', () => {
    test('should have workspace rename form', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      await expect(page.getByLabel(/workspace name/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /save name/i })).toBeVisible();
    });
  });

  test.describe('Export Section', () => {
    test('should show export curl command', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      await expect(
        page.getByText('https://api.mdplane.dev/api/v1/export?format=zip')
      ).toBeVisible();
    });

    test('should have link to API Keys page', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      const apiKeysLink = page
        .locator(`a[href="/control/${TEST_KEYS.workspaceId}/api-keys"]`)
        .filter({ hasText: /create export key/i });
      await expect(apiKeysLink).toBeVisible();
      await expect(apiKeysLink).toHaveAttribute('href', `/control/${TEST_KEYS.workspaceId}/api-keys`);
    });
  });

  test.describe('Danger Zone', () => {
    test('should have rotate keys button', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      await expect(page.getByRole('button', { name: /rotate keys/i })).toBeVisible();
    });

    test('should have delete workspace button', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      await expect(page.getByRole('button', { name: /delete workspace/i })).toBeVisible();
    });

    test('should open confirm dialog for rotate', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      await page.getByRole('button', { name: /rotate keys/i }).click();
      await expect(page.getByText(/type.*rotate.*to confirm/i)).toBeVisible();
    });

    test('should require exact text to confirm rotate', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      await page.getByRole('button', { name: /rotate keys/i }).click();

      // Confirm button should be disabled initially
      const confirmButton = page.getByRole('button', { name: /^confirm$/i });
      await expect(confirmButton).toBeDisabled();

      // Type wrong text - should still be disabled
      await page.getByPlaceholder('rotate').fill('wrong');
      await expect(confirmButton).toBeDisabled();

      // Type correct text - should be enabled
      await page.getByPlaceholder('rotate').fill('rotate');
      await expect(confirmButton).toBeEnabled();
    });

    test('should reveal newly rotated keys once after successful rotation', async ({ page }) => {
      await page.route(/\/workspaces\/[^/]+\/rotate-all$/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              workspaceId: 'ws_e2e_mock_rotate',
              message: 'All capability URLs rotated successfully',
              rotatedCount: 7,
              keyCustodyWarning: 'Store these keys now. They are shown once.',
              keys: {
                read: 'r_mocked_rotated_read_key_1234567890',
                append: 'a_mocked_rotated_append_key_123456789',
                write: 'w_mocked_rotated_write_key_1234567890',
              },
              urls: {
                api: {
                  read: 'https://api.mdplane.dev/r/r_mocked_rotated_read_key_1234567890',
                  append: 'https://api.mdplane.dev/a/a_mocked_rotated_append_key_123456789',
                  write: 'https://api.mdplane.dev/w/w_mocked_rotated_write_key_1234567890',
                },
                web: {
                  read: 'https://app.mdplane.dev/r/r_mocked_rotated_read_key_1234567890',
                  claim: 'https://app.mdplane.dev/claim/w_mocked_rotated_write_key_1234567890',
                },
              },
            },
          }),
        });
      });

      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      await page.getByRole('button', { name: /rotate keys/i }).click();
      await page.getByPlaceholder('rotate').fill('rotate');
      await page.getByRole('button', { name: /^confirm$/i }).click();

      const panel = page.getByTestId('rotated-keys-panel');
      await expect(panel.getByText(/new keys issued/i)).toBeVisible({ timeout: 15000 });
      await expect(panel.getByText(/^read key$/i)).toBeVisible();
      await expect(panel.getByText(/^append key$/i)).toBeVisible();
      await expect(panel.getByText(/^write key$/i)).toBeVisible();
    });

    test('should open confirm dialog for delete', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      await page.getByRole('button', { name: /delete workspace/i }).click();
      await expect(page.getByText(/type workspace name to confirm/i)).toBeVisible();
    });
  });

  test.describe('No TODO Stubs', () => {
    test('should NOT have TODO comments visible in page content', async ({ page }) => {
      await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
      const content = await page.textContent('body');
      expect(content?.toUpperCase()).not.toContain('TODO');
    });
  });
});



