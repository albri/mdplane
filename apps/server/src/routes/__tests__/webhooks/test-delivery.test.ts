import { describe, expect, test, beforeAll, beforeEach, afterAll } from 'bun:test';
import type { Elysia } from 'elysia';
import {
  setupWebhookTests,
  teardownWebhookTests,
  resetMockServer,
  assertValidResponse,
  getMockServerUrl,
  setMockResponse,
  INVALID_KEY,
  type WebhookTestContext,
} from './test-setup';
import { createTestWorkspace } from '../../../../tests/fixtures';

describe('Test Webhook Delivery', () => {
  let ctx: WebhookTestContext;
  let app: Elysia;
  let VALID_ADMIN_KEY: string;
  let VALID_APPEND_KEY: string;

  beforeAll(async () => {
    ctx = await setupWebhookTests();
    app = ctx.app;
    VALID_ADMIN_KEY = ctx.adminKey;
    VALID_APPEND_KEY = ctx.appendKey;
  });

  afterAll(() => {
    teardownWebhookTests();
  });

  beforeEach(() => {
    resetMockServer();
  });

  async function createWebhook(events: string[]): Promise<string> {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: getMockServerUrl(), events }),
      })
    );
    const body = await response.json();
    return body.data.id;
  }

  describe('Successful Test Delivery', () => {
    test('should return 200 on test request', async () => {
      const webhookId = await createWebhook(['file.created']);
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'WebhookTestResponse');
      expect(body.ok).toBe(true);
    });

    test('should return ok: true in response', async () => {
      const webhookId = await createWebhook(['file.created']);
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const body = await response.json();
      assertValidResponse(body, 'WebhookTestResponse');
      expect(body.ok).toBe(true);
    });

    test('should return delivery status (delivered: boolean)', async () => {
      const webhookId = await createWebhook(['file.created']);
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const body = await response.json();
      expect(typeof body.data.delivered).toBe('boolean');
    });

    test('should return responseCode from target', async () => {
      const webhookId = await createWebhook(['file.created']);
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const body = await response.json();
      expect(typeof body.data.responseCode).toBe('number');
    });

    test('should return durationMs in milliseconds', async () => {
      const webhookId = await createWebhook(['file.created']);
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const body = await response.json();
      expect(typeof body.data.durationMs).toBe('number');
      expect(body.data.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('should use append.created as default event type', async () => {
      const webhookId = await createWebhook(['append.created']);
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should accept custom event type in request', async () => {
      const webhookId = await createWebhook(['file.created', 'file.updated']);
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'file.updated' }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });
  });

  describe('Error Cases', () => {
    test('should return 404 for non-existent webhook', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/wh_nonexistent/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });

    test('should return error message on delivery failure', async () => {
      setMockResponse(500, { error: 'Internal Server Error' });
      const webhookId = await createWebhook(['file.created']);
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const body = await response.json();
      expect(body.ok).toBe(true); // Operation succeeded, but delivery failed
      expect(body.data.delivered).toBe(false);
      expect(body.data.responseCode).toBe(500);
    });
  });

  describe('Authorization', () => {
    test('should return 404 when using append key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_APPEND_KEY}/webhooks/wh_test/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 for invalid key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${INVALID_KEY}/webhooks/wh_test/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 when testing webhook from different workspace (cross-workspace isolation)', async () => {
      const webhookId = await createWebhook(['file.created']);
      const otherWorkspace = await createTestWorkspace(app);
      const response = await app.handle(
        new Request(`http://localhost/w/${otherWorkspace.writeKey}/webhooks/${webhookId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });
  });
});

