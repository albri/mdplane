import { subscribeAll, type BusEvent } from '../../services/event-bus';
import { broadcastEvent } from './broadcast';
import { startTokenCleanup } from './token';
import { WS_DEBUG } from './constants';

let wsModuleInitialized = false;

// Called explicitly to avoid implicit initialization order issues
export function initWebSocketModule(): void {
  if (wsModuleInitialized) return;
  wsModuleInitialized = true;

  // Subscribe to EventBus
  subscribeAll((event: BusEvent) => {
    broadcastEvent(event.workspaceId, {
      type: event.type,
      filePath: event.filePath,
      data: event.data,
    });
  });

  // Start token cleanup interval
  startTokenCleanup();

  if (WS_DEBUG) console.log('[WS] WebSocket module initialized');
}

export function isWebSocketModuleInitialized(): boolean {
  return wsModuleInitialized;
}
