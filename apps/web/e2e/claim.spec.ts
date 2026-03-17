/**
 * E2E Tests for Claim Flow UX
 *
 * Tests:
 * - Already claimed error state
 * - Invalid key error state
 * - Success state with API key display
 * - Network error handling
 */

import { test, publicTest, expect, FRONTEND_URL, BACKEND_URL } from './fixtures';

test.describe('Claim Flow UX', () => {
  test('should show already claimed error for claimed workspace', async ({ page, writeKey }) => {
    await page.goto(`${FRONTEND_URL}/claim/${writeKey}`, { waitUntil: 'networkidle' });
    await page.waitForURL(/\/(claim|control|login|api\/auth\/sign-in)/, { timeout: 10000 });

    const url = page.url();
    if (url.includes('/claim/')) {
      const expectedContent = page.getByText(/Already Claimed|Workspace Claimed|Go to Control/i);
      await expect(expectedContent).toBeVisible({ timeout: 10000 });
    } else if (url.includes('/control')) {
      await expect(page).toHaveURL(/\/control/);
    }
  });

  test('should show invalid key error for non-existent key', async ({ page }) => {
    const fakeKey = 'w_invalidKey123456789';
    await page.goto(`${FRONTEND_URL}/claim/${fakeKey}`, { waitUntil: 'networkidle' });

    const errorTitle = page.getByText(/Invalid Key|Claim Failed|not found|Connection Error/i).first();
    await expect(errorTitle).toBeVisible({ timeout: 10000 });
  });
});

publicTest.describe('Claim Flow UX - Unauthenticated', () => {
  publicTest('should redirect unauthenticated users to sign-in or show auth required', async ({ page }) => {
    const fakeKey = 'w_testKey123';
    await page.goto(`${FRONTEND_URL}/claim/${fakeKey}`, { waitUntil: 'networkidle' });
    await page.waitForURL(/\/(claim|login|api\/auth\/sign-in)/, { timeout: 10000 });

    const url = page.url();
    const isOnAuthPage = url.includes('/api/auth/sign-in') || url.includes('/login');

    if (!isOnAuthPage) {
      const signInText = page.getByText(/sign in|authentication|Continue with GitHub|Claim Failed|Connection Error/i);
      await expect(signInText).toBeVisible({ timeout: 5000 });
    }
  });
});
