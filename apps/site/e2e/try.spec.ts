import { zAppendResult, zCreateWorkspaceResponse } from '@mdplane/contract'
import { expect, expectAccessible, test } from './fixtures.ts'

// Each engine names the clipboard permissions differently: WebKit lets a click write without one,
// and Firefox has neither, so the config lets Firefox read without a prompt.
const clipboard: Record<string, string[]> = {
  chromium: ['clipboard-read', 'clipboard-write'],
  webkit: ['clipboard-read'],
}
test.use({ permissions: async ({ browserName }, use) => use(clipboard[browserName] ?? []) })

test('a scripted agent sets a job and works through it, live', async ({ page }) => {
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

  // Copying all three keeps them together, labelled, so the prompt can't push one off the clipboard.
  await dialog.getByRole('button', { name: 'Copy all links' }).click()
  await expect(dialog.getByRole('status')).toHaveText('All links copied.')
  const saved = await page.evaluate(() => navigator.clipboard.readText())
  for (const [name, tier] of [
    ['Read', 'r'],
    ['Append', 'a'],
    ['Write', 'w'],
  ]) {
    expect(saved).toMatch(new RegExp(`^${name}: http://\\S+/${tier}/wk_\\w+\\.\\S+$`, 'm'))
  }

  await dialog.getByRole('button', { name: 'Run a scripted agent' }).click()
  await expect(dialog).toBeHidden()
  const hero = page.locator('#hero-reader')
  await expect(hero.locator('.rd-mode')).toHaveText('Live')
  await expect(hero.locator('.task .chip')).toHaveText('Done', { timeout: 15_000 })
  await expect(hero.getByRole('button', { name: 'Checked. Show the chain' })).toBeVisible()
  await expect(hero.locator('[role="status"]')).toHaveText(
    'New entry: scripted-agent@browser responded to task #2.',
  )

  // The links stay a click away for as long as the page is open.
  await page.getByRole('button', { name: 'Your links' }).click()
  await expect(dialog.getByRole('button', { name: 'Copy all links' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()

  await page.getByRole('link', { name: 'Open the full reader' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/welcome\s*\/?\s*welcome\.md/)
  await expect(page.locator('.rd-url')).toContainText('••••')
  await expectAccessible(page)
})

test('the prompt hands your agent the job, and the page waits for its brief', async ({
  page,
  request,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try it with your agent' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Try it with your agent' })
  await dialog.getByRole('button', { name: 'Create workspace' }).click()
  await dialog.getByRole('button', { name: 'Copy prompt' }).click()
  await expect(dialog.getByRole('status')).toHaveText('Prompt copied.')
  const prompt = await page.evaluate(() => navigator.clipboard.readText())
  // The agent leads, so it gets the write link.
  const write = /^Read (http:\/\/\S+\/w\/wk_\w+\.\w+) and follow the instructions\. Lead /.exec(
    prompt,
  )?.[1]
  expect(write).toBeDefined()

  await dialog.getByRole('button', { name: 'Watch here' }).click()
  const hero = page.locator('#hero-reader')
  await expect(page.locator('#stage-text')).toHaveText('Waiting for your agent to write the brief…')
  await expect(hero).toBeHidden()

  const put = await request.put(`${write}/files/queue.md`, {
    headers: { 'If-None-Match': '*', 'Content-Type': 'text/markdown' },
    data: '# Agent-set job\n\nThree small tasks.\n',
  })
  expect(put.status()).toBe(201)
  await expect(hero).toBeVisible()
  await expect(hero.getByRole('heading', { name: 'Agent-set job' })).toBeVisible()
  await expect(page.locator('#stage-text')).toHaveText(
    "Your agent's entries appear here as it works.",
  )
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
    { type: 'task', author: 'lead@devbox', body: 'Upgrade CI to Node 22.' },
    { type: 'task', author: 'lead@devbox', body: 'Draft the changelog.\nKeep it short.' },
    { type: 'claim', author: 'codex@ci', ref: 2, body: 'Taking this.' },
    { type: 'comment', author: 'lead@devbox', body: 'Thanks, everyone.' },
    { type: 'response', author: 'codex@ci', ref: 2, body: 'CI is green. PR #482.' },
    { type: 'cancel', author: 'lead@devbox', ref: 3, body: 'Not needed.' },
  ]
  // The response finishes the task with the token from the claim.
  let token: string | undefined
  for (const entry of entries) {
    const data = { path: 'queue.md', ...entry, ...(entry.type === 'response' && { token }) }
    // oxlint-disable-next-line no-await-in-loop -- the log keeps the order they're sent in
    const sent = await request.post(`${links.append}/appends`, { data })
    expect(sent.status()).toBe(201)
    // oxlint-disable-next-line no-await-in-loop -- read as each one lands
    token ??= zAppendResult.parse(await sent.json()).lease?.token
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
  // The view redraws on the next frame, so wait for something only the earlier point lacks.
  await expect(view).not.toContainText('cancel on #3')
  await expect(view).toContainText('claim on #2')
  expect(await view.textContent()).toBe(await agentReads(4))
})
