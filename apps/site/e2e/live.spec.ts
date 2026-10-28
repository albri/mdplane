import { zCreateLinkResult, zCreateWorkspaceResponse } from '@mdplane/contract'
import type { APIRequestContext, Page } from '@playwright/test'
import { expect, showPanel, test } from './fixtures.ts'

type Links = { read: string; append: string; write: string }

// Workspaces are limited to 10 a minute from one address, so the tests here share one per worker
// and run in order. Each test uses files of its own, and its own links where it needs them.
test.describe.configure({ mode: 'default' })

const it = test.extend<
  { files: (contents: Record<string, string>) => Promise<Record<string, string>> },
  { shared: Links }
>({
  shared: [
    async ({ playwright }, use, workerInfo) => {
      const api = await playwright.request.newContext({ baseURL: workerInfo.project.use.baseURL })
      const created = await api.post('/workspaces', { data: {} })
      await use(zCreateWorkspaceResponse.parse(await created.json()).links)
      await api.dispose()
    },
    { scope: 'worker' },
  ],
  // Makes files and returns each one's ETag, for later writes.
  files: async ({ request, shared }, use) => {
    await use(async (contents) => {
      const etags: Record<string, string> = {}
      for (const [path, body] of Object.entries(contents)) {
        // oxlint-disable-next-line no-await-in-loop -- files are made in order
        const put = await request.put(`${shared.write}/files/${path}`, {
          headers: { 'If-None-Match': '*', 'Content-Type': 'text/markdown' },
          data: body,
        })
        expect(put.status()).toBe(201)
        etags[path] = put.headers().etag ?? ''
      }
      return etags
    })
  },
})

// A file name of the test's own, so repeated runs in one workspace don't collide.
const named = (name: string) => `${name}-${it.info().repeatEachIndex}.md`

async function newLink(request: APIRequestContext, shared: Links, tier: 'r' | 'a') {
  const response = await request.post(`${shared.write}/links`, { data: { tier } })
  expect(response.status()).toBe(201)
  return zCreateLinkResult.parse(await response.json())
}

const task = (request: APIRequestContext, link: string, path: string, body: string) =>
  request.post(`${link}/appends`, { data: { path, type: 'task', author: 'alex', body } })

const badge = (page: Page) => page.locator('.rd-flag')

it('a revoked link stops following and says the link no longer works', async ({
  page,
  request,
  shared,
  files,
}) => {
  const path = named('revoked')
  await files({ [path]: '# Brief' })
  const own = await newLink(request, shared, 'r')
  await page.goto(`${own.url}#${path}`)
  await expect(badge(page)).toHaveText('Live')

  const revoked = await request.delete(`${shared.write}/links/${own.link.id}`)
  expect(revoked.status()).toBe(204)
  await expect(badge(page)).toHaveText('Ended')
  await expect(page.locator('#app-status')).toHaveText(/This link doesn't work/)
})

it('reconnects after the live socket drops and misses nothing', async ({
  page,
  request,
  shared,
  files,
}) => {
  const path = named('dropped')
  await files({ [path]: '# Queue' })
  const sockets: Array<() => Promise<void>> = []
  await page.routeWebSocket(/\/live\?after=\d+$/, (socket) => {
    const server = socket.connectToServer()
    sockets.push(async () => {
      await socket.close({ code: 1001 })
      await server.close()
    })
  })
  await page.goto(`${shared.read}#${path}`)
  await expect(badge(page)).toHaveText('Live')

  await sockets[0]?.()
  await expect(badge(page)).toHaveText('Reconnecting…')
  await task(request, shared.append, path, 'Added while the socket was down.')
  await expect(badge(page)).toHaveText('Live')
  await task(request, shared.append, path, 'Added after it came back.')
  await expect(page.locator('.task-text')).toHaveText([
    'Added while the socket was down.',
    'Added after it came back.',
  ])
  expect(sockets).toHaveLength(2)
})

// Offline, nothing is retried, so only coming back online can reconnect.
it('coming back online reconnects at once', async ({ page, context, request, shared, files }) => {
  const path = named('offline')
  await files({ [path]: '# Queue' })
  const drops: Array<() => Promise<void>> = []
  await page.routeWebSocket(/\/live\?after=\d+$/, (socket) => {
    const server = socket.connectToServer()
    drops.push(async () => {
      await socket.close({ code: 1001 })
      await server.close()
    })
  })
  await page.goto(`${shared.read}#${path}`)
  await expect(badge(page)).toHaveText('Live')

  await context.setOffline(true)
  await drops[0]?.()
  await expect(badge(page)).toHaveText('Reconnecting…')
  await task(request, shared.append, path, 'Added while offline.')
  await context.setOffline(false)
  await expect(badge(page)).toHaveText('Live')
  await expect(page.locator('.task-text')).toHaveText(['Added while offline.'])
  expect(drops).toHaveLength(2)
})

it('switching files while entries stream in loses and misfiles nothing', async ({
  page,
  request,
  shared,
  files,
}) => {
  const [a, b] = [named('a'), named('b')]
  await files({ [a]: '# A', [b]: '# B' })
  const writer = await newLink(request, shared, 'a')
  await page.goto(`${shared.read}#${a}`)
  await expect(badge(page)).toHaveText('Live')
  const picker = page.getByRole('combobox', { name: 'File' })

  const sent: Record<string, string[]> = { [a]: [], [b]: [] }
  const posting = (async () => {
    for (let i = 1; i <= 12; i++) {
      for (const path of [a, b]) {
        const body = `${path} task ${i}`
        // oxlint-disable-next-line no-await-in-loop -- the log keeps the order they're sent in
        await task(request, writer.url, path, body)
        sent[path]?.push(body)
      }
    }
  })()
  for (let i = 0; i < 6; i++) {
    // oxlint-disable-next-line no-await-in-loop -- each switch follows the last
    await picker.selectOption(i % 2 === 0 ? b : a)
  }
  await posting

  for (const path of [a, b]) {
    // oxlint-disable-next-line no-await-in-loop -- one file at a time
    await picker.selectOption(path)
    await expect(page.locator('.task-text')).toHaveText(sent[path] ?? [])
    await expect(page.locator('.lg-count')).toHaveText('13 of 13')
  }

  // Back returns to the file before, and the picker follows.
  await page.goBack()
  await expect(picker).toHaveValue(a)
  await expect(page.locator('.task-text').first()).toHaveText(`${a} task 1`)
})

it.describe('a body that fails to load', () => {
  it.use({ failing: [/\/files\/failing-\d+\.md\?at=/] })

  it('keeps its entry, says why and loads on retry', async ({ page, request, shared, files }) => {
    const path = named('failing')
    const etags = await files({ [path]: '# Version 1' })
    await page.goto(`${shared.read}#${path}`)
    await expect(page.locator('.prose')).toHaveText('Version 1')

    const bodies = /\/files\/failing-\d+\.md\?at=/
    await page.route(bodies, (route) =>
      route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{}' }),
    )
    const put = await request.put(`${shared.write}/files/${path}`, {
      headers: { 'If-Match': etags[path] ?? '', 'Content-Type': 'text/markdown' },
      data: '# Version 2',
    })
    expect(put.status()).toBe(200)

    // The write is in the history at once, whatever happens to its body.
    await expect(page.locator('.lg-count')).toHaveText('2 of 2')
    const problem = page.locator('.doc-problem')
    await expect(problem).toContainText("Couldn't load this version.", { timeout: 10_000 })

    await page.unroute(bodies)
    await problem.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('.prose')).toHaveText('Version 2')
  })
})

