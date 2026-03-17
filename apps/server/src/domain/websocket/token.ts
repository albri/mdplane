import { signWsToken, verifyWsToken, tokenHashPrefix, type WsTokenPayload } from '../../core/ws-token';
import type { KeyTier } from '../../shared';
import { serverEnv } from '../../config/env';
import {
  TOKEN_TTL_MS,
  TOKEN_CLEANUP_INTERVAL_MS,
  TOKEN_EXPIRY_MS,
  WS_DEBUG,
} from './constants';
import {
  isTokenUsed,
  markTokenUsed,
  getUsedTokensIterator,
  deleteUsedToken,
} from './state';

export { tokenHashPrefix, type WsTokenPayload };

// Cleanup interval handle
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

export function cleanupExpiredTokens(): void {
  const now = Date.now();
  let usedTokensCleaned = 0;

  for (const [token, timestamp] of getUsedTokensIterator()) {
    if (now - timestamp > TOKEN_TTL_MS) {
      deleteUsedToken(token);
      usedTokensCleaned++;
    }
  }

  if (WS_DEBUG && usedTokensCleaned > 0) {
    console.log(`[WS] Token cleanup: removed ${usedTokensCleaned} used token entries`);
  }
}

export function startTokenCleanup(): void {
  if (!serverEnv.isTest && !cleanupIntervalId) {
    cleanupIntervalId = setInterval(cleanupExpiredTokens, TOKEN_CLEANUP_INTERVAL_MS);
    if (cleanupIntervalId.unref) {
      cleanupIntervalId.unref();
    }
  }
}

export function generateSubscriptionToken(params: {
  workspaceId: string;
  keyTier: KeyTier;
  keyHash: string;
  scope?: string;
}): { token: string; expiresAt: string } {
  const expSeconds = Math.floor((Date.now() + TOKEN_EXPIRY_MS) / 1000);
  const expiresAt = new Date(expSeconds * 1000).toISOString();

  const token = signWsToken({
    workspaceId: params.workspaceId,
    keyTier: params.keyTier,
    keyHash: params.keyHash,
    exp: expSeconds,
    scope: params.scope,
  });

  if (WS_DEBUG) {
    console.log(
      `[WS] Token issued: hash=${tokenHashPrefix(token)} workspace=${params.workspaceId} tier=${params.keyTier} scope=${params.scope || '/'}`
    );
  }

  return { token, expiresAt };
}

export function validateWsToken(token: string): {
  ok: true;
  payload: WsTokenPayload;
} | {
  ok: false;
  error: { code: string };
  status: number;
} {
  const hashPrefix = token ? tokenHashPrefix(token) : 'empty';

  if (!token) {
    console.log(`[WS] Token validation failed: hash=${hashPrefix} reason=TOKEN_INVALID (empty)`);
    return { ok: false, error: { code: 'TOKEN_INVALID' }, status: 401 };
  }

  // Check if token was already used (per-instance single-use enforcement)
  if (isTokenUsed(token)) {
    console.log(`[WS] Token validation failed: hash=${hashPrefix} reason=TOKEN_ALREADY_USED`);
    return { ok: false, error: { code: 'TOKEN_ALREADY_USED' }, status: 401 };
  }

  // Verify JWT signature and expiration
  const result = verifyWsToken(token);

  if (!result.ok) {
    console.log(`[WS] Token validation failed: hash=${hashPrefix} reason=${result.error.code}`);
    return result;
  }

  if (WS_DEBUG) {
    console.log(
      `[WS] Token validated: hash=${hashPrefix} workspace=${result.payload.workspaceId} tier=${result.payload.keyTier} scope=${result.payload.scope || '/'}`
    );
  }

  return result;
}

export { markTokenUsed };
