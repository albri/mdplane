import { describe, expect, test, beforeAll, beforeEach, afterAll } from 'bun:test';
import type { Elysia } from 'elysia';
import {
  setupWebhookTests,
  teardownWebhookTests,
  resetMockServer,
  assertValidResponse,
  INVALID_KEY,
  type WebhookTestContext,
} from './test-setup';
import { createTestWorkspace } from '../../../../tests/fixtures';

describe('Delete Webhook', () => {
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

  describe('Successful Deletion', () => {
    test('should return 200 on successful deletion', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-delete-test');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, { method: 'DELETE' })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'WebhookDeleteResponse');
      expect(body.ok).toBe(true);
    });

    test('should return ok: true in response', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-delete-ok');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, { method: 'DELETE' })
      );
      const body = await response.json();
      assertValidResponse(body, 'WebhookDeleteResponse');
      expect(body.ok).toBe(true);
    });

    test('should return deleted: true in response', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-delete-flag');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, { method: 'DELETE' })
      );
      const body = await response.json();
      expect(body.data.deleted).toBe(true);
    });

    test('should return id in response', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-delete-id');
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, { method: 'DELETE' })
      );
      const body = await response.json();
      expect(body.data.id).toBe(webhookId);
    });

    test('should soft delete (no longer appears in list)', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-soft-delete');
      await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, { method: 'DELETE' })
      );
      const listResponse = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const listBody = await listResponse.json();
      const deletedWebhook = listBody.data.find((wh: { id: string }) => wh.id === webhookId);
      expect(deletedWebhook).toBeUndefined();
    });
  });

  describe('Error Cases', () => {
    test('should return 404 for non-existent webhookId', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/wh_nonexistent`, { method: 'DELETE' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });

    test('should return 404 when deleting already deleted webhook', async () => {
      const webhookId = await createWebhook('https://example.com/webhook-double-delete');
      await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, { method: 'DELETE' })
      );
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}`, { method: 'DELETE' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });
  });

  describe('Authorization', () => {
    test('should return 404 when using append key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_APPEND_KEY}/webhooks/wh_test`, { method: 'DELETE' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
      expect(body.error.message).toBe('Invalid or missing capability key');
    });

    test('should return 404 when using read key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_READ_KEY}/webhooks/wh_test`, { method: 'DELETE' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 for invalid key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${INVALID_KEY}/webhooks/wh_test`, { method: 'DELETE' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 when deleting webhook from different workspace (cross-workspace isolation)', async () => {
      const webhookId = await createWebhook('https://example.com/cross-workspace-test');
      const otherWorkspace = await createTestWorkspace(app);
      const response = await app.handle(
        new Request(`http://localhost/w/${otherWorkspace.writeKey}/webhooks/${webhookId}`, {
          method: 'DELETE',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });
  });
});

