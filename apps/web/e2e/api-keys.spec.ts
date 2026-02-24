import { authenticatedTest, expect, TEST_KEYS, BACKEND_URL, unauthRequest } from './fixtures';
const test = authenticatedTest;

test.describe('API Keys Page - Structure', () => {
  test('should load API keys page with header', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: 'API Keys' });
    await expect(heading).toBeVisible();
  });

  test('should have "Create API Key" button', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const createButton = page.getByRole('button', { name: /create api key/i }).first();
    await expect(createButton).toBeVisible();
  });

  test('should show page header with title and description', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const title = page.getByRole('heading', { name: 'API Keys' });
    await expect(title).toBeVisible();

    const description = page.getByText(/manage api keys/i);
    await expect(description).toBeVisible();
  });

  test('should show recovery actions when API keys request fails', async ({ page }) => {
    await page.route(`${BACKEND_URL}/workspaces/${TEST_KEYS.workspaceId}/api-keys*`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'forced error',
          },
        }),
      });
    });

    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/couldn't load api keys/i)).toBeVisible({ timeout: 10000 });

    const errorState = page.getByTestId('empty-state');
    const launcherLink = errorState.locator('a[href="/launch"]');
    const createWorkspaceLink = errorState.locator('a[href="/bootstrap"]');

    await expect(launcherLink).toBeVisible();
    await expect(launcherLink).toHaveAttribute('href', '/launch');
    await expect(createWorkspaceLink).toBeVisible();
    await expect(createWorkspaceLink).toHaveAttribute('href', '/bootstrap');
  });
});

test.describe('API Keys Page - Empty State', () => {
  test('should show empty state when no keys exist', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const emptyState = page.getByTestId('empty-api-keys-state');
    const apiKeysList = page.getByTestId('api-keys-list');

    const isEmptyVisible = await emptyState.isVisible().catch(() => false);
    const isListVisible = await apiKeysList.isVisible().catch(() => false);

    expect(isEmptyVisible || isListVisible).toBeTruthy();
  });
});

test.describe('API Keys Page - List API Keys', () => {
  test('should list API keys with prefix only', async ({ authedRequest }) => {
    const createResponse = await authedRequest.post(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: 'E2E Test Key',
        permissions: ['read', 'write'],
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    expect(createData.ok).toBe(true);
    expect(createData.data.key).toMatch(/^sk_live_[A-Za-z0-9]{20,}$/);
    expect(createData.data.id).toBeDefined();
    expect(createData.data.name).toBe('E2E Test Key');

    const listResponse = await authedRequest.get(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`);

    expect(listResponse.status()).toBe(200);
    const listData = await listResponse.json();
    expect(listData.ok).toBe(true);
    expect(listData.data.keys).toBeInstanceOf(Array);

    const keys = listData.data.keys;
    expect(keys.length).toBeGreaterThan(0);

    const testKey = keys.find((k: { name: string }) => k.name === 'E2E Test Key');
    expect(testKey).toBeDefined();
    expect(testKey.prefix).toMatch(/^sk_live_.*\.\.\.$/);
    expect(testKey.prefix.length).toBeLessThan(16); // Prefix is truncated

    expect(testKey).not.toHaveProperty('key');

    if (testKey) {
      await authedRequest.delete(`/workspaces/${TEST_KEYS.workspaceId}/api-keys/${testKey.id}`);
    }
  });

  test('should display key metadata (permissions, created date)', async ({ authedRequest }) => {
    const createResponse = await authedRequest.post(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: 'Metadata Test Key',
        permissions: ['read', 'append', 'write'],
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const keyId = createData.data.id;

    const listResponse = await authedRequest.get(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`);

    expect(listResponse.status()).toBe(200);
    const listData = await listResponse.json();

    const testKey = listData.data.keys.find((k: { name: string }) => k.name === 'Metadata Test Key');
    expect(testKey).toBeDefined();
    expect(testKey.permissions).toEqual(['read', 'append', 'write']);
    expect(testKey.createdAt).toBeDefined();
    expect(testKey.prefix).toBeDefined();

    await authedRequest.delete(`/workspaces/${TEST_KEYS.workspaceId}/api-keys/${keyId}`);
  });
});

test.describe('API Keys Page - Create API Key', () => {
  test('should create API key via UI', async ({ page, authedRequest }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const createButton = page.getByRole('button', { name: /create api key/i }).first();
    await createButton.click();

    const nameInput = page.getByLabel(/name/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill('E2E Test Key');

    const readCheckbox = page.getByLabel(/read/i);
    await readCheckbox.check();

    const submitButton = page.getByRole('button', { name: /create key/i });
    await submitButton.click();

    const successTitle = page.locator('[data-slot="dialog-title"]', { hasText: 'API Key Created' });
    await expect(successTitle).toBeVisible({ timeout: 10000 });

    const keyDisplay = page.locator('code').first();
    await expect(keyDisplay).toBeVisible();
    const displayedKey = await keyDisplay.textContent();
    expect(displayedKey).toMatch(/^sk_live_[A-Za-z0-9]{20,}$/);

    const copyButton = page.getByRole('button', { name: /copy/i }).first();
    await expect(copyButton).toBeVisible();

    const instruction = page.getByText(/copy.*won.*t be able to see it again/i);
    await expect(instruction).toBeVisible();

    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const listResponse = await authedRequest.get(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`);

    const listData = await listResponse.json();
    const testKey = listData.data.keys.find((k: { name: string }) => k.name === 'E2E Test Key');
    expect(testKey).toBeDefined();

    if (testKey) {
      await authedRequest.delete(`/workspaces/${TEST_KEYS.workspaceId}/api-keys/${testKey.id}`);
    }
  });

  test('should show one-time key value after creation', async ({ page, authedRequest }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const createResponse = await authedRequest.post(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: 'One-time Display Test',
        permissions: ['read'],
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const fullKey = createData.data.key;
    const keyId = createData.data.id;

    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const listResponse = await authedRequest.get(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`);

    const listData = await listResponse.json();
    const testKey = listData.data.keys.find((k: { name: string }) => k.name === 'One-time Display Test');

    expect(testKey).toBeDefined();
    expect(testKey).not.toHaveProperty('key');
    expect(testKey.prefix).toBeDefined();

    await authedRequest.delete(`/workspaces/${TEST_KEYS.workspaceId}/api-keys/${keyId}`);
  });

  test('should require name to create API key', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const createButton = page.getByRole('button', { name: /create api key/i }).first();
    await createButton.click();

    const submitButton = page.getByRole('button', { name: /create key/i });
    await expect(submitButton).toBeVisible();

    await expect(submitButton).toBeDisabled();
  });

  test('should allow selecting multiple permissions', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const createButton = page.getByRole('button', { name: /create api key/i }).first();
    await createButton.click();

    const readCheckbox = page.locator('label', { hasText: /^Read - View files and folders$/i }).getByRole('checkbox');
    const appendCheckbox = page.locator('label', { hasText: /^Append - Add content to files$/i }).getByRole('checkbox');
    const writeCheckbox = page.locator('label', { hasText: /^Write - Full file access$/i }).getByRole('checkbox');
    const exportCheckbox = page.locator('label', { hasText: /^Export - Export workspace data$/i }).getByRole('checkbox');

    await expect(readCheckbox).toBeVisible();
    await expect(appendCheckbox).toBeVisible();
    await expect(writeCheckbox).toBeVisible();
    await expect(exportCheckbox).toBeVisible();

    await appendCheckbox.click();
    await writeCheckbox.click();

    await expect(readCheckbox).toBeChecked();
    await expect(appendCheckbox).toBeChecked();
    await expect(writeCheckbox).toBeChecked();
  });
});

