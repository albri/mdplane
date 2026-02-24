/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { createCommaSeparatedEnumQuerySchema } from '../comma-list-query'

const zStatusQuery = z.object({
  status: createCommaSeparatedEnumQuerySchema(['pending', 'claimed', 'stalled', 'completed', 'cancelled'] as const, 'status'),
})

describe('createCommaSeparatedEnumQuerySchema', () => {
  test('accepts valid comma-separated values', () => {
    const parsed = zStatusQuery.parse({ status: 'pending,claimed' })
    expect(parsed.status).toBe('pending,claimed')
  })

  test('normalizes spacing and casing', () => {
    const parsed = zStatusQuery.parse({ status: ' Pending, CLAIMED ' })
    expect(parsed.status).toBe('pending,claimed')
  })

  test('rejects invalid values', () => {
    const result = zStatusQuery.safeParse({ status: 'pending,unknown' })
    expect(result.success).toBe(false)
  })

  test('rejects empty strings', () => {
    const result = zStatusQuery.safeParse({ status: '  ' })
    expect(result.success).toBe(false)
  })

  test('accepts undefined', () => {
    const parsed = zStatusQuery.parse({})
    expect(parsed.status).toBeUndefined()
  })
})
