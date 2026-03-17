import { test, expect, BACKEND_URL } from './fixtures'
import type { APIRequestContext } from '@playwright/test'

const TEST_FILE_PREFIX = '__e2e_append_render_'

async function createTestFile(
  request: APIRequestContext,
  writeKey: string
): Promise<string> {
  const fileName = `${TEST_FILE_PREFIX}${Date.now()}.md`
  const filePath = `/${fileName}`

  const response = await request.put(`${BACKEND_URL}/w/${writeKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: { content: '# Append Rendering Test\n\nVerify answer and vote rendering in Activity.' },
  })
  expect([200, 201]).toContain(response.status())

  return filePath
}

async function createAppend(
  request: APIRequestContext,
  appendKey: string,
  filePath: string,
  body: Record<string, unknown>
): Promise<string> {
  const response = await request.post(`${BACKEND_URL}/a/${appendKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: body,
  })
  expect(response.status()).toBe(201)
  const json = await response.json()
  expect(json.ok).toBe(true)
  return json.data.id
}

async function deleteTestFile(
  request: APIRequestContext,
  writeKey: string,
  filePath: string
): Promise<void> {
  await request.delete(`${BACKEND_URL}/w/${writeKey}${filePath}`)
}

test.describe('Append Rendering', () => {
  test('renders answer and vote appends in reader activity section', async ({
    page,
    request,
    readKey,
    appendKey,
    writeKey,
  }) => {
    const filePath = await createTestFile(request, writeKey)

    try {
      const taskId = await createAppend(request, appendKey, filePath, {
        author: 'e2e-task-author',
        type: 'task',
        content: 'Choose retry strategy for webhook queue.',
      })

      const blockedId = await createAppend(request, appendKey, filePath, {
        author: 'e2e-blocker',
        type: 'blocked',
        ref: taskId,
        content: 'Need decision on FIFO vs priority override.',
      })

      await createAppend(request, appendKey, filePath, {
        author: 'e2e-answerer',
        type: 'answer',
        ref: blockedId,
        content: 'Use FIFO baseline and bounded priority override.',
      })

      await createAppend(request, appendKey, filePath, {
        author: 'e2e-voter',
        type: 'vote',
        ref: taskId,
        value: '+1',
      })

      await page.goto(`/r/${readKey}${filePath}`)
      await page.waitForLoadState('networkidle')

      await expect(page.getByText('Activity', { exact: true })).toBeVisible({ timeout: 10000 })
      await expect(page.locator('[data-append-type="answer"]')).toHaveCount(1)
      await expect(page.locator('[data-append-type="vote"]')).toHaveCount(1)
      await expect(page.locator('[data-append-type="answer"]')).toContainText('Use FIFO baseline and bounded priority override.')
      await expect(page.locator('[data-append-type="vote"]')).toContainText(taskId)
    } finally {
      await deleteTestFile(request, writeKey, filePath)
    }
  })
})
