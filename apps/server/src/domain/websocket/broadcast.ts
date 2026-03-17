import { generateKey } from '../../core/capability-keys';
import { getActiveConnectionsIterator, getNextSequence } from './state';

export function matchesScope(eventPath: string, scope: string): boolean {
  // Root scope or empty scope matches everything
  if (!scope || scope === '/') {
    return true;
  }
  // Event path must start with scope
  return eventPath.startsWith(scope);
}

function mapEventType(busEventType: string): string {
  // WebSocket event names use dot notation (same as EventBus)
  return busEventType;
}

export function broadcastEvent(
  workspaceId: string,
  event: {
    type: string;
    filePath: string;
    data: Record<string, unknown>;
  }
): void {
  const wsEventType = mapEventType(event.type);

  // Assign sequence once per event (not per connection) to ensure all clients
  // see the same sequence number for the same event
  const sequence = getNextSequence(workspaceId);
  const eventId = `evt_${generateKey(8)}`;
  const timestamp = new Date().toISOString();

  for (const conn of getActiveConnectionsIterator()) {
    // Must match workspace
    if (conn.workspaceId !== workspaceId) continue;

    // Check scope - event path must start with connection scope
    if (!matchesScope(event.filePath, conn.scope)) continue;

    // Check event type - must be in subscribed events
    if (!conn.events.includes(wsEventType)) continue;

    // Build event payload per API spec (same eventId/sequence for all recipients)
    const payload = {
      eventId,
      sequence,
      event: wsEventType,
      timestamp,
      file: { path: event.filePath },
      data: event.data,
    };

    // Send (handle closed connections gracefully)
    try {
      // Check if WebSocket is still open (readyState 1 = OPEN)
      if (conn.ws.readyState === undefined || conn.ws.readyState === 1) {
        conn.ws.send(JSON.stringify(payload));
      }
    } catch (err) {
      console.error('[WS] Broadcast error:', err);
    }
  }
}

