/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  detectPathTraversalFromKeyAndPathHint,
  evaluateCapabilityKeyRecord,
  hasRequiredPermission,
  isCapabilityKeyFormatValid,
  validateCapabilityKeyForCapabilityRoute,
  validateCapabilityKeyWithAsyncLookup,
  validateCapabilityKeyWithLookup,
} from '../capability-key-validation'

describe('isCapabilityKeyFormatValid', () => {
  test('accepts valid root/scoped capability keys', () => {
    expect(isCapabilityKeyFormatValid('r_1234567890123456789012')).toBe(true)
    expect(isCapabilityKeyFormatValid('w_1234567890123456789012')).toBe(true)
  })

  test('rejects short or invalid keys', () => {
    expect(isCapabilityKeyFormatValid('short')).toBe(false)
    expect(isCapabilityKeyFormatValid('not_a_capability_key')).toBe(false)
  })
})

describe('hasRequiredPermission', () => {
  test('read requirement allows all capability permissions', () => {
    expect(hasRequiredPermission('read', 'read')).toBe(true)
    expect(hasRequiredPermission('append', 'read')).toBe(true)
    expect(hasRequiredPermission('write', 'read')).toBe(true)
  })

  test('append requirement blocks read and allows append/write', () => {
    expect(hasRequiredPermission('read', 'append')).toBe(false)
    expect(hasRequiredPermission('append', 'append')).toBe(true)
    expect(hasRequiredPermission('write', 'append')).toBe(true)
  })

  test('write requirement only allows write', () => {
    expect(hasRequiredPermission('read', 'write')).toBe(false)
    expect(hasRequiredPermission('append', 'write')).toBe(false)
    expect(hasRequiredPermission('write', 'write')).toBe(true)
  })
})

describe('evaluateCapabilityKeyRecord', () => {
  test('returns invalid key when record missing', () => {
    const result = evaluateCapabilityKeyRecord({ keyRecord: null })

    expect(result?.ok).toBe(false)
    if (result?.ok === false) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('INVALID_KEY')
    }
  })

  test('returns key revoked when revokedAt exists', () => {
    const result = evaluateCapabilityKeyRecord({
      keyRecord: {
        permission: 'read',
        scopeType: 'workspace',
        scopePath: '/',
        revokedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: null,
      },
    })

    expect(result?.ok).toBe(false)
    if (result?.ok === false) {
      expect(result.error.code).toBe('KEY_REVOKED')
    }
  })

  test('returns key expired when expiresAt is in past', () => {
    const result = evaluateCapabilityKeyRecord({
      keyRecord: {
        permission: 'append',
        scopeType: 'workspace',
        scopePath: '/',
        revokedAt: null,
        expiresAt: '2000-01-01T00:00:00.000Z',
      },
    })

    expect(result?.ok).toBe(false)
    if (result?.ok === false) {
      expect(result.error.code).toBe('KEY_EXPIRED')
    }
  })

  test('returns permission denied when permission insufficient', () => {
    const result = evaluateCapabilityKeyRecord({
      keyRecord: {
        permission: 'read',
        scopeType: 'workspace',
        scopePath: '/',
        revokedAt: null,
        expiresAt: null,
      },
      requiredPermission: 'append',
    })

    expect(result?.ok).toBe(false)
    if (result?.ok === false) {
      expect(result.error.code).toBe('PERMISSION_DENIED')
    }
  })

  test('returns null when record is valid for required permission', () => {
    const result = evaluateCapabilityKeyRecord({
      keyRecord: {
        permission: 'write',
        scopeType: 'workspace',
        scopePath: '/',
        revokedAt: null,
        expiresAt: null,
      },
      requiredPermission: 'append',
    })

    expect(result).toBeNull()
  })

  test('returns invalid key when file scope is missing scopePath', () => {
    const result = evaluateCapabilityKeyRecord({
      keyRecord: {
        permission: 'append',
        scopeType: 'file',
        scopePath: null,
        revokedAt: null,
        expiresAt: null,
      },
    })

    expect(result?.ok).toBe(false)
    if (result?.ok === false) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('INVALID_KEY')
    }
  })

  test('supports custom status and message overrides', () => {
    const result = evaluateCapabilityKeyRecord({
      keyRecord: {
        permission: 'read',
        scopeType: 'workspace',
        scopePath: '/',
        revokedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: null,
      },
      config: {
        revoked: { status: 410, code: 'KEY_REVOKED', message: 'Key has been revoked' },
      },
    })

    expect(result?.ok).toBe(false)
    if (result?.ok === false) {
      expect(result.status).toBe(410)
      expect(result.error.message).toBe('Key has been revoked')
    }
  })
})

