import { test, expect } from '@playwright/test';
import { BACKEND_URL, FRONTEND_URL, TEST_KEYS } from './fixtures';

/**
 * Routing + Auth Gating E2E Tests
 *
 * Tests for verifying:
 * - Capability URLs (/r/*) never redirect to login
 * - Control routes require authentication
 * - Deep folder capability URLs work without session
 */

test.describe('Routing + Auth Gating', () => {
  test.describe('Capability URL Access (No Auth Required)', () => {
    test('should render workspace root without authentication', async ({ page }) => {
      await page.goto(`/r/${TEST_KEYS.readKey}`);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page).toHaveURL(/\/r\/.+/);

      const layout = page.locator('[data-testid="reader-layout"]');
      await expect(layout).toBeVisible();
      await expect(page.getByTestId('not-found')).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'docs' })).toBeVisible();
    });

    test('should render deep folder capability URL without authentication', async ({ page }) => {
      await page.goto(`/r/${TEST_KEYS.readKey}/docs`);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page).toHaveURL(/\/r\/.+/);

      const layout = page.locator('[data-testid="reader-layout"]');
      await expect(layout).toBeVisible();
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();
    });

    test('should show claim action for unclaimed workspace on runtime route', async ({ page }) => {
      const response = await page.request.post(`${BACKEND_URL}/bootstrap`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `10.20.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
        },
        data: { workspaceName: `e2e-unclaimed-${Date.now()}` },
      });
      expect(response.status()).toBe(201);
      const body = await response.json() as {
        ok: boolean;
        data?: { keys: { read: string; write: string } };
      };
      expect(body.ok).toBe(true);
      const readKey = body.data?.keys.read;
      expect(readKey).toBeTruthy();

      await page.goto(`/r/${readKey}`);
      await expect(page).not.toHaveURL(/\/login/);
      const claimButton = page.getByTestId('claim-workspace-button');
      await expect(claimButton).toBeVisible();
      await expect(claimButton).toHaveText('Claim');
    });

    test('should submit claim dialog with Enter key from runtime sidebar', async ({ page }) => {
      const response = await page.request.post(`${BACKEND_URL}/bootstrap`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `10.21.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
        },
        data: { workspaceName: `e2e-unclaimed-enter-${Date.now()}` },
      });
      expect(response.status()).toBe(201);
      const body = await response.json() as {
        ok: boolean;
        data?: { keys: { read: string; write: string } };
      };
      expect(body.ok).toBe(true);
      const readKey = body.data?.keys.read;
      const writeKey = body.data?.keys.write;
      expect(readKey).toBeTruthy();
      expect(writeKey).toBeTruthy();

      await page.goto(`/r/${readKey}`);
      await page.getByTestId('claim-workspace-button').click();

      const input = page.getByPlaceholder('Paste write key or /claim URL');
      await expect(input).toBeVisible();
      await input.fill(writeKey!);
      await input.press('Enter');

      await page.waitForURL(/\/(claim|login)/, { timeout: 10000 });
      const currentUrl = decodeURIComponent(page.url());
      expect(currentUrl.includes(`/claim/${writeKey}`)).toBe(true);
    });

    test('should render file capability URL without authentication', async ({ page }) => {
      await page.goto(`/r/${TEST_KEYS.readKey}/README.md`);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page).toHaveURL(/\/r\/.+/);

      const layout = page.locator('[data-testid="reader-layout"]');
      await expect(layout).toBeVisible();
    });

    test('should show 404 for invalid capability key without login prompt', async ({ page }) => {
      await page.goto('/r/invalid-key-12345678901234');
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByTestId('not-found')).toBeVisible({ timeout: 15000 });
    });

    test('should reject append key on /r route', async ({ page }) => {
      await page.goto(`/r/${TEST_KEYS.appendKey}`);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByTestId('not-found')).toBeVisible({ timeout: 15000 });
    });

    test('should reject write key on /r route', async ({ page }) => {
      await page.goto(`/r/${TEST_KEYS.writeKey}`);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByTestId('not-found')).toBeVisible({ timeout: 15000 });
    });

    test('should show 404 for non-existent file with valid key', async ({ page }) => {
      await page.goto(`/r/${TEST_KEYS.readKey}/nonexistent-file.md`);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByText(/not found|invalid|does not exist/i)).toBeVisible({ timeout: 15000 });
    });

    test('should show 404 for non-existent folder with valid key', async ({ page }) => {
      await page.goto(`/r/${TEST_KEYS.readKey}/nonexistent-folder`);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByText(/not found|invalid|does not exist/i).first()).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Control Access (Auth Required)', () => {
    test('should redirect to login when accessing control without session', async ({ page }) => {
      const context = page.context();
      await context.clearCookies();
      await page.goto('/control');
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
      await expect(page).not.toHaveURL(/\/control/);
    });

    test('should redirect to login when accessing control sub-pages without session', async ({ page }) => {
      const context = page.context();
      await context.clearCookies();

      const controlRoutes = [
        '/control',
        '/control/ws_test_route/api-keys',
        '/control/ws_test_route/settings',
        '/control/ws_test_route/orchestration',
        '/control/ws_test_route/webhooks',
      ];

      for (const route of controlRoutes) {
        await context.clearCookies();
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
        await expect(page).not.toHaveURL(new RegExp(`^${route}`));
      }
    });

    test('should show login UI when redirected from control', async ({ page }) => {
      const context = page.context();
      await context.clearCookies();
      await page.goto('/control');
      await page.waitForURL(/\/login/);

      const loginElements = page.locator('button, a, form').filter({ hasText: /Sign in|Login|GitHub/i }).first();
      await expect(loginElements).toBeVisible();
    });

    test('should save intended URL and redirect back after login (deep control page)', async ({ page }) => {
      const context = page.context();
      await context.clearCookies();

      const intendedPage = '/control/ws_test_route/settings';
      await page.goto(intendedPage);
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

      const currentUrl = new URL(page.url());
      expect(currentUrl.searchParams.get('next')).toBe(intendedPage);
    });

    test('should save intended URL and redirect back after login (API keys page)', async ({ page }) => {
      const context = page.context();
      await context.clearCookies();

      const intendedPage = '/control/ws_test_route/api-keys';
      await page.goto(intendedPage);
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

      const currentUrl = new URL(page.url());
      expect(currentUrl.searchParams.get('next')).toBe(intendedPage);
    });

    test('should use control as default redirect when no saved URL', async ({ page }) => {
      const context = page.context();
      await context.clearCookies();
      await page.goto('/login');

      const savedRedirect = await page.evaluate(() => sessionStorage.getItem('redirectAfterLogin'));
      expect(savedRedirect).toBeNull();
      // Note: The LoginForm component handles this by defaulting to '/control'
      // This test verifies the default behavior when no redirect is saved
    });

    test('should not render claim-first control splash when auth check fails', async ({ page }) => {
      const context = page.context();
      await context.clearCookies();
      await context.addCookies([
        {
          name: 'better-auth.session_token',
          value: 'invalid-session-token',
          url: FRONTEND_URL,
        },
      ]);

      await page.goto('/control');
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
      await expect(page.getByText(/claim a workspace to continue/i)).toHaveCount(0);
    });

    test('should not render claim-first control splash on deep control route when auth check fails', async ({ page }) => {
      const context = page.context();
      await context.clearCookies();
      await context.addCookies([
        {
          name: 'better-auth.session_token',
          value: 'invalid-session-token',
          url: FRONTEND_URL,
        },
      ]);

      await page.goto('/control/ws_test_route/settings');
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
      await expect(page.getByText(/claim a workspace to continue/i)).toHaveCount(0);
    });
  });

  test.describe('Not Found Page', () => {
    test('should only show a home action on 404 page', async ({ page }) => {
      await page.goto('/route-that-does-not-exist');
      await expect(page.getByTestId('not-found')).toBeVisible();

      await expect(page.getByRole('link', { name: /^go home$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /^docs$/i })).toHaveCount(0);
    });
  });

  test.describe('Auth Gating Comparison', () => {
    test('capability URL should work while control requires auth (side-by-side)', async ({ context }) => {
      const browser = context.browser();
      if (!browser) throw new Error('No browser instance available');

      const cleanContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const capabilityPage = await cleanContext.newPage();
      const controlPage = await cleanContext.newPage();

      await capabilityPage.goto(`/r/${TEST_KEYS.readKey}`);
      await expect(capabilityPage).not.toHaveURL(/\/login/);
      await expect(capabilityPage).toHaveURL(/\/r\/.+/);

      await controlPage.goto('/control');
      await expect(controlPage).toHaveURL(/\/login/);

      await capabilityPage.close();
      await controlPage.close();
      await cleanContext.close();
    });

    test('multiple capability URL navigations should never trigger login', async ({ page }) => {
      const capabilityPaths = [
        `/r/${TEST_KEYS.readKey}`,
        `/r/${TEST_KEYS.readKey}/docs`,
        `/r/${TEST_KEYS.readKey}/docs/getting-started.md`,
        `/r/${TEST_KEYS.readKey}/src`,
      ];

      for (const path of capabilityPaths) {
        await page.goto(path);
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page).toHaveURL(/\/r\/.+/);
        await expect(page.locator('[data-testid="reader-layout"]')).toBeVisible();
      }
    });
  });
});
