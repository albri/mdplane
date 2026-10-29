import {
  deriveTasks,
  type Entry,
  FILE_VIEW_LIMITS,
  pickEntries,
  pickTasks,
  zCreateLinkResult,
  zFileView,
  zLogPage,
  zProblem,
  zSearchResults,
} from '@mdplane/contract'
import { runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, test } from 'vitest'
import { clientAddress } from '../src/http.ts'
import { hashSecret } from '../src/keys.ts'
import { LIMITS } from '../src/workspace.ts'
import { append, call, createWorkspace, json, sleep, withVars, writeFile } from './helpers.ts'

const problemOf = async (response: Response) => zProblem.parse(await json(response))

const madeUpKey = (i: number) => `wk_AAAAAAAAAAAA.${String(i).padStart(32, 'B')}`

// Each request from a different address in one /64.
const createFromSubnet = (i: number) =>
  call('/workspaces', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': `2001:db8:77:1::${i.toString(16)}` },
  })

describe('the limit per address', () => {
  test('counts every keyed request, whatever secret it makes up', async () => {
    const from = { 'CF-Connecting-IP': '203.0.113.7' }
    const responses = await Promise.all(
      Array.from({ length: 600 }, (_, i) => call(`/r/${madeUpKey(i)}`, { headers: from })),
    )
    expect(responses.every((r) => r.status === 404)).toBe(true)
    const limited = await call(`/r/${madeUpKey(600)}`, { headers: from })
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('60')
    // Another address is still answered.
    expect((await call(`/r/${madeUpKey(601)}`)).status).toBe(404)
  })

  test('counts an IPv6 /64 as one address', () => {
    expect(clientAddress('2001:db8:1:2:aaaa::1')).toBe(
      clientAddress('2001:DB8:1:2:bbbb:cccc:dddd:eeee'),
    )
    expect(clientAddress('2001:db8:1:2::')).toBe('2001:0db8:0001:0002::/64')
    expect(clientAddress('2001:db8:1:3::1')).not.toBe(clientAddress('2001:db8:1:2::1'))
    expect(clientAddress('::1')).toBe('0000:0000:0000:0000::/64')
    expect(clientAddress('192.0.2.1')).toBe('192.0.2.1')
  })

  test('applies to creating workspaces, so rotating within a /64 gets nowhere', async () => {
    for (let i = 1; i <= 10; i++) {
      // oxlint-disable-next-line no-await-in-loop -- the limit counts requests in order
      expect((await createFromSubnet(i)).status).toBe(201)
    }
    expect((await createFromSubnet(11)).status).toBe(429)
  })
})

describe('creating workspaces', () => {
  test('can be switched off, while existing links keep working', async () => {
    const ws = await createWorkspace()
    await withVars({ CREATE_ENABLED: 'false' }, async () => {
      const refused = await call('/workspaces', { method: 'POST' })
      expect(refused.status).toBe(503)
      expect(await problemOf(refused)).toMatchObject({ code: 'creation_paused' })
      expect((await call(ws.read)).status).toBe(200)
    })
    expect((await call('/workspaces', { method: 'POST' })).status).toBe(201)
  })

  test('stops for the day at the daily limit, across every address', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const made = await runInDurableObject(env.QUOTA.getByName('creates'), (_, state) => {
      const [row] = state.storage.sql
        .exec<{ count: number }>(`SELECT count FROM creates WHERE day = ?`, today)
        .toArray()
      return row?.count ?? 0
    })
    await withVars({ CREATE_DAILY_LIMIT: String(made + 2) }, async () => {
      expect((await call('/workspaces', { method: 'POST' })).status).toBe(201)
      expect((await call('/workspaces', { method: 'POST' })).status).toBe(201)
      const refused = await call('/workspaces', { method: 'POST' })
      expect(refused.status).toBe(503)
      expect(await problemOf(refused)).toMatchObject({ code: 'creation_paused' })
      const wait = Number(refused.headers.get('Retry-After'))
      expect(wait).toBeGreaterThan(0)
      expect(wait).toBeLessThanOrEqual(86_400)
    })
  })

  test('the count starts again each day', async () => {
    const quota = env.QUOTA.getByName('test')
    expect(await quota.take('2026-11-01', 1)).toBe(true)
    expect(await quota.take('2026-11-01', 1)).toBe(false)
    expect(await quota.take('2026-11-02', 1)).toBe(true)
  })
})

const BUDGET = 40_000

