import { test, expect, BACKEND_URL } from './fixtures'
import type { APIRequestContext, Page } from '@playwright/test'

/**
 * Orchestration Page E2E Tests
 *
 * Tests for the control Orchestration page.
 * Uses real backend data instead of mocks.
 *
 * See: app-overhaul/UI-UX-OVERHAUL.md Section 7.2
 */

type BootstrapResponse = {
  ok: true
  data: {
    workspaceId: string
    keys: {
      read: string
      append: string
      write: string
    }
    urls: {
      api: { read: string; append: string; write: string }
      web: { read: string; claim: string }
    }
    createdAt: string
  }
}

async function createWorkspaceForControl(request: APIRequestContext) {
  const ipOctet = 10 + Math.floor(Math.random() * 200)
  const bootstrapRes = await request.post(`${BACKEND_URL}/bootstrap`, {
    headers: { 'X-Forwarded-For': `10.0.0.${ipOctet}` },
    data: {
      workspaceName: `e2e-orchestration-${Date.now()}`,
    },
  })
  expect(bootstrapRes.status()).toBe(201)
  const bootstrapJson = (await bootstrapRes.json()) as BootstrapResponse
  expect(bootstrapJson.ok).toBe(true)

  const workspaceId = bootstrapJson.data.workspaceId
  const { read: readKey, append: appendKey, write: writeKey } = bootstrapJson.data.keys

  // Claim workspace so the authenticated E2E user can access control endpoints
  const claimRes = await request.post(`${BACKEND_URL}/w/${writeKey}/claim`, {
    headers: { 'Content-Type': 'application/json' },
    data: {},
  })
  expect(claimRes.ok()).toBe(true)

  return { workspaceId, readKey, appendKey, writeKey }
}

async function createTestFile(
  request: APIRequestContext,
  writeKey: string
): Promise<string> {
  const fileName = `__e2e_orchestration_${Date.now()}.md`
  const filePath = `/${fileName}`
  const res = await request.put(`${BACKEND_URL}/w/${writeKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: { content: `# E2E Orchestration\n\nCreated ${new Date().toISOString()}` },
  })
  expect([200, 201]).toContain(res.status())
  return filePath
}

async function createTask(
  request: APIRequestContext,
  appendKey: string,
  filePath: string,
  content: string
): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/a/${appendKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: { author: 'e2e-test', type: 'task', content, priority: 'medium' },
  })
  expect(res.status()).toBe(201)
  const json = await res.json()
  return json.data.id as string
}

async function claimTask(
  request: APIRequestContext,
  appendKey: string,
  filePath: string,
  taskId: string,
  expiresInSeconds: number = 1800
): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/a/${appendKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: { author: 'e2e-agent', type: 'claim', ref: taskId, expiresInSeconds },
  })
  expect(res.status()).toBe(201)
  const json = await res.json()
  return json.data.id as string
}

