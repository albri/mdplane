import { test, expect } from '@playwright/test';
import { TEST_KEYS, BACKEND_URL } from './fixtures';

/**
 * Security regression tests for Next route handlers under:
 * - /api/capability/r/[key]
 * - /api/capability/r/[key]/[...path]
 */

test.describe('Capability Proxy Security', () => {
  test('should reject path traversal attempts', async ({ request }) => {
    const healthResponse = await request.get(`${BACKEND_URL}/health`);
    expect(healthResponse.ok()).toBe(true);
    const healthText = await healthResponse.text();

    // Use %2e%2e so the client does not normalize the path before sending.
    const response = await request.get(
      `/api/capability/r/${TEST_KEYS.readKey}/%2e%2e/health`
    );

    // Must not be able to reach backend /health through this proxy.
    expect(response.status()).not.toBe(200);

    const text = await response.text();
    expect(text).not.toBe(healthText);

    // If the request reaches the handler, it should return a structured 400.
    if (response.status() === 400) {
      const body = JSON.parse(text);
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe('INVALID_PATH');
    }
  });

  test('should proxy valid capability reads', async ({ request }) => {
    const response = await request.get(
      `/api/capability/r/${TEST_KEYS.readKey}/README.md`
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data?.content).toContain('E2E Test Workspace');
  });
});
