import { zHealth } from '@mdplane/contract'
import { runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { call, json, sleep } from './helpers.ts'

async function health() {
  const response = await call('/api/health')
  return { status: response.status, body: zHealth.parse(await json(response)) }
}

// Puts a stand-in for the object the check asks into the Worker's env while `work` runs.
async function withQuota(ping: () => Promise<void>, work: () => Promise<void>): Promise<void> {
  const real = env.QUOTA
  Object.assign(env, { QUOTA: { getByName: () => ({ ping }) } })
  try {
    await work()
  } finally {
    Object.assign(env, { QUOTA: real })
  }
}

const creates = () =>
  runInDurableObject(env.QUOTA.getByName('creates'), (_, state) =>
    state.storage.sql.exec(`SELECT * FROM creates`).toArray(),
  )

// Each test starts after the last one's answer has gone stale. Only the clock is faked, so timers
// and requests run as usual.
let clock = Date.now()
beforeEach(() => {
  clock += 60_000
  vi.useFakeTimers({ toFake: ['Date'], now: clock })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('the health check', () => {
  test('answers without a key, and takes no create', async () => {
    const before = await creates()
    const response = await call('/api/health')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(zHealth.parse(await json(response))).toMatchObject({
      status: 'ok',
      service: 'mdplane',
      environment: 'preview',
      version: env.CF_VERSION_METADATA.id,
      checks: { objects: { status: 'ok' } },
    })
    expect(await creates()).toEqual(before)
  })

  test('says the objects are down, but not why', async () => {
    await withQuota(
      () => Promise.reject(new Error('quota.internal refused the read')),
      async () => {
        const response = await call('/api/health')
        expect(response.status).toBe(503)
        const text = await response.text()
        expect(text).not.toContain('refused')
        expect(zHealth.parse(JSON.parse(text))).toMatchObject({
          status: 'degraded',
          checks: { objects: { status: 'down', error: 'unavailable' } },
        })
      },
    )
  })

  test('gives up on the objects after 3 seconds', { timeout: 10_000 }, async () => {
    await withQuota(
      () => new Promise(() => {}),
      async () => {
        const { status, body } = await health()
        expect(status).toBe(503)
        expect(body.checks.objects).toEqual({ status: 'down', error: 'timeout' })
      },
    )
  })

  test('shares one answer for 10 seconds, so asking often costs one read', async () => {
    let reads = 0
    let answer: () => void
    const answered = new Promise<void>((resolve) => {
      answer = resolve
    })
    await withQuota(
      async () => {
        reads += 1
        await answered
      },
      async () => {
        // The other two arrive while the first read is still out.
        const asking = Promise.all([health(), health(), health()])
        await sleep(100)
        answer()
        await asking
        vi.setSystemTime(clock + 9_999)
        await health()
        expect(reads).toBe(1)
        vi.setSystemTime(clock + 10_000)
        await health()
        expect(reads).toBe(2)
      },
    )
  })
})
