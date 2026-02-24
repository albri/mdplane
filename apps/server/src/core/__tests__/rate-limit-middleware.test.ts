import { describe, expect, test, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { assertValidResponse } from '../../../tests/helpers/schema-validator';
import { clearAllRateLimits, DEFAULT_RATE_LIMITS } from '../../services/rate-limit';
import {
  rateLimitMiddleware,
  determineOperationType,
  extractCapabilityKeyFromPath,
} from '../rate-limit-middleware';

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe('429 Response Format', () => {
    test('should return 429 with Retry-After header when rate limited', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-429-format', type: 'ip' }),
            getCustomLimits: () => ({ read: 1 }),
          })
        )
        .get('/test', () => ({ ok: true }));

      await testApp.handle(new Request('http://localhost/test'));

      const response = await testApp.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeDefined();
      expect(parseInt(response.headers.get('Retry-After') || '0', 10)).toBeGreaterThan(0);

      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('RATE_LIMITED');
      expect(body.error.message).toContain('Rate limit exceeded');
      expect(body.error.details).toHaveProperty('retryAfterSeconds');
      expect(body.error.details).toHaveProperty('limit');
      expect(body.error.details).toHaveProperty('resetAt');
    });

    test('should include X-RateLimit headers in 429 response', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-headers', type: 'ip' }),
            getCustomLimits: () => ({ read: 1 }),
          })
        )
        .get('/test', () => ({ ok: true }));

      await testApp.handle(new Request('http://localhost/test'));
      const response = await testApp.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('1');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    test('should include correct window in error response for minute-based limits', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-window-min', type: 'ip' }),
            getCustomLimits: () => ({ read: 1 }),
          })
        )
        .get('/test', () => ({ ok: true }));

      await testApp.handle(new Request('http://localhost/test'));
      const response = await testApp.handle(new Request('http://localhost/test'));
      const body = await response.json();

      expect(body.error.details.window).toBe('1m');
    });
  });


  describe('Rate Limit Recovery', () => {
    test('should decrement remaining count with each request', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-decrement', type: 'ip' }),
            getCustomLimits: () => ({ read: 5 }),
          })
        )
        .get('/test', () => ({ ok: true }));

      const response1 = await testApp.handle(new Request('http://localhost/test'));
      expect(response1.headers.get('X-RateLimit-Remaining')).toBe('4');

      const response2 = await testApp.handle(new Request('http://localhost/test'));
      expect(response2.headers.get('X-RateLimit-Remaining')).toBe('3');

      const response3 = await testApp.handle(new Request('http://localhost/test'));
      expect(response3.headers.get('X-RateLimit-Remaining')).toBe('2');
    });

    test('should have positive retryAfterSeconds value when rate limited', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-retry-after', type: 'ip' }),
            getCustomLimits: () => ({ read: 1 }),
          })
        )
        .get('/test', () => ({ ok: true }));

      await testApp.handle(new Request('http://localhost/test'));
      const response = await testApp.handle(new Request('http://localhost/test'));

      const body = await response.json();
      expect(body.error.details.retryAfterSeconds).toBeGreaterThan(0);
      expect(body.error.details.retryAfterSeconds).toBeLessThanOrEqual(60);
    });
  });


  describe('Per-Key Rate Limiting', () => {
    test('should track rate limits per capability key', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: (req) => {
              const url = new URL(req.url);
              const pathParts = url.pathname.split('/');
              const key = pathParts[2] || 'unknown';
              return { id: key, type: 'capability_key' };
            },
            getCustomLimits: () => ({ read: 2 }),
          })
        )
        .get('/r/:key/file', () => ({ ok: true }));

      await testApp.handle(new Request('http://localhost/r/keyA/file'));
      await testApp.handle(new Request('http://localhost/r/keyA/file'));
      const keyAResponse = await testApp.handle(
        new Request('http://localhost/r/keyA/file')
      );
      expect(keyAResponse.status).toBe(429);

      const keyBResponse = await testApp.handle(
        new Request('http://localhost/r/keyB/file')
      );
      expect(keyBResponse.status).toBe(200);
    });

    test('should track different identifiers separately', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: (req) => {
              const ip = req.headers.get('X-Forwarded-For') || 'unknown';
              return { id: ip, type: 'ip' };
            },
            getCustomLimits: () => ({ read: 1 }),
          })
        )
        .get('/test', () => ({ ok: true }));

      await testApp.handle(
        new Request('http://localhost/test', {
          headers: { 'X-Forwarded-For': '192.168.1.1' },
        })
      );
      const ip1Response = await testApp.handle(
        new Request('http://localhost/test', {
          headers: { 'X-Forwarded-For': '192.168.1.1' },
        })
      );
      expect(ip1Response.status).toBe(429);

      const ip2Response = await testApp.handle(
        new Request('http://localhost/test', {
          headers: { 'X-Forwarded-For': '192.168.1.2' },
        })
      );
      expect(ip2Response.status).toBe(200);
    });

    test('should not reset bucket when spoofing X-Forwarded-For while CF-Connecting-IP is stable', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getCustomLimits: () => ({ read: 1 }),
          })
        )
        .get('/test', () => ({ ok: true }));

      const first = await testApp.handle(
        new Request('http://localhost/test', {
          headers: {
            'CF-Connecting-IP': '203.0.113.10',
            'X-Forwarded-For': '198.51.100.77, 203.0.113.10',
          },
        })
      );
      expect(first.status).toBe(200);

      const second = await testApp.handle(
        new Request('http://localhost/test', {
          headers: {
            'CF-Connecting-IP': '203.0.113.10',
            'X-Forwarded-For': '198.51.100.88, 203.0.113.10',
          },
        })
      );
      expect(second.status).toBe(429);
    });

    test('should not reset limiter bucket with a spoofed single X-Forwarded-For header', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getCustomLimits: () => ({ read: 1 }),
          })
        )
        .get('/test', () => ({ ok: true }));

      const first = await testApp.handle(new Request('http://localhost/test'));
      expect(first.status).toBe(200);

      const baselineLimited = await testApp.handle(new Request('http://localhost/test'));
      expect(baselineLimited.status).toBe(429);

      const spoofed = await testApp.handle(
        new Request('http://localhost/test', {
          headers: { 'X-Forwarded-For': '198.51.100.77' },
        })
      );
      expect(spoofed.status).toBe(429);
    });
  });


  describe('Different Limit Types', () => {
    test('should apply read rate limit to GET requests', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-read-limit', type: 'ip' }),
            getCustomLimits: () => ({ read: 2 }),
          })
        )
        .get('/r/:key/file', () => ({ ok: true }));

      await testApp.handle(new Request('http://localhost/r/test/file'));
      await testApp.handle(new Request('http://localhost/r/test/file'));

      const response = await testApp.handle(
        new Request('http://localhost/r/test/file')
      );
      expect(response.status).toBe(429);
    });

    test('should apply write rate limit to PUT requests', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-write-limit', type: 'ip' }),
            getCustomLimits: () => ({ write: 2 }),
          })
        )
        .put('/w/:key/file', () => ({ ok: true }));

      await testApp.handle(
        new Request('http://localhost/w/test/file', { method: 'PUT' })
      );
      await testApp.handle(
        new Request('http://localhost/w/test/file', { method: 'PUT' })
      );

      const response = await testApp.handle(
        new Request('http://localhost/w/test/file', { method: 'PUT' })
      );
      expect(response.status).toBe(429);
    });

    test('should apply append rate limit to POST /a/ requests', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-append-limit', type: 'ip' }),
            getCustomLimits: () => ({ append: 2 }),
          })
        )
        .post('/a/:key/file', () => ({ ok: true }));

      await testApp.handle(
        new Request('http://localhost/a/test/file', { method: 'POST' })
      );
      await testApp.handle(
        new Request('http://localhost/a/test/file', { method: 'POST' })
      );

      const response = await testApp.handle(
        new Request('http://localhost/a/test/file', { method: 'POST' })
      );
      expect(response.status).toBe(429);
    });

    test('should apply subscribe rate limit to subscribe endpoints', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-subscribe-limit', type: 'ip' }),
            getCustomLimits: () => ({ subscribe: 2 }),
          })
        )
        .get('/r/:key/ops/subscribe', () => ({ ok: true }));

      await testApp.handle(new Request('http://localhost/r/test/ops/subscribe'));
      await testApp.handle(new Request('http://localhost/r/test/ops/subscribe'));

      const response = await testApp.handle(
        new Request('http://localhost/r/test/ops/subscribe')
      );
      expect(response.status).toBe(429);
    });

    test('should apply search rate limit to search endpoints', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-search-limit', type: 'ip' }),
            getCustomLimits: () => ({ search: 2 }),
          })
        )
        .get('/r/:key/search', () => ({ ok: true }));

      await testApp.handle(new Request('http://localhost/r/test/search'));
      await testApp.handle(new Request('http://localhost/r/test/search'));

      const response = await testApp.handle(
        new Request('http://localhost/r/test/search')
      );
      expect(response.status).toBe(429);
    });

    test('should apply webhook_create rate limit to POST /webhooks', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-webhook-limit', type: 'ip' }),
            getCustomLimits: () => ({ webhook_create: 2 }),
          })
        )
        .post('/w/:key/webhooks', () => ({ ok: true }));

      await testApp.handle(
        new Request('http://localhost/w/test/webhooks', { method: 'POST' })
      );
      await testApp.handle(
        new Request('http://localhost/w/test/webhooks', { method: 'POST' })
      );

      const response = await testApp.handle(
        new Request('http://localhost/w/test/webhooks', { method: 'POST' })
      );
      expect(response.status).toBe(429);
    });

    test('should apply bulk rate limit to bulk endpoints', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-bulk-limit', type: 'ip' }),
            getCustomLimits: () => ({ bulk: 2 }),
          })
        )
        .post('/a/:key/folders/:folderPath/bulk', () => ({ ok: true }));

      await testApp.handle(
        new Request('http://localhost/a/test/folders/projects/bulk', { method: 'POST' })
      );
      await testApp.handle(
        new Request('http://localhost/a/test/folders/projects/bulk', { method: 'POST' })
      );

      const response = await testApp.handle(
        new Request('http://localhost/a/test/folders/projects/bulk', { method: 'POST' })
      );
      expect(response.status).toBe(429);
    });

    test('should apply bulk rate limit to root bulk endpoint', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-bulk-root-limit', type: 'ip' }),
            getCustomLimits: () => ({ bulk: 2, append: 99 }),
          })
        )
        .post('/a/:key/folders/bulk', () => ({ ok: true }));

      await testApp.handle(
        new Request('http://localhost/a/test/folders/bulk', { method: 'POST' })
      );
      await testApp.handle(
        new Request('http://localhost/a/test/folders/bulk', { method: 'POST' })
      );

      const response = await testApp.handle(
        new Request('http://localhost/a/test/folders/bulk', { method: 'POST' })
      );
      expect(response.status).toBe(429);
    });

    test('should apply bootstrap rate limit to /bootstrap endpoint', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-bootstrap-limit', type: 'ip' }),
            getCustomLimits: () => ({ bootstrap: 2 }),
          })
        )
        .post('/bootstrap', () => ({ ok: true }));

      await testApp.handle(
        new Request('http://localhost/bootstrap', { method: 'POST' })
      );
      await testApp.handle(
        new Request('http://localhost/bootstrap', { method: 'POST' })
      );

      const response = await testApp.handle(
        new Request('http://localhost/bootstrap', { method: 'POST' })
      );
      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body.error.details.window).toBe('1h');
    });
  });

  describe('Operation Classification', () => {
    test('should classify append file paths containing "bulk" as append', async () => {
      const testApp = new Elysia()
        .use(
          rateLimitMiddleware({
            getIdentifier: () => ({ id: 'test-append-bulk-name', type: 'ip' }),
            getCustomLimits: () => ({ append: 2, bulk: 1 }),
          })
        )
        .post('/a/:key/*', () => ({ ok: true }));

      const first = await testApp.handle(
        new Request('http://localhost/a/test/projects/bulk-notes.md', { method: 'POST' })
      );
      const second = await testApp.handle(
        new Request('http://localhost/a/test/projects/bulk-notes.md', { method: 'POST' })
      );

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
    });

    test('should classify /w/:key/capabilities/check as capability_check', () => {
      const operation = determineOperationType('POST', '/w/a_testKey12345678901234/capabilities/check');
      expect(operation).toBe('capability_check');
    });

    test('should classify /a/:key/folders/bulk as bulk', () => {
      const operation = determineOperationType('POST', '/a/a_testKey12345678901234/folders/bulk');
      expect(operation).toBe('bulk');
    });

    test('should extract scoped keys with underscore from capability paths', () => {
      const key = 'a_12345678901234567890';
      expect(extractCapabilityKeyFromPath(`/a/${key}/project/file.md`)).toBe(key);
    });
  });


  describe('Default Rate Limits', () => {
    test('should have correct default limits configured', () => {
      expect(DEFAULT_RATE_LIMITS.bootstrap.limit).toBe(10);
      expect(DEFAULT_RATE_LIMITS.read.limit).toBe(1000);
      expect(DEFAULT_RATE_LIMITS.write.limit).toBe(100);
      expect(DEFAULT_RATE_LIMITS.append.limit).toBe(400);
      expect(DEFAULT_RATE_LIMITS.search.limit).toBe(60);
      expect(DEFAULT_RATE_LIMITS.subscribe.limit).toBe(10);
      expect(DEFAULT_RATE_LIMITS.bulk.limit).toBe(30);
      expect(DEFAULT_RATE_LIMITS.webhook_create.limit).toBe(20);
      expect(DEFAULT_RATE_LIMITS.capability_check.limit).toBe(5);
    });

    test('should use 1-minute window for most operations', () => {
      const MINUTE = 60 * 1000;
      expect(DEFAULT_RATE_LIMITS.read.windowMs).toBe(MINUTE);
      expect(DEFAULT_RATE_LIMITS.write.windowMs).toBe(MINUTE);
      expect(DEFAULT_RATE_LIMITS.append.windowMs).toBe(MINUTE);
      expect(DEFAULT_RATE_LIMITS.search.windowMs).toBe(MINUTE);
      expect(DEFAULT_RATE_LIMITS.subscribe.windowMs).toBe(MINUTE);
    });

    test('should use 1-hour window for bootstrap and webhook_create', () => {
      const HOUR = 60 * 60 * 1000;
      expect(DEFAULT_RATE_LIMITS.bootstrap.windowMs).toBe(HOUR);
      expect(DEFAULT_RATE_LIMITS.webhook_create.windowMs).toBe(HOUR);
    });
  });


  describe('Endpoint Exemptions', () => {
    test('should not rate limit health endpoint', async () => {
      const testApp = new Elysia()
        .use(rateLimitMiddleware())
        .get('/health', () => ({ ok: true }));

      for (let i = 0; i < 20; i++) {
        const response = await testApp.handle(
          new Request('http://localhost/health')
        );
        expect(response.status).toBe(200);
      }
    });

    test('should not add rate limit headers to health endpoint', async () => {
      const testApp = new Elysia()
        .use(rateLimitMiddleware())
        .get('/health', () => ({ ok: true }));

      const response = await testApp.handle(
        new Request('http://localhost/health')
      );

      expect(response.headers.get('X-RateLimit-Limit')).toBeNull();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeNull();
    });
  });

});
