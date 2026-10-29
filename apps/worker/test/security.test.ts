import {
  verifyChain,
  zCreateLinkResult,
  zLinkList,
  zLogPage,
  zProblem,
  zWorkspace,
} from '@mdplane/contract'
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import config from '../wrangler.jsonc?raw'
import { append, call, createWorkspace, json, ORIGIN, writeFile } from './helpers.ts'

const MADE_UP = 'wk_AAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

async function snapshot(response: Response) {
  return {
    status: response.status,
    type: response.headers.get('Content-Type'),
    body: await response.text(),
  }
}

async function createLink(write: string, request: Record<string, unknown>) {
  const response = await call(`${write}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return {
    response,
    result: response.status === 201 ? zCreateLinkResult.parse(await json(response)) : null,
  }
}

const secretOf = (link: string) => link.split('.')[1] ?? ''

describe('a link that fails to authorise', () => {
  test('gets the same 404 however it fails', async () => {
    const ws = await createWorkspace()
    const readKey = ws.read.slice(3)

    const { result } = await createLink(ws.write, { tier: 'r' })
    const revoked = (result?.url ?? '').slice(ORIGIN.length)
    await call(`${ws.write}/links/${result?.link.id}`, { method: 'DELETE' })

    const expired = await createWorkspace()
    await runDurableObjectAlarm(env.WORKSPACES.getByName(expired.id))

    const failures = [
      `/r/${ws.id}.${'x'.repeat(32)}`, // wrong secret
      `/w/${readKey}`, // a read key presented as a write link
      `/r/${MADE_UP}`, // no such workspace
      `/r/${ws.id}.${secretOf(ws.read).slice(1)}`, // malformed key
      `/q/${readKey}`, // no such tier
      revoked,
      expired.read,
      '/nowhere',
    ]
    const responses = await Promise.all(failures.map(async (path) => snapshot(await call(path))))
    const expected = await snapshot(await call(`/r/${MADE_UP}`))
    expect(expected.status).toBe(404)
    for (const response of responses) expect(response).toEqual(expected)
  })

  test('a missing file looks like a wrong key', async () => {
    const ws = await createWorkspace()
    const missing = await snapshot(await call(`${ws.read}/files/nope.md`))
    expect(missing).toEqual(await snapshot(await call(`/r/${MADE_UP}/files/nope.md`)))
  })
})

describe('tiers', () => {
  test('each link can only make the requests its tier allows', async () => {
    const ws = await createWorkspace()
    await writeFile(ws.write, 'queue.md', 'Brief\n')
    const comment = { path: 'queue.md', type: 'comment', author: 'a', body: 'hi' }

    expect((await append(ws.read, comment)).status).toBe(404)
    expect((await append(ws.append, comment)).status).toBe(201)
    expect((await writeFile(ws.append, 'other.md', 'x')).status).toBe(404)
    expect((await call(`${ws.append}/links`)).status).toBe(404)
    expect((await call(`${ws.write}/links`)).status).toBe(200)
  })

  test('responses are never cached and never leak the URL', async () => {
    const ws = await createWorkspace()
    for (const response of [await call(ws.read), await call(`/r/${MADE_UP}`)]) {
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    }
  })
})

async function scoped() {
  const ws = await createWorkspace()
  await writeFile(ws.write, 'queue.md', 'Top level\n')
  await writeFile(ws.write, 'release/queue.md', 'Release\n')
  await append(ws.append, {
    path: 'queue.md',
    type: 'task',
    author: 'lead@devbox',
    body: 'Secret plan',
  })
  const { result } = await createLink(ws.write, { tier: 'w', folder: 'release' })
  return { ...ws, release: (result?.url ?? '').slice(ORIGIN.length), linkId: result?.link.id }
}

describe('folder links', () => {
  test('only reach files in their folder', async () => {
    const ws = await scoped()
    expect((await call(`${ws.release}/files/release/queue.md`)).status).toBe(200)
    expect((await call(`${ws.release}/files/queue.md`)).status).toBe(404)
    expect((await writeFile(ws.release, 'queue.md', 'x', '"*"')).status).toBe(404)
    const task = { path: 'queue.md', type: 'task', author: 'a', body: 'x' }
    expect((await append(ws.release, task)).status).toBe(404)
    expect((await call(`${ws.release}/search?q=secret`)).status).toBe(200)
    expect(await json(await call(`${ws.release}/search?q=secret`))).toEqual({ results: [] })

    const workspace = zWorkspace.parse(
      await json(await call(ws.release, { headers: { Accept: 'application/json' } })),
    )
    expect(workspace.files.map((f) => f.path)).toEqual(['release/queue.md'])
  })

  test('stop at the folder, not at names that start with it', async () => {
    const ws = await scoped()
    for (const path of ['release-notes/x.md', 'releases.md']) {
      // oxlint-disable-next-line no-await-in-loop -- files are made in order
      await writeFile(ws.write, path, 'Sibling plan\n')
      // oxlint-disable-next-line no-await-in-loop -- one path at a time keeps the failure readable
      const { status } = await call(`${ws.release}/files/${path}`)
      expect({ path, status }).toEqual({ path, status: 404 })
    }
    expect(await json(await call(`${ws.release}/search?q=sibling`))).toEqual({ results: [] })
    const workspace = zWorkspace.parse(
      await json(await call(ws.release, { headers: { Accept: 'application/json' } })),
    )
    expect(workspace.files.map((f) => f.path)).toEqual(['release/queue.md'])
  })

  test('see other entries redacted, with the chain still checkable', async () => {
    const ws = await scoped()
    const page = zLogPage.parse(await json(await call(`${ws.release}/log`)))
    expect(page.entries).toHaveLength(3)
    expect(page.entries[0]).toEqual({
      seq: 1,
      prev: expect.any(String),
      hash: expect.any(String),
      redacted: true,
    })
    expect(page.entries[1]).toMatchObject({ path: 'release/queue.md', type: 'write' })
    expect(JSON.stringify(page)).not.toContain('Secret plan')
    expect(await verifyChain(page.entries)).toEqual({ ok: true, head: page.head.hash })
  })

  test('can only create and revoke links inside their folder', async () => {
    const ws = await scoped()
    const outside = await createLink(ws.release, { tier: 'r', folder: 'other' })
    expect(outside.response.status).toBe(422)
    const inside = await createLink(ws.release, { tier: 'a', folder: 'release/notes' })
    expect(inside.result?.link.folder).toBe('release/notes')
    const inherited = await createLink(ws.release, { tier: 'r' })
    expect(inherited.result?.link.folder).toBe('release')

    const listed = zLinkList.parse(await json(await call(`${ws.release}/links`)))
    expect(listed.links.every((l) => l.folder?.startsWith('release'))).toBe(true)

    const all = zLinkList.parse(await json(await call(`${ws.write}/links`)))
    const unscoped = all.links.find((l) => l.folder === null)
    expect((await call(`${ws.release}/links/${unscoped?.id}`, { method: 'DELETE' })).status).toBe(
      404,
    )
  })
})

describe('search', () => {
  test('refuses control characters, which would end the quoted search', async () => {
    const ws = await createWorkspace()
    const response = await call(`${ws.read}/search?q=%00`)
    expect(response.status).toBe(400)
    expect(zProblem.parse(await json(response)).code).toBe('invalid_request')
  })
})

describe('revoking', () => {
  test('stops a link at once, and a link cannot revoke itself', async () => {
    const ws = await createWorkspace()
    const { result } = await createLink(ws.write, { tier: 'a' })
    const link = (result?.url ?? '').slice(ORIGIN.length)
    expect((await call(link)).status).toBe(200)
    expect((await call(`${ws.write}/links/${result?.link.id}`, { method: 'DELETE' })).status).toBe(
      204,
    )
    expect((await call(link)).status).toBe(404)

    const self = zWorkspace.parse(
      await json(await call(ws.write, { headers: { Accept: 'application/json' } })),
    )
    const own = await call(`${ws.write}/links/${self.link.id}`, { method: 'DELETE' })
    expect(zProblem.parse(await json(own))).toMatchObject({ status: 422, code: 'invalid_request' })
  })
})

describe('paths', () => {
  test('cannot escape the workspace or name hidden files', async () => {
    const ws = await createWorkspace()
    const invalid = [
      '..%2Fsecret.md',
      '%2e%2e%2Fsecret.md',
      '.hidden.md',
      'notes/.env.md',
      'a//b.md',
      'plain.txt',
    ]
    for (const path of invalid) {
      // oxlint-disable-next-line no-await-in-loop -- one at a time keeps the failure readable
      const { status } = await writeFile(ws.write, path, 'x')
      expect({ path, status }).toEqual({ path, status: 400 })
    }
    // The URL parser resolves unencoded dot segments before routing, so these never reach a file.
    expect((await writeFile(ws.write, '../secret.md', 'x')).status).toBe(404)
    const workspace = zWorkspace.parse(
      await json(await call(ws.write, { headers: { Accept: 'application/json' } })),
    )
    expect(workspace.files).toEqual([])
  })
})

describe('expiry', () => {
  test('ends a workspace when it is due, even before the alarm runs', async () => {
    const ws = await createWorkspace()
    await writeFile(ws.write, 'queue.md', 'Brief\n')
    await runInDurableObject(env.WORKSPACES.getByName(ws.id), (_, state) => {
      state.storage.sql.exec(
        `UPDATE meta SET expires_at = ?`,
        new Date(Date.now() - 1).toISOString(),
      )
    })
    expect((await call(ws.read)).status).toBe(404)
    expect((await call(`${ws.read}/files/queue.md`)).status).toBe(404)
    const comment = { path: 'queue.md', type: 'comment', author: 'a', body: 'late' }
    expect((await append(ws.append, comment)).status).toBe(404)
  })

  test('the alarm deletes the workspace', async () => {
    const ws = await createWorkspace()
    await writeFile(ws.write, 'queue.md', 'Brief\n')
    const stub = env.WORKSPACES.getByName(ws.id)
    expect(await runDurableObjectAlarm(stub)).toBe(true)
    expect((await call(`${ws.read}/files/queue.md`)).status).toBe(404)
    expect((await call(ws.write)).status).toBe(404)
  })
})

// One address for every request, so they share a limit.
const createFromOneAddress = () =>
  call('/workspaces', { method: 'POST', headers: { 'CF-Connecting-IP': '192.0.2.1' } })

describe('creating workspaces', () => {
  test('is rate limited per address', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 10; i++) {
      // oxlint-disable-next-line no-await-in-loop -- the limit counts requests in order
      statuses.push((await createFromOneAddress()).status)
    }
    expect(statuses.every((s) => s === 201)).toBe(true)
    const limited = await createFromOneAddress()
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('60')
  })
})

const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

describe('browsers', () => {
  test('get the reader from a working link, under a strict content security policy', async () => {
    const ws = await createWorkspace()
    const response = await call(ws.read, { headers: { Accept: BROWSER } })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'self'")
    expect(response.headers.get('Content-Security-Policy')).toContain('trusted-types lit-html')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
    const html = await response.text()
    expect(html).toContain('id="reader"')
    expect(html).not.toContain(ws.read.split('.')[1])
  })

  test('get the same page for every 404', async () => {
    const ws = await createWorkspace()
    const pages = await Promise.all(
      [`/r/${MADE_UP}`, `/w/${ws.read.slice(3)}`, `${ws.read}/files/nope.md`, '/nowhere'].map(
        async (path) => snapshot(await call(path, { headers: { Accept: BROWSER } })),
      ),
    )
    expect(pages[0]?.status).toBe(404)
    expect(pages[0]?.type).toContain('text/html')
    for (const page of pages) expect(page).toEqual(pages[0])
  })
})

// The config allows comments and trailing commas. Its comments all take whole lines.
const worker = z.object({
  observability: z
    .object({
      logs: z.object({ invocation_logs: z.boolean().optional() }).optional(),
      traces: z.object({ enabled: z.boolean().optional() }).optional(),
    })
    .optional(),
  durable_objects: z.unknown(),
  ratelimits: z.array(z.object({ namespace_id: z.string() }).loose()),
  vars: z.record(z.string(), z.string()),
  workers_dev: z.boolean().optional(),
  preview_urls: z.boolean().optional(),
})
const deployed = worker
  .extend({ env: z.object({ production: worker }) })
  .parse(JSON.parse(config.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1')))
const production = deployed.env.production

describe("Cloudflare's logs", () => {
  test('keep no request URLs, since each one holds a key', () => {
    // mdplane.dev inherits these settings unless it sets its own. Invocation logs are on unless
    // they are turned off.
    const settings = [deployed.observability, production.observability ?? deployed.observability]
    for (const observability of settings) {
      expect(observability?.logs?.invocation_logs).toBe(false)
      expect(observability?.traces?.enabled ?? false).toBe(false)
    }
  })
})

// mdplane.dev is a wrangler environment, which inherits no bindings or vars, so it repeats them
// and could drift from the Worker these tests run.
describe('mdplane.dev', () => {
  test('runs with the bindings and vars that the tests run with', () => {
    // Each Worker counts in its own namespaces.
    const limits = (target: typeof production) =>
      target.ratelimits.map((limit) => ({ ...limit, namespace_id: undefined }))
    expect(production.vars).toEqual(deployed.vars)
    expect(production.durable_objects).toEqual(deployed.durable_objects)
    expect(limits(production)).toEqual(limits(deployed))
  })

  test('is reached only through its zone, where the rate-limiting rule applies', () => {
    expect(production.workers_dev).toBe(false)
    expect(production.preview_urls).toBe(false)
  })
})
