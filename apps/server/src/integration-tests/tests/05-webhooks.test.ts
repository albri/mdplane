/**
 * Webhooks Integration Tests
 *
 * Tests webhook CRUD and real delivery using mock webhook receiver.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { waitFor } from '../helpers/polling';
import { startMockWebhookReceiver } from '../helpers/mock-webhook-receiver';
import { uniqueName } from '../helpers/test-utils';

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

describe('05 - Webhooks', () => {
  let workspace: BootstrappedWorkspace;
  let webhookId: string | undefined;
  let receiver: ReturnType<typeof startMockWebhookReceiver>;
  const testRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const testFileName = `${uniqueName('webhook')}.md`;

  beforeAll(async () => {
    workspace = await bootstrap();

    receiver = startMockWebhookReceiver();

    receiver.clearEvents();
  });

  afterAll(async () => {
    try {
      if (webhookId) {
        await apiRequest('DELETE', `/w/${workspace.writeKey}/webhooks/${webhookId}`);
      }
    } catch (error) {
      if (error instanceof Error) console.warn('Cleanup error (delete webhook):', error.message);
    }

    try {
      await apiRequest('DELETE', `/w/${workspace.writeKey}/${testFileName}`);
    } catch (error) {
      if (error instanceof Error) console.warn('Cleanup error (delete file):', error.message);
    }

    receiver.stop();
  });

  test('setup: mock receiver is running', () => {
    expect(receiver.url).toBeDefined();
    expect(receiver.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  describe('Webhook CRUD', () => {
    test('can create webhook for file.created and file.updated events', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: `${receiver.url}/ingest?testRunId=${testRunId}`,
          events: ['file.created', 'file.updated'],
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.ok).toBe(true);
      webhookId = data.data.id;
      expect(typeof webhookId).toBe('string');
      expect(data.data.url).toBe(`${receiver.url}/ingest?testRunId=${testRunId}`);
      expect(data.data.events).toEqual(['file.created', 'file.updated']);
    });

    test('can list webhooks and find created webhook', async () => {
      expect(webhookId).toBeDefined();

      const response = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks`);
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      const webhook = data.data.find((w: { id: string }) => w.id === webhookId);
      expect(webhook).toBeDefined();
    });

    test('can disable and re-enable webhook', async () => {
      expect(webhookId).toBeDefined();

      const disabledAt = new Date().toISOString();

      const disableRes = await apiRequest('PATCH', `/w/${workspace.writeKey}/webhooks/${webhookId}`, {
        body: { disabledAt },
      });
      expect(disableRes.status).toBe(200);

      const enableRes = await apiRequest('PATCH', `/w/${workspace.writeKey}/webhooks/${webhookId}`, {
        body: { disabledAt: null },
      });
      expect(enableRes.status).toBe(200);
      const enableData = await enableRes.json();
      expect(enableData.ok).toBe(true);
      expect(enableData.data.disabledAt ?? null).toBeNull();
    });

    test('can delete webhook and confirm removed from list', async () => {
      expect(webhookId).toBeDefined();

      const deleteRes = await apiRequest('DELETE', `/w/${workspace.writeKey}/webhooks/${webhookId}`);
      expect(deleteRes.status).toBe(200);
      const deleteData = await deleteRes.json();
      expect(deleteData.ok).toBe(true);

      const listRes = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks`);
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();

      const webhook = listData.data.find((w: { id: string }) => w.id === webhookId);
      expect(webhook).toBeUndefined();

      webhookId = undefined;
    });
  });

  describe('Real Webhook Delivery', () => {
    test(
      'delivers file.created and file.updated, and respects disabledAt',
      async () => {
      const createRes = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: `${receiver.url}/ingest?testRunId=${testRunId}`,
          events: ['file.created', 'file.updated'],
        },
      });
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      webhookId = createData.data.id;

      const enableRes = await apiRequest('PATCH', `/w/${workspace.writeKey}/webhooks/${webhookId}`, {
        body: { disabledAt: null },
      });
      expect(enableRes.status).toBe(200);

       receiver.clearEvents();

       const createFileRes = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
         body: { content: '# Webhook Test\n' },
       });
       expect(createFileRes.status).toBe(201);


      await waitFor(
        async () => {
          const events = receiver.getEvents(testRunId);
          return events.some((e) => {
            const webhookEvent = asWebhookEvent(e);
            return webhookEvent?.event === 'file.created';
          });
        },
        { description: 'file.created delivery', intervalMs: 250, timeoutMs: 20_000 }
      );

      const updateFileRes = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
        body: { content: '# Webhook Test\n\nupdated' },
      });
      expect(updateFileRes.status).toBe(200);

      await waitFor(
        async () => {
          const events = receiver.getEvents(testRunId);
          return events.some((e) => {
            const webhookEvent = asWebhookEvent(e);
            return webhookEvent?.event === 'file.updated';
          });
        },
        { description: 'file.updated delivery', intervalMs: 250, timeoutMs: 20_000 }
      );

      receiver.clearEvents();

      const disableRes = await apiRequest('PATCH', `/w/${workspace.writeKey}/webhooks/${webhookId}`, {
        body: { active: false },
      });
      expect(disableRes.status).toBe(200);

      const disabledUpdateRes = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
        body: { content: '# Webhook Test\n\ndisabled update' },
      });
      expect(disabledUpdateRes.status).toBe(200);

      const start = Date.now();
      const timeoutMs = 5_000;
      while (Date.now() - start < timeoutMs) {
        const events = receiver.getEvents(testRunId);

        const hasUnexpected = events.some((e) => {
          const webhookEvent = asWebhookEvent(e);
          return webhookEvent?.event === 'file.updated';
        });
        if (hasUnexpected) {
          throw new Error('Disabled webhook delivered file.updated event');
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      },
      30_000
    );
  });

  describe('Webhook Delivery Logs', () => {
    let logsWebhookId: string | undefined;
    const logsTestRunId = `logs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const logsTestFileName = `${uniqueName('webhook-logs')}.md`;

    test('setup: create webhook for logs testing', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: `${receiver.url}/ingest?testRunId=${logsTestRunId}`,
          events: ['file.created', 'file.updated'],
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      logsWebhookId = data.data.id;
      expect(typeof logsWebhookId).toBe('string');
    });

    test('trigger webhook delivery by creating a file', async () => {
      expect(logsWebhookId).toBeDefined();
      receiver.clearEvents();

      const createFileRes = await apiRequest('PUT', `/w/${workspace.writeKey}/${logsTestFileName}`, {
        body: { content: '# Webhook Logs Test\n' },
      });
      expect(createFileRes.status).toBe(201);

      // Wait for webhook delivery
      await waitFor(
        async () => {
          const events = receiver.getEvents(logsTestRunId);
          return events.some((e) => {
            const webhookEvent = asWebhookEvent(e);
            return webhookEvent?.event === 'file.created';
          });
        },
        { description: 'file.created delivery for logs test', intervalMs: 250, timeoutMs: 15_000 }
      );
    });

    test('GET /w/:key/webhooks/:webhookId/logs returns delivery logs', async () => {
      expect(logsWebhookId).toBeDefined();

      // Give a moment for the delivery to be recorded
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks/${logsWebhookId}/logs`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data.logs)).toBe(true);
      expect(data.data.logs.length).toBeGreaterThan(0);

      // Verify log entry structure
      const log = data.data.logs[0];
      expect(log.id).toBeDefined();
      expect(typeof log.id).toBe('string');
      expect(log.event).toBe('file.created');
      expect(log.status).toBe('ok');
      expect(log.responseCode).toBe(200);
      expect(typeof log.timestamp).toBe('string');
      expect(typeof log.durationMs).toBe('number');
    });

    test('logs endpoint respects limit parameter', async () => {
      expect(logsWebhookId).toBeDefined();

      const response = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks/${logsWebhookId}/logs?limit=1`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.logs.length).toBeLessThanOrEqual(1);
    });

    test('logs endpoint returns 404 for non-existent webhook', async () => {
      const response = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks/wh_nonexistent123/logs`);
      expect(response.status).toBe(404);
    });

    test('logs endpoint returns 404 for read-only key', async () => {
      expect(logsWebhookId).toBeDefined();

      const response = await apiRequest('GET', `/r/${workspace.readKey}/webhooks/${logsWebhookId}/logs`);
      expect(response.status).toBe(404);
    });

    test('cleanup: delete test webhook and file', async () => {
      if (logsWebhookId) {
        await apiRequest('DELETE', `/w/${workspace.writeKey}/webhooks/${logsWebhookId}`);
      }
      await apiRequest('DELETE', `/w/${workspace.writeKey}/${logsTestFileName}`);
    });
  });
});
