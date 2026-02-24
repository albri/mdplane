import { describe, expect, test } from 'bun:test';
import { getClientIpFromHeaders } from '../client-ip';

const TRUST_PROXY_HEADERS = {
  trustProxyHeaders: true,
  trustSingleXForwardedFor: false,
  trustedProxySharedSecretHeader: 'x-mdplane-proxy-secret',
} as const;

const DONT_TRUST_PROXY_HEADERS = {
  trustProxyHeaders: false,
  trustSingleXForwardedFor: false,
  trustedProxySharedSecretHeader: 'x-mdplane-proxy-secret',
} as const;

describe('getClientIp', () => {
  test('prefers CF-Connecting-IP over forwarded headers', () => {
    const headers = new Headers({
        'CF-Connecting-IP': '203.0.113.42',
        'X-Forwarded-For': '198.51.100.77, 203.0.113.42',
    });

    expect(getClientIpFromHeaders(headers, DONT_TRUST_PROXY_HEADERS)).toBe('203.0.113.42');
  });

  test('uses the last IP from X-Forwarded-For chains when proxy headers are trusted', () => {
    const headers = new Headers({
        'X-Forwarded-For': '198.51.100.77, 203.0.113.42',
    });

    expect(getClientIpFromHeaders(headers, TRUST_PROXY_HEADERS)).toBe('203.0.113.42');
  });

  test('does not trust proxy headers when proxy trust is disabled', () => {
    const headers = new Headers({
      'X-Forwarded-For': '198.51.100.77, 203.0.113.42',
      'X-Real-IP': '203.0.113.42',
    });

    expect(getClientIpFromHeaders(headers, DONT_TRUST_PROXY_HEADERS)).toBe('unknown');
  });

  test('does not trust single-value X-Forwarded-For unless explicitly enabled', () => {
    const headers = new Headers({
        'X-Forwarded-For': '198.51.100.77',
    });

    expect(getClientIpFromHeaders(headers, TRUST_PROXY_HEADERS)).toBe('unknown');
  });

  test('ignores invalid forwarded values', () => {
    const headers = new Headers({
        'X-Forwarded-For': 'not-an-ip, still-not-an-ip',
    });

    expect(getClientIpFromHeaders(headers, TRUST_PROXY_HEADERS)).toBe('unknown');
  });

  test('requires trusted proxy secret when configured', () => {
    const options = {
      ...TRUST_PROXY_HEADERS,
      trustedProxySharedSecret: 'secret-value',
    } as const;

    const missingSecretHeaders = new Headers({
      'CF-Connecting-IP': '203.0.113.42',
    });
    expect(getClientIpFromHeaders(missingSecretHeaders, options)).toBe('unknown');

    const wrongSecretHeaders = new Headers({
      'CF-Connecting-IP': '203.0.113.42',
      'X-MDPLANE-Proxy-Secret': 'wrong-value',
    });
    expect(getClientIpFromHeaders(wrongSecretHeaders, options)).toBe('unknown');

    const validSecretHeaders = new Headers({
      'CF-Connecting-IP': '203.0.113.42',
      'X-MDPLANE-Proxy-Secret': 'secret-value',
    });
    expect(getClientIpFromHeaders(validSecretHeaders, options)).toBe('203.0.113.42');
  });
});
