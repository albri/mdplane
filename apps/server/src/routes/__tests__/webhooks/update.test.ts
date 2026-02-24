import { describe, expect, test, beforeAll, beforeEach, afterAll } from 'bun:test';
import type { Elysia } from 'elysia';
import {
  setupWebhookTests,
  teardownWebhookTests,
  resetMockServer,
  assertValidResponse,
  ISO_TIMESTAMP_PATTERN,
  INVALID_KEY,
  type WebhookTestContext,
} from './test-setup';

describe('Update Webhook', () => {
  let ctx: WebhookTestContext;
  let app: Elysia;
  let VALID_ADMIN_KEY: string;
  let VALID_APPEND_KEY: string;
  let VALID_READ_KEY: string;

  beforeAll(async () => {
    ctx = await setupWebhookTests();
    app = ctx.app;
    VALID_ADMIN_KEY = ctx.adminKey;
    VALID_APPEND_KEY = ctx.appendKey;
    VALID_READ_KEY = ctx.readKey;
  });

  afterAll(() => {
    teardownWebhookTests();
  });

  beforeEach(() => {
    resetMockServer();
  });

  async function createWebhook(url: string): Promise<string> {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events: ['file.created'] }),
      })
    );
    const body = await response.json();
    return body.data.id;
  }

  describe('Successful Update', () => {
    test('should return 200 with updated webhook', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-update-test');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook-updated' }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'WebhookUpdateResponse');
      expect(body.ok).toBe(true);
      expect(body.data.url).toBe('https://example.com/webhook-updated');
    });

    test('should update events array', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-events-update');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: ['file.created', 'file.updated', 'append'] }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'WebhookUpdateResponse');
      expect(body.ok).toBe(true);
      expect(body.data.events).toEqual(['file.created', 'file.updated', 'append']);
    });

    test('should update active status to disabled', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-disable-test');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.status).toBe('paused');
    });

    test('should re-enable a disabled webhook', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-reenable-test');
      await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
        })
      );
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: true }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.status).toBe('active');
    });

    test('should return webhook id in response', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-id-response');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: ['append'] }),
        })
      );
      const body = await response.json();
      expect(body.data.id).toBe(webhookId);
    });

    test('should return created timestamp in response', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-created-ts');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: ['append'] }),
        })
      );
      const body = await response.json();
      expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
    });
  });

  describe('Error Cases', () => {
    test('should return 404 for non-existent webhookId', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/wh_nonexistent`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/updated' }),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });

    test('should return 400 for invalid URL format', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-invalid-url');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'not-a-valid-url' }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for invalid event type', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-invalid-event');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: ['invalid.event.type'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });

  describe('Authorization', () => {
    test('should return 404 when using append key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_APPEND_KEY}/webhooks/wh_test`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/updated' }),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 when using read key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_READ_KEY}/webhooks/wh_test`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/updated' }),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 for invalid key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${INVALID_KEY}/webhooks/wh_test`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/updated' }),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });
  });
});

