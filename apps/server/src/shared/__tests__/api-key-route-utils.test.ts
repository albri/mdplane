/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  createApiKeyRateLimiter,
  insufficientScopeResponse,
  sanitizeApiKeyName,
} from '../api-key-route-utils'

describe('createApiKeyRateLimiter', () => {
  test('uses secure default burst window', () => {
    let nowUs = 0
    const limiter = createApiKeyRateLimiter({
      getTimeUs: () => nowUs,
    })

    for (let i = 0; i < 10; i++) {
      expect(limiter.check('ws_default').allowed).toBe(true)
      limiter.increment('ws_default')
    }

    expect(limiter.check('ws_default').allowed).toBe(false)

    // 50ms later should still be blocked with a 60s default window.
    nowUs = 50_000
    expect(limiter.check('ws_default').allowed).toBe(false)

    nowUs = 60_000_001
    expect(limiter.check('ws_default')).toEqual({ allowed: true, retryAfter: 0 })
  })

  test('enforces max keys within the active window', () => {
    let nowUs = 0
    const limiter = createApiKeyRateLimiter({
      windowMs: 1,
      maxKeys: 2,
      getTimeUs: () => nowUs,
    })

    expect(limiter.check('ws_1')).toEqual({ allowed: true, retryAfter: 0 })
    limiter.increment('ws_1')
    expect(limiter.check('ws_1')).toEqual({ allowed: true, retryAfter: 0 })
    limiter.increment('ws_1')

    const blocked = limiter.check('ws_1')
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBe(1)

    nowUs = 1001
    expect(limiter.check('ws_1')).toEqual({ allowed: true, retryAfter: 0 })
  })

  test('tracks rate limits per workspace', () => {
    let nowUs = 0
    const limiter = createApiKeyRateLimiter({
      windowMs: 1,
      maxKeys: 1,
      getTimeUs: () => nowUs,
    })

    limiter.increment('ws_a')
    expect(limiter.check('ws_a').allowed).toBe(false)
    expect(limiter.check('ws_b').allowed).toBe(true)

    nowUs = 1001
    expect(limiter.check('ws_a').allowed).toBe(true)
  })

  test('reset clears all workspace counters', () => {
    const limiter = createApiKeyRateLimiter({
      windowMs: 1,
      maxKeys: 1,
      getTimeUs: () => 0,
    })

    limiter.increment('ws_1')
    expect(limiter.check('ws_1').allowed).toBe(false)

    limiter.reset()
    expect(limiter.check('ws_1')).toEqual({ allowed: true, retryAfter: 0 })
  })
})

describe('sanitizeApiKeyName', () => {
  test('strips html tags and trims whitespace', () => {
    expect(sanitizeApiKeyName('  <b>alpha</b>  ')).toBe('alpha')
  })

  test('removes script tag payloads', () => {
    expect(sanitizeApiKeyName('safe<script>alert(1)</script>name')).toBe('safename')
  })
})

describe('insufficientScopeResponse', () => {
  test('returns canonical insufficient-scope response payload', () => {
    expect(insufficientScopeResponse()).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Insufficient scope' },
    })
  })
})
