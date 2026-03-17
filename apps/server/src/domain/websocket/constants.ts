import { serverEnv } from '../../config/env';

// URLs
export const BASE_URL = serverEnv.baseUrl;
export const WS_URL = serverEnv.wsUrl;

// Token expiry
export const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Token cleanup
export const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const TOKEN_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Connection limits (from API Design)
export const MAX_WORKSPACE_CONNECTIONS = 100;
export const MAX_KEY_CONNECTIONS = 10;

// Events by tier
export const READ_EVENTS = ['append', 'file.created', 'file.deleted', 'file.updated'];

export const APPEND_EVENTS = [
  ...READ_EVENTS,
  'task.created',
  'task.completed',
  'task.cancelled',
  'task.blocked',
  'task.unblocked',
  'task.overdue',
  'task.escalated',
  'task.recurred',
  'claim.created',
  'claim.expired',
  'claim.renewed',
  'claim.released',
  'heartbeat',
];

export const WRITE_EVENTS = [...APPEND_EVENTS, 'webhook.failed', 'settings.changed'];

// Debug flag
export const WS_DEBUG = serverEnv.wsDebug;
