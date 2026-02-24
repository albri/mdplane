import { Elysia } from 'elysia';
import {
  checkRateLimit,
  buildRateLimitHeaders,
  buildRateLimitErrorResponse,
  type OperationType,
} from '../services/rate-limit';
import { serverEnv } from '../config/env';
import { validateKey } from './capability-keys';
import { getClientIp } from './client-ip';

export interface ApiKeyRateLimits {
  read?: number;
  write?: number;
  append?: number;
  search?: number;
  subscribe?: number;
  webhook_create?: number;
  bulk?: number;
  bootstrap?: number;
  capability_check?: number;
}

export interface RateLimitContext {
  rateLimitId: string;
  rateLimitIdType: 'api_key' | 'capability_key' | 'ip';
  customRateLimits?: ApiKeyRateLimits;
}

export function extractApiKeyFromHeader(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth) return null;

  const match = auth.match(/^Bearer\s+(sk_(live|test)_[A-Za-z0-9]{20,})$/);
  return match ? match[1] : null;
}

export function extractCapabilityKeyFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  const keyType = segments[0];
  if (keyType !== 'r' && keyType !== 'a' && keyType !== 'w') {
    return null;
  }

  const keyCandidate = segments[1];
  if (validateKey(keyCandidate, 'root') || validateKey(keyCandidate, 'scoped')) {
    return keyCandidate;
  }

  return null;
}

export function determineOperationType(method: string, pathname: string): OperationType {
  const verb = method.toUpperCase();
  const segments = pathname.split('/').filter(Boolean);

  const isCapabilityTierPath =
    segments[0] === 'r' || segments[0] === 'a' || segments[0] === 'w';

  // Bootstrap
  if (pathname === '/bootstrap') {
    return 'bootstrap';
  }

  // Capability check
  if (
    pathname === '/capabilities/check' ||
    (verb === 'POST' &&
      segments.length === 4 &&
      segments[0] === 'w' &&
      segments[2] === 'capabilities' &&
      segments[3] === 'check')
  ) {
    return 'capability_check';
  }

  // Subscribe endpoints
  if (
    verb === 'GET' &&
    ((isCapabilityTierPath &&
      segments.length === 4 &&
      segments[2] === 'ops' &&
      segments[3] === 'subscribe') ||
      (isCapabilityTierPath &&
        segments.length === 5 &&
        segments[2] === 'ops' &&
        segments[3] === 'folders' &&
        segments[4] === 'subscribe'))
  ) {
    return 'subscribe';
  }

  // Search endpoints
  if (
    verb === 'GET' &&
    ((segments.length === 3 && segments[0] === 'r' && segments[2] === 'search') ||
      (segments.length === 5 &&
        segments[0] === 'r' &&
        segments[2] === 'ops' &&
        segments[3] === 'folders' &&
        segments[4] === 'search') ||
      (segments.length === 3 &&
        segments[0] === 'api' &&
        segments[1] === 'v1' &&
        segments[2] === 'search'))
  ) {
    return 'search';
  }

  // Bulk operations
  if (
    verb === 'POST' &&
    segments.length >= 4 &&
    segments[0] === 'a' &&
    segments[2] === 'folders' &&
    segments[segments.length - 1] === 'bulk'
  ) {
    return 'bulk';
  }

  // Webhook creation
  if (
    verb === 'POST' &&
    ((segments.length === 3 && segments[0] === 'w' && segments[2] === 'webhooks') ||
      (segments.length >= 5 &&
        segments[0] === 'w' &&
        segments[2] === 'folders' &&
        segments[segments.length - 1] === 'webhooks') ||
      (segments.length === 3 &&
        segments[0] === 'workspaces' &&
        segments[2] === 'webhooks'))
  ) {
    return 'webhook_create';
  }

  // Write operations (POST, PUT, DELETE on /w/ paths)
  if (pathname.startsWith('/w/') && ['POST', 'PUT', 'DELETE'].includes(verb)) {
    return 'write';
  }

  // Append operations (POST on /a/ paths)
  if (pathname.startsWith('/a/') && verb === 'POST') {
    return 'append';
  }

  // Default to read for everything else
  return 'read';
}

