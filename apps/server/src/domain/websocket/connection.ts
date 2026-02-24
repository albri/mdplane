import { generateKey } from '../../core/capability-keys';
import type { KeyTier } from '../../shared';
import type { WsConnection, ConnectionLimitResult } from './types';
import { MAX_WORKSPACE_CONNECTIONS, MAX_KEY_CONNECTIONS, WS_DEBUG } from './constants';
import {
  getWorkspaceConnectionCount,
  addWorkspaceConnection,
  removeWorkspaceConnection,
  getKeyConnectionCount,
  addKeyConnection,
  removeKeyConnection,
  setActiveConnection,
  deleteActiveConnection,
  getActiveConnectionCount as getActiveCount,
  clearWorkspaceConnections,
  clearKeyConnections,
} from './state';
import { getEventsForTier } from './subscription';

export function checkConnectionLimits(
  keyHash: string,
  workspaceId: string
): ConnectionLimitResult {
  const currentKeyConnections = getKeyConnectionCount(keyHash);
  if (currentKeyConnections >= MAX_KEY_CONNECTIONS) {
    return {
      allowed: false,
      code: 'CONNECTION_LIMIT_EXCEEDED',
      message: 'Too many connections for this key',
      status: 429,
    };
  }

  const currentWorkspaceConnections = getWorkspaceConnectionCount(workspaceId);
  if (currentWorkspaceConnections >= MAX_WORKSPACE_CONNECTIONS) {
    return {
      allowed: false,
      code: 'SERVER_BUSY',
      message: 'Server at capacity',
      status: 503,
    };
  }

  return { allowed: true };
}

export function registerConnection(params: {
  ws: { send: (data: string) => void; readyState?: number };
  workspaceId: string;
  keyHash: string;
  keyTier: KeyTier;
  scope?: string;
}): { connectionId: string; events: string[] } {
  const connectionId = generateKey(16);
  const events = getEventsForTier(params.keyTier);

  addWorkspaceConnection(params.workspaceId, connectionId);
  addKeyConnection(params.keyHash, connectionId);

  setActiveConnection(connectionId, {
    ws: params.ws,
    connectionId,
    workspaceId: params.workspaceId,
    keyHash: params.keyHash,
    scope: params.scope || '/',
    events,
    keyTier: params.keyTier,
    connectedAt: Date.now(),
  });

  return { connectionId, events };
}

export function unregisterConnection(
  connectionId: string,
  workspaceId: string,
  keyHash: string
): void {
  const prevCount = getKeyConnectionCount(keyHash);

  deleteActiveConnection(connectionId);
  removeWorkspaceConnection(workspaceId, connectionId);
  removeKeyConnection(keyHash, connectionId);

  const newCount = getKeyConnectionCount(keyHash);
  if (WS_DEBUG) {
    console.log(
      `[WS] Connection closed: connId=${connectionId.slice(0, 8)} keyHash=${keyHash.slice(0, 6)} keyConns=${prevCount}->${newCount}`
    );
  }
}

export function getActiveConnectionCount(): number {
  return getActiveCount();
}

export function getConnectionCounts(
  keyHash?: string,
  workspaceId?: string
): { keyConnections: number; workspaceConnections: number } {
  return {
    keyConnections: keyHash ? getKeyConnectionCount(keyHash) : 0,
    workspaceConnections: workspaceId ? getWorkspaceConnectionCount(workspaceId) : 0,
  };
}

export function resetConnectionTracking(): void {
  clearWorkspaceConnections();
  clearKeyConnections();
}

