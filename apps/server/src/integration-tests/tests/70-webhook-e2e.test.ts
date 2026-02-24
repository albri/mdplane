import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';
import { startMockWebhookReceiver } from '../helpers/mock-webhook-receiver';

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const match = events.find((e) => {
      const webhookEvent = asWebhookEvent(e);
      return webhookEvent?.event === eventType;
    });
    if (match) {
      const webhookEvent = asWebhookEvent(match);
      if (webhookEvent) return webhookEvent;
    }
    await sleep(500);
  }

  throw new Error(
    `Timeout waiting for event '${eventType}' after ${timeoutMs}ms. ` +
      `Events received: ${JSON.stringify(events.map((e) => asWebhookEvent(e)?.event))}`
  );
}

async function pollForEvents(
  receiver: ReturnType<typeof startMockWebhookReceiver>,
  testRunId: string,
  expectedCount: number,
  timeoutMs: number = 15000
): Promise<ReceiverEvent[]> {
  const startTime = Date.now();
  let events: StoredEvent[] = [];

  while (Date.now() - startTime < timeoutMs) {
    events = receiver.getEvents(testRunId);
    const webhookEvents = events.map((e) => asWebhookEvent(e)).filter((e): e is ReceiverEvent => e !== null);
    if (webhookEvents.length >= expectedCount) {
      return webhookEvents;
    }
    await sleep(500);
  }

  throw new Error(
    `Timeout waiting for ${expectedCount} events after ${timeoutMs}ms, got ${events.length}. ` +
      `Events received: ${JSON.stringify(events.map((e) => asWebhookEvent(e)?.event))}`
  );
}

describe('70 - Webhook E2E - Real Delivery', () => {
  let workspace: BootstrappedWorkspace;
  let webhookId: string;
  let testRunId: string;
  let receiver: ReturnType<typeof startMockWebhookReceiver>;
  const testFileName = `${uniqueName('webhook-e2e')}.md`;
  let taskAppendId: string;

  beforeAll(async () => {
    testRunId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    workspace = await bootstrap();

    receiver = startMockWebhookReceiver();
    receiver.clearEvents();

    const webhookUrl = `${receiver.url}/ingest?testRunId=${testRunId}`;
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
      body: {
        url: webhookUrl,
        events: ['file.created', 'file.updated', 'append.created', 'task.created', 'claim.created'],
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    webhookId = data.data.id;
  });

  afterAll(async () => {
    if (webhookId && workspace) {
      await apiRequest('DELETE', `/w/${workspace.writeKey}/webhooks/${webhookId}`);
    }

    receiver.stop();
  });

  test('file.created event is delivered to receiver', async () => {
    const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
      body: { content: '# Webhook E2E Test\n\nTest file for webhook delivery.' },
    });
    expect(response.status).toBe(201);

    const event = await pollForEvent(receiver, testRunId, 'file.created');

    expect(event.event).toBe('file.created');
    expect(event.timestamp).toBeDefined();
    expect(event.data?.file?.path).toBe(`/${testFileName}`);
    expect(() => new Date(event.timestamp)).not.toThrow();
  });

  test('file.updated event is delivered to receiver', async () => {
    const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
      body: { content: '# Webhook E2E Test\n\nUpdated content for webhook test.' },
    });
    expect(response.status).toBe(200);

    const event = await pollForEvent(receiver, testRunId, 'file.updated');

    expect(event.event).toBe('file.updated');
    expect(event.timestamp).toBeDefined();
    expect(event.data?.file?.path).toBe(`/${testFileName}`);
    expect(() => new Date(event.timestamp)).not.toThrow();
  });

  test('append.created event is delivered to receiver', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: 'webhook-e2e',
        type: 'comment',
        content: 'Test comment for webhook E2E',
      },
    });
    expect(response.status).toBe(201);

    const event = await pollForEvent(receiver, testRunId, 'append.created');

    expect(event.event).toBe('append.created');
    expect(event.timestamp).toBeDefined();
    expect(event.data?.file?.path).toBe(`/${testFileName}`);
    expect(() => new Date(event.timestamp)).not.toThrow();
  });

  test('task.created event is delivered to receiver', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: 'webhook-e2e',
        type: 'task',
        content: 'Test task for webhook E2E',
      },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    taskAppendId = data.data.id;

    const event = await pollForEvent(receiver, testRunId, 'task.created');

    expect(event.event).toBe('task.created');
    expect(event.timestamp).toBeDefined();
    expect(event.data?.file?.path).toBe(`/${testFileName}`);
    expect(() => new Date(event.timestamp)).not.toThrow();
  });

  test('claim.created event is delivered to receiver', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: 'webhook-e2e_claimer',
        type: 'claim',
        ref: taskAppendId,
        content: 'Claiming task for webhook E2E test',
      },
    });
    expect(response.status).toBe(201);

    const event = await pollForEvent(receiver, testRunId, 'claim.created');

    expect(event.event).toBe('claim.created');
    expect(event.timestamp).toBeDefined();
    expect(event.data?.file?.path).toBe(`/${testFileName}`);
    expect(() => new Date(event.timestamp)).not.toThrow();
  });

  test('all events have valid payload structure', async () => {
    const events = await pollForEvents(receiver, testRunId, 5);

    for (const event of events) {
      expect(event.event).toBeDefined();
      expect(typeof event.event).toBe('string');

      expect(event.timestamp).toBeDefined();
      const timestamp = new Date(event.timestamp);
      expect(timestamp.toISOString()).toBe(event.timestamp);

      expect(event.data?.file?.path).toBe(`/${testFileName}`);
    }

    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain('file.created');
    expect(eventTypes).toContain('file.updated');
    expect(eventTypes).toContain('append.created');
    expect(eventTypes).toContain('task.created');
    expect(eventTypes).toContain('claim.created');
  });
});
