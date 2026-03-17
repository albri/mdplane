import { test, expect, BACKEND_URL } from './fixtures'
import type { APIRequestContext, Page } from '@playwright/test'

/**
 * Capability URL Orchestration Page E2E Tests
 *
 * Tests for the /r/:key?view=orchestration runtime view.
 * This page is accessible without authentication using a read capability key.
 *
 * Tests create real data via the append API and verify the UI displays it correctly.
 */

const TEST_FILE_PREFIX = '__e2e_cap_orch_'

type BootstrapResponse = {
  ok: true
  data: {
    workspaceId: string
    keys: {
      read: string
      append: string
      write: string
    }
  }
}

async function bootstrapWorkspace(request: APIRequestContext, workspaceName: string) {
  const response = await request.post(`${BACKEND_URL}/bootstrap`, {
    headers: { 'Content-Type': 'application/json' },
    data: { workspaceName },
  })
  expect(response.status()).toBe(201)
  const json = (await response.json()) as BootstrapResponse
  expect(json.ok).toBe(true)
  return json.data
}

async function claimWorkspaceOwnership(
  request: APIRequestContext,
  writeKey: string
): Promise<void> {
  const response = await request.post(`${BACKEND_URL}/w/${writeKey}/claim`, {
    headers: { 'Content-Type': 'application/json' },
    data: {},
  })
  expect(response.status()).toBe(200)
}

/**
 * Create a test file for task appends
 */
async function createFileAtPath(
  request: APIRequestContext,
  writeKey: string,
  filePath: string,
  content: string
): Promise<void> {
  const response = await request.put(`${BACKEND_URL}/w/${writeKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: { content },
  })
  expect([200, 201]).toContain(response.status())
}

async function createTestFile(
  request: APIRequestContext,
  writeKey: string
): Promise<string> {
  const fileName = `${TEST_FILE_PREFIX}${Date.now()}.md`
  const filePath = `/${fileName}`

  await createFileAtPath(
    request,
    writeKey,
    filePath,
    `# E2E Capability Orchestration\n\nCreated ${new Date().toISOString()}`
  )

  return filePath
}

/**
 * Create a task via the append API
 */
async function createTask(
  request: APIRequestContext,
  appendKey: string,
  filePath: string,
  content: string,
  options?: {
    priority?: 'low' | 'medium' | 'high' | 'critical'
    author?: string
  }
): Promise<string> {
  const response = await request.post(`${BACKEND_URL}/a/${appendKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      author: options?.author ?? 'e2e-test',
      type: 'task',
      content,
      priority: options?.priority ?? 'medium',
    },
  })
  expect(response.status()).toBe(201)
  const json = await response.json()
  expect(json.ok).toBe(true)
  return json.data.id
}

/**
 * Claim a task via the append API
 */
async function claimTask(
  request: APIRequestContext,
  appendKey: string,
  filePath: string,
  taskId: string,
  author: string = 'e2e-agent',
  expiresInSeconds: number = 1800
): Promise<string> {
  const response = await request.post(`${BACKEND_URL}/a/${appendKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      author,
      type: 'claim',
      ref: taskId,
      expiresInSeconds,
    },
  })
  expect(response.status()).toBe(201)
  const json = await response.json()
  expect(json.ok).toBe(true)
  return json.data.id
}

/**
 * Complete a task via the append API
 */
