import { zCreateWorkspaceResponse } from '@mdplane/contract'
import { expect, expectAccessible, test } from './fixtures.ts'

test('a scripted agent works through the welcome task, live', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try it with your agent' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Try it with your agent' })
  await expect(dialog.getByRole('button', { name: 'Create workspace' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Create workspace' }).click()
  await expect(dialog.getByRole('button', { name: 'Copy prompt' })).toBeFocused()
  // The buttons copy the links; the page never shows a key.
  await expect(dialog).toContainText('••••')
  await expect(dialog).not.toContainText(/\/[raw]\/[\w-]+\.[\w-]{8,}/)
  await expectAccessible(page)

  await dialog.getByRole('button', { name: 'Run a scripted agent' }).click()
  await expect(dialog).toBeHidden()
  const hero = page.locator('#hero-reader')
  await expect(hero.locator('.rd-flag')).toHaveText('Live')
  await expect(hero.locator('.task .chip')).toHaveText('Done', { timeout: 15_000 })
  await expect(hero.getByRole('button', { name: '✓ Verified' })).toBeVisible()
  await expect(hero.locator('[role="status"]')).toHaveText(
    'New entry: scripted-agent@browser responded to task #2.',
  )

  await page.getByRole('link', { name: 'Open the full reader' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/welcome\s*\/?\s*welcome\.md/)
  await expect(page.locator('.rd-url')).toContainText('••••')
  await expectAccessible(page)
})

// A write link can put anything in a body. The reader has to show it as text.
test('shows a hostile body as text', async ({ page, request }) => {
  const created = await request.post('/workspaces', { data: {} })
  const { links } = zCreateWorkspaceResponse.parse(await created.json())
  const body = [
    '# <img src=x onerror="document.title=1">',
    '<script>document.title=2</script>',
    '[click](javascript:document.title=3) [x](https://example.com/"onmouseover="document.title=4)',
  ].join('\n\n')
  const put = await request.put(`${links.write}/files/brief.md`, {
    headers: { 'If-None-Match': '*', 'Content-Type': 'text/markdown' },
    data: body,
  })
  expect(put.status()).toBe(201)

  await page.goto(links.read)
  const prose = page.locator('.prose')
  await expect(prose).toContainText('<script>document.title=2</script>')
  await expect(prose.locator('img, script')).toHaveCount(0)
  await expect(prose.locator('a')).toHaveCount(1)
  await expect(prose.locator('a')).toHaveAttribute(
    'href',
    'https://example.com/"onmouseover="document.title=4',
  )
  await prose.locator('a').hover()
  await expect(page).toHaveTitle(/brief\.md/)
})

// The reader's Markdown view is what an agent gets from the server, at the head and at any point.
test('shows the same markdown an agent reads', async ({ page, request }) => {
  const created = await request.post('/workspaces', { data: {} })
  const { links } = zCreateWorkspaceResponse.parse(await created.json())
  await request.put(`${links.write}/files/queue.md`, {
    headers: { 'If-None-Match': '*', 'Content-Type': 'text/markdown' },
    data: '# Queue\n\nWork through the tasks below.\n',
  })
  const entries = [
    { type: 'task', author: 'alex', body: 'Upgrade CI to Node 22.' },
    { type: 'task', author: 'alex', body: 'Draft the changelog.\nKeep it short.' },
    { type: 'claim', author: 'codex@ci', ref: 2, body: 'Taking this.' },
    { type: 'comment', author: 'alex', body: 'Thanks, everyone.' },
    { type: 'response', author: 'codex@ci', ref: 2, body: 'CI is green. PR #482.' },
    { type: 'cancel', author: 'alex', ref: 3, body: 'Not needed.' },
  ]
  for (const entry of entries) {
    // oxlint-disable-next-line no-await-in-loop -- the log keeps the order they're sent in
    await request.post(`${links.append}/appends`, { data: { path: 'queue.md', ...entry } })
  }
  const agentReads = async (at?: number) => {
    const query = at === undefined ? '' : `?at=${at}`
    const response = await request.get(`${links.read}/files/queue.md${query}`, {
      headers: { Accept: 'text/markdown' },
    })
    return response.text()
  }

  await page.goto(links.read)
  await page.getByRole('button', { name: 'Markdown' }).click()
  const view = page.locator('.rd-doc .src')
  await expect(view).toContainText('cancel on #3')
  expect(await view.textContent()).toBe(await agentReads())

  await page.getByRole('slider', { name: 'Position in the history' }).fill('4')
  await expect(view).toContainText('claim on #2')
  expect(await view.textContent()).toBe(await agentReads(4))
})