describe('the text budget', () => {
  test('refuses an entry that would take a workspace over it', async () => {
    await withVars({ WORKSPACE_MAX_BYTES: String(BUDGET) }, async () => {
      const ws = await createWorkspace()
      expect((await writeFile(ws.write, 'queue.md', 'Brief\n')).status).toBe(201)
      // Two bytes a character, so each comment is 30,000 bytes against the budget.
      const comment = { path: 'queue.md', type: 'comment', author: 'a', body: 'é'.repeat(15_000) }
      expect((await append(ws.append, comment)).status).toBe(201)
      const refused = await append(ws.append, comment)
      expect(refused.status).toBe(409)
      expect(await problemOf(refused)).toMatchObject({ code: 'workspace_full' })
      // What still fits is accepted.
      const small = { path: 'queue.md', type: 'comment', author: 'a', body: 'Still here.' }
      expect((await append(ws.append, small)).status).toBe(201)
    })
  })

  test('counts every distinct version of a body once', async () => {
    await withVars({ WORKSPACE_MAX_BYTES: String(BUDGET) }, async () => {
      const ws = await createWorkspace()
      const [one, two] = ['1'.repeat(15_000), '2'.repeat(15_000)]
      const first = await writeFile(ws.write, 'brief.md', one)
      const second = await writeFile(ws.write, 'brief.md', two, first.headers.get('ETag') ?? '')
      // Going back to the first version adds nothing to store.
      const third = await writeFile(ws.write, 'brief.md', one, second.headers.get('ETag') ?? '')
      expect(third.status).toBe(200)
      const refused = await writeFile(
        ws.write,
        'brief.md',
        '3'.repeat(15_000),
        third.headers.get('ETag') ?? '',
      )
      expect(refused.status).toBe(409)
      expect(await problemOf(refused)).toMatchObject({ code: 'workspace_full' })
    })
  })

  test('covers workspaces made before the budget, once they are next used', async () => {
    await withVars({ WORKSPACE_MAX_BYTES: String(BUDGET) }, async () => {
      const ws = await createWorkspace()
      await writeFile(ws.write, 'brief.md', 'x'.repeat(30_000))
      // Takes the workspace back to the schema it had before any migration.
      const stub = env.WORKSPACES.getByName(ws.id)
      await runInDurableObject(stub, (instance, state) => {
        state.storage.sql.exec(`DROP TABLE schema_version`)
        state.storage.sql.exec(`DROP TABLE leases`)
        state.storage.sql.exec(`ALTER TABLE meta DROP COLUMN bytes`)
        Reflect.set(instance, 'exists', false)
      })
      const big = { path: 'brief.md', type: 'comment', author: 'a', body: 'y'.repeat(15_000) }
      expect((await append(ws.append, big)).status).toBe(409)
    })
  })
})

describe('waiting on a workspace', () => {
  test(`takes at most ${LIMITS.polls} long polls at once`, async () => {
    const ws = await createWorkspace()
    const poll = () => call(`${ws.read}/log?after=0`, { headers: { Prefer: 'wait=10' } })
    // The object takes requests one at a time, so whichever arrives last is the one refused.
    const polls = Array.from({ length: LIMITS.polls + 1 }, poll)
    const refused = await Promise.race(
      polls.map(async (p) => p.then((r) => (r.status === 429 ? r : new Promise<never>(() => {})))),
    )
    expect(refused.headers.get('Retry-After')).toBe('5')
    await writeFile(ws.write, 'queue.md', 'Brief\n')
    const statuses = (await Promise.all(polls)).map((r) => r.status)
    expect(statuses.toSorted((a, b) => a - b)).toEqual([
      ...Array.from({ length: LIMITS.polls }, () => 200),
      429,
    ])
    // Each one that answered has stopped waiting, so another can.
    const next = await call(`${ws.read}/log?after=1`, { headers: { Prefer: 'wait=1' } })
    expect(next.status).toBe(200)
  })

  test('a poll the Worker lost gives up its place when its wait is up', async () => {
    const ws = await createWorkspace()
    const headers = {
      Upgrade: 'websocket',
      'x-mdplane-tier': 'r',
      'x-mdplane-secret-hash': await hashSecret(ws.read.split('.')[1] ?? ''),
    }
    // Polls asked for the way the Worker asks, but never closed, as if their requests were lost.
    const stub = env.WORKSPACES.getByName(ws.id)
    const lost = await Promise.all(
      Array.from({ length: LIMITS.polls }, () =>
        stub.fetch('https://workspace/wait?after=0&limit=100&wait=0', { headers }),
      ),
    )
    for (const response of lost) response.webSocket?.accept()
    const poll = () => call(`${ws.read}/log?after=0`, { headers: { Prefer: 'wait=1' } })
    expect((await poll()).status).toBe(429)
    await sleep(2500)
    expect((await poll()).status).toBe(200)
  })

  test(`takes at most ${LIMITS.sockets} live connections at once`, async () => {
    const ws = await createWorkspace()
    const connect = () => call(`${ws.read}/live`, { headers: { Upgrade: 'websocket' } })
    const opened = await Promise.all(Array.from({ length: LIMITS.sockets }, connect))
    expect(opened.every((r) => r.status === 101)).toBe(true)
    const sockets = opened.flatMap((r) => (r.webSocket ? [r.webSocket] : []))
    for (const socket of sockets) socket.accept()
    const refused = await connect()
    expect(refused.status).toBe(429)
    expect(await problemOf(refused)).toMatchObject({ code: 'rate_limited' })
    for (const socket of sockets) socket.close()
  })
})

