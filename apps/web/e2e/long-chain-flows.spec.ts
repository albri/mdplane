import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { authenticatedTest as test, expect, BACKEND_URL, TEST_KEYS } from './fixtures';

interface BootstrapResponseBody {
  ok: boolean;
  data?: {
    workspaceId: string;
    keys: {
      read: string;
      append: string;
      write: string;
    };
  };
}

interface ClaimResponseBody {
  ok: boolean;
  data?: {
    workspaceId: string;
    claimed: boolean;
  };
}

interface ErrorResponseBody {
  ok: boolean;
  error?: {
    code?: string;
    message?: string;
  };
}

interface WorkspaceSeed {
  workspaceId: string;
  workspaceName: string;
  readKey: string;
  writeKey: string;
}

async function revealKey(keyReveal: Locator): Promise<string> {
  await expect(keyReveal).toBeVisible();
  await keyReveal.getByRole('button', { name: /reveal key/i }).click();
  const key = (await keyReveal.locator('code').textContent())?.trim() ?? '';
  expect(key.length).toBeGreaterThan(20);
  return key;
}

async function createUnclaimedWorkspace(page: Page, testLabel: string): Promise<WorkspaceSeed> {
  const workspaceName = `e2e-${testLabel}-${Date.now()}`;
  const response = await page.request.post(`${BACKEND_URL}/bootstrap`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `10.31.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
    data: { workspaceName },
  });

  expect(response.status()).toBe(201);
  const body = (await response.json()) as BootstrapResponseBody;
  expect(body.ok).toBe(true);
  expect(body.data?.workspaceId).toBeTruthy();
  expect(body.data?.keys.read).toBeTruthy();
  expect(body.data?.keys.write).toBeTruthy();

  return {
    workspaceId: body.data!.workspaceId,
    workspaceName,
    readKey: body.data!.keys.read,
    writeKey: body.data!.keys.write,
  };
}

async function claimWorkspace(
  authedRequest: APIRequestContext,
  writeKey: string,
): Promise<string> {
  const response = await authedRequest.post(`/w/${writeKey}/claim`, { data: {} });
  expect(response.status()).toBe(200);

  const body = (await response.json()) as ClaimResponseBody;
  expect(body.ok).toBe(true);
  expect(body.data?.workspaceId).toBeTruthy();
  expect(body.data?.claimed).toBe(true);

  return body.data!.workspaceId;
}

async function signInFreshUserWithNoWorkspaces(page: Page): Promise<void> {
  await page.context().clearCookies();

  const email = `e2e-long-chain-${Date.now()}@example.com`;
  const password = 'test-empty-workspaces-password-12345';

  const signUpResponse = await page.request.post(`${BACKEND_URL}/api/auth/sign-up/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      email,
      password,
      name: 'E2E Long Chain User',
    },
  });

  expect(signUpResponse.ok()).toBeTruthy();
}

