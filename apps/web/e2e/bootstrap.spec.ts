import { publicTest, expect, FRONTEND_URL, BACKEND_URL } from './fixtures';

/**
 * Bootstrap E2E Tests
 *
 * Tests for the bootstrap page that creates new workspaces.
 * This page does NOT require authentication - the whole point of mdplane
 * is capability URLs where auth is embedded in the URL itself.
 *
 * Expected flow:
 * 1. User visits /bootstrap (no auth required)
 * 2. User enters a workspace name
 * 3. Workspace is created via API
 * 4. User sees read/append/write keys once
 * 5. User clicks continue to open /r/{readKey}
 *
 * See: ROUTE-AUDIT-FINDINGS/03a-bootstrap-landing-page-migration.md
 */

publicTest.describe('Bootstrap Page', () => {
  publicTest('should require workspace name before creation', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/bootstrap`);

    await expect(page.getByLabel(/workspace name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create workspace/i })).toBeDisabled();
  });

  publicTest('should create workspace and show all root keys', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/bootstrap`);

    await page.getByLabel(/workspace name/i).fill(`e2e-bootstrap-${Date.now()}`);
    await page.getByRole('button', { name: /create workspace/i }).click();

    await expect(page.getByText('Workspace created')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/read key/i)).toBeVisible();
    await expect(page.getByText(/append key/i)).toBeVisible();
    await expect(page.getByText(/write key/i)).toBeVisible();
    await expect(page.getByText(/shown once/i)).toBeVisible();
    await expect(page.getByTestId('continue-to-workspace')).toBeVisible();
  });

  publicTest('should navigate to runtime read URL on continue button click', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/bootstrap`);

    await page.getByLabel(/workspace name/i).fill(`e2e-bootstrap-${Date.now()}`);
    await page.getByRole('button', { name: /create workspace/i }).click();
    await expect(page.getByText('Workspace created')).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId('continue-to-workspace')).toBeDisabled();
    await page.getByText(/i have saved these keys securely/i).click();
    await expect(page.getByTestId('continue-to-workspace')).toBeEnabled();
    await page.getByTestId('continue-to-workspace').click();

    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]+/, { timeout: 10000 });
    await expect(page.locator('body')).not.toContainText(/sign in|log in/i);
  });

  publicTest('should reveal masked key when eye icon clicked', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/bootstrap`);

    await page.getByLabel(/workspace name/i).fill(`e2e-bootstrap-${Date.now()}`);
    await page.getByRole('button', { name: /create workspace/i }).click();
    await expect(page.getByText('Workspace created')).toBeVisible({ timeout: 15000 });

    const keyReveal = page.getByTestId('key-reveal').first();
    const codeElement = keyReveal.locator('code');
    const maskedText = await codeElement.textContent();
    expect(maskedText).toContain('•');

    await keyReveal.getByRole('button', { name: /reveal key/i }).click();

    const revealedText = await codeElement.textContent();
    expect(revealedText).not.toMatch(/^•+/);
  });

  publicTest('should show error state on API failure', async ({ page }) => {
    // Note: Mocking is acceptable for error state testing because we can't
    // easily trigger a real 500 error from the backend
    await page.route(`${BACKEND_URL}/bootstrap`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Test error message',
          },
        }),
      });
    });

    await page.goto(`${FRONTEND_URL}/bootstrap`);
    await page.getByLabel(/workspace name/i).fill('error-case');
    await page.getByRole('button', { name: /create workspace/i }).click();

    await expect(page.getByText("Couldn't create workspace")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Test error message')).toBeVisible();

    const retryButton = page.getByRole('button', { name: /try again/i });
    await expect(retryButton).toBeVisible();
    await expect(page.getByRole('link', { name: /back to control/i })).toBeVisible();
  });

  publicTest('should retry on error button click and show success state', async ({ page }) => {
    let requestCount = 0;

    // Mock the bootstrap API to fail first, then let it through to real backend
    // Note: Mocking is acceptable for error state testing
    await page.route(`${BACKEND_URL}/bootstrap`, async (route) => {
      requestCount++;
      if (requestCount === 1) {
        // First request fails (simulated error)
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Temporary error',
            },
          }),
        });
      } else {
        // Let subsequent requests go to the real backend
        await route.continue();
      }
    });

    await page.goto(`${FRONTEND_URL}/bootstrap`);
    await page.getByLabel(/workspace name/i).fill('retry-case');
    await page.getByRole('button', { name: /create workspace/i }).click();

    // Wait for error state (using BootstrapError component)
    await expect(page.getByText("Couldn't create workspace")).toBeVisible({ timeout: 5000 });

    // Click retry button
    const retryButton = page.getByRole('button', { name: /try again/i });
    await retryButton.click();

    // Retry returns to form; submit again
    await expect(page.getByLabel(/workspace name/i)).toHaveValue('retry-case');
    await page.getByRole('button', { name: /create workspace/i }).click();

    // Should now show success state with a real workspace key
    await expect(page.getByText('Workspace created')).toBeVisible({ timeout: 15000 });

    // The key reveal should show a real key (not empty)
    const keyReveal = page.getByTestId('key-reveal').first();
    await keyReveal.getByRole('button', { name: /reveal key/i }).click();
    const keyText = await keyReveal.locator('code').textContent();
    expect(keyText).toBeTruthy();
    expect(keyText!.length).toBeGreaterThan(10);
  });
});