it('a long file path fits the screen', async ({ page, shared, files }) => {
  const prefix = `${'nested-folder/'.repeat(17)}${it.info().repeatEachIndex}-`
  const long = `${prefix}${'x'.repeat(256 - prefix.length - 3)}.md`
  expect(long).toHaveLength(256)
  await files({ [named('short')]: '# Short', [long]: '# Long' })
  await page.goto(`${shared.read}#${encodeURIComponent(long)}`)
  const picker = page.getByRole('combobox', { name: 'File' })
  await expect(picker).toHaveValue(long)
  const width = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    screen: document.documentElement.clientWidth,
  }))
  expect(width.page).toBe(width.screen)
  expect((await picker.boundingBox())?.width).toBeLessThan(width.screen)
})

it('a long history draws only the rows near the screen', async ({
  page,
  request,
  shared,
  files,
}) => {
  const path = named('long-log')
  await files({ [path]: '# Log' })
  const writer = await newLink(request, shared, 'a')
  for (let i = 1; i <= 120; i++) {
    // oxlint-disable-next-line no-await-in-loop -- the log keeps the order they're sent in
    await task(request, writer.url, path, `Task ${i}`)
  }
  await page.goto(`${shared.read}#${path}`)
  await expect(badge(page)).toHaveText('Live')
  await showPanel(page, 'History')
  const rows = page.locator('.lg-list > li')
  await expect(rows.last()).toHaveAttribute('aria-setsize', '121')
  expect(await rows.count()).toBeLessThan(80)

  await page.getByRole('slider', { name: 'Position in the history' }).fill('1')
  const current = page.locator('.lg-row[aria-current]')
  await expect(current).toHaveAttribute('data-index', '1')
  await expect(current).toBeInViewport()
})

// Checking a chain only shows it matches itself. A head kept from an earlier visit is what shows
// that history was rewritten.
it('warns when the history no longer leads to the head it checked before', async ({
  page,
  shared,
  files,
}) => {
  const path = named('remembered')
  await files({ [path]: '# Brief' })
  const id = /\/r\/(wk_\w+)\./.exec(shared.read)?.[1] ?? ''
  await page.goto(`${shared.read}#${path}`)
  await expect(page.getByRole('button', { name: '✓ Verified' })).toBeVisible()
  const kept = await page.evaluate((key) => localStorage.getItem(key), `mdplane-head:${id}`)
  expect(JSON.parse(kept ?? 'null')).toEqual({
    seq: expect.any(Number),
    hash: expect.stringMatching(/^[0-9a-f]{64}$/),
  })

  // As the history would look to this browser after a rewrite of entry #1.
  await page.evaluate(
    ([key, head]) => localStorage.setItem(key, head),
    [`mdplane-head:${id}`, JSON.stringify({ seq: 1, hash: '0'.repeat(64) })],
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Changed at #1' })).toBeVisible()
})
