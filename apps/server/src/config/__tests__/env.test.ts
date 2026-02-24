import { describe, expect, test } from 'bun:test';
import { readServerEnv } from '../env';

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    BASE_URL: 'http://127.0.0.1:3001',
    APP_URL: 'http://127.0.0.1:3000',
    WS_URL: 'ws://127.0.0.1:3001/ws',
    BETTER_AUTH_URL: 'http://127.0.0.1:3001',
    ...overrides,
  };
}

describe('readServerEnv', () => {
  test('defaults trusted anonymous IP requirement to false outside production', () => {
    const env = readServerEnv(baseEnv());
    expect(env.requireTrustedClientIpForAnonymousRateLimits).toBe(false);
  });

  test('defaults trusted anonymous IP requirement to true in production', () => {
    const env = readServerEnv(baseEnv({
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'test-secret',
      MP_JWT_SECRET: 'test-jwt-secret',
    }));
    expect(env.requireTrustedClientIpForAnonymousRateLimits).toBe(true);
  });

  test('respects explicit proxy trust flags', () => {
    const env = readServerEnv(baseEnv({
      TRUST_PROXY_HEADERS: 'true',
      TRUST_SINGLE_X_FORWARDED_FOR: 'true',
      REQUIRE_TRUSTED_CLIENT_IP_FOR_ANON_RATE_LIMITS: 'true',
      TRUSTED_PROXY_SHARED_SECRET: 'abc123',
      TRUSTED_PROXY_SHARED_SECRET_HEADER: 'X-Origin-Verify',
    }));

    expect(env.trustProxyHeaders).toBe(true);
    expect(env.trustSingleXForwardedFor).toBe(true);
    expect(env.requireTrustedClientIpForAnonymousRateLimits).toBe(true);
    expect(env.trustedProxySharedSecret).toBe('abc123');
    expect(env.trustedProxySharedSecretHeader).toBe('x-origin-verify');
  });
});
