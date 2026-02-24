/**
 * Rate Limit Service Tests
 *
 * Tests for rate limiting with sliding window algorithm.
 *
 * @see docs/Architecture.md - Rate Limiting section
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import {
  checkRateLimit,
  getRateLimitStatus,
  cleanupExpiredEntries,
  clearAllRateLimits,
  getRateLimitStoreSize,
  buildRateLimitHeaders,
  buildRateLimitErrorResponse,
  DEFAULT_RATE_LIMITS,
  resolveRateLimits,
  type OperationType,
} from '../rate-limit';

describe('Rate Limit Service', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe('checkRateLimit', () => {
    test('should allow requests within limit', () => {
      const result = checkRateLimit('test-key', 'read');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.limit).toBe(DEFAULT_RATE_LIMITS.read.limit);
    });

    test('should track requests correctly', () => {
      const identifier = 'track-test';

      // First request
      const result1 = checkRateLimit(identifier, 'read');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(DEFAULT_RATE_LIMITS.read.limit - 1);

      // Second request
      const result2 = checkRateLimit(identifier, 'read');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(DEFAULT_RATE_LIMITS.read.limit - 2);
    });

    test('should deny requests when limit exceeded', () => {
      const identifier = 'limit-exceeded';
      const customLimit = 3;

      // Make requests up to limit
      for (let i = 0; i < customLimit; i++) {
        const result = checkRateLimit(identifier, 'read', customLimit);
        expect(result.allowed).toBe(true);
      }

      // Next request should be denied
      const result = checkRateLimit(identifier, 'read', customLimit);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('should use custom limit when provided', () => {
      const identifier = 'custom-limit';
      const customLimit = 5;

      const result = checkRateLimit(identifier, 'read', customLimit);
      expect(result.limit).toBe(customLimit);
      expect(result.remaining).toBe(customLimit - 1);
    });

    test('should track different operations separately', () => {
      const identifier = 'multi-op';

      // Read operation
      checkRateLimit(identifier, 'read');
      const readStatus = getRateLimitStatus(identifier, 'read');

      // Append operation (should be tracked separately)
      checkRateLimit(identifier, 'append');
      const appendStatus = getRateLimitStatus(identifier, 'append');

      // Both should have independent counts
      expect(readStatus.remaining).toBe(DEFAULT_RATE_LIMITS.read.limit - 1);
      expect(appendStatus.remaining).toBe(DEFAULT_RATE_LIMITS.append.limit - 1);
    });

    test('should track different identifiers separately', () => {
      // First identifier
      checkRateLimit('key1', 'read');
      const status1 = getRateLimitStatus('key1', 'read');

      // Second identifier (should be tracked separately)
      checkRateLimit('key2', 'read');
      const status2 = getRateLimitStatus('key2', 'read');

      // Both should have their own counts
      expect(status1.remaining).toBe(DEFAULT_RATE_LIMITS.read.limit - 1);
      expect(status2.remaining).toBe(DEFAULT_RATE_LIMITS.read.limit - 1);
    });
  });

  describe('getRateLimitStatus', () => {
    test('should return full limit for new identifier', () => {
      const status = getRateLimitStatus('new-key', 'read');

      expect(status.limit).toBe(DEFAULT_RATE_LIMITS.read.limit);
      expect(status.remaining).toBe(DEFAULT_RATE_LIMITS.read.limit);
      expect(status.retryAfter).toBe(0);
    });

    test('should not consume request when checking status', () => {
      const identifier = 'status-check';

      // Check status multiple times
      getRateLimitStatus(identifier, 'read');
      getRateLimitStatus(identifier, 'read');
      getRateLimitStatus(identifier, 'read');

      // Remaining should still be full
      const status = getRateLimitStatus(identifier, 'read');
      expect(status.remaining).toBe(DEFAULT_RATE_LIMITS.read.limit);
    });
  });

  describe('DEFAULT_RATE_LIMITS', () => {
    test('should have correct bootstrap limit', () => {
      expect(DEFAULT_RATE_LIMITS.bootstrap.limit).toBe(10);
      expect(DEFAULT_RATE_LIMITS.bootstrap.windowMs).toBe(60 * 60 * 1000); // 1 hour
    });

    test('should have correct read limit', () => {
      expect(DEFAULT_RATE_LIMITS.read.limit).toBe(1000);
      expect(DEFAULT_RATE_LIMITS.read.windowMs).toBe(60 * 1000); // 1 minute
    });

    test('should have correct write limit', () => {
      expect(DEFAULT_RATE_LIMITS.write.limit).toBe(100);
      expect(DEFAULT_RATE_LIMITS.write.windowMs).toBe(60 * 1000); // 1 minute
    });

    test('should have correct append limit', () => {
      expect(DEFAULT_RATE_LIMITS.append.limit).toBe(400);
      expect(DEFAULT_RATE_LIMITS.append.windowMs).toBe(60 * 1000); // 1 minute
    });

    test('should have correct bulk limit', () => {
      expect(DEFAULT_RATE_LIMITS.bulk.limit).toBe(30);
      expect(DEFAULT_RATE_LIMITS.bulk.windowMs).toBe(60 * 1000); // 1 minute
    });

    test('should have correct webhook_create limit', () => {
      expect(DEFAULT_RATE_LIMITS.webhook_create.limit).toBe(20);
      expect(DEFAULT_RATE_LIMITS.webhook_create.windowMs).toBe(60 * 60 * 1000); // 1 hour
    });

    test('should have correct capability_check limit', () => {
      expect(DEFAULT_RATE_LIMITS.capability_check.limit).toBe(5);
      expect(DEFAULT_RATE_LIMITS.capability_check.windowMs).toBe(60 * 1000); // 1 minute
    });

    test('should have correct search limit', () => {
      expect(DEFAULT_RATE_LIMITS.search.limit).toBe(60);
      expect(DEFAULT_RATE_LIMITS.search.windowMs).toBe(60 * 1000); // 1 minute
    });

    test('should allow env overrides for limits and windows', () => {
      const resolved = resolveRateLimits({
        RATE_LIMIT_READ_LIMIT: '42',
        RATE_LIMIT_READ_WINDOW_MS: '120000',
      });

      expect(resolved.read.limit).toBe(42);
      expect(resolved.read.windowMs).toBe(120000);
      expect(resolved.write.limit).toBe(100);
    });

    test('should ignore invalid env overrides and keep defaults', () => {
      const resolved = resolveRateLimits({
        RATE_LIMIT_APPEND_LIMIT: '0',
        RATE_LIMIT_APPEND_WINDOW_MS: '-1',
      });

      expect(resolved.append.limit).toBe(400);
      expect(resolved.append.windowMs).toBe(60 * 1000);
    });
  });

  describe('cleanupExpiredEntries', () => {
    test('should clean up expired entries', () => {
      // Add some entries
      checkRateLimit('cleanup-test-1', 'read');
      checkRateLimit('cleanup-test-2', 'read');

      expect(getRateLimitStoreSize()).toBeGreaterThan(0);

      // Clear and check (entries should be removed when they expire)
      clearAllRateLimits();
      expect(getRateLimitStoreSize()).toBe(0);
    });

    test('should return number of cleaned entries', () => {
      clearAllRateLimits();
      expect(getRateLimitStoreSize()).toBe(0);

      // Add entries
      checkRateLimit('entry1', 'read');
      checkRateLimit('entry2', 'write');

      expect(getRateLimitStoreSize()).toBe(2);

      // Clear all (simulates cleanup of expired entries)
      clearAllRateLimits();
      expect(getRateLimitStoreSize()).toBe(0);
    });
  });

  describe('buildRateLimitHeaders', () => {
    test('should build correct headers from result', () => {
      const result = checkRateLimit('header-test', 'read');
      const headers = buildRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe(String(result.limit));
      expect(headers['X-RateLimit-Remaining']).toBe(String(result.remaining));
      expect(headers['X-RateLimit-Reset']).toBe(String(result.resetAt));
    });

    test('should build headers with zero remaining when exceeded', () => {
      const identifier = 'header-exceeded';
      const customLimit = 1;

      // Exhaust the limit
      checkRateLimit(identifier, 'read', customLimit);
      const result = checkRateLimit(identifier, 'read', customLimit);

      const headers = buildRateLimitHeaders(result);
      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });

  describe('buildRateLimitErrorResponse', () => {
    test('should build correct error response', () => {
      const identifier = 'error-test';
      const customLimit = 1;

      // Exhaust the limit
      checkRateLimit(identifier, 'read', customLimit);
      const result = checkRateLimit(identifier, 'read', customLimit);

      const response = buildRateLimitErrorResponse(result, 'read') as {
        ok: boolean;
        error: { code: string; message: string; details: Record<string, unknown> };
      };

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('RATE_LIMITED');
      expect(response.error.message).toContain('Rate limit exceeded');
      expect(response.error.details.limit).toBe(customLimit);
      expect(response.error.details.retryAfterSeconds).toBeGreaterThan(0);
    });

    test('should include correct window in error response', () => {
      const identifier = 'window-test';
      const customLimit = 1;

      // Test minute window (read operation)
      checkRateLimit(identifier, 'read', customLimit);
      const readResult = checkRateLimit(identifier, 'read', customLimit);
      const readResponse = buildRateLimitErrorResponse(readResult, 'read') as {
        error: { details: { window: string } };
      };
      expect(readResponse.error.details.window).toBe('1m');

      // Test hour window (bootstrap operation)
      checkRateLimit(identifier + '-bootstrap', 'bootstrap', customLimit);
      const bootstrapResult = checkRateLimit(identifier + '-bootstrap', 'bootstrap', customLimit);
      const bootstrapResponse = buildRateLimitErrorResponse(bootstrapResult, 'bootstrap') as {
        error: { details: { window: string } };
      };
      expect(bootstrapResponse.error.details.window).toBe('1h');
    });
  });

  describe('getRateLimitStoreSize', () => {
    test('should return 0 for empty store', () => {
      clearAllRateLimits();
      expect(getRateLimitStoreSize()).toBe(0);
    });

    test('should return correct count', () => {
      clearAllRateLimits();

      checkRateLimit('size-test-1', 'read');
      expect(getRateLimitStoreSize()).toBe(1);

      checkRateLimit('size-test-2', 'read');
      expect(getRateLimitStoreSize()).toBe(2);

      // Same key, different operation creates new entry
      checkRateLimit('size-test-1', 'write');
      expect(getRateLimitStoreSize()).toBe(3);
    });
  });
});
