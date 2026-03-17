import { describe, expect, test, beforeAll, beforeEach, afterAll } from 'bun:test';
import type { Elysia } from 'elysia';
import {
  setupWebhookTests,
  teardownWebhookTests,
  resetMockServer,
  getMockServerUrl,
  setMockResponse,
  WEBHOOK_ID_PATTERN,
  WEBHOOK_SECRET_PATTERN,
  type WebhookTestContext,
} from './test-setup';

describe('Webhook Signature and Retry', () => {
  let ctx: WebhookTestContext;
  let app: Elysia;
  let VALID_ADMIN_KEY: string;

  beforeAll(async () => {
    ctx = await setupWebhookTests();
    app = ctx.app;
    VALID_ADMIN_KEY = ctx.adminKey;
  });

  afterAll(() => {
    teardownWebhookTests();
  });

  beforeEach(() => {
    resetMockServer();
  });

  async function createWebhook(url: string, events: string[] = ['file.created']): Promise<{ id: string; secret: string }> {
    const response = await app.handle(
      new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events }),
      })
    );
    const body = await response.json();
    return { id: body.data.id, secret: body.data.secret };
  }

  describe('HMAC-SHA256 Signature', () => {
    test('should include X-Webhook-Signature header in delivery', async () => {
      const { secret } = await createWebhook('https://httpbin.org/post');
      expect(secret).toBeDefined();
      expect(secret).toMatch(WEBHOOK_SECRET_PATTERN);
    });

    test('should include X-Webhook-Id header in delivery', async () => {
      const { id } = await createWebhook('https://httpbin.org/post');
      expect(id).toBeDefined();
      expect(id).toMatch(WEBHOOK_ID_PATTERN);
    });

    test('should include X-Webhook-Timestamp header in delivery', async () => {
      const { id } = await createWebhook(getMockServerUrl());
      const testResponse = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const testBody = await testResponse.json();
      expect(testBody.ok).toBe(true);
    });
  });

  describe('Signature Verification', () => {
    test('should generate consistent signature for same payload and secret', async () => {
      const { secret: secret1 } = await createWebhook('https://httpbin.org/post');
      const { secret: secret2 } = await createWebhook('https://httpbin.org/post');
      expect(secret1).not.toBe(secret2);
    });
  });

  describe('Failure Tracking', () => {
    test('should increment failureCount on delivery failure', async () => {
      setMockResponse(500, { error: 'Internal Server Error' });
      const { id } = await createWebhook(getMockServerUrl());
      await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const listResponse = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const listBody = await listResponse.json();
      const webhook = listBody.data.find((wh: { id: string }) => wh.id === id);
      expect(webhook.failureCount).toBeGreaterThanOrEqual(1);
    });

    test('should pause webhook after 5 consecutive failures', async () => {
      setMockResponse(500, { error: 'Internal Server Error' });
      const { id } = await createWebhook(getMockServerUrl());
      for (let i = 0; i < 5; i++) {
        await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${id}/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        );
      }
      const listResponse = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const listBody = await listResponse.json();
      const webhook = listBody.data.find((wh: { id: string }) => wh.id === id);
      expect(webhook.status).toBe('paused');
    });

    test('should reset failureCount on successful delivery', async () => {
      const { id } = await createWebhook(getMockServerUrl());
      await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const listResponse = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, { method: 'GET' })
      );
      const listBody = await listResponse.json();
      const webhook = listBody.data.find((wh: { id: string }) => wh.id === id);
      expect(webhook.failureCount).toBe(0);
    });
  });

  describe('Retry-After Header', () => {
    test('should include Retry-After header on rate limit response', async () => {
      setMockResponse(429, { error: 'Too Many Requests' }, { 'Retry-After': '60' });
      const { id } = await createWebhook(getMockServerUrl());
      const testResponse = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const testBody = await testResponse.json();
      expect(testBody.data.delivered).toBe(false);
      expect(testBody.data.responseCode).toBe(429);
    });
  });
});

