import { authenticatedTest, publicTest, expect, TEST_KEYS, BACKEND_URL, FRONTEND_URL } from './fixtures';

publicTest.describe('Control Access', () => {
  publicTest('should redirect to login when not authenticated', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(`${FRONTEND_URL}/control`);

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    await ctx.close();
  });
});

authenticatedTest.describe('Logout Flow', () => {
  authenticatedTest('should logout and redirect to login page', async ({ page, browser }) => {
    await page.goto('/control');

    const accountMenuButton = page.getByRole('button', { name: /open account menu/i });
    await expect(accountMenuButton).toBeVisible();
    await accountMenuButton.click();

    const signOutButton = page.getByRole('button', { name: /sign out/i });
    await expect(signOutButton).toBeVisible();
    await signOutButton.focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/login|^\/$/, { timeout: 10000 });

    const freshContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const freshPage = await freshContext.newPage();

    await freshPage.goto(`${FRONTEND_URL}/control`);
    await expect(freshPage).toHaveURL(/\/login/, { timeout: 10000 });

    await freshContext.close();
  });

  authenticatedTest('should show Sign out button in sidebar', async ({ page }) => {
    await page.goto('/control');

    const accountMenuButton = page.getByRole('button', { name: /open account menu/i });
    await expect(accountMenuButton).toBeVisible();
    await accountMenuButton.click();

    const signOutButton = page.getByRole('button', { name: /sign out/i });
    await expect(signOutButton).toBeVisible();

    const buttonWithIcon = signOutButton.locator('svg');
    await expect(buttonWithIcon).toBeVisible();
  });
});

authenticatedTest.describe('Control Access (Authenticated)', () => {
  authenticatedTest('should load control page structure', async ({ page }) => {
    await page.goto('/control');
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(['Welcome']).toContain(headingText);
  });

  authenticatedTest('should show workspace launcher label in workspace nav section', async ({ page }) => {
    await page.goto('/control');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: /^workspace launcher$/i }).first()).toBeVisible();
  });

  authenticatedTest('should show control onboarding cards in welcome state', async ({ page }) => {
    await page.route('**/workspaces/*/orchestration*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            claims: [],
          },
        }),
      });
    });

    await page.goto(`/control/${TEST_KEYS.workspaceId}`);
    await page.waitForLoadState('networkidle');

    const welcomeState = page.getByTestId('control-welcome-state');

    await expect(page.getByRole('heading', { name: /^welcome$/i })).toBeVisible();
    await expect(welcomeState.getByText('Workspace Launcher', { exact: true })).toBeVisible();
    await expect(welcomeState.getByText('Orchestration', { exact: true })).toBeVisible();
    await expect(welcomeState.getByRole('button', { name: /open launcher/i })).toBeVisible();
    await expect(welcomeState.getByRole('button', { name: /open orchestration/i })).toBeVisible();
  });

  authenticatedTest('should open and close control drawer on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/control');
    await page.waitForLoadState('networkidle');

    const trigger = page.getByRole('button', { name: /toggle menu/i });
    await expect(trigger).toBeVisible();
    await trigger.click();

    await expect(page.locator('#app-sidebar-mobile')).toBeVisible();
    await expect(page.locator('#app-sidebar-mobile').getByRole('link', { name: /welcome/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#app-sidebar-mobile')).toBeHidden();
  });

  authenticatedTest('should show recovery actions when control overview request fails', async ({ page }) => {
    await page.route('**/workspaces/*/orchestration*', async (route) => {
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

    await page.goto(`/control/${TEST_KEYS.workspaceId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/couldn't load workspace activity/i)).toBeVisible({ timeout: 10000 });

    const launcherButton = page.getByRole('button', { name: /^workspace launcher$/i });
    await expect(launcherButton).toBeVisible();
  });
});

authenticatedTest.describe('Control API Keys Page', () => {
  authenticatedTest('should load API keys page with header and action', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/api-keys`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: 'API Keys' });
    await expect(heading).toBeVisible();

    await expect(page.getByText(/manage api keys/i)).toBeVisible();

    await expect(page.getByRole('button', { name: /create api key/i }).first()).toBeVisible();
  });
});

authenticatedTest.describe('Control Webhooks Page', () => {
  authenticatedTest('should load webhooks page and show create action', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/webhooks`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: 'Webhooks' });
    await expect(heading).toBeVisible();

    await expect(page.getByText(/outbound events/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create webhook/i }).first()).toBeVisible();
  });

  authenticatedTest('should create webhook through control UI and persist via workspace endpoint', async ({
    page,
    authedRequest,
    workspaceId,
  }) => {
    const webhookUrl = `https://example.com/e2e-control-${Date.now()}`;
    const parsedWebhookUrl = new URL(webhookUrl);
    const endpointLabel = parsedWebhookUrl.host + parsedWebhookUrl.pathname;

    await page.goto(`/control/${TEST_KEYS.workspaceId}/webhooks`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^create webhook$/i }).first().click();
    await page.getByPlaceholder('https://your-server.com/webhook').fill(webhookUrl);
    await page.getByText('File Created').click();
    await page.getByRole('dialog').getByRole('button', { name: /^create webhook$/i }).click();

    await expect(page.getByText(endpointLabel)).toBeVisible({ timeout: 10000 });

    const listResponse = await authedRequest.get(`${BACKEND_URL}/workspaces/${workspaceId}/webhooks`);
    expect(listResponse.status()).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect((listBody.data as Array<{ url: string }>).some((item) => item.url === webhookUrl)).toBe(true);
  });

  authenticatedTest('should show recovery actions when webhooks request fails', async ({ page }) => {
    await page.route('**/workspaces/*/webhooks*', async (route) => {
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

    await page.goto(`/control/${TEST_KEYS.workspaceId}/webhooks`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/couldn't load webhooks/i)).toBeVisible({ timeout: 10000 });

    const launcherButton = page.getByRole('button', { name: /^workspace launcher$/i });
    await expect(launcherButton).toBeVisible();
  });
});

authenticatedTest.describe('API Health Check', () => {
  authenticatedTest('should respond to health check endpoint', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/health`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe('healthy');
  });
});

authenticatedTest.describe('Capability URL API Access', () => {
  authenticatedTest('should access folder listing via read key', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.items).toBeInstanceOf(Array);
  });

  authenticatedTest('should list seeded test files', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    const items = data.data.items as Array<{ name: string; type: string }>;
    const names = items.map((item) => item.name);
    expect(names).toContain('README.md');
  });

  authenticatedTest('should read file content via read key', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/README.md`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toContain('E2E Test Workspace');
  });

  authenticatedTest('should reject invalid capability key', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/invalid-key-12345678901234/folders`);
    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INVALID_KEY');
  });
});


