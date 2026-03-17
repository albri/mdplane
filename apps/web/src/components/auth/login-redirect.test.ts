import { describe, expect, test } from 'bun:test'
import { extractSafeNextPath, resolvePostLoginRedirect } from './login-redirect'

describe('login redirect helpers', () => {
  test('extracts a safe next path from login query string', () => {
    expect(extractSafeNextPath('?next=%2Fclaim%2Fw_1234567890123456789012')).toBe('/claim/w_1234567890123456789012')
  })

  test('rejects unsafe next values', () => {
    expect(extractSafeNextPath('?next=https%3A%2F%2Fevil.example')).toBeNull()
    expect(extractSafeNextPath('?next=javascript%3Aalert(1)')).toBeNull()
    expect(extractSafeNextPath('?next=claim%2Fw_123')).toBeNull()
  })

  test('prefers next query value over session storage', () => {
    const redirect = resolvePostLoginRedirect({
      locationSearch: '?next=%2Fclaim%2Fw_abcdefghijklmnopqrstuv',
      storedRedirect: '/control/ws_stored',
      fallbackPath: '/control',
    })

    expect(redirect).toBe('/claim/w_abcdefghijklmnopqrstuv')
  })

  test('falls back to stored redirect when no next query is present', () => {
    const redirect = resolvePostLoginRedirect({
      locationSearch: '',
      storedRedirect: '/control/ws_saved/api-keys',
      fallbackPath: '/control',
    })

    expect(redirect).toBe('/control/ws_saved/api-keys')
  })

  test('falls back to control root when nothing valid is available', () => {
    const redirect = resolvePostLoginRedirect({
      locationSearch: '?next=https%3A%2F%2Fevil.example',
      storedRedirect: 'not-a-path',
      fallbackPath: '/control',
    })

    expect(redirect).toBe('/control')
  })
})
