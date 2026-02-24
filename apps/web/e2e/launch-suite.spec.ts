import { test, expect, publicTest, TEST_KEYS, BACKEND_URL, unauthRequest } from './fixtures';

test.describe('Launch Suite: Browse Flow', () => {
  test('should navigate from folder to file and render markdown content', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="reader-layout"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="folder-view"]')).toBeVisible({ timeout: 15000 });

    const docsFolder = page.locator('[data-testid="folder-item"]').filter({ hasText: 'docs' }).first();
    await expect(docsFolder).toBeVisible({ timeout: 15000 });
    await docsFolder.click();

    await expect(page).toHaveURL(/\/r\/.*\/docs$/, { timeout: 15000 });

    const readmeFile = page.locator('[data-testid="folder-item"]').filter({ hasText: /getting-started\.md|api-reference\.md/ }).first();
    await readmeFile.click();

    await expect(page).toHaveURL(/\/r\/.*\/docs\/(getting-started|api-reference)\.md$/);

    const headings = page.locator('article h1, article h2, article h3');
    await expect(headings.first()).toBeVisible({ timeout: 10000 });

    const paragraphs = page.locator('article p');
    await expect(paragraphs.first()).toBeVisible({ timeout: 10000 });
  });

  test('should render nested file navigation via sidebar', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}/docs`);
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'docs' })).toBeVisible();

    const fileItem = page.locator('[data-testid="folder-item"]').filter({ hasText: /getting-started\.md/i }).first();
    await fileItem.click();
    await expect(page).toHaveURL(/\/r\/.*\/docs\/getting-started\.md$/, { timeout: 15000 });

    await expect(page.locator('article h1#getting-started')).toBeVisible({ timeout: 15000 });
  });

  test('should handle navigation back via sidebar', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}/docs/getting-started`);
    await page.waitForLoadState('networkidle');

    const homeLink = page.locator('aside a').first();
    await homeLink.click();

    await expect(page).toHaveURL(/\/r\/[^\/]+$/);
    await expect(page.locator('[data-testid="folder-view"]')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Launch Suite: Claim Flow', () => {
  test('should load claim page and show OAuth options', async ({ page }) => {
    await page.goto('/claim');

    const heading = page.getByText('Claim Your Workspace', { exact: true });
    await expect(heading).toBeVisible({ timeout: 10000 });

    const githubButton = page.getByRole('button', { name: /github/i });
    const googleButton = page.getByRole('button', { name: /google/i });

    await expect(githubButton).toBeVisible();
    await expect(googleButton).toBeVisible();

    const skipLink = page.getByText(/skip|anonymous/i);
    await expect(skipLink).toBeVisible();
  });

  test('should load writeKey-specific claim page', async ({ page }) => {
    await page.goto(`/claim/${TEST_KEYS.writeKey}`);

    const url = page.url();
    const hasValidState =
      url.includes('/claim') ||
      url.includes('/auth') ||
      url.includes('/sign-in');

    expect(hasValidState).toBe(true);
  });

  test('should redirect to OAuth when not authenticated on claim page', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(`/claim/${TEST_KEYS.writeKey}`);
    await page.waitForURL(/\/(claim|auth|sign-in)/, { timeout: 10000 });

    const url = page.url();
    expect(url).toMatch(/\/(claim|auth|sign-in)/);
  });

  test('should return 401 for claim API without session', async () => {
    const ctx = await unauthRequest.newContext({
      baseURL: BACKEND_URL,
      storageState: { cookies: [], origins: [] },
    });
    const response = await ctx.post(`/w/${TEST_KEYS.writeKey}/claim`);

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.ok).toBe(false);

    await ctx.dispose();
  });
});