async function completeTask(
  request: APIRequestContext,
  appendKey: string,
  filePath: string,
  taskId: string,
  author: string = 'e2e-agent'
): Promise<void> {
  const response = await request.post(`${BACKEND_URL}/a/${appendKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      author,
      type: 'response',
      ref: taskId,
      content: 'Task completed',
    },
  })
  expect(response.status()).toBe(201)
}

/**
 * Delete a test file
 */
async function deleteTestFile(
  request: APIRequestContext,
  writeKey: string,
  filePath: string
): Promise<void> {
  await request.delete(`${BACKEND_URL}/w/${writeKey}${filePath}`)
}

function taskCard(page: Page, title: string) {
  return page.locator('[data-testid="orchestration-task-card"]', { hasText: title })
}

async function selectFilterOption(
  page: Page,
  triggerLabel: RegExp,
  optionLabel: string,
  options?: { closeWithEscape?: boolean }
) {
  const trigger = page.getByLabel(triggerLabel).first()
  await trigger.click()
  const popupId = await trigger.getAttribute('aria-controls')
  const popup = popupId
    ? page.locator(`#${popupId}`)
    : page.locator("[data-slot='select-content']").last()
  await expect(popup).toBeVisible()
  await popup.getByRole('option', { name: optionLabel, exact: true }).click()
  if (options?.closeWithEscape ?? true) {
    await page.keyboard.press('Escape')
  }
}

test.describe('Capability Orchestration Page', () => {
  test.describe('Page Structure', () => {
    test('should load orchestration page with header', async ({ page, readKey }) => {
      await page.goto(`/r/${readKey}?view=orchestration`)
      await expect(page.getByRole('heading', { name: /orchestration/i })).toBeVisible({ timeout: 10000 })
    })

    test('should have refresh button', async ({ page, readKey }) => {
      await page.goto(`/r/${readKey}?view=orchestration`)
      await expect(
        page.getByRole('button', { name: /refresh/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('should not render back to files button', async ({ page, readKey }) => {
      await page.goto(`/r/${readKey}?view=orchestration`)
      await expect(page.getByRole('button', { name: /back to files/i })).toHaveCount(0)
    })
  })

  test.describe('Task Display', () => {
    test('should show pending task in orchestration feed', async ({
      page,
      request,
      readKey,
      appendKey,
      writeKey,
    }) => {
      const filePath = await createTestFile(request, writeKey)
      const taskContent = `Pending task ${Date.now()}`

      try {
        await createTask(request, appendKey, filePath, taskContent)

        await page.goto(`/r/${readKey}?view=orchestration`)
        await expect(page.getByText(taskContent)).toBeVisible({ timeout: 10000 })
      } finally {
        await deleteTestFile(request, writeKey, filePath)
      }
    })

    test('should show claimed task in claimed column', async ({
      page,
      request,
      readKey,
      appendKey,
      writeKey,
    }) => {
      const filePath = await createTestFile(request, writeKey)
      const taskContent = `Claimed task ${Date.now()}`

      try {
        const taskId = await createTask(request, appendKey, filePath, taskContent)
        await claimTask(request, appendKey, filePath, taskId)

        await page.goto(`/r/${readKey}?view=orchestration`)
        await expect(page.getByText(taskContent)).toBeVisible({ timeout: 10000 })
      } finally {
        await deleteTestFile(request, writeKey, filePath)
      }
    })

    test('should show status section headers with task counts', async ({
      page,
      request,
      readKey,
      appendKey,
      writeKey,
    }) => {
      const filePath = await createTestFile(request, writeKey)

      try {
        await createTask(request, appendKey, filePath, `Stats test task ${Date.now()}`)

        await page.goto(`/r/${readKey}?view=orchestration`)
        await expect(page.getByText(/^pending$/i).first()).toBeVisible({ timeout: 10000 })
      } finally {
        await deleteTestFile(request, writeKey, filePath)
      }
    })

    test('should render completed task cards in completed section', async ({
      page,
      request,
      readKey,
      appendKey,
      writeKey,
    }) => {
      const filePath = await createTestFile(request, writeKey)
      const taskContent = `Completed runtime task ${Date.now()}`

      try {
        const taskId = await createTask(request, appendKey, filePath, taskContent)
        await claimTask(request, appendKey, filePath, taskId)
        await completeTask(request, appendKey, filePath, taskId)

        await page.goto(`/r/${readKey}?view=orchestration`)
        await expect(taskCard(page, taskContent)).toHaveCount(1, { timeout: 10000 })
        await expect(
          page.locator('[data-task-status="completed"]').filter({ hasText: taskContent })
        ).toHaveCount(1, { timeout: 10000 })
      } finally {
        await deleteTestFile(request, writeKey, filePath)
      }
    })
  })

  test.describe('Refresh', () => {
    test('should refresh data on button click', async ({
      page,
      request,
      readKey,
      appendKey,
      writeKey,
    }) => {
      const filePath = await createTestFile(request, writeKey)
      const taskContent = `Refresh test task ${Date.now()}`

      try {
        // Load page first (may show empty or existing tasks)
        await page.goto(`/r/${readKey}?view=orchestration`)
        await expect(
          page.getByRole('heading', { name: /orchestration/i })
        ).toBeVisible({ timeout: 10000 })

        // Create task after page load
        await createTask(request, appendKey, filePath, taskContent)

        // Click refresh
        await page.getByRole('button', { name: /refresh orchestration/i }).click()

        // New task should appear
        await expect(page.getByText(taskContent)).toBeVisible({ timeout: 10000 })
      } finally {
        await deleteTestFile(request, writeKey, filePath)
      }
    })

    test('should link task file path to runtime document', async ({
      page,
      request,
      readKey,
      appendKey,
      writeKey,
    }) => {
      const filePath = await createTestFile(request, writeKey)
      const taskContent = `Task path link ${Date.now()}`

      try {
        await createTask(request, appendKey, filePath, taskContent)
        await page.goto(`/r/${readKey}?view=orchestration`)

        const task = taskCard(page, taskContent)
        await expect(task).toBeVisible({ timeout: 10000 })

        const docLink = task.getByRole('link', { name: filePath })
        await expect(docLink).toBeVisible()
        await expect(docLink).toHaveAttribute('href', `/r/${readKey}${filePath}`)
      } finally {
        await deleteTestFile(request, writeKey, filePath)
      }
    })

  })

  test.describe('Invalid Key', () => {
    test('should show 404 for invalid capability key', async ({ page }) => {
      await page.goto('/r/invalid-key-12345?view=orchestration')

      // Layout validates key on server - invalid key returns 404 page
      await expect(page.getByText('404')).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('Filters', () => {
    test('should apply status and priority filters with real query behavior', async ({
      page,
      request,
      readKey,
      appendKey,
      writeKey,
    }) => {
      const runId = Date.now()
      const baseFolder = `/__e2e_cap_orch_filters_${runId}`
      const pendingPath = `${baseFolder}/pending.md`
      const claimedPath = `${baseFolder}/claimed.md`
      const pendingTitle = `cap-filter-pending-${runId}`
      const claimedTitle = `cap-filter-claimed-${runId}`

      await createFileAtPath(request, writeKey, pendingPath, '# Pending filter task')
      await createFileAtPath(request, writeKey, claimedPath, '# Claimed filter task')

      try {
        await createTask(request, appendKey, pendingPath, pendingTitle, {
          priority: 'critical',
          author: `e2e-status-agent-${runId}`,
        })
        const claimedTaskId = await createTask(request, appendKey, claimedPath, claimedTitle, {
          priority: 'low',
          author: `e2e-claimed-agent-${runId}`,
        })
        await claimTask(request, appendKey, claimedPath, claimedTaskId)

        await page.goto(`/r/${readKey}?view=orchestration`)
        await expect(taskCard(page, pendingTitle)).toHaveCount(1, { timeout: 10000 })
        await expect(taskCard(page, claimedTitle)).toHaveCount(1, { timeout: 10000 })

        const statusPendingRequest = page.waitForRequest((req) =>
          req.url().includes('/api/capability/r/') &&
          req.url().includes('/orchestration') &&
          req.url().includes('status=pending')
        )
        await selectFilterOption(page, /choose status/i, 'Pending')
        await statusPendingRequest

        await expect(taskCard(page, pendingTitle)).toHaveCount(1, { timeout: 10000 })
        await expect(taskCard(page, claimedTitle)).toHaveCount(0, { timeout: 10000 })

        const statusMultiRequest = page.waitForRequest((req) =>
          req.url().includes('/api/capability/r/') &&
          req.url().includes('/orchestration') &&
          /(status=pending%2Cclaimed|status=claimed%2Cpending)/.test(req.url())
        )
        await selectFilterOption(page, /choose status/i, 'Claimed')
        await statusMultiRequest

        await expect(taskCard(page, pendingTitle)).toHaveCount(1, { timeout: 10000 })
        await expect(taskCard(page, claimedTitle)).toHaveCount(1, { timeout: 10000 })

        const priorityRequest = page.waitForRequest((req) =>
          req.url().includes('/api/capability/r/') &&
          req.url().includes('/orchestration') &&
          req.url().includes('priority=critical')
        )
        await selectFilterOption(page, /choose priority/i, 'Critical')
        await priorityRequest

        await expect(taskCard(page, pendingTitle)).toHaveCount(1, { timeout: 10000 })
        await expect(taskCard(page, claimedTitle)).toHaveCount(0, { timeout: 10000 })
      } finally {
        await deleteTestFile(request, writeKey, pendingPath)
        await deleteTestFile(request, writeKey, claimedPath)
      }
    })

    test('should apply agent and folder filters with deterministic task visibility', async ({
      page,
      request,
      readKey,
      appendKey,
      writeKey,
    }) => {
      const runId = Date.now()
      const folderA = `/__e2e_cap_orch_agent_a_${runId}`
      const folderB = `/__e2e_cap_orch_agent_b_${runId}`
      const pathA = `${folderA}/task-a.md`
      const pathB = `${folderB}/task-b.md`
      const titleA = `cap-agent-folder-a-${runId}`
      const titleB = `cap-agent-folder-b-${runId}`
      const agentA = `e2e-agent-a-${runId}`
      const agentB = `e2e-agent-b-${runId}`

      await createFileAtPath(request, writeKey, pathA, '# Agent A task file')
      await createFileAtPath(request, writeKey, pathB, '# Agent B task file')

      try {
        const taskAId = await createTask(request, appendKey, pathA, titleA, { author: `task-${agentA}` })
        const taskBId = await createTask(request, appendKey, pathB, titleB, { author: `task-${agentB}` })
        await claimTask(request, appendKey, pathA, taskAId, agentA)
        await claimTask(request, appendKey, pathB, taskBId, agentB)

        await page.goto(`/r/${readKey}?view=orchestration`)
        await expect(taskCard(page, titleA)).toHaveCount(1, { timeout: 10000 })
        await expect(taskCard(page, titleB)).toHaveCount(1, { timeout: 10000 })

        const agentRequest = page.waitForRequest((req) =>
          req.url().includes('/api/capability/r/') &&
          req.url().includes('/orchestration') &&
          req.url().includes(`agent=${agentA}`)
        )
        await selectFilterOption(page, /choose agent/i, agentA, { closeWithEscape: false })
        await agentRequest

        await expect(taskCard(page, titleA)).toHaveCount(1, { timeout: 10000 })
        await expect(taskCard(page, titleB)).toHaveCount(0, { timeout: 10000 })

        const folderRequest = page.waitForRequest((req) => {
          if (!req.url().includes('/api/capability/r/') || !req.url().includes('/orchestration')) {
            return false
          }
          return decodeURIComponent(req.url()).includes(`folder=${folderA}`)
        })
        await selectFilterOption(page, /choose folder/i, folderA, { closeWithEscape: false })
        await folderRequest

        await expect(taskCard(page, titleA)).toHaveCount(1, { timeout: 10000 })
        await expect(taskCard(page, titleB)).toHaveCount(0, { timeout: 10000 })
      } finally {
        await deleteTestFile(request, writeKey, pathA)
        await deleteTestFile(request, writeKey, pathB)
      }
    })
  })

  test.describe('Route Collision Safety', () => {
    test('should allow folder named orchestration via path route', async ({
      page,
      request,
      readKey,
      writeKey,
    }) => {
      const filePath = '/orchestration/guide.md'
      const createResponse = await request.put(`${BACKEND_URL}/w/${writeKey}${filePath}`, {
        headers: { 'Content-Type': 'application/json' },
        data: { content: '# Route collision safety' },
      })
      expect([200, 201]).toContain(createResponse.status())

      try {
        await page.goto(`/r/${readKey}/orchestration`)
        await expect(page.getByText('guide.md')).toBeVisible({ timeout: 10000 })
      } finally {
        await request.delete(`${BACKEND_URL}/w/${writeKey}${filePath}`)
      }
    })

    test('should allow nested ops/orchestration content path', async ({
      page,
      request,
      readKey,
      writeKey,
    }) => {
      const filePath = '/ops/orchestration.md'
      const createResponse = await request.put(`${BACKEND_URL}/w/${writeKey}${filePath}`, {
        headers: { 'Content-Type': 'application/json' },
        data: { content: '# Nested route collision safety' },
      })
      expect([200, 201]).toContain(createResponse.status())

      try {
        await page.goto(`/r/${readKey}/ops/orchestration.md`)
        await expect(page.getByText('Nested route collision safety')).toBeVisible({ timeout: 10000 })
      } finally {
        await request.delete(`${BACKEND_URL}/w/${writeKey}${filePath}`)
      }
    })
  })

  test.describe('Take Action', () => {
    test('should allow owner session to reclaim stalled work from runtime orchestration', async ({
      page,
      request,
      authedRequest,
    }) => {
      const runId = Date.now()
      const seeded = await bootstrapWorkspace(authedRequest, `cap-owner-${runId}`)
      await claimWorkspaceOwnership(authedRequest, seeded.keys.write)

      const filePath = `/${TEST_FILE_PREFIX}owner_${runId}.md`
      const taskTitle = `runtime-stalled-${Date.now()}`
      await createFileAtPath(request, seeded.keys.write, filePath, '# Runtime owner takeover')

      try {
        const taskId = await createTask(request, seeded.keys.append, filePath, taskTitle)
        const claimId = await claimTask(request, seeded.keys.append, filePath, taskId, 'e2e-agent')
        const expireResponse = await authedRequest.post(
          `${BACKEND_URL}/workspaces/${seeded.workspaceId}/orchestration/claims/${claimId}/renew`,
          { data: { expiresInSeconds: -60 } }
        )
        expect(expireResponse.status()).toBe(200)

        await page.goto(`/r/${seeded.keys.read}?view=orchestration`)
        const stalledCard = page
          .locator('[data-task-status="stalled"]')
          .filter({ hasText: taskTitle })
        await expect(stalledCard).toHaveCount(1, { timeout: 10000 })

        const reclaimRequest = page.waitForRequest((req) =>
          req.method() === 'POST' &&
          req.url().includes(`/workspaces/${seeded.workspaceId}/orchestration/claims/`) &&
          req.url().includes('/renew')
        )

        await stalledCard.getByRole('button', { name: /take action/i }).click()
        await expect(page.getByRole('heading', { name: /take action/i })).toBeVisible()
        await page.getByRole('button', { name: /apply action/i }).click()
        await reclaimRequest

        await expect(
          page.locator('[data-task-status="stalled"]').filter({ hasText: taskTitle })
        ).toHaveCount(0, { timeout: 10000 })
        await expect(
          page.locator('[data-task-status="claimed"]').filter({ hasText: taskTitle })
        ).toHaveCount(1, { timeout: 10000 })
      } finally {
        await deleteTestFile(request, seeded.keys.write, filePath)
      }
    })

    test('should allow write-key unlock flow for non-owner runtime viewer', async ({
      page,
      request,
    }) => {
      const runId = Date.now()
      const seeded = await bootstrapWorkspace(request, `cap-unlocked-${runId}`)
      const filePath = `/unlock-${runId}.md`
      const taskTitle = `runtime-claimed-${runId}`

      await createFileAtPath(request, seeded.keys.write, filePath, '# Write-key unlock test')
      const taskId = await createTask(request, seeded.keys.append, filePath, taskTitle, {
        author: 'task-author',
      })
      await claimTask(request, seeded.keys.append, filePath, taskId, 'human-operator')

      try {
        await page.goto(`/r/${seeded.keys.read}?view=orchestration`)
        const claimedCard = page
          .locator('[data-task-status="claimed"]')
          .filter({ hasText: taskTitle })
        await expect(claimedCard).toHaveCount(1, { timeout: 10000 })
        await expect(claimedCard.getByRole('button', { name: /take action/i })).toHaveCount(0)

        await page.getByRole('button', { name: /unlock actions/i }).click()
        await page.getByPlaceholder('Paste write key or /claim URL').fill(seeded.keys.write)
        await page.getByRole('button', { name: /^unlock$/i }).click()
        await expect(page.getByText(/write key unlocked/i)).toBeVisible({ timeout: 10000 })
        await expect(claimedCard.getByRole('button', { name: /take action/i })).toHaveCount(1)

        const writeKeyResponse = page.waitForResponse((response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/capability/a/') &&
          response.url().includes(encodeURIComponent(seeded.keys.write)) &&
          !response.url().includes('/append/') &&
          response.status() === 201
        )
        await claimedCard.getByRole('button', { name: /take action/i }).click()
        await page.getByRole('button', { name: /apply action/i }).click()
        await writeKeyResponse

        await expect(
          page.locator('[data-task-status="claimed"]').filter({ hasText: taskTitle })
        ).toHaveCount(1, { timeout: 10000 })
      } finally {
        await deleteTestFile(request, seeded.keys.write, filePath)
      }
    })
  })
})

