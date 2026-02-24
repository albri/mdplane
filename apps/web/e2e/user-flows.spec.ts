import { publicTest, authenticatedTest, expect, TEST_KEYS, BACKEND_URL } from './fixtures'

publicTest.describe('Bootstrap Flow', () => {
  publicTest('should load home page with plane chooser', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'mdplane' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open Workspace/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open Control/i })).toBeVisible();
  });

  publicTest('should navigate to launcher from workspace button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Open Workspace/i }).click();
    await expect(page).toHaveURL(/\/launch/);
    await expect(page.getByRole('heading', { name: 'Workspace Launcher' })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to home/i })).toHaveCount(0);
  });

  publicTest('should resume to last workspace from home when recent URL exists', async ({ page }) => {
    await page.addInitScript(([readKey]) => {
      localStorage.setItem(
        'mdplane_recent_workspace_urls',
        JSON.stringify({
          saveEnabled: true,
          urls: [
            {
              url: `/r/${readKey}/docs/getting-started.md`,
              label: 'R key: recent...',
              addedAt: '2026-02-08T12:00:00.000Z',
            },
          ],
        }),
      );
    }, [TEST_KEYS.readKey]);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Resume Last Workspace/i }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${TEST_KEYS.readKey}/docs/getting-started\\.md$`));
    await expect(page.locator('article h1#getting-started')).toBeVisible();
  });

  publicTest('should preserve deep capability path when opening URL from launcher', async ({ page }) => {
    await page.goto('/launch');
    await page.waitForLoadState('networkidle');

    const deepPath = `/r/${TEST_KEYS.readKey}/docs/getting-started.md`;
    await page.getByPlaceholder(/capability url or key/i).fill(deepPath);
    await page.getByRole('button', { name: /open workspace/i }).click();

    await expect(page).toHaveURL(new RegExp(`/r/${TEST_KEYS.readKey}/docs/getting-started\\.md$`));
    await expect(page.locator('article h1#getting-started')).toBeVisible();
    await expect(page.locator('article h2#quick-start')).toBeVisible();
  });

  publicTest('should preserve deep capability path from absolute URL in launcher', async ({ page }) => {
    await page.goto('/launch');
    await page.waitForLoadState('networkidle');

    const absoluteUrl = `http://127.0.0.1:3000/r/${TEST_KEYS.readKey}/docs/getting-started.md?view=raw`;
    await page.getByPlaceholder(/capability url or key/i).fill(absoluteUrl);
    await page.getByRole('button', { name: /open workspace/i }).click();

    await expect(page).toHaveURL(
      new RegExp(`/r/${TEST_KEYS.readKey}/docs/getting-started\\.md\\?view=raw$`),
    );
    await expect(page.locator('article h1#getting-started')).toBeVisible();
    await expect(page.locator('article h2#quick-start')).toBeVisible();
  });

  publicTest('should reject short manual capability keys in launcher', async ({ page }) => {
    await page.goto('/launch');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder(/capability url or key/i).fill('short-key');
    await page.getByRole('button', { name: /open workspace/i }).click();

    await expect(page.getByText(/at least 22 characters/i)).toBeVisible();
    await expect(page).toHaveURL(/\/launch$/);
  });

  publicTest('should reject traversal suffix in pasted capability URL', async ({ page }) => {
    await page.goto('/launch');
    await page.waitForLoadState('networkidle');

    await page
      .getByPlaceholder(/capability url or key/i)
      .fill(`/r/${TEST_KEYS.readKey}/../../control`);
    await page.getByRole('button', { name: /open workspace/i }).click();

    await expect(page.getByText('Path traversal is not allowed in capability URL')).toBeVisible();
    await expect(page).toHaveURL(/\/launch$/);
  });

  publicTest('should create workspace via bootstrap API', async ({ request }) => {
    // Test the bootstrap API endpoint - hits backend directly
    const response = await request.post(`${BACKEND_URL}/bootstrap`, {
      data: {
        workspaceName: `e2e-bootstrap-${Date.now()}`,
      },
    });

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.workspaceId).toBeDefined();
    // New bootstrap response structure (Phase 1 refactor)
    expect(data.data.keys.read).toBeDefined();
    expect(data.data.keys.append).toBeDefined();
    expect(data.data.keys.write).toBeDefined();
    expect(data.data.urls.api.read).toBeDefined();
    expect(data.data.urls.web.read).toBeDefined();
    expect(data.data.urls.web.claim).toBeDefined();
    expect(data.data.createdAt).toBeDefined();
  });
});

publicTest.describe('File Operations via API', () => {
  publicTest('should list files in workspace', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.items).toBeInstanceOf(Array);
  });

  publicTest('should read file content', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/README.md`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toBeDefined();
  });

  publicTest('should create and read file', async ({ request }) => {
    const testPath = `/e2e-flow-test-${Date.now()}.md`;

    const createResponse = await request.put(`${BACKEND_URL}/w/${TEST_KEYS.writeKey}${testPath}`, {
      data: { content: '# Flow Test\n\nCreated by E2E flow test.' },
    });
    expect(createResponse.status()).toBe(201);

    const readResponse = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}${testPath}`);
    expect(readResponse.status()).toBe(200);

    const data = await readResponse.json();
    expect(data.data.content).toContain('# Flow Test');
  });
});

authenticatedTest.describe('Control Navigation', () => {
  authenticatedTest('should navigate to orchestration page', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/orchestration`);

    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /^orchestration$/i })).toBeVisible();
  });

  authenticatedTest('should navigate to webhooks page', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/webhooks`);

    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Webhooks' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Create Webhook/i }).first()).toBeVisible()
  });

  authenticatedTest('should navigate to API keys page', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);

    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create API Key/i }).first()).toBeVisible();
  });
});

publicTest.describe('Error Handling', () => {
  publicTest('should return 404 for invalid capability key', async ({ request }) => {
    // Per capability URL security model: return 404 to prevent key enumeration
    const response = await request.get(`${BACKEND_URL}/r/invalid-key-that-does-not-exist/folders`);

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INVALID_KEY');
  });

  publicTest('should return 404 for non-existent file', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/nonexistent-file-12345.md`);

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(String(data.error.code)).toMatch(/FILE_NOT_FOUND|NOT_FOUND/i);
  });
});


