import { type LogItem, verifyChain, zCreateLinkResult, zLogItem, zProblem } from '@mdplane/contract'
import { describe, expect, test } from 'vitest'
import { append, call, createWorkspace, json, writeFile } from './helpers.ts'

async function connect(link: string, after = 0) {
  const response = await call(`${link}/live?after=${after}`, { headers: { Upgrade: 'websocket' } })
  const socket = response.webSocket
  if (response.status !== 101 || !socket) throw new Error(`live returned ${response.status}`)
  const items: LogItem[] = []
  const waiting: Array<{ count: number; resolve: () => void }> = []
  socket.addEventListener('message', (event) => {
    items.push(zLogItem.parse(JSON.parse(String(event.data))))
    for (const waiter of waiting.filter((w) => items.length >= w.count)) waiter.resolve()
  })
  socket.accept()
  const until = (count: number) =>
    items.length >= count
      ? Promise.resolve()
      : new Promise<void>((resolve) => waiting.push({ count, resolve }))
  return { socket, items, until }
}

describe('the live stream', () => {
  test('sends the backlog, then each new entry, with nothing missed or repeated', async () => {
    const ws = await createWorkspace()
    await writeFile(ws.write, 'queue.md', 'Brief\n')
    await append(ws.append, { path: 'queue.md', type: 'task', author: 'lead@devbox', body: 'One' })

    const live = await connect(ws.read, 1)
    await live.until(1)
    await append(ws.append, {
      path: 'queue.md',
      type: 'comment',
      author: 'lead@devbox',
      body: 'Two',
    })
    await live.until(2)
    expect(live.items.map((item) => item.seq)).toEqual([2, 3])

    const full = await connect(ws.read)
    await full.until(3)
    expect(await verifyChain(full.items)).toMatchObject({ ok: true })
    live.socket.close()
    full.socket.close()
  })

  test('redacts entries outside a folder link', async () => {
    const ws = await createWorkspace()
    const created = await call(`${ws.write}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'r', folder: 'release' }),
    })
    const { url } = (await json(created)) as { url: string }
    const live = await connect(new URL(url).pathname)
    await writeFile(ws.write, 'queue.md', 'Top level\n')
    await writeFile(ws.write, 'release/queue.md', 'Release\n')
    await live.until(2)
    expect(live.items[0]).toMatchObject({ seq: 1, redacted: true })
    expect(live.items[1]).toMatchObject({ seq: 2, path: 'release/queue.md' })
    live.socket.close()
  })

  test('a socket closed by the server, waiting for its client, does not fail the next entry', async () => {
    const ws = await createWorkspace()
    await writeFile(ws.write, 'queue.md', 'Brief\n')
    const created = await call(`${ws.write}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'r' }),
    })
    const { url, link } = zCreateLinkResult.parse(await json(created))
    // Never accepted, so the client never answers the server's close.
    const upgrade = { headers: { Upgrade: 'websocket' } }
    expect((await call(`${new URL(url).pathname}/live`, upgrade)).status).toBe(101)
    expect((await call(`${ws.write}/links/${link.id}`, { method: 'DELETE' })).status).toBe(204)
    // Sending to the closed socket threw after the entry was sealed: a 500 for a written entry.
    const comment = { path: 'queue.md', type: 'comment', author: 'a', body: 'After the revoke' }
    expect((await append(ws.append, comment)).status).toBe(201)
  })

  test('needs a WebSocket upgrade', async () => {
    const ws = await createWorkspace()
    const response = await call(`${ws.read}/live`)
    expect(response.status).toBe(426)
    expect(zProblem.parse(await json(response)).code).toBe('upgrade_required')
  })
})