async function completeTask(
  request: APIRequestContext,
  appendKey: string,
  filePath: string,
  taskId: string
): Promise<void> {
  const res = await request.post(`${BACKEND_URL}/a/${appendKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: { author: 'e2e-agent', type: 'response', ref: taskId, content: 'Done' },
  })
  expect(res.status()).toBe(201)
}

function taskCard(page: Page, title: string) {
  return page.locator('[data-testid="orchestration-task-card"]', { hasText: title })
}

async function selectFilterOption(page: Page, triggerLabel: RegExp, optionLabel: string) {
  const trigger = page.getByLabel(triggerLabel).first()
  await trigger.click()
  const popupId = await trigger.getAttribute('aria-controls')
  const popup = popupId
    ? page.locator(`#${popupId}`)
    : page.locator("[data-slot='select-content']").last()
  await expect(popup).toBeVisible()
  await popup.getByRole('option', { name: optionLabel, exact: true }).click()
  await page.keyboard.press('Escape')
}

test.describe('Orchestration Page', () => {
  let emptyWorkspaceId = ''
  let seededWorkspaceId = ''
  let seededClaimedTaskTitle = ''
  let seededStalledTaskTitle = ''
  let seededCompletedTaskTitle = ''

  test.beforeAll(async ({ authedRequest }) => {
    {
      const created = await createWorkspaceForControl(authedRequest)
      emptyWorkspaceId = created.workspaceId
    }

    {
      const created = await createWorkspaceForControl(authedRequest)
      seededWorkspaceId = created.workspaceId

      const filePath = await createTestFile(authedRequest, created.writeKey)

      seededClaimedTaskTitle = `Active task for orchestration ${Date.now()}`
      const task1Id = await createTask(
        authedRequest,
        created.appendKey,
        filePath,
        seededClaimedTaskTitle
      )
      await claimTask(authedRequest, created.appendKey, filePath, task1Id)

      seededCompletedTaskTitle = `Completed task for orchestration ${Date.now()}`
      const task2Id = await createTask(authedRequest, created.appendKey, filePath, seededCompletedTaskTitle)
      await claimTask(authedRequest, created.appendKey, filePath, task2Id)
      await completeTask(authedRequest, created.appendKey, filePath, task2Id)

      seededStalledTaskTitle = `Stalled task for take action ${Date.now()}`
      const task3Id = await createTask(
        authedRequest,
        created.appendKey,
        filePath,
        seededStalledTaskTitle
      )
      const stalledClaimId = await claimTask(authedRequest, created.appendKey, filePath, task3Id)
      const forceExpiredRes = await authedRequest.post(
        `${BACKEND_URL}/workspaces/${created.workspaceId}/orchestration/claims/${stalledClaimId}/renew`,
        { data: { expiresInSeconds: -60 } }
      )
      expect(forceExpiredRes.status()).toBe(200)
    }
  })

  test.describe('Page Structure', () => {
    test('should load orchestration page with header', async ({ page }) => {
      await page.goto(`/control/${emptyWorkspaceId}/orchestration`)
      await expect(
        page.getByRole('heading', { name: /orchestration/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show page description', async ({ page }) => {
      await page.goto(`/control/${emptyWorkspaceId}/orchestration`)
      await expect(page.getByText(/operational task flow/i)).toBeVisible({ timeout: 10000 })
    })

    test('should have refresh button', async ({ page }) => {
      await page.goto(`/control/${emptyWorkspaceId}/orchestration`)
      await expect(
        page.getByRole('button', { name: /refresh orchestration/i })
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Empty State', () => {
    test('should show empty state when no claims exist', async ({ page }) => {
      await page.goto(`/control/${emptyWorkspaceId}/orchestration`)
      const emptyState = page.getByTestId('orchestration-empty-state')
      await expect(emptyState.getByText(/no tasks yet/i)).toBeVisible({ timeout: 10000 })
      await expect(emptyState.getByRole('button', { name: /task docs/i })).toBeVisible()
      await expect(emptyState.getByRole('link', { name: /^workspace launcher$/i })).toBeVisible()
    })
  })

  test.describe('Error Recovery', () => {
    test('should show recovery actions when orchestration request fails', async ({ page }) => {
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
        })
      })

      await page.goto(`/control/${emptyWorkspaceId}/orchestration`)

      await expect(page.getByText(/couldn't load tasks/i)).toBeVisible({ timeout: 10000 })

      const errorState = page.getByTestId('orchestration-error-state')

      const launcherButton = errorState.getByRole('link', { name: /^workspace launcher$/i })
      await expect(launcherButton).toBeVisible()

      const retryButton = errorState.getByRole('button', { name: /^try again$/i })
      await expect(retryButton).toBeVisible()
    })
  })

  test.describe('Task Board', () => {
    test('should show orchestration feed with real claims data', async ({ page }) => {
      await page.goto(`/control/${seededWorkspaceId}/orchestration`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(/no tasks yet/i)).not.toBeVisible({ timeout: 10000 })
    })

    test('should render completed task cards in completed section', async ({ page }) => {
      await page.goto(`/control/${seededWorkspaceId}/orchestration`)
      await expect(taskCard(page, seededCompletedTaskTitle)).toHaveCount(1, { timeout: 10000 })
      await expect(
        page.locator('[data-task-status="completed"]').filter({ hasText: seededCompletedTaskTitle })
      ).toHaveCount(1, { timeout: 10000 })
    })
  })

  test.describe('No Mock Data', () => {
    test('should NOT show hardcoded mock task titles', async ({ page }) => {
      await page.goto(`/control/${emptyWorkspaceId}/orchestration`)
      await expect(
        page.getByRole('heading', { name: /orchestration/i })
      ).toBeVisible()
      await expect(page.getByText('Fix auth redirect')).not.toBeVisible()
      await expect(page.getByText('Add dark mode')).not.toBeVisible()
      await expect(page.getByText('Update API docs')).not.toBeVisible()
    })
  })

  test.describe('Refresh', () => {
    test('should refresh data on button click', async ({ page }) => {
      await page.goto(`/control/${emptyWorkspaceId}/orchestration`)
      await expect(page.getByText(/no tasks yet/i)).toBeVisible({ timeout: 10000 })
      const refreshPromise = page.waitForRequest((req) =>
        req.url().includes('/workspaces/') && req.url().includes('/orchestration')
      )
      await page.getByRole('button', { name: /refresh orchestration/i }).click()
      await refreshPromise
      await expect(page.getByText(/no tasks yet/i)).toBeVisible()
    })
  })

  test.describe('Filters', () => {
    test('should apply status filter through orchestration query params', async ({ page }) => {
      await page.goto(`/control/${seededWorkspaceId}/orchestration`)

      const statusRequest = page.waitForRequest((req) =>
        req.url().includes(`/workspaces/${seededWorkspaceId}/orchestration`) &&
        req.url().includes('status=stalled')
      )
      await selectFilterOption(page, /choose status/i, 'Stalled')
      await statusRequest

      await expect(taskCard(page, seededStalledTaskTitle)).toHaveCount(1, { timeout: 10000 })
      await expect(taskCard(page, seededClaimedTaskTitle)).toHaveCount(0, { timeout: 10000 })
    })
  })

  test.describe('Take Action', () => {
    test('should renew stalled claim from control UI and move task back to in progress', async ({ page }) => {
      await page.goto(`/control/${seededWorkspaceId}/orchestration`)

      const stalledCard = page
        .locator('[data-task-status="stalled"]')
        .filter({ hasText: seededStalledTaskTitle })
      await expect(stalledCard).toHaveCount(1, { timeout: 10000 })

      const renewRequest = page.waitForRequest((req) =>
        req.method() === 'POST' &&
        req.url().includes(`/workspaces/${seededWorkspaceId}/orchestration/claims/`) &&
        req.url().includes('/renew')
      )
      await stalledCard.getByRole('button', { name: /take action/i }).click()
      await expect(page.getByRole('heading', { name: /take action/i })).toBeVisible()
      await page.getByRole('button', { name: /apply action/i }).click()
      await renewRequest

      await expect(
        page.locator('[data-task-status="stalled"]').filter({ hasText: seededStalledTaskTitle })
      ).toHaveCount(0, { timeout: 10000 })
      await expect(
        page.locator('[data-task-status="claimed"]').filter({ hasText: seededStalledTaskTitle })
      ).toHaveCount(1, { timeout: 10000 })
    })
  })
})