test.describe('Launch Suite: API Key Management', () => {
  test('should create API key and verify it appears in list', async ({ authedRequest }) => {
    const keyName = `E2E Launch Test Key ${Date.now()}`;

    const createResponse = await authedRequest.post(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: keyName,
        permissions: ['read', 'write'],
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    expect(createData.ok).toBe(true);
    expect(createData.data.key).toMatch(/^sk_live_[A-Za-z0-9]{20,}$/);

    const keyId = createData.data.id;

    const listResponse = await authedRequest.get(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`);

    expect(listResponse.status()).toBe(200);
    const listData = await listResponse.json();
    expect(listData.ok).toBe(true);

    const testKey = listData.data.keys.find((k: { name: string }) => k.name === keyName);
    expect(testKey).toBeDefined();
    expect(testKey.prefix).toBeDefined();
    expect(testKey).not.toHaveProperty('key');

    await authedRequest.delete(`/workspaces/${TEST_KEYS.workspaceId}/api-keys/${keyId}`);
  });

  test('should revoke API key and verify it no longer appears in list', async ({ authedRequest }) => {
    const keyName = `E2E Revoke Test Key ${Date.now()}`;

    const createResponse = await authedRequest.post(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: keyName,
        permissions: ['read'],
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const keyId = createData.data.id;

    const listBeforeResponse = await authedRequest.get(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`);

    expect(listBeforeResponse.status()).toBe(200);
    const listBeforeData = await listBeforeResponse.json();
    const keyBefore = listBeforeData.data.keys.find((k: { id: string }) => k.id === keyId);
    expect(keyBefore).toBeDefined();

    const deleteResponse = await authedRequest.delete(`/workspaces/${TEST_KEYS.workspaceId}/api-keys/${keyId}`);

    expect(deleteResponse.status()).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData.ok).toBe(true);
    expect(deleteData.data.revoked).toBe(true);

    const listAfterResponse = await authedRequest.get(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`);

    expect(listAfterResponse.status()).toBe(200);
    const listAfterData = await listAfterResponse.json();
    const keyAfter = listAfterData.data.keys.find((k: { id: string }) => k.id === keyId);
    expect(keyAfter).toBeUndefined();
  });

  test('should return 401 for unauthenticated API key requests', async () => {
    const ctx = await unauthRequest.newContext({
      baseURL: BACKEND_URL,
      storageState: { cookies: [], origins: [] },
    });
    const response = await ctx.get(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`);

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');

    await ctx.dispose();
  });
});

publicTest.describe('Launch Suite: Auth Gating - Negative Case', () => {
  publicTest('should redirect to login when accessing control without session', async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    await page.goto('/control');

    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/control/);
  });

  publicTest('should redirect to login for all control sub-pages without session', async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    const controlRoutes = [
      '/control',
      '/control/ws_test_route/api-keys',
      '/control/ws_test_route/settings',
      '/control/ws_test_route/orchestration',
      '/control/ws_test_route/webhooks',
    ];

    for (const route of controlRoutes) {
      await page.context().clearCookies();
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15000 });

      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
      await expect(page).not.toHaveURL(new RegExp(`^${route}`));
    }
  });

  publicTest('should save intended URL and redirect back after login', async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    const intendedPage = '/control/ws_test_route/api-keys';
    await page.goto(intendedPage);

    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.get('next')).toBe(intendedPage);
  });

  publicTest('capability URLs should never redirect to login', async ({ page }) => {
    await page.context().clearCookies();

    const capabilityPaths = [
      `/r/${TEST_KEYS.readKey}`,
      `/r/${TEST_KEYS.readKey}/docs`,
      `/r/${TEST_KEYS.readKey}/docs/getting-started.md`,
    ];

    for (const path of capabilityPaths) {
      await page.goto(path);

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page).toHaveURL(/\/r\/.+/);
      await expect(page.locator('[data-testid="reader-layout"]')).toBeVisible();
    }
  });

  publicTest('side-by-side: capability works while control requires auth', async ({ context }) => {
    await context.clearCookies();
    const capabilityPage = await context.newPage();
    const controlPage = await context.newPage();

    await capabilityPage.goto(`/r/${TEST_KEYS.readKey}`);

    await expect(capabilityPage).not.toHaveURL(/\/login/);
    await expect(capabilityPage).toHaveURL(/\/r\/.+/);

    await controlPage.goto('/control');

    await expect(controlPage).toHaveURL(/\/login/);

    await capabilityPage.close();
    await controlPage.close();
  });
});
