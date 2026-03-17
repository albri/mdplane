// Types
export type {
  KeyValidationResult,
  WsConnection,
  BuildSubscriptionInput,
  SubscriptionResponse,
  RateLimitResult,
  ConnectionLimitResult,
} from './types';

// Constants
export {
  WS_URL,
  TOKEN_EXPIRY_MS,
  MAX_WORKSPACE_CONNECTIONS,
  MAX_KEY_CONNECTIONS,
  READ_EVENTS,
  APPEND_EVENTS,
  WRITE_EVENTS,
  WS_DEBUG,
} from './constants';

// Initialization
export { initWebSocketModule, isWebSocketModuleInitialized } from './init';

// Token operations
export {
  validateWsToken,
  markTokenUsed,
  tokenHashPrefix,
  type WsTokenPayload,
} from './token';

// Key validation
export {
  validateAndGetKey,
  checkKeyNotRevoked,
  hashKey,
} from './key-validation';

// Subscription
export {
  getEventsForTier,
  getTierFromPrefix,
  checkRateLimit,
  resetRateLimitState,
  buildSubscriptionResponse,
  handleSubscribe,
  type SubscribeInput,
  type SubscribeResult,
} from './subscription';

// Connection management
export {
  checkConnectionLimits,
  registerConnection,
  unregisterConnection,
  getActiveConnectionCount,
  getConnectionCounts,
  resetConnectionTracking,
} from './connection';

// Broadcasting
export { matchesScope, broadcastEvent } from './broadcast';

// State (for testing)
export { clearUsedTokens as resetUsedTokens } from './state';

// Route
export { websocketRoute } from './route';
