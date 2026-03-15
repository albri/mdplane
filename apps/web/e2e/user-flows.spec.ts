import { publicTest, authenticatedTest, expect, TEST_KEYS, BACKEND_URL } from './fixtures'

publicTest.describe('Bootstrap Flow', () => {
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