export function parseApiKeyRateLimits(rateLimitJson: string | null): ApiKeyRateLimits | undefined {
  if (!rateLimitJson) return undefined;

  try {
    const parsed = JSON.parse(rateLimitJson);
    if (typeof parsed !== 'object' || parsed === null) return undefined;

    const result: ApiKeyRateLimits = {};
    if (typeof parsed.read === 'number') result.read = parsed.read;
    if (typeof parsed.write === 'number') result.write = parsed.write;
    if (typeof parsed.append === 'number') result.append = parsed.append;
    if (typeof parsed.search === 'number') result.search = parsed.search;
    if (typeof parsed.subscribe === 'number') result.subscribe = parsed.subscribe;
    if (typeof parsed.webhook_create === 'number') result.webhook_create = parsed.webhook_create;
    if (typeof parsed.bulk === 'number') result.bulk = parsed.bulk;
    if (typeof parsed.bootstrap === 'number') result.bootstrap = parsed.bootstrap;
    if (typeof parsed.capability_check === 'number') result.capability_check = parsed.capability_check;

    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

export interface RateLimitMiddlewareOptions {
  skipPaths?: RegExp[];
  getIdentifier?: (request: Request) => { id: string; type: 'api_key' | 'capability_key' | 'ip' };
  getCustomLimits?: (identifier: string) => ApiKeyRateLimits | undefined;
}

function computeRateLimitInfo(
  request: Request,
  options?: RateLimitMiddlewareOptions
): {
  shouldSkip: boolean;
  missingTrustedClientIp: boolean;
  rateLimitId: string;
  operation: OperationType;
  customLimit?: number;
} {
  // Integration test mode: skip rate limiting for local testing
  if (serverEnv.integrationTestMode) {
    return { shouldSkip: true, missingTrustedClientIp: false, rateLimitId: '', operation: 'read' };
  }

  const skipPaths = options?.skipPaths ?? [/^\/health/, /^\/openapi\.json/, /^\/docs/];
  const url = new URL(request.url);
  const pathname = url.pathname;
  const operation = determineOperationType(request.method, pathname);

  // Check if path should be skipped
  const shouldSkip = skipPaths.some((pattern) => pattern.test(pathname));
  let missingTrustedClientIp = false;

  // Determine identifier
  let rateLimitId: string;

  if (options?.getIdentifier) {
    const custom = options.getIdentifier(request);
    rateLimitId = custom.id;
  } else {
    // Try API key from header first
    const apiKey = extractApiKeyFromHeader(request);
    if (apiKey) {
      // Use key prefix as identifier (first 16 chars)
      rateLimitId = apiKey.substring(0, 16);
    } else {
      // Try capability key from path
      const capKey = extractCapabilityKeyFromPath(pathname);
      if (capKey) {
        // Use key prefix as identifier (first 6 chars per Architecture.md)
        rateLimitId = capKey.substring(0, 6);
      } else {
        // Fallback to IP
        rateLimitId = getClientIp(request);
        const operationNeedsIp =
          operation === 'bootstrap' || operation === 'capability_check';
        if (
          operationNeedsIp &&
          rateLimitId === 'unknown' &&
          serverEnv.requireTrustedClientIpForAnonymousRateLimits
        ) {
          missingTrustedClientIp = true;
        }
      }
    }
  }

  // Get custom limits if available
  const customRateLimits = options?.getCustomLimits?.(rateLimitId);

  // Get custom limit for this operation if available
  const customLimit = customRateLimits?.[operation as keyof ApiKeyRateLimits];

  return { shouldSkip, missingTrustedClientIp, rateLimitId, operation, customLimit };
}

export function rateLimitMiddleware(options?: RateLimitMiddlewareOptions) {
  return new Elysia({ name: 'rate-limit-middleware' })
    .derive({ as: 'scoped' }, ({ request }) => {
      const info = computeRateLimitInfo(request, options);
      return { rateLimitInfo: info };
    })
    .onBeforeHandle({ as: 'scoped' }, ({ rateLimitInfo, set }) => {
      if (rateLimitInfo.shouldSkip) {
        return; // Skip rate limiting
      }

      if (rateLimitInfo.missingTrustedClientIp) {
        set.status = 503;
        return {
          ok: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'Client IP unavailable for rate limiting. Configure trusted proxy headers.',
          },
        };
      }

      const { rateLimitId, operation, customLimit } = rateLimitInfo;

      // Check rate limit
      const result = checkRateLimit(rateLimitId, operation, customLimit);

      // Return 429 if exceeded
      if (!result.allowed) {
        set.status = 429;
        set.headers['Retry-After'] = String(result.retryAfter);
        // Add rate limit headers
        const headers = buildRateLimitHeaders(result);
        Object.assign(set.headers, headers);
        return buildRateLimitErrorResponse(result, operation);
      }

      // Add rate limit headers for successful requests
      const headers = buildRateLimitHeaders(result);
      Object.assign(set.headers, headers);

      return;
    });
}
