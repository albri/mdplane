import {
  verifyChain,
  zAppendResult,
  zCreateLinkResult,
  zFileView,
  zLogPage,
  zProblem,
  zSearchResults,
  zWorkspace,
  zWriteResult,
} from '@mdplane/contract'
import { describe, expect, test } from 'vitest'
import { append, call, createWorkspace, json, sleep, writeFile } from './helpers.ts'

const BRIEF = '# Release 2.4\n\nShip on Thursday. Claim a task before you start.\n'

async function withQueue() {
  const ws = await createWorkspace('release-2-4')
  expect((await writeFile(ws.write, 'queue.md', BRIEF)).status).toBe(201)
  const task = zAppendResult.parse(
    await json(
      await append(ws.append, {
        path: 'queue.md',
        type: 'task',
        author: 'alex',
        body: 'Upgrade CI to Node 22.',
      }),
    ),
  )
  return { ...ws, task: task.entry.seq }
}

async function claim(link: string, ref: number, author: string, token?: string) {
  return append(link, { path: 'queue.md', type: 'claim', author, ref, ...(token && { token }) })
}

async function claimed(link: string, ref: number, author: string) {
  const { lease } = zAppendResult.parse(await json(await claim(link, ref, author)))
  if (!lease) throw new Error('A claim returns a lease')
  return lease
}

const seqOf = async (response: Response) => zAppendResult.parse(await json(response)).entry.seq

async function problemCode(response: Response) {
  return zProblem.parse(await json(response)).code
}

describe('a workspace', () => {
  test('tells an agent what its link can do and what is happening', async () => {
    const { write, append: appendLink } = await withQueue()
    const text = await (await call(appendLink)).text()
    expect(text).toContain('You have an append link.')
    expect(text).toContain('## Right now')
    expect(text).toMatch(/#2 open: Upgrade CI to Node 22\./)

    const response = await call(write, { headers: { Accept: 'application/json' } })
    const workspace = zWorkspace.parse(await json(response))
    expect(workspace.name).toBe('release-2-4')
    expect(workspace.link.tier).toBe('w')
    expect(workspace.files.map((f) => f.path)).toEqual(['queue.md'])
    expect(response.headers.get('ETag')).toBe(`"${workspace.head.hash}"`)
  })
})

describe('file bodies', () => {
  test('need a precondition, and keep every version', async () => {
    const ws = await createWorkspace()
    const first = await writeFile(ws.write, 'notes/plan.md', 'one\n')
    expect(first.status).toBe(201)
    const etag = first.headers.get('ETag') ?? ''

    expect((await writeFile(ws.write, 'notes/plan.md', 'again\n')).status).toBe(412)
    const bare = await call(`${ws.write}/files/notes/plan.md`, { method: 'PUT', body: 'x' })
    expect(bare.status).toBe(428)
    expect(await problemCode(bare)).toBe('precondition_required')

    const second = await writeFile(ws.write, 'notes/plan.md', 'two\n', etag)
    expect(second.status).toBe(200)
    const { entry } = zWriteResult.parse(await json(second))
    expect(entry.version).toBe(2)
    expect((await writeFile(ws.write, 'notes/plan.md', 'three\n', etag)).status).toBe(412)

    const read = (query = '') =>
      call(`${ws.read}/files/notes/plan.md${query}`, { headers: { Accept: 'application/json' } })
    expect(zFileView.parse(await json(await read())).body).toBe('two\n')
    const past = zFileView.parse(await json(await read('?at=1')))
    expect(past).toMatchObject({ body: 'one\n', version: 1, at: 1 })
  })

  test('a deleted file is gone, but its history can still be read', async () => {
    const ws = await withQueue()
    const current = await call(`${ws.write}/files/queue.md`)
    const etag = current.headers.get('ETag') ?? ''
    const deleted = await call(`${ws.write}/files/queue.md`, {
      method: 'DELETE',
      headers: { 'If-Match': etag },
    })
    expect(deleted.status).toBe(200)
    expect((await call(`${ws.read}/files/queue.md`)).status).toBe(404)
    expect((await claim(ws.append, ws.task, 'codex@ci')).status).toBe(404)
    const before = await call(`${ws.read}/files/queue.md?at=2`)
    expect(await before.text()).toContain('Upgrade CI to Node 22.')
  })

  test('render as markdown with the tasks and log after the brief', async () => {
    const ws = await withQueue()
    await claim(ws.append, ws.task, 'codex@ci')
    const text = await (await call(`${ws.read}/files/queue.md`)).text()
    expect(text.startsWith(BRIEF.trimEnd())).toBe(true)
    expect(text).toMatch(/#2 claimed by codex@ci until \d\d:\d\d UTC: Upgrade CI/)
    expect(text).toContain('codex@ci, claim on #2')
  })
})

describe('the log', () => {
  test('orders concurrent appends into one unbroken chain', async () => {
    const ws = await withQueue()
    const responses = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        append(ws.append, {
          path: 'queue.md',
          type: 'comment',
          author: `agent-${i}`,
          body: `${i}`,
        }),
      ),
    )
    expect(responses.every((r) => r.status === 201)).toBe(true)

    const page = zLogPage.parse(await json(await call(`${ws.read}/log?limit=500`)))
    expect(page.entries.map((e) => e.seq)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1))
    expect(await verifyChain(page.entries)).toEqual({ ok: true, head: page.head.hash })
    expect(page.cursor).toBe(27)
  })

  test('pages with a cursor', async () => {
    const ws = await withQueue()
    const first = zLogPage.parse(await json(await call(`${ws.read}/log?limit=1`)))
    expect(first.entries.map((e) => e.seq)).toEqual([1])
    const rest = zLogPage.parse(await json(await call(`${ws.read}/log?after=${first.cursor}`)))
    expect(rest.entries.map((e) => e.seq)).toEqual([2])
    expect(await verifyChain(rest.entries, first.entries[0]?.hash)).toMatchObject({ ok: true })
  })

  test('a long poll answers as soon as an entry arrives', async () => {
    const ws = await withQueue()
    const started = Date.now()
    const waiting = call(`${ws.read}/log?after=2`, { headers: { Prefer: 'wait=10' } })
    await sleep(50)
    await append(ws.append, { path: 'queue.md', type: 'comment', author: 'alex', body: 'Hello' })
    const response = await waiting
    expect(response.headers.get('Preference-Applied')).toBe('wait=10')
    const page = zLogPage.parse(await json(response))
    expect(page.entries).toMatchObject([{ seq: 3, body: 'Hello' }])
    expect(Date.now() - started).toBeLessThan(5000)
  })

  test('a long poll checks its link again after waiting', async () => {
    const ws = await withQueue()
    const created = await call(`${ws.write}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'r' }),
    })
    const { link, url } = zCreateLinkResult.parse(await json(created))
    const waiting = call(`${new URL(url).pathname}/log?after=2`, { headers: { Prefer: 'wait=5' } })
    await sleep(50)
    await call(`${ws.write}/links/${link.id}`, { method: 'DELETE' })
    // The new entry wakes the request, which by then belongs to a revoked link.
    await append(ws.append, { path: 'queue.md', type: 'comment', author: 'a', body: 'After' })
    const response = await waiting
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain('After')
  })

  test('a long poll with nothing new returns an empty page when the wait is up', async () => {
    const ws = await withQueue()
    const response = await call(`${ws.read}/log?after=2`, { headers: { Prefer: 'wait=1' } })
    expect(zLogPage.parse(await json(response))).toMatchObject({ entries: [], cursor: 2 })
  })

  test('search finds bodies and entries', async () => {
    const ws = await withQueue()
    const response = await call(`${ws.read}/search?q=thursday`)
    expect(zSearchResults.parse(await json(response)).results).toEqual([
      { path: 'queue.md', seq: null, snippet: expect.stringContaining('**Thursday**') },
    ])
    const entries = zSearchResults.parse(await json(await call(`${ws.read}/search?q="node 22`)))
    expect(entries.results.map((r) => r.seq)).toEqual([ws.task])
  })
})

