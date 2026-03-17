/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { evaluateApiKeyLifecycle } from '../api-key-lifecycle'

describe('evaluateApiKeyLifecycle', () => {
  test('returns null for active key', () => {
    const result = evaluateApiKeyLifecycle({
      revokedAt: null,
      expiresAt: null,
    })

    expect(result).toBeNull()
  })

  test('returns default unauthorized response for revoked key', () => {
    const result = evaluateApiKeyLifecycle({
      revokedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: null,
    })

    expect(result?.status).toBe(401)
    expect(result?.error.code).toBe('UNAUTHORIZED')
    expect(result?.error.message).toBe('Invalid API key')
  })

  test('returns default unauthorized response for expired key', () => {
    const result = evaluateApiKeyLifecycle({
      revokedAt: null,
      expiresAt: '2000-01-01T00:00:00.000Z',
    })

    expect(result?.status).toBe(401)
    expect(result?.error.code).toBe('UNAUTHORIZED')
    expect(result?.error.message).toBe('Invalid API key')
  })

  test('returns canonical unauthorized response for both revoked and expired keys', () => {
    const revokedResult = evaluateApiKeyLifecycle({
      revokedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: null,
    })
    const expiredResult = evaluateApiKeyLifecycle({
      revokedAt: null,
      expiresAt: '2000-01-01T00:00:00.000Z',
    })

    expect(revokedResult?.status).toBe(401)
    expect(revokedResult?.error.code).toBe('UNAUTHORIZED')
    expect(revokedResult?.error.message).toBe('Invalid API key')
    expect(expiredResult?.status).toBe(401)
    expect(expiredResult?.error.code).toBe('UNAUTHORIZED')
    expect(expiredResult?.error.message).toBe('Invalid API key')
  })
})
