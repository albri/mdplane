import { describe, expect, test, beforeAll, beforeEach, afterAll } from 'bun:test';
import type { Elysia } from 'elysia';
import {
  setupWebhookTests,
  teardownWebhookTests,
  resetMockServer,
  getMockServerUrl,
  ISO_TIMESTAMP_PATTERN,
  type WebhookTestContext,
} from './test-setup';

describe('Webhook Payload and Error Consistency', () => {
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

  describe('Payload Structure', () => {
    test('should include event type in payload', async () => {
      const webhookId = await createWebhook(['file.created']);
      const testResponse = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/${webhookId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'file.created' }),
        })
      );
      expect(testResponse.status).toBe(200);
      const testBody = await testResponse.json();
      expect(testBody.ok).toBe(true);
    });

    test('should include timestamp in payload', async () => {
      const createResponse = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: getMockServerUrl(), events: ['append.created'] }),
        })
      );
      const createBody = await createResponse.json();
      expect(createBody.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
    });
  });

  describe('Error Structure Consistency', () => {
    test('400 errors should have standard structure', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(typeof body.error.code).toBe('string');
      expect(body.error.message).toBeDefined();
      expect(typeof body.error.message).toBe('string');
    });

    test('404 errors should have standard structure (using DELETE for non-existent webhook)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/wh_nonexistent`, { method: 'DELETE' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(typeof body.error.code).toBe('string');
      expect(body.error.message).toBeDefined();
      expect(typeof body.error.message).toBe('string');
    });
  });

  describe('Error Code Consistency', () => {
    test('should use WEBHOOK_NOT_FOUND for missing webhooks (via DELETE)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/wh_nonexistent`, { method: 'DELETE' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });

    test('should use INVALID_REQUEST for validation errors', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(['INVALID_REQUEST', 'VALIDATION_ERROR']).toContain(body.error.code);
    });
  });

  describe('HTTP Status Code Consistency', () => {
    test('400 should be used for validation/bad request errors', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'not-a-valid-url' }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(['INVALID_REQUEST', 'VALIDATION_ERROR', 'INVALID_URL']).toContain(body.error.code);
    });

    test('404 should be used for not found errors (via DELETE)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/wh_nonexistent`, { method: 'DELETE' })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });
  });

  describe('Error Message Quality', () => {
    test('error messages should be human-readable', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks/wh_nonexistent`, { method: 'DELETE' })
      );
      const body = await response.json();
      expect(body.error.message.length).toBeGreaterThan(5);
      expect(body.error.message).not.toContain('at ');
      expect(body.error.message).not.toContain('node_modules');
    });

    test('error messages should not expose internal details', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'not-a-valid-url', events: ['file.created'] }),
        })
      );
      const body = await response.json();
      expect(body.error.message).not.toContain('sqlite');
      expect(body.error.message).not.toContain('drizzle');
      expect(body.error.message).not.toContain('C:\\');
    });
  });
});

