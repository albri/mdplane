import { zProblem } from '@mdplane/contract'
import { runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, test } from 'vitest'
import { clientAddress } from '../src/http.ts'
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
      // Takes the workspace back to the schema it had before the budget.
      const stub = env.WORKSPACES.getByName(ws.id)
      await runInDurableObject(stub, (instance, state) => {
        state.storage.sql.exec(`DROP TABLE schema_version`)
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
