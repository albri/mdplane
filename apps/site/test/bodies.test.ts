import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { GENESIS, type Entry } from '@mdplane/contract/core'
import { Bodies } from '../src/api.ts'

// A made-up link; the requests never leave the test.
const BASE = 'https://mdplane.test/r/wk_7Qm2x9Lp4Rt8.x3Kq9Lm2Vb7Np4Rt8Wc6Hy1Jd5Fs0Ga3Z'

const write = (seq: number): Entry => ({
  seq,
  at: '2026-10-28T09:00:00Z',
  path: 'queue.md',
  type: 'write',
  author: 'ln_Ne4Jw9Qa2Xt7',
  ref: null,
  body: null,
  version: seq,
  contentHash: `hash${seq}`,
  prev: GENESIS,
  hash: GENESIS,
})

// Each request waits until the test answers it, so the test sees how many are open at once.
type Pending = { seq: number; answer: (status: number, headers?: Record<string, string>) => void }
let requests: Pending[] = []

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', globalThis)
  requests = []
  vi.stubGlobal('fetch', (url: string) => {
    const seq = Number(new URL(url).searchParams.get('at'))
    return new Promise<Response>((resolve) => {
      requests.push({
        seq,
        answer: (status, headers = {}) => {
          const body = status === 200 ? { contentHash: `hash${seq}`, body: `Body ${seq}` } : {}
          resolve(new Response(JSON.stringify(body), { status, headers }))
        },
      })
    })
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const settle = () => vi.advanceTimersByTimeAsync(0)
const open = () => requests.filter((r) => r.answer !== done)
const done = () => undefined
async function answer(
  request: Pending | undefined,
  status = 200,
  headers?: Record<string, string>,
) {
  request?.answer(status, headers)
  if (request) request.answer = done
  await settle()
}

describe('bodies', () => {
  test('fetches at most four at once, newest first, and drops what was passed long ago', async () => {
    const bodies = new Bodies(BASE, () => undefined)
    for (let seq = 1; seq <= 14; seq++) bodies.want(write(seq))
    await settle()
    expect(open().map((r) => r.seq)).toEqual([1, 2, 3, 4])

    await answer(requests[0])
    expect(open().map((r) => r.seq)).toEqual([2, 3, 4, 14])
    expect(bodies.cache.get('hash1')).toBe('Body 1')
    while (open().length > 0) await answer(open()[0])
    // Eight wait their turn. A reader that comes back to the others asks for them again.
    expect(requests.map((r) => r.seq).toSorted((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14,
    ])
  })

  test("keeps each body, so wanting it again doesn't fetch it again", async () => {
    const bodies = new Bodies(BASE, () => undefined)
    bodies.want(write(1))
    await settle()
    await answer(requests[0])
    bodies.want(write(1))
    await settle()
    expect(requests).toHaveLength(1)
  })

  test('waits out a rate limit instead of failing', async () => {
    const bodies = new Bodies(BASE, () => undefined)
    bodies.want(write(1))
    await settle()
    await answer(requests[0], 429, { 'Retry-After': '60' })
    expect(bodies.problem(write(1))?.retry).toBe(false)

    bodies.want(write(2))
    await vi.advanceTimersByTimeAsync(59_000)
    expect(requests).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(open().map((r) => r.seq)).toEqual([2, 1])
  })

  test('retries a failure twice, then offers to try again', async () => {
    const bodies = new Bodies(BASE, () => undefined)
    const loaded = bodies.load(write(1))
    await settle()
    await answer(requests[0], 503)
    // Asking again during the wait doesn't hurry the retry.
    bodies.want(write(1))
    await settle()
    expect(requests).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1_000)
    await answer(requests[1], 503)
    await vi.advanceTimersByTimeAsync(2_000)
    await answer(requests[2], 503)
    await loaded
    expect(bodies.problem(write(1))).toEqual({
      message: "Couldn't load this version.",
      retry: true,
    })

    bodies.retry(write(1))
    await settle()
    await answer(requests[3])
    expect(bodies.problem(write(1))).toBeNull()
    expect(bodies.cache.get('hash1')).toBe('Body 1')
  })
})
