/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  buildCursor,
  detectPossibleTraversal,
  parsePaginationParams,
  validateFilename,
  validateFolderName,
} from '../folder-utils'

describe('validateFilename', () => {
  test('rejects empty filename', () => {
    expect(validateFilename('')).toEqual({
      code: 'INVALID_REQUEST',
      message: 'filename is required',
    })
  })

  test('rejects path separators', () => {
    expect(validateFilename('a/b.md')).toEqual({
      code: 'INVALID_PATH',
      message: 'Filename cannot contain path separators',
    })
    expect(validateFilename('a\\b.md')).toEqual({
      code: 'INVALID_PATH',
      message: 'Filename cannot contain path separators',
    })
  })

  test('accepts valid filename', () => {
    expect(validateFilename('notes.md')).toBeNull()
  })
})

describe('validateFolderName', () => {
  test('rejects empty name', () => {
    expect(validateFolderName('')).toEqual({
      code: 'INVALID_REQUEST',
      message: 'name is required',
    })
  })

  test('rejects relative segments', () => {
    expect(validateFolderName('..')).toEqual({
      code: 'INVALID_PATH',
      message: 'Invalid folder name',
    })
  })

  test('accepts valid name', () => {
    expect(validateFolderName('docs')).toBeNull()
  })
})

describe('detectPossibleTraversal', () => {
  test('detects raw traversal markers', () => {
    expect(
      detectPossibleTraversal({ rawUrl: 'http://localhost/r/key/folders/../etc', key: 'key', pathParam: 'etc' })
    ).toBe(true)
  })

  test('detects suspicious key and path patterns', () => {
    expect(detectPossibleTraversal({ rawUrl: 'http://localhost/r/etc/folders/x', key: 'etc', pathParam: 'x' })).toBe(true)
    expect(
      detectPossibleTraversal({ rawUrl: 'http://localhost/r/key/folders/passwd', key: 'key', pathParam: 'passwd' })
    ).toBe(true)
  })

  test('accepts normal folder request path', () => {
    expect(
      detectPossibleTraversal({ rawUrl: 'http://localhost/r/key/folders/docs/api', key: 'key', pathParam: 'docs/api' })
    ).toBe(false)
  })
})

describe('parsePaginationParams', () => {
  test('returns defaults without query', () => {
    expect(parsePaginationParams()).toEqual({
      limit: 50,
      offset: 0,
      sort: 'name',
      order: 'asc',
    })
  })

  test('decodes cursor offset', () => {
    const cursor = buildCursor(120)
    expect(
      parsePaginationParams({
        cursor,
        limit: 25,
        recursive: 'false',
        sort: 'modified',
        order: 'desc',
      })
    ).toEqual({
      limit: 25,
      offset: 120,
      sort: 'modified',
      order: 'desc',
    })
  })

  test('falls back to offset 0 for invalid cursor', () => {
    expect(parsePaginationParams({ cursor: '%%%%', limit: 10, recursive: 'false', sort: 'name', order: 'asc' })).toEqual({
      limit: 10,
      offset: 0,
      sort: 'name',
      order: 'asc',
    })
  })
})