describe('claims and leases', () => {
  test('only one of two simultaneous claims wins', async () => {
    const ws = await withQueue()
    const [a, b] = await Promise.all([
      claim(ws.append, ws.task, 'codex@ci'),
      claim(ws.append, ws.task, 'claude@laptop'),
    ])
    if (!a || !b) throw new Error('Expected two responses')
    expect([a.status, b.status].toSorted((x, y) => x - y)).toEqual([201, 409])
    const loser = zProblem.parse(await json(a.status === 409 ? a : b))
    expect(loser.code).toBe('task_claimed')
    expect(['codex@ci', 'claude@laptop']).toContain(loser.holder)
    expect(loser.retryAfterMs).toBeGreaterThan(0)
  })

  test('two agents with the same name still cannot both win', async () => {
    const ws = await withQueue()
    const responses = await Promise.all([
      claim(ws.append, ws.task, 'claude@laptop'),
      claim(ws.append, ws.task, 'claude@laptop'),
    ])
    expect(responses.map((r) => r.status).toSorted((x, y) => x - y)).toEqual([201, 409])
  })

  test('the holder renews with its token; anyone can claim once the lease lapses', async () => {
    const ws = await withQueue()
    const first = await claimed(ws.append, ws.task, 'codex@ci')
    expect(first.holder).toBe('codex@ci')
    expect(await problemCode(await claim(ws.append, ws.task, 'codex@ci'))).toBe('task_claimed')
    const renewed = zAppendResult.parse(
      await json(await claim(ws.append, ws.task, 'codex@ci', first.token)),
    )
    expect(renewed.lease?.token).toBe(first.token)
    expect((await claim(ws.append, ws.task, 'claude@laptop')).status).toBe(409)

    await sleep(400)
    const view = zFileView.parse(
      await json(
        await call(`${ws.read}/files/queue.md`, { headers: { Accept: 'application/json' } }),
      ),
    )
    expect(view.tasks[0]).toMatchObject({ status: 'open', holder: null })
    const next = await claimed(ws.append, ws.task, 'claude@laptop')
    expect(next.token).not.toBe(first.token)
    // The lapsed lease's token is no use once someone else holds the task.
    expect((await claim(ws.append, ws.task, 'codex@ci', first.token)).status).toBe(409)
  })

  test('a response completes the task, and only the holder can send it', async () => {
    const ws = await withQueue()
    const lease = await claimed(ws.append, ws.task, 'codex@ci')
    const respond = (author: string, token?: string) =>
      append(ws.append, {
        path: 'queue.md',
        type: 'response',
        author,
        ref: ws.task,
        body: 'Done',
        ...(token && { token }),
      })
    expect(await problemCode(await respond('claude@laptop'))).toBe('task_claimed')
    // The holder's own name isn't enough without the token.
    expect(await problemCode(await respond('codex@ci'))).toBe('task_claimed')
    expect((await respond('codex@ci', lease.token)).status).toBe(201)
    expect(await problemCode(await claim(ws.append, ws.task, 'claude@laptop'))).toBe('task_closed')
    const cancel = append(ws.append, {
      path: 'queue.md',
      type: 'cancel',
      author: 'alex',
      ref: ws.task,
    })
    expect(await problemCode(await cancel)).toBe('task_closed')
  })

  test('a ref must be a task in the same file', async () => {
    const ws = await withQueue()
    await writeFile(ws.write, 'other.md', 'Other\n')
    const comment = zAppendResult.parse(
      await json(
        await append(ws.append, { path: 'queue.md', type: 'comment', author: 'a', body: 'hi' }),
      ),
    )
    expect(await problemCode(await claim(ws.append, comment.entry.seq, 'a'))).toBe('invalid_ref')
    expect(await problemCode(await claim(ws.append, 999, 'a'))).toBe('invalid_ref')
    const elsewhere = append(ws.append, { path: 'other.md', type: 'claim', author: 'a', ref: 2 })
    expect(await problemCode(await elsewhere)).toBe('invalid_ref')
  })
})

