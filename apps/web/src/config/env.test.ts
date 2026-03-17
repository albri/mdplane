/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { readWebEnv } from './env'

function productionEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://app.example.com',
    NEXT_PUBLIC_API_URL: 'https://api.example.com',
    ...overrides,
  }
}

describe('readWebEnv localhost guards', () => {
  test('rejects localhost API URL in production by default', () => {
    expect(() =>
      readWebEnv(
        productionEnv({
          NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3001',
        })
      )
    ).toThrow('NEXT_PUBLIC_API_URL cannot point to localhost in production')
  })

  test('allows localhost API URL in production with public override', () => {
    const env = readWebEnv(
      productionEnv({
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3001',
        NEXT_PUBLIC_MDPLANE_ALLOW_LOCALHOST_PUBLIC_URLS: 'true',
      })
    )

    expect(env.apiUrl).toBe('http://127.0.0.1:3001')
  })

  test('ignores server-only localhost override in production', () => {
    expect(() =>
      readWebEnv(
        productionEnv({
          NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3001',
          MDPLANE_ALLOW_LOCALHOST_PUBLIC_URLS: 'true',
        })
      )
    ).toThrow('NEXT_PUBLIC_API_URL cannot point to localhost in production')
  })

  test('rejects localhost WS URL in production by default', () => {
    expect(() =>
      readWebEnv(
        productionEnv({
          NEXT_PUBLIC_WS_URL: 'ws://127.0.0.1:3001/ws',
        })
      )
    ).toThrow('NEXT_PUBLIC_WS_URL cannot point to localhost in production')
  })

  test('allows localhost WS URL in production with public override', () => {
    const env = readWebEnv(
      productionEnv({
        NEXT_PUBLIC_WS_URL: 'ws://127.0.0.1:3001/ws',
        NEXT_PUBLIC_MDPLANE_ALLOW_LOCALHOST_PUBLIC_URLS: 'true',
      })
    )

    expect(env.wsUrl).toBe('ws://127.0.0.1:3001/ws')
  })
})