describe('reading a busy file', () => {
  test('shows its open tasks and newest entries, and says where the rest are', async () => {
    const ws = await createWorkspace()
    await writeFile(ws.write, 'queue.md', 'Brief\n')
    await Promise.all(
      Array.from({ length: 102 }, (_, i) =>
        append(ws.append, { path: 'queue.md', type: 'task', author: 'a', body: `Task ${i}` }),
      ),
    )
    for (const ref of [2, 3]) {
      // oxlint-disable-next-line no-await-in-loop -- the cancels land after the tasks, in order
      await append(ws.append, { path: 'queue.md', type: 'cancel', author: 'a', ref })
    }
    const read = (accept: string) =>
      call(`${ws.read}/files/queue.md`, { headers: { Accept: accept } })
    const view = zFileView.parse(await json(await read('application/json')))
    // 102 tasks, two of them cancelled: the 100 open ones fit, the cancelled ones don't.
    expect(view.tasks).toHaveLength(100)
    expect(view.tasks.every((task) => task.status === 'open')).toBe(true)
    expect(view.omitted).toEqual({ tasks: 2, entries: 5 })
    // A write, 102 tasks and 2 cancels: the newest 100 of 105 entries.
    expect(view.entries.map((e) => e.seq)).toEqual(Array.from({ length: 100 }, (_, i) => i + 6))
    expect(view.since).toBe(0)

    const text = await (await read('text/markdown')).text()
    expect(text).toContain('2 more tasks aren’t shown.')
    expect(text).toContain('5 older entries are at `GET $URL/log?path=queue.md&after=0`.')
  })

  test('keeps its tasks and entries within a byte budget, cut where the reader cuts them', async () => {
    const ws = await createWorkspace()
    await writeFile(ws.write, 'queue.md', 'Brief\n')
    // Two bytes a character, so counting characters would fit twice as many.
    const body = 'é'.repeat(8000)
    await Promise.all(
      Array.from({ length: 10 }, () =>
        append(ws.append, { path: 'queue.md', type: 'task', author: 'a', body }),
      ),
    )
    const view = zFileView.parse(
      await json(
        await call(`${ws.read}/files/queue.md`, { headers: { Accept: 'application/json' } }),
      ),
    )
    // 16,000 bytes a task: eight fit in 128 KiB, and the write entry has no body.
    expect(view.tasks.map((task) => task.seq)).toEqual([2, 3, 4, 5, 6, 7, 8, 9])
    expect(view.entries.map((entry) => entry.seq)).toEqual([4, 5, 6, 7, 8, 9, 10, 11])
    expect(view.omitted).toEqual({ tasks: 2, entries: 3 })
    expect(FILE_VIEW_LIMITS.bytes).toBe(131_072)

    // The reader replays the log to show what an agent gets.
    const log = zLogPage
      .parse(await json(await call(`${ws.read}/log`)))
      .entries.filter((item): item is Entry => !('redacted' in item))
    expect(pickTasks(deriveTasks(log, Date.now())).map((task) => task.seq)).toEqual(
      view.tasks.map((task) => task.seq),
    )
    expect(pickEntries(log).map((entry) => entry.seq)).toEqual(
      view.entries.map((entry) => entry.seq),
    )
    const text = await (await call(`${ws.read}/files/queue.md`)).text()
    expect(text).toContain(
      '2 more tasks aren’t shown. Each is a `task` entry at `GET $URL/log?path=queue.md&after=0`.',
    )
  })

  test('the overview carries only what its summary of each open task needs', async () => {
    const ws = await createWorkspace()
    await writeFile(ws.write, 'queue.md', 'Brief\n')
    const long = { path: 'queue.md', type: 'task', author: 'a', body: 'x'.repeat(16_000) }
    await append(ws.append, long)
    await append(ws.append, long)
    await append(ws.append, { path: 'queue.md', type: 'cancel', author: 'a', ref: 3 })
    const secret = ws.read.split('.')[1] ?? ''
    const result = await env.WORKSPACES.getByName(ws.id).overview({
      tier: 'r',
      secretHash: await hashSecret(secret),
    })
    if (!result.ok) throw new Error('overview failed')
    const tasks = result.value.tasks['queue.md'] ?? []
    expect(tasks.map((task) => [task.seq, task.status])).toEqual([[2, 'open']])
    expect(tasks[0]?.body.length).toBeLessThanOrEqual(240)
  })
})

