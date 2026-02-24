/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { hasRawPathTraversal, pathTraversalErrorResponse } from '../path-guard-utils'

describe('hasRawPathTraversal', () => {
  test('detects plain traversal marker', () => {
    expect(hasRawPathTraversal('http://localhost/r/key/../etc')).toBe(true)
  })

  test('detects encoded traversal markers', () => {
    expect(hasRawPathTraversal('http://localhost/r/key/%2e%2e/etc')).toBe(true)
    expect(hasRawPathTraversal('http://localhost/r/key/%2E%2E/etc')).toBe(true)
  })

  test('returns false for safe urls', () => {
    expect(hasRawPathTraversal('http://localhost/r/key/docs/file.md')).toBe(false)
  })
})

describe('pathTraversalErrorResponse', () => {
  test('returns canonical invalid-path payload', () => {
    expect(pathTraversalErrorResponse()).toEqual({
      ok: false,
      error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' },
    })
  })
})

