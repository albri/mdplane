import type { WsConnection } from './types';

const usedTokens = new Map<string, number>(); // token hash -> timestamp
const workspaceConnections = new Map<string, Set<string>>();
const keyConnections = new Map<string, Set<string>>();
const activeConnections = new Map<string, WsConnection>();
const eventSequences = new Map<string, number>();

export function isTokenUsed(token: string): boolean {
  return usedTokens.has(token);
}

export function markTokenUsed(token: string): void {
  usedTokens.set(token, Date.now());
}

export function getUsedTokenTimestamp(token: string): number | undefined {
  return usedTokens.get(token);
}

export function deleteUsedToken(token: string): void {
  usedTokens.delete(token);
}

export function getUsedTokensIterator(): IterableIterator<[string, number]> {
  return usedTokens.entries();
}

export function clearUsedTokens(): void {
  usedTokens.clear();
}

export function getWorkspaceConnectionCount(workspaceId: string): number {
  return workspaceConnections.get(workspaceId)?.size || 0;
}

export function addWorkspaceConnection(workspaceId: string, connectionId: string): void {
  if (!workspaceConnections.has(workspaceId)) {
    workspaceConnections.set(workspaceId, new Set());
  }
  workspaceConnections.get(workspaceId)!.add(connectionId);
}

export function removeWorkspaceConnection(workspaceId: string, connectionId: string): void {
  const conns = workspaceConnections.get(workspaceId);
  if (conns) {
    conns.delete(connectionId);
    if (conns.size === 0) {
      workspaceConnections.delete(workspaceId);
    }
  }
}

export function clearWorkspaceConnections(): void {
  workspaceConnections.clear();
}

export function getKeyConnectionCount(keyHash: string): number {
  return keyConnections.get(keyHash)?.size || 0;
}

export function addKeyConnection(keyHash: string, connectionId: string): void {
  if (!keyConnections.has(keyHash)) {
    keyConnections.set(keyHash, new Set());
  }
  keyConnections.get(keyHash)!.add(connectionId);
}

export function removeKeyConnection(keyHash: string, connectionId: string): void {
  const conns = keyConnections.get(keyHash);
  if (conns) {
    conns.delete(connectionId);
    if (conns.size === 0) {
      keyConnections.delete(keyHash);
    }
  }
}

export function clearKeyConnections(): void {
  keyConnections.clear();
}

export function getActiveConnection(connectionId: string): WsConnection | undefined {
  return activeConnections.get(connectionId);
}

export function setActiveConnection(connectionId: string, conn: WsConnection): void {
  activeConnections.set(connectionId, conn);
}

export function deleteActiveConnection(connectionId: string): void {
  activeConnections.delete(connectionId);
}

export function getActiveConnectionsIterator(): IterableIterator<WsConnection> {
  return activeConnections.values();
}

export function getActiveConnectionCount(): number {
  return activeConnections.size;
}

export function getNextSequence(workspaceId: string): number {
  const current = eventSequences.get(workspaceId) || 0;
  const next = current + 1;
  eventSequences.set(workspaceId, next);
  return next;
}
