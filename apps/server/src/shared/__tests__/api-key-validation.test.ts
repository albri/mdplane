/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  parseApiKeyScopes,
  validateApiKeyFromAuthorizationHeaderWithLookup,
  validateApiKeyTokenWithLookup,
} from '../api-key-validation'

describe('validateApiKeyTokenWithLookup', () => {
  test('returns unauthorized for invalid token format', () => {
    const result = validateApiKeyTokenWithLookup({ token: 'not-an-api-key', lookupByHash: () => null })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error.code).toBe('UNAUTHORIZED')
      expect(result.error.message).toBe('Invalid API key')
    }
  })

  test('returns unauthorized when token does not exist', () => {
    const token = 'sk_live_12345678901234567890'
    const result = validateApiKeyTokenWithLookup({ token, lookupByHash: () => null })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error.message).toBe('Invalid API key')
    }
  })

  test('returns unauthorized for revoked key', () => {
    const token = 'sk_live_12345678901234567890'
    const result = validateApiKeyTokenWithLookup({ token, lookupByHash: () => ({
      id: 'key_1',
      workspaceId: 'ws_1',
      revokedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: null,
    }) })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error.message).toBe('Invalid API key')
    }
  })

  test('returns unauthorized for expired key', () => {
    const token = 'sk_live_12345678901234567890'
    const result = validateApiKeyTokenWithLookup({ token, lookupByHash: () => ({
      id: 'key_1',
      workspaceId: 'ws_1',
      revokedAt: null,
      expiresAt: '2000-01-01T00:00:00.000Z',
    }) })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error.message).toBe('Invalid API key')
    }
  })

  test('returns key for active API key record', () => {
    const token = 'sk_live_12345678901234567890'
    const result = validateApiKeyTokenWithLookup({ token, lookupByHash: () => ({
      id: 'key_1',
      workspaceId: 'ws_1',
      scopes: '["read"]',
      revokedAt: null,
      expiresAt: null,
    }) })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.key.id).toBe('key_1')
      expect(result.key.workspaceId).toBe('ws_1')
      expect(result.key.scopes).toBe('["read"]')
    }
  })

  test('supports disabling format enforcement for nonstandard token fixtures', () => {
    const result = validateApiKeyTokenWithLookup({
      token: 'fixture_token_with_underscores',
      lookupByHash: () => ({
        id: 'key_fixture',
        workspaceId: 'ws_fixture',
        scopes: '["read"]',
        revokedAt: null,
        expiresAt: null,
      }),
      options: { enforceFormat: false },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.key.id).toBe('key_fixture')
    }
  })
})

describe('validateApiKeyFromAuthorizationHeaderWithLookup', () => {
  test('returns unauthorized when header is missing', () => {
    const result = validateApiKeyFromAuthorizationHeaderWithLookup({
      authorizationHeader: null,
      lookupByHash: () => null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error.code).toBe('UNAUTHORIZED')
      expect(result.error.message).toBe('Authorization header required')
    }
  })

  test('supports custom missing-header message', () => {
    const result = validateApiKeyFromAuthorizationHeaderWithLookup({
      authorizationHeader: null,
      lookupByHash: () => null,
      options: { missingHeaderMessage: 'API key required' },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error.message).toBe('API key required')
    }
  })
})

describe('parseApiKeyScopes', () => {
  const allowed = ['read', 'append', 'write', 'export'] as const

  test('parses valid scopes JSON', () => {
    const result = parseApiKeyScopes({ rawScopes: '["read","export"]', allowedScopes: allowed })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.scopes).toEqual(['read', 'export'])
    }
  })

  test('returns unauthorized for malformed JSON', () => {
    const result = parseApiKeyScopes({ rawScopes: '{bad json', allowedScopes: allowed })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error.code).toBe('UNAUTHORIZED')
      expect(result.error.message).toBe('Invalid API key')
    }
  })

  test('returns unauthorized for unknown scopes', () => {
    const result = parseApiKeyScopes({ rawScopes: '["read","admin"]', allowedScopes: allowed })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error.message).toBe('Invalid API key')
    }
  })
})
