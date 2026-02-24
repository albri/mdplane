/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { createFileDeletedResponse, generateVersionedETag, parseFrontmatterFromMarkdown } from '../file-response-utils'
import type { ElysiaContextSet } from '../types'

describe('createFileDeletedResponse', () => {
  test('returns 410 envelope and headers for recent soft delete', () => {
    const set: ElysiaContextSet = { headers: {} }
    const deletedAt = new Date().toISOString()

    const result = createFileDeletedResponse(deletedAt, set)

    expect(set.status).toBe(410)
    expect(set.headers['X-Deleted-At']).toBe(deletedAt)
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('FILE_DELETED')
    expect(result.error.details?.recoverable).toBe(true)
  })

  test('marks file as non-recoverable after expiry window', () => {
    const set: ElysiaContextSet = { headers: {} }
    const deletedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()

    const result = createFileDeletedResponse(deletedAt, set)
    expect(result.error.details?.recoverable).toBe(false)
  })
})

describe('parseFrontmatterFromMarkdown', () => {
  test('parses key-value pairs from yaml frontmatter', () => {
    const content = `---\ntitle: Test Doc\nauthor: agent\n---\n# Body`
    expect(parseFrontmatterFromMarkdown(content)).toEqual({
      title: 'Test Doc',
      author: 'agent',
    })
  })

  test('returns empty object when frontmatter is absent', () => {
    expect(parseFrontmatterFromMarkdown('# No frontmatter')).toEqual({})
  })
})

describe('generateVersionedETag', () => {
  test('returns quoted deterministic etag for same inputs', () => {
    const etagA = generateVersionedETag('hello', '2026-01-01T00:00:00Z')
    const etagB = generateVersionedETag('hello', '2026-01-01T00:00:00Z')

    expect(etagA).toBe(etagB)
    expect(etagA.startsWith('"')).toBe(true)
    expect(etagA.endsWith('"')).toBe(true)
  })

  test('changes etag when updated timestamp changes', () => {
    const etagA = generateVersionedETag('hello', '2026-01-01T00:00:00Z')
    const etagB = generateVersionedETag('hello', '2026-01-02T00:00:00Z')
    expect(etagA).not.toBe(etagB)
  })
})

