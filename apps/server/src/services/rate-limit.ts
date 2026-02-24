/**
 * Rate Limiting Service
 *
 * Database-backed rate limiter using fixed window algorithm.
 * Supports different limits per endpoint type and tracking by API key ID or IP address.
 * Persists rate limit data in SQLite for distributed deployments.
 *
 * @see docs/Architecture.md - Rate Limiting section
 * @see docs/Architecture.md - Rate Limiting section
 * @module services/rate-limit
 */

import { sqlite } from '../db';

/**
 * Rate limit configuration for an operation type
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Maximum requests allowed in window */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the limit resets */
  resetAt: number;
  /** Seconds until the limit resets (for Retry-After header) */
  retryAfter: number;
}

/**
 * Operation types for rate limiting
 */
export type OperationType =
  | 'bootstrap'
  | 'read'
  | 'write'
  | 'append'
  | 'search'
  | 'subscribe'
  | 'bulk'
  | 'webhook_create'
  | 'capability_check';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Baseline rate limits per operation type.
 * These are fallback values when env overrides are not provided.
 * @see docs/API Design.md - Rate Limiting section
 */
const BASE_DEFAULT_RATE_LIMITS: Record<OperationType, RateLimitConfig> = {
  bootstrap: { limit: 10, windowMs: HOUR }, // 10/hour per IP
  read: { limit: 1000, windowMs: MINUTE }, // 1000/min per key (was 100, updated per requirements)
  write: { limit: 100, windowMs: MINUTE }, // 100/min per key
  append: { limit: 400, windowMs: MINUTE }, // 400/min per key
  search: { limit: 60, windowMs: MINUTE }, // 60/min per key
  subscribe: { limit: 10, windowMs: MINUTE }, // 10/min per capability URL
  bulk: { limit: 30, windowMs: MINUTE }, // 30/min per capability URL
  webhook_create: { limit: 20, windowMs: HOUR }, // 20/hour per workspace
  capability_check: { limit: 5, windowMs: MINUTE }, // 5/min per key or IP
};

