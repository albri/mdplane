import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import {
  connectWebSocket,
  waitForConnected,
  waitForEvent,
  createFile,
  appendToFile,
  deleteFile,
  sleep,
  type WebSocketLike,
} from '../helpers/websocket';
import { startMockWebhookReceiver } from '../helpers/mock-webhook-receiver';

// Types for receiver events
type ReceiverEvent = {
  event: string;
  timestamp: string;
  data?: {
    file?: {
      path: string;
    };
  };
};

type StoredEvent = {
  testRunId?: string;
  timestamp: number;
  payload: unknown;
};

function asWebhookEvent(e: StoredEvent): ReceiverEvent | null {
  const p = e.payload as Partial<ReceiverEvent> | null | undefined;
  if (!p || typeof p !== 'object') return null;
  if (typeof p.event !== 'string') return null;
  if (typeof p.timestamp !== 'string') return null;
  return {
    event: p.event,
    timestamp: p.timestamp,
    data: p.data,
  };
}

async function pollForEvent(
  receiver: ReturnType<typeof startMockWebhookReceiver>,
  testRunId: string,
  eventType: string,
  timeoutMs: number = 15000
): Promise<ReceiverEvent> {
  const startTime = Date.now();
  let events: StoredEvent[] = [];

  while (Date.now() - startTime < timeoutMs) {
    events = receiver.getEvents(testRunId);
    const found = events.find((e) => {
      const webhookEvent = asWebhookEvent(e);
      return webhookEvent?.event === eventType;
    });
    if (found) {
      const webhookEvent = asWebhookEvent(found);
      if (webhookEvent) return webhookEvent;
    }
    await sleep(500);
  }

  throw new Error(
    `Timeout waiting for ${eventType} event. Got ${events.length} events: ${events.map((e) => asWebhookEvent(e)?.event).join(', ')}`
  );
}

describe('72 - Combined Webhook + WebSocket Flow', () => {
  let workspace: BootstrappedWorkspace;
  let testRunId: string;
  let webhookId: string;
  let readKey: string;
  let writeKey: string;
  let appendKey: string;
  let receiver: ReturnType<typeof startMockWebhookReceiver>;
  const activeSockets: WebSocketLike[] = [];
  const createdFiles: string[] = [];

  beforeAll(async () => {
    workspace = await bootstrap();
    readKey = workspace.readKey;
    writeKey = workspace.writeKey;
    appendKey = workspace.appendKey;

    // Generate unique test run ID
    testRunId = `combined-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Start mock receiver
    receiver = startMockWebhookReceiver();
    receiver.clearEvents();

    // Create webhook pointing to receiver
    const webhookUrl = `${receiver.url}/ingest?testRunId=${testRunId}`;
    const response = await apiRequest('POST', `/w/${writeKey}/webhooks`, {
      body: {
        url: webhookUrl,
        events: ['file.created', 'task.created', 'append'],
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    webhookId = data.data.id;

    // Connect 2 WebSocket clients at append tier so they can receive task events.
    // Read tier does not include `task.created`.
    const wsA = await connectWebSocket(appendKey, { keyType: 'a' });
    const wsB = await connectWebSocket(appendKey, { keyType: 'a' });
    activeSockets.push(wsA, wsB);

    // Wait for both to be connected
    await Promise.all([waitForConnected(wsA), waitForConnected(wsB)]);
  });

  afterAll(async () => {
    for (const ws of activeSockets) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      } catch {
      }
    }

    if (webhookId && workspace) {
      await apiRequest('DELETE', `/w/${writeKey}/webhooks/${webhookId}`);
    }

    for (const path of createdFiles) {
      try {
        await deleteFile(writeKey, path);
      } catch {
      }
    }

    receiver.stop();

    if (testRunId) {
      receiver.clearEvents(testRunId);
    }
  });

  test('file.created observed by both webhook receiver and WebSocket clients', async () => {
    const [wsA, wsB] = activeSockets;
    if (!wsA || !wsB) {
      throw new Error('Expected 2 active sockets from setup');
    }

    const filePath = `/__int_combined_${Date.now()}.md`;
    createdFiles.push(filePath);

    const wsPromises = [wsA, wsB].map((ws) => waitForEvent(ws, 'file.created', 15000));

    await createFile(writeKey, filePath, '# Combined test');

    const wsEvents = await Promise.all(wsPromises);
    expect(wsEvents).toHaveLength(2);
    for (const event of wsEvents) {
      expect(event.event).toBe('file.created');
      expect(event.file.path).toBe(filePath);
    }

    const receiverEvent = await pollForEvent(receiver, testRunId, 'file.created', 15000);
    expect(receiverEvent.event).toBe('file.created');
    expect(receiverEvent.data?.file?.path).toBe(filePath);
  });

  test(
    'task.created observed by both webhook receiver and WebSocket clients',
    async () => {
    const [wsA, wsB] = activeSockets;
    if (!wsA || !wsB) {
      throw new Error('Expected 2 active sockets from setup');
    }

    let filePath = createdFiles[0];
    if (!filePath) {
      filePath = `/__int_combined_task_${Date.now()}.md`;
      createdFiles.push(filePath);
      await createFile(writeKey, filePath, '# Task test');
      await sleep(500);
    }

    const wsPromises = [wsA, wsB].map((ws) => waitForEvent(ws, 'task.created', 15000));

    await appendToFile(appendKey, filePath, {
      content: 'Combined task test',
      type: 'task',
    });

    const wsEvents = await Promise.all(wsPromises);
    expect(wsEvents).toHaveLength(2);
    for (const event of wsEvents) {
      expect(event.event).toBe('task.created');
      expect(event.file.path).toBe(filePath);
    }

    const receiverEvent = await pollForEvent(receiver, testRunId, 'task.created', 15000);
    expect(receiverEvent.event).toBe('task.created');
    expect(receiverEvent.data?.file?.path).toBe(filePath);
    },
    30_000
  );
});
