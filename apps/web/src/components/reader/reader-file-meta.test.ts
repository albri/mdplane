/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  estimateReadingTimeMinutes,
  formatFileDisplayName,
  formatFileSize,
  formatUpdatedTimestamp,
} from './reader-file-meta'

describe('reader-file-meta helpers', () => {
  test('formatFileDisplayName strips markdown extension', () => {
    expect(formatFileDisplayName('architecture.md')).toBe('architecture')
    expect(formatFileDisplayName('README.md')).toBe('README')
  })

  test('formatFileDisplayName falls back to document when missing', () => {
    expect(formatFileDisplayName(undefined)).toBe('Document')
    expect(formatFileDisplayName('')).toBe('Document')
  })

  test('formatFileSize renders human-readable units', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1_536)).toBe('1.5 KB')
    expect(formatFileSize(1_048_576)).toBe('1.0 MB')
  })

  test('estimateReadingTimeMinutes returns at least one minute', () => {
    expect(estimateReadingTimeMinutes('short file')).toBe(1)
  })

  test('estimateReadingTimeMinutes scales with content length', () => {
    const longContent = Array.from({ length: 450 }, () => 'word').join(' ')
    expect(estimateReadingTimeMinutes(longContent)).toBe(3)
  })

  test('formatUpdatedTimestamp formats as UTC date label', () => {
    expect(formatUpdatedTimestamp('2026-02-13T09:30:00.000Z')).toBe('Feb 13, 2026')
  })
})
