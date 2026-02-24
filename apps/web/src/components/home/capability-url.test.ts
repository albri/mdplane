/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  MIN_CAPABILITY_KEY_LENGTH,
  buildCapabilityPath,
  parseCapabilityUrl,
} from './capability-url'

const VALID_KEY = 'a'.repeat(MIN_CAPABILITY_KEY_LENGTH)

describe('capability-url helpers', () => {
  describe('parseCapabilityUrl', () => {
    test('parses a bare key as read access by default', () => {
      const result = parseCapabilityUrl(VALID_KEY)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.keyType).toBe('r')
      expect(result.value.key).toBe(VALID_KEY)
      expect(result.value.suffix).toBe('')
    })

    test('parses a relative capability path with deep suffix', () => {
      const result = parseCapabilityUrl(`/r/${VALID_KEY}/docs/getting-started.md`)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.keyType).toBe('r')
      expect(result.value.key).toBe(VALID_KEY)
      expect(result.value.suffix).toBe('/docs/getting-started.md')
    })

    test('parses an absolute read capability URL and preserves query/hash', () => {
      const result = parseCapabilityUrl(`https://app.mdplane.dev/r/${VALID_KEY}/docs/readme.md?view=raw#intro`)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.keyType).toBe('r')
      expect(result.value.key).toBe(VALID_KEY)
      expect(result.value.suffix).toBe('/docs/readme.md?view=raw#intro')
    })

    test('rejects short capability keys', () => {
      const result = parseCapabilityUrl('/r/short-key')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('at least')
    })

    test('rejects traversal in raw suffix path', () => {
      const result = parseCapabilityUrl(`/r/${VALID_KEY}/../../control`)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Path traversal')
    })

    test('rejects traversal in encoded suffix path', () => {
      const result = parseCapabilityUrl(`/r/${VALID_KEY}/%2e%2e/%2e%2e/control`)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Path traversal')
    })

    test('rejects encoded control characters in suffix path', () => {
      const result = parseCapabilityUrl(`/r/${VALID_KEY}/notes%0D%0Ainjected.md`)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('invalid control characters')
    })
  })

  describe('buildCapabilityPath', () => {
    test('builds workspace read path with suffix', () => {
      const path = buildCapabilityPath(VALID_KEY, '/docs/readme.md')
      expect(path).toBe(`/r/${VALID_KEY}/docs/readme.md`)
    })
  })
})
