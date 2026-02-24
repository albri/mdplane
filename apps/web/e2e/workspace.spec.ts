/**
 * E2E Tests for Workspace Routing
 *
 * Tests:
 * - /control resolves to /control/{workspaceId}
 * - Workspace-scoped pages use path segments
 * - Legacy unscoped routes are hard-cut
 */

import { test, expect, FRONTEND_URL, TEST_KEYS } from './fixtures';
import { BACKEND_URL } from './fixtures';

async function createClaimedWorkspace(
  page: import('@playwright/test').Page,
  authedRequest: import('@playwright/test').APIRequestContext,
) {
  const bootstrapResponse = await page.request.post(`${BACKEND_URL}/bootstrap`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `10.23.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
    data: { workspaceName: `e2e-ws-routing-${Date.now()}` },
  });

  expect(bootstrapResponse.status()).toBe(201);
  const bootstrapJson = await bootstrapResponse.json() as {
    ok: boolean;
    data?: {
      workspaceId: string;
      keys: { write: string };
    };
  };
  expect(bootstrapJson.ok).toBe(true);
  expect(bootstrapJson.data?.workspaceId).toBeTruthy();
  expect(bootstrapJson.data?.keys.write).toBeTruthy();

  const claimResponse = await authedRequest.post(`/w/${bootstrapJson.data!.keys.write}/claim`, { data: {} });
  expect([200, 400]).toContain(claimResponse.status());

  return bootstrapJson.data!.workspaceId;
}

test.describe('Workspace Routing', () => {
  test('should resolve /control to selected workspace path', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/control`, { waitUntil: 'networkidle' });

    await expect(page).toHaveURL(/\/control\/ws_[^/]+$/);
  });

  test('should load orchestration from workspace-scoped path', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/control/${TEST_KEYS.workspaceId}/orchestration`, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Orchestration/i })).toBeVisible();
  });

  test('should ignore invalid last-workspace cookie and resolve to a claimed workspace', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'mdplane_last_workspace_id',
        value: 'ws_invalid_workspace',
        url: FRONTEND_URL,
      },
    ]);

    await page.goto(`${FRONTEND_URL}/control`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/control\/ws_[^/]+$/);
  });

  test('should hard-cut legacy unscoped control route', async ({ page }) => {
    const response = await page.goto(`${FRONTEND_URL}/control/api-keys`, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(404);
  });

  test('should honor a valid last-workspace cookie when resolving /control', async ({ page, authedRequest }) => {
    const secondWorkspaceId = await createClaimedWorkspace(page, authedRequest);

    await page.context().addCookies([
      {
        name: 'mdplane_last_workspace_id',
        value: secondWorkspaceId,
        url: FRONTEND_URL,
      },
    ]);

    await page.goto(`${FRONTEND_URL}/control`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`/control/${secondWorkspaceId}$`));
  });

  test('should switch workspace and then resolve /control to the selected workspace from cookie', async ({ page, authedRequest }) => {
    const secondWorkspaceId = await createClaimedWorkspace(page, authedRequest);

    await page.goto(`${FRONTEND_URL}/control/${TEST_KEYS.workspaceId}`, { waitUntil: 'networkidle' });
    await page.getByLabel('Select workspace').click();
    await page.getByTestId('workspace-switcher-option').filter({ hasText: secondWorkspaceId }).first().click();

    await expect(page).toHaveURL(new RegExp(`/control/${secondWorkspaceId}$`));

    await page.goto(`${FRONTEND_URL}/control`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`/control/${secondWorkspaceId}$`));
  });

  test('workspace switcher should expose listbox semantics and keyboard-select a workspace', async ({
    page,
    authedRequest,
  }) => {
    const secondWorkspaceId = await createClaimedWorkspace(page, authedRequest);

    await page.goto(`${FRONTEND_URL}/control/${TEST_KEYS.workspaceId}`, { waitUntil: 'networkidle' });

    const trigger = page.getByLabel('Select workspace');
    await trigger.focus();
    await page.keyboard.press('Enter');

    const listbox = page.getByRole('listbox', { name: 'Workspace options' });
    await expect(listbox).toBeVisible();

    const option = listbox.getByRole('option', { name: secondWorkspaceId }).first();
    await expect(option).toBeVisible();
    await option.focus();
    await expect(option).toBeFocused();
    await option.press('Enter');

    await expect(page).toHaveURL(new RegExp(`/control/${secondWorkspaceId}$`));
  });

});
