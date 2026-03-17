export type EventType =
  | 'file.created'
  | 'file.updated'
  | 'file.deleted'
  | 'append'
  | 'task.created'
  | 'task.completed'
  | 'task.cancelled'
  | 'task.blocked'
  | 'task.unblocked'
  | 'task.overdue'
  | 'task.escalated'
  | 'task.recurred'
  | 'claim.created'
  | 'claim.expired'
  | 'claim.renewed'
  | 'claim.released'
  | 'heartbeat'
  | 'webhook.failed'
  | 'settings.changed';

export interface BusEvent {
  type: EventType;
  workspaceId: string;
  filePath: string;
  data: Record<string, unknown>;
  timestamp: string;
}

type EventCallback = (event: BusEvent) => void;

const workspaceListeners = new Map<string, Set<EventCallback>>();

const globalListeners = new Set<EventCallback>();

export function emit(event: BusEvent): void {
  const wsListeners = workspaceListeners.get(event.workspaceId);
  if (wsListeners) {
    for (const callback of wsListeners) {
      try {
        callback(event);
      } catch (err) {
        console.error('[EventBus] Listener error:', err);
      }
    }
  }

  for (const callback of globalListeners) {
    try {
      callback(event);
    } catch (err) {
      console.error('[EventBus] Global listener error:', err);
    }
  }
}

export function subscribe(
  workspaceId: string,
  callback: EventCallback
): () => void {
  if (!workspaceListeners.has(workspaceId)) {
    workspaceListeners.set(workspaceId, new Set());
  }
  workspaceListeners.get(workspaceId)!.add(callback);

  return () => {
    const listeners = workspaceListeners.get(workspaceId);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        workspaceListeners.delete(workspaceId);
      }
    }
  };
}

export function subscribeAll(callback: EventCallback): () => void {
  globalListeners.add(callback);

  return () => {
    globalListeners.delete(callback);
  };
}

export function getListenerCounts(): {
  workspaces: number;
  global: number;
} {
  return {
    workspaces: workspaceListeners.size,
    global: globalListeners.size,
  };
}

export function clearAllListeners(): void {
  workspaceListeners.clear();
  globalListeners.clear();
}

