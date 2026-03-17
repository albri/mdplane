import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { eq, and, isNull } from 'drizzle-orm';

import { foldersRoute } from '../../folders';
import { ssrfConfig } from '../../../core/ssrf';
import { createTestApp } from '../../../../tests/helpers';
import { createTestWorkspace, type TestWorkspace } from '../../../../tests/fixtures';
import { db } from '../../../db';
import { webhooks } from '../../../db/schema';

// Patterns
const WEBHOOK_ID_PATTERN = /^wh_[A-Za-z0-9]+$/;
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9]+$/;

let app: Elysia;
let testWorkspace: TestWorkspace;
let VALID_WRITE_KEY: string;
let VALID_READ_KEY: string;

describe('Folder Webhooks', () => {
  beforeAll(async () => {
    app = createTestApp();
    // Allow test URLs for SSRF protection
    ssrfConfig.allowList.push('example.com', 'test.webhook.com');
    testWorkspace = await createTestWorkspace(app);
    VALID_WRITE_KEY = testWorkspace.writeKey;
    VALID_READ_KEY = testWorkspace.readKey;

    // Create a test folder
    await app.handle(
      new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'docs' }),
      })
    );
  });

  afterAll(() => {
    ssrfConfig.allowList.length = 0;
  });

  describe('POST /w/:key/folders/:path/webhooks - Create Folder Webhook', () => {
    test('should create folder webhook and persist to database', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['file.created'],
            recursive: true,
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.id).toMatch(WEBHOOK_ID_PATTERN);
      expect(body.data.secret).toMatch(WEBHOOK_SECRET_PATTERN);
      expect(body.data.recursive).toBe(true);

      // Verify persisted to database
      const dbWebhook = await db.query.webhooks.findFirst({
        where: eq(webhooks.id, body.data.id),
      });
      expect(dbWebhook).not.toBeNull();
      expect(dbWebhook!.scopeType).toBe('folder');
      expect(dbWebhook!.scopePath).toBe('/docs');
      expect(dbWebhook!.recursive).toBe(1);
    });

    test('should create non-recursive folder webhook', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/non-recursive',
            events: ['file.created'],
            recursive: false,
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.recursive).toBe(false);

      // Verify persisted with recursive=0
      const dbWebhook = await db.query.webhooks.findFirst({
        where: eq(webhooks.id, body.data.id),
      });
      expect(dbWebhook!.recursive).toBe(0);
    });

    test('should default recursive to true when not specified', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/default-recursive',
            events: ['file.created'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.recursive).toBe(true);
    });

    test('should reject SSRF-blocked URLs', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://127.0.0.1:8080/evil',
            events: ['file.created'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('should return 404 for read-only key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_READ_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['file.created'],
          }),
        })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /w/:key/folders/:path/webhooks - List Folder Webhooks', () => {
    test('should list folder webhooks from database', async () => {
      // Create a webhook first
      const createRes = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://test.webhook.com/list-test',
            events: ['file.updated'],
            recursive: true,
          }),
        })
      );
      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      // List webhooks
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);

      // Should include the created webhook
      const found = body.data.find((wh: { id: string }) => wh.id === created.data.id);
      expect(found).toBeDefined();
      expect(found.url).toBe('https://test.webhook.com/list-test');
      expect(found.events).toContain('file.updated');
      expect(found.recursive).toBe(true);
    });

    test('should not include deleted webhooks in list', async () => {
      // Create a webhook
      const createRes = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://test.webhook.com/to-delete',
            events: ['file.created'],
          }),
        })
      );
      const created = await createRes.json();

      // Soft delete in DB
      await db.update(webhooks)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(webhooks.id, created.data.id));

      // List should not include deleted webhook
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const found = body.data.find((wh: { id: string }) => wh.id === created.data.id);
      expect(found).toBeUndefined();
    });
  });

  describe('Webhook Limit Enforcement', () => {
    test('should enforce max 10 webhooks per folder', async () => {
      // Create a new folder for this test
      await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'limit-test' }),
        })
      );

      // Create 10 webhooks
      for (let i = 0; i < 10; i++) {
        const res = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/limit-test/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: `https://example.com/webhook-${i}`,
              events: ['file.created'],
            }),
          })
        );
        expect(res.status).toBe(201);
      }

      // 11th should fail with 429
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/limit-test/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook-11',
            events: ['file.created'],
          }),
        })
      );

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error.code).toBe('WEBHOOK_LIMIT_EXCEEDED');
    });
  });

  describe('DELETE /w/:key/folders/:path/webhooks/:webhookId - Delete Folder Webhook', () => {
    test('should delete folder webhook', async () => {
      // Create a webhook first
      const createRes = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/to-delete',
            events: ['file.created'],
          }),
        })
      );
      const created = await createRes.json();

      // Delete webhook
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks/${created.data.id}`, {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe(created.data.id);
      expect(body.data.deleted).toBe(true);

      // Verify soft deleted in database
      const dbWebhook = await db.query.webhooks.findFirst({
        where: eq(webhooks.id, created.data.id),
      });
      expect(dbWebhook!.deletedAt).not.toBeNull();
    });

    test('should return 404 for non-existent webhook', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks/wh_nonexistent`, {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });

    test('should return 404 for read-only key', async () => {
      // Create a webhook first
      const createRes = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/readonly-delete',
            events: ['file.created'],
          }),
        })
      );
      const created = await createRes.json();

      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_READ_KEY}/folders/docs/webhooks/${created.data.id}`, {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /w/:key/folders/:path/webhooks/:webhookId - Update Folder Webhook', () => {
    test('should update folder webhook URL', async () => {
      // Create a webhook first
      const createRes = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/original',
            events: ['file.created'],
          }),
        })
      );
      const created = await createRes.json();

      // Update webhook
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks/${created.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/updated',
          }),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.url).toBe('https://example.com/updated');
    });

    test('should update folder webhook recursive setting', async () => {
      // Create a recursive webhook
      const createRes = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/recursive-update',
            events: ['file.created'],
            recursive: true,
          }),
        })
      );
      const created = await createRes.json();
      expect(created.data.recursive).toBe(true);

      // Update to non-recursive
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks/${created.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recursive: false,
          }),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.recursive).toBe(false);
    });

    test('should pause and resume folder webhook', async () => {
      // Create a webhook
      const createRes = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/pause-test',
            events: ['file.created'],
          }),
        })
      );
      const created = await createRes.json();
      expect(created.data.status).toBe('active');

      // Pause webhook
      let response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks/${created.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
        })
      );
      let body = await response.json();
      expect(body.data.status).toBe('paused');

      // Resume webhook
      response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks/${created.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: true }),
        })
      );
      body = await response.json();
      expect(body.data.status).toBe('active');
    });

    test('should reject SSRF-blocked URL on update', async () => {
      // Create a webhook
      const createRes = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/ssrf-update',
            events: ['file.created'],
          }),
        })
      );
      const created = await createRes.json();

      // Try to update with blocked URL
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks/${created.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://127.0.0.1:8080/evil',
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('should return 404 for non-existent webhook', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/webhooks/wh_nonexistent`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/new' }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });
  });
});


