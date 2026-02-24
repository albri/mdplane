/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { toOrchestrationStatusFilterForClaims } from './use-control-claims'

describe('toOrchestrationStatusFilterForClaims', () => {
  test('omits UI-only claim tabs from backend orchestration query', () => {
    expect(toOrchestrationStatusFilterForClaims(undefined)).toBeUndefined()
    expect(toOrchestrationStatusFilterForClaims('active')).toBeUndefined()
    expect(toOrchestrationStatusFilterForClaims('expired')).toBeUndefined()
    expect(toOrchestrationStatusFilterForClaims('completed')).toBeUndefined()
  })

  test('passes through orchestration status filters when explicitly used', () => {
    expect(toOrchestrationStatusFilterForClaims('pending')).toBe('pending')
    expect(toOrchestrationStatusFilterForClaims('claimed')).toBe('claimed')
    expect(toOrchestrationStatusFilterForClaims('stalled')).toBe('stalled')
    expect(toOrchestrationStatusFilterForClaims('cancelled')).toBe('cancelled')
  })
})
