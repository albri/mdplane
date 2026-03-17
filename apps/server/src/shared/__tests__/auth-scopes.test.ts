/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { hasRequiredScope } from '../auth-scopes'

describe('hasRequiredScope', () => {
  test('returns true when required scope exists', () => {
    expect(hasRequiredScope(['read', 'export'], 'export')).toBe(true)
  })

  test('returns false when required scope is missing', () => {
    expect(hasRequiredScope(['read', 'append'], 'write')).toBe(false)
  })

  test('handles empty scope lists', () => {
    expect(hasRequiredScope([], 'read')).toBe(false)
  })
})
