/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { getAuthMe } from './get-auth-me'

describe('getAuthMe', () => {
  test('returns ok when auth/me responds with data payload', async () => {
    const result = await getAuthMe('session=abc', async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            id: 'user_1',
            email: 'owner@example.com',
            name: 'Owner',
            workspaces: [{ id: 'ws_123', name: 'Workspace' }],
          },
        }),
        { status: 200 }
      )
    )

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.data.workspaces[0]?.id).toBe('ws_123')
    }
  })

  test('returns unauthenticated for missing cookie header', async () => {
    const result = await getAuthMe('')
    expect(result.status).toBe('unauthenticated')
  })

  test('returns unauthenticated for 401 response', async () => {
    const result = await getAuthMe('session=abc', async () => new Response('Unauthorized', { status: 401 }))
    expect(result.status).toBe('unauthenticated')
  })

  test('returns error for non-auth server failures', async () => {
    const result = await getAuthMe('session=abc', async () => new Response('Server error', { status: 500 }))
    expect(result.status).toBe('error')
  })

  test('returns error when request throws', async () => {
    const result = await getAuthMe('session=abc', async () => {
      throw new Error('network down')
    })

    expect(result.status).toBe('error')
  })
})