const RATE_LIMIT_ENV_KEYS: Record<OperationType, { limit: string; windowMs: string }> = {
  bootstrap: {
    limit: 'RATE_LIMIT_BOOTSTRAP_LIMIT',
    windowMs: 'RATE_LIMIT_BOOTSTRAP_WINDOW_MS',
  },
  read: {
    limit: 'RATE_LIMIT_READ_LIMIT',
    windowMs: 'RATE_LIMIT_READ_WINDOW_MS',
  },
  write: {
    limit: 'RATE_LIMIT_WRITE_LIMIT',
    windowMs: 'RATE_LIMIT_WRITE_WINDOW_MS',
  },
  append: {
    limit: 'RATE_LIMIT_APPEND_LIMIT',
    windowMs: 'RATE_LIMIT_APPEND_WINDOW_MS',
  },
  search: {
    limit: 'RATE_LIMIT_SEARCH_LIMIT',
    windowMs: 'RATE_LIMIT_SEARCH_WINDOW_MS',
  },
  subscribe: {
    limit: 'RATE_LIMIT_SUBSCRIBE_LIMIT',
    windowMs: 'RATE_LIMIT_SUBSCRIBE_WINDOW_MS',
  },
  bulk: {
    limit: 'RATE_LIMIT_BULK_LIMIT',
    windowMs: 'RATE_LIMIT_BULK_WINDOW_MS',
  },
  webhook_create: {
    limit: 'RATE_LIMIT_WEBHOOK_CREATE_LIMIT',
    windowMs: 'RATE_LIMIT_WEBHOOK_CREATE_WINDOW_MS',
  },
  capability_check: {
    limit: 'RATE_LIMIT_CAPABILITY_CHECK_LIMIT',
    windowMs: 'RATE_LIMIT_CAPABILITY_CHECK_WINDOW_MS',
  },
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function resolveRateLimits(
  source: NodeJS.ProcessEnv = process.env
): Record<OperationType, RateLimitConfig> {
  const operations = Object.keys(BASE_DEFAULT_RATE_LIMITS) as OperationType[];
  const resolved = {} as Record<OperationType, RateLimitConfig>;

  for (const operation of operations) {
    const defaults = BASE_DEFAULT_RATE_LIMITS[operation];
    const keys = RATE_LIMIT_ENV_KEYS[operation];
    resolved[operation] = {
      limit: parsePositiveInt(source[keys.limit], defaults.limit),
      windowMs: parsePositiveInt(source[keys.windowMs], defaults.windowMs),
    };
  }

  return resolved;
}

/**
 * Active rate limits for this server process.
 * Environment variables override fallback defaults from BASE_DEFAULT_RATE_LIMITS.
 */
export const DEFAULT_RATE_LIMITS: Record<OperationType, RateLimitConfig> = resolveRateLimits();

// Type for rate limit database record
interface RateLimitRecord {
  key: string;
  count: number;
  window_start: number;
}

// Use raw SQLite for rate limiting to avoid async overhead
// Note: Bun's prepare<ReturnType, ParamsType> - return type comes first!
const getRateLimitStmt = sqlite.prepare<RateLimitRecord, string>(`
  SELECT key, count, window_start FROM rate_limits WHERE key = ?
`);

const upsertRateLimitStmt = sqlite.prepare<void, [string, number, number]>(`
  INSERT INTO rate_limits (key, count, window_start)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start
`);

const deleteExpiredStmt = sqlite.prepare<void, number>(`
  DELETE FROM rate_limits WHERE window_start < ?
`);

const clearAllStmt = sqlite.prepare<void, []>(`DELETE FROM rate_limits`);

const countEntriesStmt = sqlite.prepare<{ count: number }, []>(`SELECT COUNT(*) as count FROM rate_limits`);

/**
 * Cleanup interval reference for graceful shutdown
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check if a request is allowed under rate limiting.
 * Uses fixed window algorithm with database persistence.
 *
 * @param identifier - Unique identifier (API key ID, IP address, etc.)
 * @param operation - Type of operation being performed
 * @param customLimit - Optional custom limit override (e.g., from API key config)
 * @returns Rate limit result with allowed status and metadata
 */
export function checkRateLimit(
  identifier: string,
  operation: OperationType,
  customLimit?: number
): RateLimitResult {
  const config = DEFAULT_RATE_LIMITS[operation];
  const limit = customLimit ?? config.limit;
  const windowMs = config.windowMs;
  const now = Date.now();
  const windowStart = now - windowMs;

  const key = `${operation}:${identifier}`;

  // Get existing entry from database
  const existing = getRateLimitStmt.get(key);

  // If entry exists but window has expired, reset it
  if (existing && existing.window_start < windowStart) {
    // Window expired, reset count
    upsertRateLimitStmt.run(key, 1, now);
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetAt: Math.ceil((now + windowMs) / 1000),
      retryAfter: 0,
    };
  }

  // If no entry exists, create one
  if (!existing) {
    upsertRateLimitStmt.run(key, 1, now);
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetAt: Math.ceil((now + windowMs) / 1000),
      retryAfter: 0,
    };
  }

  // Check if limit exceeded
  if (existing.count >= limit) {
    const resetAt = Math.ceil((existing.window_start + windowMs) / 1000);
    const retryAfter = Math.max(0, Math.ceil((existing.window_start + windowMs - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt,
      retryAfter,
    };
  }

  // Increment count
  const newCount = existing.count + 1;
  upsertRateLimitStmt.run(key, newCount, existing.window_start);

  return {
    allowed: true,
    limit,
    remaining: limit - newCount,
    resetAt: Math.ceil((existing.window_start + windowMs) / 1000),
    retryAfter: 0,
  };
}

/**
 * Get current rate limit status without consuming a request.
 * Useful for displaying rate limit info in responses.
 */
export function getRateLimitStatus(
  identifier: string,
  operation: OperationType,
  customLimit?: number
): Omit<RateLimitResult, 'allowed'> {
  const config = DEFAULT_RATE_LIMITS[operation];
  const limit = customLimit ?? config.limit;
  const windowMs = config.windowMs;
  const now = Date.now();
  const windowStart = now - windowMs;

  const key = `${operation}:${identifier}`;
  const existing = getRateLimitStmt.get(key);

  // No entry or expired entry
  if (!existing || existing.window_start < windowStart) {
    return {
      limit,
      remaining: limit,
      resetAt: Math.ceil((now + windowMs) / 1000),
      retryAfter: 0,
    };
  }

  const remaining = Math.max(0, limit - existing.count);
  const resetAt = Math.ceil((existing.window_start + windowMs) / 1000);
  const retryAfter = remaining === 0 ? Math.max(0, Math.ceil((existing.window_start + windowMs - now) / 1000)) : 0;

  return { limit, remaining, resetAt, retryAfter };
}

/**
 * Clean up expired entries from the rate limit store.
 * Should be called periodically to prevent database growth.
 */
export function cleanupExpiredEntries(): number {
  const windows = Object.values(DEFAULT_RATE_LIMITS);
  const maxWindowMs = windows.reduce((max, config) => Math.max(max, config.windowMs), 0);
  const threshold = Date.now() - maxWindowMs;
  deleteExpiredStmt.run(threshold);
  // SQLite doesn't return affected rows easily, so we estimate
  return 0;
}

/**
 * Start periodic cleanup of expired entries.
 * @param intervalMs - Cleanup interval in milliseconds (default: 5 minutes)
 */
export function startCleanup(intervalMs: number = 5 * 60 * 1000): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  cleanupInterval = setInterval(() => {
    cleanupExpiredEntries();
  }, intervalMs);
}

/**
 * Stop periodic cleanup.
 */
export function stopCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear all rate limit entries.
 * Useful for testing.
 */
export function clearAllRateLimits(): void {
  clearAllStmt.run();
}

/**
 * Get the current size of the rate limit store.
 * Useful for monitoring.
 */
export function getRateLimitStoreSize(): number {
  const result = countEntriesStmt.get();
  return result?.count ?? 0;
}

/**
 * Build rate limit headers for HTTP response.
 */
export function buildRateLimitHeaders(result: RateLimitResult | Omit<RateLimitResult, 'allowed'>): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  };
}

/**
 * Build rate limit error response body.
 */
export function buildRateLimitErrorResponse(result: RateLimitResult, operation: OperationType): object {
  const config = DEFAULT_RATE_LIMITS[operation];
  const windowStr = formatWindowDuration(config.windowMs);

  return {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`,
      details: {
        limit: result.limit,
        window: windowStr,
        retryAfterSeconds: result.retryAfter,
        resetAt: new Date(result.resetAt * 1000).toISOString(),
      },
    },
  };
}

function formatWindowDuration(windowMs: number): string {
  if (windowMs % HOUR === 0) {
    return `${windowMs / HOUR}h`;
  }
  if (windowMs % MINUTE === 0) {
    return `${windowMs / MINUTE}m`;
  }
  return `${Math.max(1, Math.ceil(windowMs / 1000))}s`;
}
