/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { getBearerToken } from '../auth-header'

function createRequest(authHeader?: string): Request {
  const headers = new Headers()
  if (authHeader !== undefined) {
    headers.set('Authorization', authHeader)
  }
  return new Request('http://localhost/test', { headers })
}

describe('getBearerToken', () => {
  test('returns null when Authorization header is missing', () => {
    expect(getBearerToken(createRequest())).toBeNull()
  })

  test('returns null when header does not use Bearer prefix', () => {
    expect(getBearerToken(createRequest('Token abc123'))).toBeNull()
    expect(getBearerToken(createRequest('BearerMissingSpace'))).toBeNull()
  })

  test('returns token when header is in Bearer format', () => {
    expect(getBearerToken(createRequest('Bearer pk_test_123'))).toBe('pk_test_123')
  })

  test('returns null when header has no token value', () => {
    expect(getBearerToken(createRequest('Bearer '))).toBeNull()
  })
})