describe('validateCapabilityKeyWithLookup', () => {
  test('returns invalid key for malformed format', () => {
    const result = validateCapabilityKeyWithLookup({ keyString: 'not-a-key', lookupByHash: () => null })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('INVALID_KEY')
    }
  })

  test('uses custom invalid-key config for malformed format', () => {
    const result = validateCapabilityKeyWithLookup({
      keyString: 'not-a-key',
      lookupByHash: () => null,
      config: {
        invalidKey: { status: 404, code: 'NOT_FOUND', message: 'Key not found' },
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('NOT_FOUND')
      expect(result.error.message).toBe('Key not found')
    }
  })

  test('returns invalid key when lookup misses', () => {
    const result = validateCapabilityKeyWithLookup({
      keyString: 'r_1234567890123456789012',
      lookupByHash: () => null,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('INVALID_KEY')
    }
  })

  test('returns permission denied when required permission is not met', () => {
    const result = validateCapabilityKeyWithLookup({
      keyString: 'r_1234567890123456789012',
      lookupByHash: () => ({
        id: 'key_1',
        workspaceId: 'ws_1',
        permission: 'read',
        scopeType: 'workspace',
        scopePath: '/',
        revokedAt: null,
        expiresAt: null,
      }),
      requiredPermission: 'append',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('PERMISSION_DENIED')
    }
  })

  test('returns key for valid record and permission', () => {
    const result = validateCapabilityKeyWithLookup({
      keyString: 'a_1234567890123456789012',
      lookupByHash: () => ({
        id: 'key_1',
        workspaceId: 'ws_1',
        permission: 'append',
        scopeType: 'workspace',
        scopePath: '/',
        revokedAt: null,
        expiresAt: null,
      }),
      requiredPermission: 'append',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.key.id).toBe('key_1')
      expect(result.key.workspaceId).toBe('ws_1')
      expect(result.key.permission).toBe('append')
    }
  })

  test('returns invalid key when lookup result has malformed scope binding', () => {
    const result = validateCapabilityKeyWithLookup({
      keyString: 'a_1234567890123456789012',
      lookupByHash: () => ({
        id: 'key_1',
        workspaceId: 'ws_1',
        permission: 'append',
        scopeType: 'folder',
        scopePath: null,
        revokedAt: null,
        expiresAt: null,
      }),
      requiredPermission: 'append',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('INVALID_KEY')
    }
  })
})

describe('validateCapabilityKeyWithAsyncLookup', () => {
  test('returns invalid key for malformed format', async () => {
    const result = await validateCapabilityKeyWithAsyncLookup({
      keyString: 'not-a-key',
      lookupByHash: async () => null,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('INVALID_KEY')
    }
  })

  test('uses custom invalid-key config for malformed format', async () => {
    const result = await validateCapabilityKeyWithAsyncLookup({
      keyString: 'not-a-key',
      lookupByHash: async () => null,
      config: {
        invalidKey: { status: 404, code: 'NOT_FOUND', message: 'Key not found' },
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('NOT_FOUND')
      expect(result.error.message).toBe('Key not found')
    }
  })

  test('returns invalid key when async lookup misses', async () => {
    const result = await validateCapabilityKeyWithAsyncLookup({
      keyString: 'r_1234567890123456789012',
      lookupByHash: async () => null,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('INVALID_KEY')
    }
  })

  test('returns permission denied when required permission is not met', async () => {
    const result = await validateCapabilityKeyWithAsyncLookup({
      keyString: 'r_1234567890123456789012',
      lookupByHash: async () => ({
        id: 'key_1',
        workspaceId: 'ws_1',
        permission: 'read',
        scopeType: 'workspace',
        scopePath: '/',
        revokedAt: null,
        expiresAt: null,
      }),
      requiredPermission: 'append',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('PERMISSION_DENIED')
    }
  })

  test('returns key for valid async lookup result', async () => {
    const result = await validateCapabilityKeyWithAsyncLookup({
      keyString: 'a_1234567890123456789012',
      lookupByHash: async () => ({
        id: 'key_2',
        workspaceId: 'ws_2',
        permission: 'append',
        scopeType: 'workspace',
        scopePath: '/',
        revokedAt: null,
        expiresAt: null,
      }),
      requiredPermission: 'append',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.key.id).toBe('key_2')
      expect(result.key.workspaceId).toBe('ws_2')
      expect(result.key.permission).toBe('append')
    }
  })
})

describe('detectPathTraversalFromKeyAndPathHint', () => {
  test('returns null when key input is null', () => {
    const result = detectPathTraversalFromKeyAndPathHint(null, 'passwd')
    expect(result).toBeNull()
  })

  test('returns null when key input is not a string', () => {
    const result = detectPathTraversalFromKeyAndPathHint({ key: 'etc' }, 'passwd')
    expect(result).toBeNull()
  })

  test('returns INVALID_PATH for normalized traversal-like key and system path hint', () => {
    const result = detectPathTraversalFromKeyAndPathHint('etc', 'passwd')

    expect(result).not.toBeNull()
    if (result && !result.ok) {
      expect(result.status).toBe(400)
      expect(result.error.code).toBe('INVALID_PATH')
      expect(result.error.message).toBe('Path traversal not allowed')
    }
  })

  test('returns null when path hint has file extension', () => {
    const result = detectPathTraversalFromKeyAndPathHint('etc', 'notes.md')
    expect(result).toBeNull()
  })

  test('returns null when key is not a system-path-like segment', () => {
    const result = detectPathTraversalFromKeyAndPathHint('key123', 'passwd')
    expect(result).toBeNull()
  })
})

describe('validateCapabilityKeyForCapabilityRoute', () => {
  test('returns INVALID_PATH for traversal-like malformed key and system path hint', async () => {
    const result = await validateCapabilityKeyForCapabilityRoute({
      keyString: 'etc',
      lookupByHash: async () => null,
      pathHint: 'passwd',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.error.code).toBe('INVALID_PATH')
    }
  })

  test('returns INVALID_KEY for malformed key without traversal hint', async () => {
    const result = await validateCapabilityKeyForCapabilityRoute({
      keyString: 'not-a-key',
      lookupByHash: async () => null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('INVALID_KEY')
    }
  })

  test('supports custom invalid-key config overrides', async () => {
    const result = await validateCapabilityKeyForCapabilityRoute({
      keyString: 'not-a-key',
      lookupByHash: async () => null,
      config: {
        invalidKey: { status: 404, code: 'NOT_FOUND', message: 'Key not found' },
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('NOT_FOUND')
      expect(result.error.message).toBe('Key not found')
    }
  })

  test('delegates permission checks to async lookup validation', async () => {
    const result = await validateCapabilityKeyForCapabilityRoute({
      keyString: 'r_1234567890123456789012',
      lookupByHash: async () => ({
        id: 'key_1',
        workspaceId: 'ws_1',
        permission: 'read',
        scopeType: 'workspace',
        scopePath: '/',
        revokedAt: null,
        expiresAt: null,
      }),
      requiredPermission: 'append',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PERMISSION_DENIED')
    }
  })

  test('returns INVALID_KEY for malformed scope binding from lookup', async () => {
    const result = await validateCapabilityKeyForCapabilityRoute({
      keyString: 'a_1234567890123456789012',
      lookupByHash: async () => ({
        id: 'key_2',
        workspaceId: 'ws_2',
        permission: 'append',
        scopeType: 'file',
        scopePath: null,
        revokedAt: null,
        expiresAt: null,
      }),
      requiredPermission: 'append',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error.code).toBe('INVALID_KEY')
    }
  })
})