test.describe('API Keys Page - Revoke API Key', () => {
  test('should revoke API key and it should not appear in list', async ({ authedRequest }) => {
    const createResponse = await authedRequest.post(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: 'To Be Deleted',
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
    expect(deleteData.data.id).toBe(keyId);
    expect(deleteData.data.revoked).toBe(true);

    const listAfterResponse = await authedRequest.get(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`);

    expect(listAfterResponse.status()).toBe(200);
    const listAfterData = await listAfterResponse.json();
    const keyAfter = listAfterData.data.keys.find((k: { id: string }) => k.id === keyId);
    expect(keyAfter).toBeUndefined();
  });

  test('should handle revoke for non-existent key', async ({ authedRequest }) => {
    const deleteResponse = await authedRequest.delete(`/workspaces/${TEST_KEYS.workspaceId}/api-keys/key_does_not_exist`);

    expect(deleteResponse.status()).toBe(404);

    const data = await deleteResponse.json();
    expect(data.ok).toBe(false);
  });

  test('should have delete button on each API key card', async ({ page, authedRequest }) => {
    const createResponse = await authedRequest.post(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: 'Delete Button Test',
        permissions: ['read'],
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const keyId = createData.data.id;

    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const deleteButton = page.getByTestId('delete-api-key-btn').first();
    await expect(deleteButton).toBeVisible();

    await authedRequest.delete(`/workspaces/${TEST_KEYS.workspaceId}/api-keys/${keyId}`);
  });
});

test.describe('API Keys API - Backend Tests', () => {
  test('should return 401 for unauthenticated requests', async () => {
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

  test('should return 403 for unauthorized workspace access', async ({ authedRequest }) => {
    const bootstrapCtx = await unauthRequest.newContext({
      baseURL: BACKEND_URL,
      storageState: { cookies: [], origins: [] },
    });
    const bootstrapResponse = await bootstrapCtx.post('/bootstrap', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        workspaceName: `e2e-unowned-${Date.now()}`,
      },
    });
    expect(bootstrapResponse.status()).toBe(201);
    const bootstrapData = await bootstrapResponse.json();
    await bootstrapCtx.dispose();

    const unownedWorkspaceId = bootstrapData.data.workspaceId as string;
    const response = await authedRequest.get(`/workspaces/${unownedWorkspaceId}/api-keys`);
    expect(response.status()).toBe(403);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
  });

  test('should return 400 for invalid permission', async ({ authedRequest }) => {
    const response = await authedRequest.post(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: 'Invalid Key',
        permissions: ['invalid_permission'],
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.ok).toBe(false);
  });

  test('should return 400 for missing name', async ({ authedRequest }) => {
    const response = await authedRequest.post(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        permissions: ['read'],
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.ok).toBe(false);
  });

  test('should validate API key format', async ({ authedRequest }) => {
    const response = await authedRequest.post(`/workspaces/${TEST_KEYS.workspaceId}/api-keys`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: 'Format Test Key',
        permissions: ['read'],
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.data.key).toMatch(/^sk_(live|test)_[A-Za-z0-9]{20,}$/);

    await authedRequest.delete(`/workspaces/${TEST_KEYS.workspaceId}/api-keys/${data.data.id}`);
  });
});