function parseControlWorkspaceId(url: string): string | null {
  const match = url.match(/\/control\/(ws_[A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

async function openClaimWorkspaceInput(page: Page): Promise<Locator> {
  const claimButton = page.getByTestId('claim-workspace-button').first();
  const claimInput = page
    .getByRole('dialog', { name: /^claim workspace$/i })
    .getByPlaceholder('Paste write key or /claim URL')
    .first();

  await expect(claimButton).toBeVisible({ timeout: 10000 });
  await expect
    .poll(
      async () => {
        if (await claimInput.isVisible().catch(() => false)) return true;
        try {
          await claimButton.click();
        } catch {
          return false;
        }
        return claimInput.isVisible().catch(() => false);
      },
      { timeout: 10000, message: 'Claim workspace dialog did not open' },
    )
    .toBe(true);

  return claimInput;
}

test.describe('Long Chained Control + Runtime Flows', () => {
  test('launcher to bootstrap to runtime claim lands in scoped control', async ({ page }) => {
    await page.goto('/launch');
    await page.getByRole('button', { name: /create workspace/i }).click();
    await expect(page).toHaveURL(/\/bootstrap$/);

    await page.getByLabel(/workspace name/i).fill(`e2e-launch-bootstrap-${Date.now()}`);
    await page.getByRole('button', { name: /create workspace/i }).click();

    await expect(page.getByText('Workspace created')).toBeVisible({ timeout: 15000 });

    const keyReveals = page.getByTestId('key-reveal');
    const readKey = await revealKey(keyReveals.nth(0));
    const writeKey = await revealKey(keyReveals.nth(2));
    expect(readKey).not.toBe(writeKey);

    await page.getByRole('checkbox').first().click();
    await expect(page.getByTestId('continue-to-workspace')).toBeEnabled();
    await page.getByTestId('continue-to-workspace').click();

    await expect(page).toHaveURL(new RegExp(`/r/${readKey}$`), { timeout: 10000 });

    const claimInput = await openClaimWorkspaceInput(page);
    await claimInput.fill(writeKey);
    await claimInput.press('Enter');

    await expect(page).toHaveURL(new RegExp(`/claim/${writeKey}$`), { timeout: 10000 });
    await expect(page.getByText('Workspace Claimed!', { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: /^go to control$/i }).click();
    await expect(page).toHaveURL(/\/control\/ws_[A-Za-z0-9]+$/, { timeout: 10000 });
    await expect(page.getByTestId('error-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^welcome$/i })).toBeVisible({ timeout: 10000 });
  });

  test('real rotate keys issues a new runtime key that can read workspace data', async ({
    page,
    authedRequest,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'rotate-chain');
    await claimWorkspace(authedRequest, workspace.writeKey);

    await page.goto(`/control/${workspace.workspaceId}/settings`);
    await page.getByRole('button', { name: /rotate keys/i }).click();
    await page.getByPlaceholder('rotate').fill('rotate');
    await page.getByRole('button', { name: /^confirm$/i }).click();

    const rotatedPanel = page.getByTestId('rotated-keys-panel');
    await expect(rotatedPanel).toBeVisible({ timeout: 10000 });

    const newReadKey = await revealKey(rotatedPanel.getByTestId('key-reveal').nth(0));
    expect(newReadKey).not.toBe(workspace.readKey);

    await expect
      .poll(async () => {
        const response = await page.request.get(`${BACKEND_URL}/r/${newReadKey}/folders`);
        return response.status();
      }, { timeout: 10000 })
      .toBe(200);
  });

  test('delete workspace removes direct control route and workspace switcher entry', async ({
    page,
    authedRequest,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'delete-chain');
    await claimWorkspace(authedRequest, workspace.writeKey);

    await page.goto(`/control/${workspace.workspaceId}/settings`);
    await page.getByRole('button', { name: /delete workspace/i }).click();
    await page.getByPlaceholder(workspace.workspaceName).fill(workspace.workspaceName);
    await page.getByRole('button', { name: /^confirm$/i }).click();

    await expect(page).toHaveURL(/\/control(?:\/ws_[^/]+)?$/, { timeout: 10000 });
    await expect(page).not.toHaveURL(new RegExp(`/control/${workspace.workspaceId}(?:$|/)`));

    await page.goto(`/control/${workspace.workspaceId}`, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(new RegExp(`/control/${workspace.workspaceId}(?:$|/)`));

    await page.getByLabel('Select workspace').click();
    await expect(
      page.getByTestId('workspace-switcher-option').filter({ hasText: workspace.workspaceId }),
    ).toHaveCount(0);
  });

  test('cross-tab claim and control navigation remains coherent after claim', async ({
    page,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'cross-tab-claim');
    const controlTab = await page.context().newPage();

    await controlTab.goto('/control');
    await expect(controlTab).toHaveURL(/\/control\/ws_[^/]+$/);
    await expect(controlTab.getByRole('heading', { name: /^welcome$/i })).toBeVisible({ timeout: 10000 });

    await page.goto(`/r/${workspace.readKey}`);
    const claimInput = await openClaimWorkspaceInput(page);
    await claimInput.fill(workspace.writeKey);
    await claimInput.press('Enter');

    await expect(page.getByText('Workspace Claimed!', { exact: true })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: /^go to control$/i }).click();
    await expect(page).toHaveURL(new RegExp(`/control/${workspace.workspaceId}$`), { timeout: 10000 });
    await expect(page.getByTestId('error-page')).toHaveCount(0);

    await controlTab.goto(`/control/${workspace.workspaceId}`);
    await expect(controlTab).toHaveURL(new RegExp(`/control/${workspace.workspaceId}$`), { timeout: 10000 });
    await expect(controlTab.getByTestId('error-page')).toHaveCount(0);
    await expect(controlTab.getByRole('heading', { name: /^welcome$/i })).toBeVisible({ timeout: 10000 });

    await controlTab.close();
  });

  test('fresh claim updates workspace switcher and supports immediate switching', async ({
    page,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'switcher-claim');

    await page.goto(`/claim/${workspace.writeKey}`);
    await expect(page.getByText('Workspace Claimed!', { exact: true })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: /^go to control$/i }).click();
    await expect(page).toHaveURL(new RegExp(`/control/${workspace.workspaceId}$`), { timeout: 10000 });

    await page.getByLabel('Select workspace').click();
    await expect(page.getByTestId('workspace-switcher-option').filter({ hasText: workspace.workspaceId }).first()).toBeVisible();
    await expect(page.getByTestId('workspace-switcher-option').filter({ hasText: TEST_KEYS.workspaceId }).first()).toBeVisible();

    await page.getByTestId('workspace-switcher-option').filter({ hasText: TEST_KEYS.workspaceId }).first().click();
    await expect(page).toHaveURL(new RegExp(`/control/${TEST_KEYS.workspaceId}$`), { timeout: 10000 });

    await page.getByLabel('Select workspace').click();
    await page.getByTestId('workspace-switcher-option').filter({ hasText: workspace.workspaceId }).first().click();
    await expect(page).toHaveURL(new RegExp(`/control/${workspace.workspaceId}$`), { timeout: 10000 });
    await expect(page.getByTestId('error-page')).toHaveCount(0);
  });

  test('unauthenticated runtime claim preserves redirect targets through login and OAuth handoff', async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    const workspace = await createUnclaimedWorkspace(page, 'auth-redirect');

    await page.goto(`/r/${workspace.readKey}`);
    const claimInput = await openClaimWorkspaceInput(page);
    await claimInput.fill(workspace.writeKey);
    await claimInput.press('Enter');

    await page.waitForURL(/\/login/, { timeout: 10000 });
    const loginUrl = decodeURIComponent(page.url());
    expect(loginUrl).toContain('/login?next=');
    expect(loginUrl).toContain(`/claim/${workspace.writeKey}`);

    const redirectAfterLogin = await page.evaluate(() => sessionStorage.getItem('redirectAfterLogin'));
    expect(redirectAfterLogin).toBe(`/claim/${workspace.writeKey}`);

    await page.getByRole('button', { name: /continue with github/i }).click();
    await expect.poll(() => page.url(), { timeout: 10000 }).toContain('github.com/login');

    const oauthUrl = page.url();
    expect(oauthUrl).toContain('return_to=');
    const callbackUrl = `${BACKEND_URL}/api/auth/callback/github`;
    const doubleEncodedCallback = encodeURIComponent(encodeURIComponent(callbackUrl));
    expect(oauthUrl).toContain(`redirect_uri%3D${doubleEncodedCallback}`);
  });

  test('control root resolves away from deleted workspace across repeated entries and new tab', async ({
    page,
    authedRequest,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'resolver-delete');
    await claimWorkspace(authedRequest, workspace.writeKey);

    await page.goto(`/control/${workspace.workspaceId}/settings`);
    await page.getByRole('button', { name: /delete workspace/i }).click();
    await page.getByPlaceholder(workspace.workspaceName).fill(workspace.workspaceName);
    await page.getByRole('button', { name: /^confirm$/i }).click();

    await page.goto('/control');
    await expect(page).toHaveURL(/\/control\/ws_[A-Za-z0-9]+$/, { timeout: 10000 });
    const firstResolvedWorkspaceId = parseControlWorkspaceId(page.url());
    expect(firstResolvedWorkspaceId).toBeTruthy();
    expect(firstResolvedWorkspaceId).not.toBe(workspace.workspaceId);

    await page.goto('/control');
    await expect(page).toHaveURL(/\/control\/ws_[A-Za-z0-9]+$/, { timeout: 10000 });
    const secondResolvedWorkspaceId = parseControlWorkspaceId(page.url());
    expect(secondResolvedWorkspaceId).toBe(firstResolvedWorkspaceId);
    await expect(page.getByTestId('error-page')).toHaveCount(0);

    const secondTab = await page.context().newPage();
    await secondTab.goto('/control');
    await expect(secondTab).toHaveURL(/\/control\/ws_[A-Za-z0-9]+$/, { timeout: 10000 });
    expect(parseControlWorkspaceId(secondTab.url())).toBe(firstResolvedWorkspaceId);
    await expect(secondTab.getByTestId('error-page')).toHaveCount(0);
    await secondTab.close();
  });

  test('renaming workspace propagates through switcher and control navigation surfaces', async ({
    page,
    authedRequest,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'rename-propagation');
    await claimWorkspace(authedRequest, workspace.writeKey);

    const renamedWorkspace = `renamed-${Date.now()}`;
    await page.goto(`/control/${workspace.workspaceId}/settings`);

    const nameInput = page.getByLabel(/workspace name/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill(renamedWorkspace);

    const saveButton = page.getByRole('button', { name: /save name/i });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect
      .poll(async () => (await page.getByLabel('Select workspace').textContent()) ?? '', { timeout: 10000 })
      .toContain(renamedWorkspace);

    await page.goto('/control');
    await expect(page).toHaveURL(new RegExp(`/control/${workspace.workspaceId}$`), { timeout: 10000 });
    await expect(page.getByLabel('Select workspace')).toContainText(renamedWorkspace);

    const secondTab = await page.context().newPage();
    await secondTab.goto(`/control/${workspace.workspaceId}`);
    await expect(secondTab.getByLabel('Select workspace')).toContainText(renamedWorkspace);
    await secondTab.close();
  });

  test('api key create-use-revoke lifecycle invalidates token immediately after revoke', async ({
    page,
    authedRequest,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'api-key-lifecycle');
    await claimWorkspace(authedRequest, workspace.writeKey);

    const keyName = `Lifecycle Key ${Date.now()}`;

    await page.goto(`/control/${workspace.workspaceId}/api-keys`);
    await page.getByRole('button', { name: /create api key/i }).first().click();
    await page.getByLabel(/name/i).fill(keyName);
    await page
      .locator('label', { hasText: /^Export - Export workspace data$/i })
      .getByRole('checkbox')
      .click();
    await page.getByRole('button', { name: /create key/i }).click();

    const keyDialogTitle = page.getByRole('heading', { name: /^API Key Created$/ });
    await expect(keyDialogTitle).toBeVisible({ timeout: 10000 });
    const createdDialog = page.getByRole('dialog').filter({ has: keyDialogTitle });
    const apiKey = (await createdDialog.locator('code').first().textContent())?.trim() ?? '';
    expect(apiKey).toMatch(/^sk_live_[A-Za-z0-9]{20,}$/);
    await createdDialog.getByRole('button', { name: /^done$/i }).click();

    const exportResponse = await page.request.get(`${BACKEND_URL}/api/v1/export?format=zip`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    expect(exportResponse.status()).toBe(200);
    expect(exportResponse.headers()['content-disposition'] ?? '').toContain('attachment;');

    const keyCard = page.locator('[data-testid="api-keys-list"] > *').filter({ hasText: keyName }).first();
    await expect(keyCard).toBeVisible();
    await keyCard.getByTestId('delete-api-key-btn').click();
    await expect(keyCard).toHaveCount(0);

    const revokedResponse = await page.request.get(`${BACKEND_URL}/api/v1/export?format=zip`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    expect(revokedResponse.status()).toBe(401);
  });

  test('concurrent claim attempts settle to one success with deterministic non-success companion', async ({
    page,
    authedRequest,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'claim-race');

    await expect
      .poll(async () => {
        const response = await page.request.get(`${BACKEND_URL}/r/${workspace.readKey}/folders`);
        return response.status();
      }, { timeout: 10000 })
      .toBe(200);

    const [firstClaimResponse, secondClaimResponse] = await Promise.all([
      authedRequest.post(`/w/${workspace.writeKey}/claim`, { data: {} }),
      page.request.post(`${BACKEND_URL}/w/${workspace.writeKey}/claim`, { data: {} }),
    ]);

    const statuses = [firstClaimResponse.status(), secondClaimResponse.status()];
    expect(statuses.some((status) => status === 200)).toBe(true);
    expect(statuses.every((status) => [200, 400].includes(status))).toBe(true);

    const firstBody = (await firstClaimResponse.json()) as ClaimResponseBody | ErrorResponseBody;
    const secondBody = (await secondClaimResponse.json()) as ClaimResponseBody | ErrorResponseBody;

    const successBody = [firstBody, secondBody].find(
      (body): body is ClaimResponseBody => body.ok === true && 'data' in body && Boolean(body.data?.workspaceId),
    );
    expect(successBody?.data?.workspaceId).toBe(workspace.workspaceId);

    const failureBody = [firstBody, secondBody].find(
      (body): body is ErrorResponseBody => body.ok === false,
    );
    if (failureBody?.error?.code) {
      expect(['ALREADY_CLAIMED', 'BAD_REQUEST']).toContain(failureBody.error.code);
    }

    await page.goto(`/control/${workspace.workspaceId}`);
    await expect(page.getByRole('heading', { name: /^welcome$/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('error-page')).toHaveCount(0);
  });

  test('pre-rotation claim URL resolves to explicit state after key rotation', async ({
    page,
    authedRequest,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'stale-claim');
    await claimWorkspace(authedRequest, workspace.writeKey);
    const preRotationWriteKey = workspace.writeKey;

    await page.goto(`/control/${workspace.workspaceId}/settings`);
    await page.getByRole('button', { name: /rotate keys/i }).click();
    await page.getByPlaceholder('rotate').fill('rotate');
    await page.getByRole('button', { name: /^confirm$/i }).click();
    await expect(page.getByTestId('rotated-keys-panel')).toBeVisible({ timeout: 10000 });

    await page.goto(`/claim/${preRotationWriteKey}`);
    await expect(page.getByTestId('error-page')).toHaveCount(0);

    const hasSuccessState = await page.getByText('Workspace Claimed!', { exact: true }).isVisible();
    if (!hasSuccessState) {
      await expect(page.getByText(/invalid key|claim failed|already claimed|revoked|expired/i).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('fresh user with no workspaces can recover from control empty state through claim flow', async ({
    page,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'empty-state-recovery');
    await signInFreshUserWithNoWorkspaces(page);

    await page.goto('/control');
    await expect(page.getByText(/claim a workspace to continue/i)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#app-sidebar')).toHaveCount(0);

    await page.getByPlaceholder('Paste write key or /claim URL').fill(workspace.writeKey);
    await page.getByRole('button', { name: /continue to claim/i }).click();

    await expect(page).toHaveURL(new RegExp(`/claim/${workspace.writeKey}$`), { timeout: 10000 });
    await expect(page.getByText('Workspace Claimed!', { exact: true })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: /^go to control$/i }).click();
    await expect(page).toHaveURL(new RegExp(`/control/${workspace.workspaceId}$`), { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /^welcome$/i })).toBeVisible({ timeout: 10000 });
  });

  test('recent workspace resume handles stale entries and still opens valid recent runtime URLs', async ({
    page,
  }) => {
    const workspace = await createUnclaimedWorkspace(page, 'recent-resilience');
    const staleUrl = '/r/invalid-key-that-does-not-exist-1234567890';
    const validUrl = `/r/${workspace.readKey}`;

    await page.addInitScript(([stale, valid]) => {
      localStorage.setItem(
        'mdplane_recent_workspace_urls',
        JSON.stringify({
          saveEnabled: true,
          urls: [
            { url: stale, label: 'R key: stale-entry...', addedAt: '2026-02-24T10:00:00.000Z' },
            { url: valid, label: 'R key: valid-entry...', addedAt: '2026-02-24T09:00:00.000Z' },
          ],
        }),
      );
    }, [staleUrl, validUrl]);

    await page.goto('/');
    await page.getByRole('button', { name: /resume last workspace/i }).click();
    await expect(page).toHaveURL(new RegExp(`${staleUrl}$`), { timeout: 10000 });
    await expect(page.getByTestId('not-found')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('error-page')).toHaveCount(0);

    await page.goto('/launch');
    await page.getByRole('link', { name: 'R key: valid-entry...' }).click();
    await expect(page).toHaveURL(new RegExp(`${validUrl}$`), { timeout: 10000 });
    await expect(page.locator('[data-testid="reader-layout"]')).toBeVisible({ timeout: 10000 });
  });
});
