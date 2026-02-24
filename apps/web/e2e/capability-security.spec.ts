/**
 * E2E Tests for Capability Security
 *
 * Tests:
 * - Capability keys are not exposed in error messages
 * - Referrer policy prevents key leakage
 * - Invalid keys return 404 (not 403) to prevent information disclosure
 */

import { test, expect, TEST_KEYS, BACKEND_URL, FRONTEND_URL } from './fixtures';

test.describe('Capability Security', () => {
  test('invalid key UI offers a home recovery action', async ({ page }) => {
    const fakeKey = 'r_invalidKey123456789';

    await page.goto(`${FRONTEND_URL}/r/${fakeKey}`, { waitUntil: 'networkidle' });

    await expect(page.locator('[data-testid="not-found"]')).toBeVisible();
    const homeLink = page.locator('a[href="/"]').filter({ hasText: /^go home$/i });
    await expect(homeLink).toBeVisible();
  });

  test('should return 404 for invalid capability keys (not 403)', async ({ page }) => {
    const fakeKey = 'r_invalidKey123456789';
    const response = await page.request.get(`${BACKEND_URL}/r/${fakeKey}/folders`);

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error?.code).toBe('INVALID_KEY');
    expect(data.error?.message).not.toContain(fakeKey);
  });

  test('should not expose keys in error responses', async ({ page }) => {
    const fakeKey = 'w_sensitiveKey123456';
    const response = await page.request.put(`${BACKEND_URL}/w/${fakeKey}/test.md`, {
      data: { content: 'test' },
    });

    const data = await response.json();

    const responseText = JSON.stringify(data);
    expect(responseText).not.toContain(fakeKey);
    expect(responseText).not.toContain('sensitiveKey');
  });

  test('capability page should have security headers', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}`, { waitUntil: 'networkidle' });

    const response = await page.request.get(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}`);
    const headers = response.headers();

    expect(headers['referrer-policy'] || headers['Referrer-Policy']).toBeTruthy();

    expect(headers['x-frame-options'] || headers['X-Frame-Options']).toBeTruthy();

    expect(headers['x-content-type-options'] || headers['X-Content-Type-Options']).toBeTruthy();

    expect(headers['x-xss-protection'] || headers['X-XSS-Protection']).toBeUndefined();
  });

  test('should not log capability keys to console', async ({ page }) => {
    const consoleMessages: string[] = [];

    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    await page.goto(`${FRONTEND_URL}/r/${TEST_KEYS.readKey}`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="reader-layout"]')).toBeVisible();

    const allMessages = consoleMessages.join(' ');
    expect(allMessages).not.toContain(TEST_KEYS.readKey);
    expect(allMessages).not.toContain(TEST_KEYS.writeKey);
    expect(allMessages).not.toContain(TEST_KEYS.appendKey);
  });
});
