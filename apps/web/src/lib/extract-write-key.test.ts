/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { extractWriteKey } from './extract-write-key'

const WRITE_KEY = 'w_mocked_write_key_1234567890'

describe('extractWriteKey', () => {
  test('returns null for empty input', () => {
    expect(extractWriteKey('')).toBeNull()
    expect(extractWriteKey('   ')).toBeNull()
  })

  test('accepts a bare key', () => {
    expect(extractWriteKey(WRITE_KEY)).toBe(WRITE_KEY)
  })

  test('extracts key from claim url', () => {
    expect(extractWriteKey(`https://app.mdplane.dev/claim/${WRITE_KEY}`)).toBe(WRITE_KEY)
    expect(extractWriteKey(`/claim/${WRITE_KEY}`)).toBe(WRITE_KEY)
  })

  test('extracts key from write capability url', () => {
    expect(extractWriteKey(`https://api.mdplane.dev/w/${WRITE_KEY}/README.md`)).toBe(WRITE_KEY)
    expect(extractWriteKey(`/w/${WRITE_KEY}/README.md`)).toBe(WRITE_KEY)
  })

  test('returns null for unsupported input', () => {
    expect(extractWriteKey('https://app.mdplane.dev/r/r_read_key_1234567890')).toBeNull()
    expect(extractWriteKey('hello world')).toBeNull()
  })
})
