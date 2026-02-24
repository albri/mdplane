import { describe, expect, test } from 'bun:test'
import { deserializeRecentWorkspaceState } from './recent-workspace-storage'

const VALID_URL = '/r/abcdefghijklmnopqrstuvwxyz123456/docs/getting-started.md'

describe('recent workspace storage', () => {
  test('returns parsed state for valid payload', () => {
    const payload = JSON.stringify({
      saveEnabled: true,
      urls: [
        {
          url: VALID_URL,
          label: 'R key: abcdefgh...',
          addedAt: '2026-02-08T12:00:00.000Z',
        },
      ],
    })

    const result = deserializeRecentWorkspaceState(payload)

    expect(result.saveEnabled).toBe(true)
    expect(result.urls).toHaveLength(1)
    expect(result.urls[0]?.url).toBe(VALID_URL)
  })

  test('returns default state for malformed payload', () => {
    const result = deserializeRecentWorkspaceState('not-json')
    expect(result.saveEnabled).toBe(false)
    expect(result.urls).toEqual([])
  })

  test('returns default state when save is disabled', () => {
    const payload = JSON.stringify({
      saveEnabled: false,
      urls: [
        {
          url: VALID_URL,
          label: 'R key: abcdefgh...',
          addedAt: '2026-02-08T12:00:00.000Z',
        },
      ],
    })

    const result = deserializeRecentWorkspaceState(payload)
    expect(result.saveEnabled).toBe(false)
    expect(result.urls).toEqual([])
  })
})