// 40 entries of 16,000 bytes come to 640,000 bytes, more than one page carries.
async function withLongLog() {
  const ws = await createWorkspace()
  await writeFile(ws.write, 'queue.md', 'Brief\n')
  const body = 'x'.repeat(16_000)
  await Promise.all(
    Array.from({ length: 40 }, () =>
      append(ws.append, { path: 'queue.md', type: 'comment', author: 'a', body }),
    ),
  )
  return ws
}

describe('reading the log', () => {
  test('stops a page at its byte budget, and its cursor reads on with nothing missed', async () => {
    const ws = await withLongLog()
    const first = zLogPage.parse(await json(await call(`${ws.read}/log?limit=500`)))
    // The write and 32 comments fit in 512 KiB; a 33rd comment would not.
    expect(LIMITS.pageBytes).toBe(524_288)
    expect(first.entries.map((e) => e.seq)).toEqual(Array.from({ length: 33 }, (_, i) => i + 1))
    expect(first).toMatchObject({ cursor: 33, head: { seq: 41 } })
    const second = zLogPage.parse(await json(await call(`${ws.read}/log?after=33&limit=500`)))
    expect(second.entries.map((e) => e.seq)).toEqual(Array.from({ length: 8 }, (_, i) => i + 34))
    expect(second.cursor).toBe(41)
  })

  test('does not count or send the bodies a folder link sees redacted', async () => {
    const ws = await withLongLog()
    const created = await call(`${ws.write}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'r', folder: 'release' }),
    })
    const { url } = zCreateLinkResult.parse(await json(created))
    const response = await call(`${new URL(url).pathname}/log?limit=500`)
    const text = await response.text()
    expect(text).not.toContain('xxxx')
    const page = zLogPage.parse(JSON.parse(text))
    expect(page.entries).toHaveLength(41)
    expect(page.entries.every((item) => 'redacted' in item)).toBe(true)
    expect(page.cursor).toBe(41)
  })
})

describe('search', () => {
  // FTS5's snippet() took over a second for each of these bodies, and the workspace answered
  // nothing else meanwhile. Ranking and cutting the snippet take a few milliseconds.
  test('stays quick over the longest bodies', async () => {
    const ws = await createWorkspace()
    const words = ['owl', 'merge', 'device', 'lantern', 'sync', 'note', 'launch']
    const body = (seed: number) =>
      Array.from({ length: 45_000 }, (_, i) => words[(i * 3 + seed) % words.length])
        .join(' ')
        .slice(0, 262_144)
    for (const i of [1, 2]) {
      // oxlint-disable-next-line no-await-in-loop -- one write at a time
      expect((await writeFile(ws.write, `long-${i}.md`, body(i))).status).toBe(201)
    }
    const started = Date.now()
    const response = await call(`${ws.read}/search?q=owl%20merge%20device&limit=50`)
    const took = Date.now() - started
    const { results } = zSearchResults.parse(await json(response))
    expect(results.map((r) => r.path).toSorted()).toEqual(['long-1.md', 'long-2.md'])
    expect(took).toBeLessThan(250)
  })
})

describe('request bodies', () => {
  test('one sent without a length is read only as far as its limit', async () => {
    let pulled = 0
    const chunk = new Uint8Array(65_536).fill(120)
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.byteLength
        if (pulled > 4_194_304) controller.close()
        else controller.enqueue(chunk)
      },
    })
    const response = await call(`/w/${madeUpKey(0)}/files/big.md`, {
      method: 'PUT',
      headers: { 'If-None-Match': '*' },
      body,
    })
    expect(response.status).toBe(413)
    // The limit is 256 KiB; reading on would have pulled all 4 MiB.
    expect(pulled).toBeLessThan(1_048_576)
  })
})

describe('links', () => {
  test('only live ones count toward the limit', async () => {
    const ws = await createWorkspace()
    const make = () =>
      call(`${ws.write}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'r' }),
      })
    for (let i = 0; i < LIMITS.links; i++) {
      // oxlint-disable-next-line no-await-in-loop -- each link is made, then revoked
      const { link } = zCreateLinkResult.parse(await json(await make()))
      // oxlint-disable-next-line no-await-in-loop -- each link is made, then revoked
      expect((await call(`${ws.write}/links/${link.id}`, { method: 'DELETE' })).status).toBe(204)
    }
    // The workspace's own three links, and as many more as the limit leaves.
    const made = await Promise.all(Array.from({ length: LIMITS.links - 3 }, make))
    expect(made.every((r) => r.status === 201)).toBe(true)
    const refused = await make()
    expect(refused.status).toBe(409)
    expect(await problemOf(refused)).toMatchObject({ code: 'workspace_full' })
  })
})
