import { describe, expect, test, beforeAll, beforeEach, afterAll } from 'bun:test';
import type { Elysia } from 'elysia';
import {
  setupWebhookTests,
  teardownWebhookTests,
  resetMockServer,
  assertValidResponse,
  WEBHOOK_ID_PATTERN,
  ISO_TIMESTAMP_PATTERN,
  INVALID_KEY,
  type WebhookTestContext,
} from './test-setup';

describe('List Webhooks', () => {
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

  describe('Successful Listing', () => {
    test('should return 200 with array of webhooks', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'WebhookListResponse');
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should return ok: true in response', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const body = await response.json();
      assertValidResponse(body, 'WebhookListResponse');
      expect(body.ok).toBe(true);
    });

    test('should return all active webhooks', async () => {
      await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook-list-test', events: ['file.created'] }),
        })
      );
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const body = await response.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    test('should not include deleted webhooks', async () => {
      const createResponse = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook-to-delete', events: ['file.created'] }),
        })
      );
      const createBody = await createResponse.json();
      const webhookId = createBody.data.id;

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

    test('should not include secret in list response', async () => {
      await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook-no-secret', events: ['file.created'] }),
        })
      );
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const body = await response.json();
      for (const webhook of body.data) {
        expect(webhook.secret).toBeUndefined();
      }
    });

    test('should include id for each webhook', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const body = await response.json();
      for (const webhook of body.data) {
        expect(webhook.id).toMatch(WEBHOOK_ID_PATTERN);
      }
    });

    test('should include url for each webhook', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const body = await response.json();
      for (const webhook of body.data) {
        expect(webhook.url).toBeDefined();
        expect(typeof webhook.url).toBe('string');
      }
    });

    test('should include events array for each webhook', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const body = await response.json();
      for (const webhook of body.data) {
        expect(Array.isArray(webhook.events)).toBe(true);
      }
    });

    test('should include createdAt for each webhook', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const body = await response.json();
      for (const webhook of body.data) {
        expect(webhook.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
      }
    });

    test('should include status for each webhook', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const body = await response.json();
      for (const webhook of body.data) {
        expect(['active', 'paused', 'suspended', 'disabled']).toContain(webhook.status);
      }
    });

    test('should not expose scopePath in list response', async () => {
      await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook-scope-hidden', events: ['file.created'] }),
        })
      );

      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const body = await response.json();
      for (const webhook of body.data) {
        expect(webhook.scopePath).toBeUndefined();
      }
    });
  });

  describe('Authorization', () => {
    test('should return 404 when using append key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_APPEND_KEY}/webhooks`, { method: 'GET' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
      expect(body.error.message).toBe('Invalid or missing capability key');
    });

    test('should return 404 when using read key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_READ_KEY}/webhooks`, { method: 'GET' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
      expect(body.error.message).toBe('Invalid or missing capability key');
    });

    test('should return 404 for invalid key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${INVALID_KEY}/webhooks`, { method: 'GET' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
      expect(body.error.message).toBe('Invalid or missing capability key');
    });
  });
});
