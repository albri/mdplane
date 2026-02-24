/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import type { WorkspaceKeys } from '../types'
import {
  buildFileUrls,
  generateFileId,
  generateRecordId,
  generateWebhookId,
  generateWebhookSecret,
} from '../folder-core-utils'

describe('folder id generators', () => {
  test('generateFileId returns 5-character id', () => {
    expect(generateFileId()).toHaveLength(5)
  })

  test('generateRecordId returns a stable non-empty token', () => {
    expect(generateRecordId().length).toBeGreaterThanOrEqual(16)
  })

  test('generateWebhookId includes expected prefix', () => {
    const id = generateWebhookId()
    expect(id.startsWith('wh_')).toBe(true)
    expect(id.length).toBeGreaterThan(3)
  })

  test('generateWebhookSecret includes expected prefix', () => {
    const secret = generateWebhookSecret()
    expect(secret.startsWith('whsec_')).toBe(true)
    expect(secret.length).toBeGreaterThan(6)
  })
})

describe('buildFileUrls', () => {
  test('returns all capability urls when keys exist', () => {
    const keys: WorkspaceKeys = {
      readKey: 'r_key',
      appendKey: 'a_key',
      writeKey: 'w_key',
    }

    expect(buildFileUrls({ baseUrl: 'https://example.test', filePath: '/docs/file.md', keys })).toEqual({
      read: 'https://example.test/r/r_key/files/docs/file.md',
      append: 'https://example.test/a/a_key/files/docs/file.md',
      write: 'https://example.test/w/w_key/files/docs/file.md',
    })
  })

  test('returns null urls for unavailable key tiers', () => {
    const keys: WorkspaceKeys = {
      readKey: 'r_key',
      appendKey: null,
      writeKey: null,
    }

    expect(buildFileUrls({ baseUrl: 'https://example.test', filePath: '/docs/file.md', keys })).toEqual({
      read: 'https://example.test/r/r_key/files/docs/file.md',
      append: null,
      write: null,
    })
  })
})
