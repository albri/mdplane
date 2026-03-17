/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { applyIdempotencyReplay, getIdempotencyKey, getRequestAuditContext } from '../request-utils'
import type { ElysiaContextSet } from '../types'

describe('getIdempotencyKey', () => {
  test('returns header value when present', () => {
    const request = new Request('http://localhost/test', {
      headers: { 'Idempotency-Key': 'idem-123' },
    })
    expect(getIdempotencyKey(request)).toBe('idem-123')
  })

  test('returns null when header is missing', () => {
    const request = new Request('http://localhost/test')
    expect(getIdempotencyKey(request)).toBeNull()
  })
})

describe('applyIdempotencyReplay', () => {
  test('returns false when record is absent', () => {
    const set: ElysiaContextSet = { headers: {} }
    expect(applyIdempotencyReplay(null, set)).toBe(false)
    expect(set.status).toBeUndefined()
  })

  test('applies replay headers/status and returns true when record exists', () => {
    const set: ElysiaContextSet = { headers: {} }
    const replayed = applyIdempotencyReplay(
      { responseStatus: 201, responseBody: JSON.stringify({ ok: true }) },
      set
    )

    expect(replayed).toBe(true)
    expect(set.status).toBe(201)
    expect(set.headers['Content-Type']).toBe('application/json')
    expect(set.headers['Idempotency-Replayed']).toBe('true')
  })
})

describe('getRequestAuditContext', () => {
  test('extracts ip and user agent from headers', () => {
    const request = new Request('http://localhost/test', {
      headers: {
        'x-forwarded-for': '203.0.113.42',
        'user-agent': 'mdplane-test-agent',
      },
    })

    expect(getRequestAuditContext(request)).toEqual({
      ipAddress: '203.0.113.42',
      userAgent: 'mdplane-test-agent',
    })
  })

  test('returns undefined values when headers are absent', () => {
    const request = new Request('http://localhost/test')
    expect(getRequestAuditContext(request)).toEqual({
      ipAddress: undefined,
      userAgent: undefined,
    })
  })
})
