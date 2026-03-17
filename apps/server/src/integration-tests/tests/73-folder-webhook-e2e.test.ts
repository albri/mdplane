import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';
import { startMockWebhookReceiver } from '../helpers/mock-webhook-receiver';

type ReceiverEvent = {
  event: string;
  timestamp: string;
  data?: unknown;
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

function getPayloadFilePath(payload: ReceiverEvent): string | undefined {
  const data = payload.data as any;
  const direct = data?.path;
  const fromFile = data?.file?.path;
  return typeof direct === 'string' ? direct : typeof fromFile === 'string' ? fromFile : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForEvent(
  receiver: ReturnType<typeof startMockWebhookReceiver>,
  testRunId: string,
  eventType: string,
  filePath: string,
  timeoutMs: number = 30000
): Promise<ReceiverEvent> {
  const startTime = Date.now();
  let events: StoredEvent[] = [];

  while (Date.now() - startTime < timeoutMs) {
    events = receiver.getEvents(testRunId);
    const match = events.find((e) => {
      const webhookEvent = asWebhookEvent(e);
      return webhookEvent?.event === eventType && getPayloadFilePath(webhookEvent) === filePath;
    });
    if (match) {
      const webhookEvent = asWebhookEvent(match);
      if (webhookEvent) return webhookEvent;
    }
    await sleep(500);
  }

  throw new Error(
    `Timeout waiting for event '${eventType}' at path '${filePath}' after ${timeoutMs}ms. ` +
      `Events received: ${JSON.stringify(events.map((e) => ({ event: asWebhookEvent(e)?.event, path: getPayloadFilePath(asWebhookEvent(e)!) })))}`
  );
}

async function assertNoEvent(
  receiver: ReturnType<typeof startMockWebhookReceiver>,
  testRunId: string,
  eventType: string,
  filePath: string,
  pollDurationMs: number = 3000,
  pollIntervalMs: number = 300
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < pollDurationMs) {
    const events = receiver.getEvents(testRunId);
    const match = events.find((e) => {
      const webhookEvent = asWebhookEvent(e);
      return webhookEvent?.event === eventType && getPayloadFilePath(webhookEvent) === filePath;
    });
    if (match) {
      const webhookEvent = asWebhookEvent(match);
      throw new Error(
        `Expected NO event '${eventType}' at path '${filePath}', but received one at ${Date.now() - startTime}ms: ${JSON.stringify(webhookEvent)}`
      );
    }
    await sleep(pollIntervalMs);
  }

  const finalEvents = receiver.getEvents(testRunId);
  const finalMatch = finalEvents.find((e) => {
    const webhookEvent = asWebhookEvent(e);
    return webhookEvent?.event === eventType && getPayloadFilePath(webhookEvent) === filePath;
  });

  if (finalMatch) {
    const webhookEvent = asWebhookEvent(finalMatch);
    throw new Error(
      `Expected NO event '${eventType}' at path '${filePath}', but received one in final check: ${JSON.stringify(webhookEvent)}`
    );
  }
}

describe('73 - Folder Webhook E2E - Recursive Semantics', () => {
  const TEST_TIMEOUT_MS = 30_000;

  let workspace: BootstrappedWorkspace;
  let receiverRecursive: ReturnType<typeof startMockWebhookReceiver>;
  let receiverNonRecursive: ReturnType<typeof startMockWebhookReceiver>;
  let recursiveWebhookId: string;
  let nonRecursiveWebhookId: string;
  let testRunIdRecursive: string;
  let testRunIdNonRecursive: string;

  beforeAll(async () => {
    testRunIdRecursive = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    testRunIdNonRecursive = `nonrec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    workspace = await bootstrap();

    receiverRecursive = startMockWebhookReceiver();
    receiverNonRecursive = startMockWebhookReceiver();

    receiverRecursive.clearEvents();
    receiverNonRecursive.clearEvents();

    const folderRes = await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
      body: { name: 'docs' },
    });
    expect(folderRes.status).toBe(201);

    const recursiveUrl = `${receiverRecursive.url}/ingest?testRunId=${testRunIdRecursive}`;
    const recRes = await apiRequest('POST', `/w/${workspace.writeKey}/folders/docs/webhooks`, {
      body: { url: recursiveUrl, events: ['file.created'] },
    });
    expect(recRes.status).toBe(201);
    const recData = await recRes.json();
    recursiveWebhookId = recData.data.id;
    expect(recData.data.recursive).toBe(true);

    const nonRecursiveUrl = `${receiverNonRecursive.url}/ingest?testRunId=${testRunIdNonRecursive}`;
    const nonRecRes = await apiRequest('POST', `/w/${workspace.writeKey}/folders/docs/webhooks`, {
      body: { url: nonRecursiveUrl, events: ['file.created'], recursive: false },
    });
    expect(nonRecRes.status).toBe(201);
    const nonRecData = await nonRecRes.json();
    nonRecursiveWebhookId = nonRecData.data.id;
    expect(nonRecData.data.recursive).toBe(false);
  });

  afterAll(async () => {
    if (recursiveWebhookId && workspace) {
      await apiRequest('DELETE', `/w/${workspace.writeKey}/folders/docs/webhooks/${recursiveWebhookId}`);
    }
    if (nonRecursiveWebhookId && workspace) {
      await apiRequest('DELETE', `/w/${workspace.writeKey}/folders/docs/webhooks/${nonRecursiveWebhookId}`);
    }
    receiverRecursive.stop();
    receiverNonRecursive.stop();
  });

  test(
    'direct child file triggers BOTH recursive and non-recursive webhooks',
    async () => {
      const fileName = `${uniqueName('direct')}.md`;

      const filePath = `/docs/${fileName}`;

      const res = await apiRequest('PUT', `/w/${workspace.writeKey}/docs/${fileName}`, {
        body: { content: '# Direct child file' },
      });
      expect(res.status).toBe(201);

      const recEvent = await pollForEvent(receiverRecursive, testRunIdRecursive, 'file.created', filePath);
      expect(recEvent.event).toBe('file.created');
      expect(getPayloadFilePath(recEvent)).toBe(filePath);

      const nonRecEvent = await pollForEvent(receiverNonRecursive, testRunIdNonRecursive, 'file.created', filePath);
      expect(nonRecEvent.event).toBe('file.created');
      expect(getPayloadFilePath(nonRecEvent)).toBe(filePath);
    },
    TEST_TIMEOUT_MS
  );

  test('nested file triggers recursive webhook but NOT non-recursive webhook', async () => {
    const fileName = `${uniqueName('nested')}.md`;
    const filePath = `/docs/guides/${fileName}`;

    const res = await apiRequest('PUT', `/w/${workspace.writeKey}/docs/guides/${fileName}`, {
      body: { content: '# Nested file in guides subfolder' },
    });
    expect(res.status).toBe(201);

    const recEvent = await pollForEvent(receiverRecursive, testRunIdRecursive, 'file.created', filePath);
    expect(recEvent.event).toBe('file.created');
    expect(getPayloadFilePath(recEvent)).toBe(filePath);

    await assertNoEvent(receiverNonRecursive, testRunIdNonRecursive, 'file.created', filePath);
  });

  test('deeply nested file triggers recursive webhook but NOT non-recursive', async () => {
    const fileName = `${uniqueName('deep')}.md`;
    const filePath = `/docs/guides/advanced/topics/${fileName}`;

    const res = await apiRequest('PUT', `/w/${workspace.writeKey}/docs/guides/advanced/topics/${fileName}`, {
      body: { content: '# Deeply nested file' },
    });
    expect(res.status).toBe(201);

    const recEvent = await pollForEvent(receiverRecursive, testRunIdRecursive, 'file.created', filePath);
    expect(recEvent.event).toBe('file.created');
    expect(getPayloadFilePath(recEvent)).toBe(filePath);

    await assertNoEvent(receiverNonRecursive, testRunIdNonRecursive, 'file.created', filePath);
  });

  test(
    'file outside folder scope triggers NEITHER webhook',
    async () => {
      const fileName = `${uniqueName('outside')}.md`;
      const filePath = `/other/${fileName}`;

      const res = await apiRequest('PUT', `/w/${workspace.writeKey}/other/${fileName}`, {
        body: { content: '# File outside docs folder' },
      });
      expect(res.status).toBe(201);

      await assertNoEvent(receiverRecursive, testRunIdRecursive, 'file.created', filePath);
      await assertNoEvent(receiverNonRecursive, testRunIdNonRecursive, 'file.created', filePath);
    },
    TEST_TIMEOUT_MS
  );

  test('folder webhook persists across API calls (durability)', async () => {
    const listRes = await apiRequest('GET', `/w/${workspace.writeKey}/folders/docs/webhooks`);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();

    const webhookIds = listData.data.map((w: { id: string }) => w.id);
    expect(webhookIds).toContain(recursiveWebhookId);
    expect(webhookIds).toContain(nonRecursiveWebhookId);

    const recWebhook = listData.data.find((w: { id: string }) => w.id === recursiveWebhookId);
    const nonRecWebhook = listData.data.find((w: { id: string }) => w.id === nonRecursiveWebhookId);

    expect(recWebhook.recursive).toBe(true);
    expect(nonRecWebhook.recursive).toBe(false);
  });

  test('can update webhook recursive setting via PATCH', async () => {
    const patchRes = await apiRequest(
      'PATCH',
      `/w/${workspace.writeKey}/folders/docs/webhooks/${recursiveWebhookId}`,
      { body: { recursive: false } }
    );
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.data.recursive).toBe(false);

    const restoreRes = await apiRequest(
      'PATCH',
      `/w/${workspace.writeKey}/folders/docs/webhooks/${recursiveWebhookId}`,
      { body: { recursive: true } }
    );
    expect(restoreRes.status).toBe(200);
    const restoreData = await restoreRes.json();
    expect(restoreData.data.recursive).toBe(true);
  });
});

