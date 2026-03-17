import type { KeyTier } from '../../shared';
import type { BuildSubscriptionInput, SubscriptionResponse, RateLimitResult } from './types';
import { READ_EVENTS, APPEND_EVENTS, WRITE_EVENTS, WS_URL } from './constants';
import { generateSubscriptionToken } from './token';
import { checkRateLimit as checkRateLimitService, clearAllRateLimits } from '../../services/rate-limit';
import { validateAndGetKey, hashKey } from './key-validation';
import { serverEnv } from '../../config/env';

/**
 * Get events list for a given key tier.
 */
export function getEventsForTier(tier: KeyTier): string[] {
  switch (tier) {
    case 'read':
      return READ_EVENTS;
    case 'append':
      return APPEND_EVENTS;
    case 'write':
      return WRITE_EVENTS;
    default:
      return READ_EVENTS;
  }
}

/**
 * Get tier from route prefix.
 */
export function getTierFromPrefix(prefix: string): KeyTier {
  switch (prefix) {
    case 'r':
      return 'read';
    case 'a':
      return 'append';
    case 'w':
      return 'write';
    default:
      return 'read';
  }
}

/**
 * Check rate limit for a capability key.
 */
export function checkRateLimit(keyHash: string): RateLimitResult {
  // Integration tests exercise many subscribe calls rapidly.
  // Disable subscribe rate limiting in test/integration mode.
  if (serverEnv.isTest) {
    return { allowed: true };
  }

  const result = checkRateLimitService(keyHash, 'subscribe');
  if (result.allowed) {
    return { allowed: true };
  }
  return { allowed: false, retryAfter: result.retryAfter };
}

/**
 * Reset rate limit state (for testing).
 */
export function resetRateLimitState(): void {
  clearAllRateLimits();
}

/**
 * Build subscription response.
 */
export function buildSubscriptionResponse(input: BuildSubscriptionInput): SubscriptionResponse {
  const { token, expiresAt } = generateSubscriptionToken({
    workspaceId: input.workspaceId,
    keyTier: input.keyTier,
    keyHash: input.keyHash,
    scope: input.scope,
  });

  const events = getEventsForTier(input.keyTier);

  const response: SubscriptionResponse = {
    wsUrl: WS_URL,
    token,
    expiresAt,
    events,
    keyTier: input.keyTier,
  };

  if (input.scope) {
    response.scope = input.scope;
    response.recursive = true;
  }

  return response;
}

export type SubscribeInput = {
  keyString: string;
  expectedTier: KeyTier;
  scope?: string;
};

export type SubscribeResult =
  | { ok: true; status: 200; data: SubscriptionResponse }
  | { ok: false; status: number; error: { code: string; message: string }; retryAfter?: number };

/**
 * Handle subscribe request - validates key, checks rate limit, builds response.
 * SECURITY: Uses the key's actual permission from DB, not the requested tier.
 * Capability routes return not-found on tier mismatch to avoid leaking key metadata.
 */
export async function handleSubscribe(input: SubscribeInput): Promise<SubscribeResult> {
  const keyResult = await validateAndGetKey(input.keyString);
  if (!keyResult.ok) {
    return {
      ok: false,
      status: keyResult.status,
      error: { code: keyResult.error.code, message: keyResult.error.message || 'Validation failed' },
    };
  }

  // SECURITY: Hide tier mismatches behind not-found semantics.
  const actualTier = keyResult.key.permission as KeyTier;
  if (actualTier !== input.expectedTier) {
    return {
      ok: false,
      status: 404,
      error: { code: 'NOT_FOUND', message: 'Key not found' },
    };
  }

  const keyHash = hashKey(keyResult.keyString);

  const rateLimit = checkRateLimit(keyHash);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      status: 429,
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      retryAfter: rateLimit.retryAfter,
    };
  }

  // Use the key's actual permission, not the requested tier
  const response = buildSubscriptionResponse({
    keyTier: actualTier,
    keyHash,
    workspaceId: keyResult.key.workspaceId,
    scope: input.scope,
  });

  return { ok: true, status: 200, data: response };
}
