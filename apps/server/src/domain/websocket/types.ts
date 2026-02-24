import type { KeyTier, CapabilityKeyRecord } from '../../shared';

/**
 * Result of validating a capability key.
 */
export type KeyValidationResult =
  | {
      ok: true;
      key: CapabilityKeyRecord;
      keyString: string;
    }
  | {
      ok: false;
      error: { code: string; message?: string };
      status: number;
    };

/**
 * Active WebSocket connection info.
 */
export interface WsConnection {
  ws: { send: (data: string) => void; readyState?: number };
  connectionId: string;
  workspaceId: string;
  keyHash: string;
  scope: string;
  events: string[];
  keyTier: KeyTier;
  connectedAt: number;
}

/**
 * Input for building a subscription response.
 */
export interface BuildSubscriptionInput {
  keyTier: KeyTier;
  keyHash: string;
  workspaceId: string;
  scope?: string;
}

/**
 * Subscription response data.
 */
export interface SubscriptionResponse {
  wsUrl: string;
  token: string;
  expiresAt: string;
  events: string[];
  keyTier: KeyTier;
  scope?: string;
  recursive?: boolean;
}

/**
 * Rate limit check result.
 */
export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

/**
 * Connection limit check result.
 */
export type ConnectionLimitResult =
  | { allowed: true }
  | { allowed: false; code: string; message: string; status: number };

