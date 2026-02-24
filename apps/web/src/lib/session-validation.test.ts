/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { validateSessionWithTimeout } from './session-validation'

describe('validateSessionWithTimeout', () => {
  test('returns true when get-session returns top-level user', async () => {
    const result = await validateSessionWithTimeout({
      apiUrl: 'http://example.test',
      cookieHeader: 'a=b',
      fetchImpl: async () => new Response(JSON.stringify({ user: { id: 'u_1' } }), { status: 200 }),
    })

    expect(result).toBe(true)
  })

  test('returns true when get-session returns session.user', async () => {
    const result = await validateSessionWithTimeout({
      apiUrl: 'http://example.test',
      cookieHeader: 'a=b',
      fetchImpl: async () => new Response(JSON.stringify({ session: { user: { id: 'u_1' } } }), { status: 200 }),
    })

    expect(result).toBe(true)
  })

  test('returns false for non-ok responses', async () => {
    const result = await validateSessionWithTimeout({
      apiUrl: 'http://example.test',
      cookieHeader: 'a=b',
      fetchImpl: async () => new Response('Unauthorized', { status: 401 }),
    })

    expect(result).toBe(false)
  })

  test('returns false when user payload is missing', async () => {
    const result = await validateSessionWithTimeout({
      apiUrl: 'http://example.test',
      cookieHeader: 'a=b',
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    })

    expect(result).toBe(false)
  })

  test('returns false when request aborts on timeout budget', async () => {
    const startedAt = Date.now()
    let sawAbortSignal = false

    const result = await validateSessionWithTimeout({
      apiUrl: 'http://example.test',
      cookieHeader: 'a=b',
      timeoutMs: 25,
      fetchImpl: async (_input, init) => {
        sawAbortSignal = init?.signal instanceof AbortSignal

        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      },
    })

    const elapsedMs = Date.now() - startedAt

    expect(sawAbortSignal).toBe(true)
    expect(result).toBe(false)
    expect(elapsedMs).toBeLessThan(200)
  })
})
