import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { type Entry, fitting, GENESIS } from '@mdplane/contract/core'
import { readLog } from '../src/api.ts'

// A made-up link; the requests never leave the test.
const BASE = 'https://mdplane.test/r/wk_7Qm2x9Lp4Rt8.x3Kq9Lm2Vb7Np4Rt8Wc6Hy1Jd5Fs0Ga3Z'

const entry = (seq: number, body = `Entry ${seq}`): Entry => ({
  seq,
  at: '2026-10-28T09:00:00Z',
  path: 'queue.md',
  type: 'comment',
  author: 'codex@ci',
  ref: null,
  body,
  version: null,
  contentHash: null,
  prev: GENESIS,
  hash: GENESIS,
})

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

// Pages the log as the server does: up to `limit` entries and `pageBytes` of their bodies, with a
// cursor that reaches the head once a page has seen everything.
let log: Entry[] = []
let pageBytes = Infinity
let asked: number[] = []
let open = 0
let mostOpen = 0

beforeEach(() => {
  log = []
  pageBytes = Infinity
  asked = []
  open = 0
  mostOpen = 0
  vi.stubGlobal('fetch', async (url: string) => {
    const params = new URL(url).searchParams
    const after = Number(params.get('after'))
    const limit = Number(params.get('limit'))
    asked.push(after)
    mostOpen = Math.max(mostOpen, ++open)
    await new Promise((resolve) => setTimeout(resolve, 1))
    open -= 1
    const rest = log.filter((e) => e.seq > after).slice(0, limit)
    const fit = fitting(
      rest.map((e) => e.body?.length ?? 0),
      limit,
      pageBytes,
    )
    const head = { seq: log.at(-1)?.seq ?? 0, hash: GENESIS }
    const cursor =
      fit === rest.length && fit < limit ? Math.max(after, head.seq) : rest[fit - 1]?.seq
    return Response.json({ entries: rest.slice(0, fit), cursor: cursor ?? after, head })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('reads a long log in spans of 500 asked for at once, and joins them in order', async () => {
  log = range(1, 1234).map((seq) => entry(seq))
  const items = await readLog(BASE)
  expect(items.map((e) => e.seq)).toEqual(range(1, 1234))
  expect(asked).toEqual([0, 500, 1000])
  // The first page says where the head is; the other two are then in flight together.
  expect(mostOpen).toBe(2)
})

test('carries on from where a page stopped short of its limit', async () => {
  log = range(1, 1200).map((seq) => entry(seq, 'x'.repeat(seq % 7 === 0 ? 900 : 40)))
  pageBytes = 4000
  const items = await readLog(BASE)
  expect(items.map((e) => e.seq)).toEqual(range(1, 1200))
})

test('reads in order when the spans do not join up', async () => {
  log = [...range(1, 699), ...range(701, 1100)].map((seq) => entry(seq))
  const items = await readLog(BASE)
  expect(items.map((e) => e.seq)).toEqual(log.map((e) => e.seq))
})