describe('idempotency', () => {
  test('a retried append is applied once and replays the first response', async () => {
    const ws = await withQueue()
    const entry = { path: 'queue.md', type: 'comment', author: 'codex@ci', body: 'Started' }
    const first = await append(ws.append, entry, 'retry-1')
    const second = await append(ws.append, entry, 'retry-1')
    expect(second.status).toBe(201)
    expect(second.headers.get('Idempotent-Replayed')).toBe('true')
    expect(await json(second)).toEqual(await json(first))
    const page = zLogPage.parse(await json(await call(`${ws.read}/log`)))
    expect(page.head.seq).toBe(3)
  })

  test('keys belong to the link that sent them', async () => {
    const ws = await withQueue()
    const other = await call(`${ws.write}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'a' }),
    })
    const second = new URL(zCreateLinkResult.parse(await json(other)).url).pathname
    const entry = { path: 'queue.md', type: 'comment', author: 'a', body: 'Same words' }
    const first = await append(ws.append, entry, 'shared-key')
    const again = await append(second, entry, 'shared-key')
    expect(again.headers.get('Idempotent-Replayed')).toBeNull()
    expect(await seqOf(again)).toBe((await seqOf(first)) + 1)
  })

  test('reusing a key for a different request is refused', async () => {
    const ws = await withQueue()
    await append(ws.append, { path: 'queue.md', type: 'comment', author: 'a', body: 'one' }, 'k')
    const reused = await append(
      ws.append,
      { path: 'queue.md', type: 'comment', author: 'a', body: 'two' },
      'k',
    )
    expect(reused.status).toBe(422)
    expect(await problemCode(reused)).toBe('idempotency_key_reused')
  })
})

describe('invalid requests', () => {
  test('with a field the contract does not name are refused, not trimmed', async () => {
    const ws = await withQueue()
    const comment = { path: 'queue.md', type: 'comment', author: 'a', body: 'hi', seq: 999 }
    expect((await append(ws.append, comment)).status).toBe(400)
    const create = await call('/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x', extra: 1 }),
    })
    expect(create.status).toBe(400)
  })

  test('get a problem that says what is wrong', async () => {
    const ws = await withQueue()
    const missing = await append(ws.append, { path: 'queue.md', type: 'claim', author: 'a' })
    expect(missing.status).toBe(400)
    expect(missing.headers.get('Content-Type')).toBe('application/problem+json')
    const big = await append(ws.append, {
      path: 'queue.md',
      type: 'comment',
      author: 'a',
      body: 'x'.repeat(16_385),
    })
    expect(big.status).toBe(413)
    expect(zProblem.parse(await json(big)).detail).toBe('The limit is 16384 characters.')
    const file = await call(`${ws.write}/files/big.md`, {
      method: 'PUT',
      headers: { 'If-None-Match': '*' },
      body: 'x'.repeat(262_145),
    })
    expect(file.status).toBe(413)
  })
})
