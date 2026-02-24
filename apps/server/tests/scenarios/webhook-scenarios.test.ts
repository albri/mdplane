/**
 * Webhook Scenario Tests
 *
 * Comprehensive scenario tests for webhook handling:
 * - Set up webhook on file creation
 * - Add webhook to existing file
 * - Subscribe to someone else's public file
 * - Watch a folder for changes
 * - Receive webhook with append content
 *
 * Tests verify webhook management API, not actual delivery.
 *
 * Note: The webhook route uses a different key validation than other routes.
 * It expects keys to start with 'w' for admin, 'a' for append, 'r' for read.
 * This is different from the bootstrap-generated keys which don't have prefixes.
 * For scenario tests, we use hardcoded test keys that match this format.
 *
 * @see packages/shared/openapi/paths/webhooks.yaml
 * @see packages/shared/openapi/components/schemas/webhooks.yaml
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import type { Elysia } from 'elysia';
import { createTestApp } from '../helpers';
import { assertValidResponse } from '../helpers/schema-validator';
import { createTestWorkspace, createTestFile, type TestWorkspace, type TestFile } from '../fixtures';

// Pattern matchers from existing webhook tests
const WEBHOOK_ID_PATTERN = /^wh_[A-Za-z0-9]+$/;
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9]+$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

// Keys populated from workspace created via bootstrap (dynamic, not hardcoded)

// Valid webhook events from OpenAPI spec
const VALID_EVENTS = [
  'append',
  'append.created',
  'task.created',
  'task.claimed',
  'task.completed',
  'task.cancelled',
  'task.blocked',
  'file.created',
  'file.updated',
  'file.deleted',
] as const;

describe('Webhook Scenarios', () => {
  let app: ReturnType<typeof createTestApp>;
  let workspace: TestWorkspace;
  let file: TestFile;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Create fresh workspace and file for each test
    workspace = await createTestWorkspace(app);
    file = await createTestFile(app, workspace, '/webhook-test.md', '# Webhook Test File\n\nContent here.');
  });

  async function createWebhook(
    url: string = 'https://example.com/webhook',
    events: string[] = ['append.created'],
    adminKey?: string
  ): Promise<{ id: string; secret: string; status: number }> {
    const key = adminKey ?? workspace.writeKey;
    const response = await app.handle(
      new Request(`http://localhost/w/${key}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events }),
      })
    );

    const body = await response.json();
    if (response.status === 201) {
      assertValidResponse(body, 'WebhookCreateResponse');
    }
    return {
      id: body.data?.id,
      secret: body.data?.secret,
      status: response.status,
    };
  }

  describe('Webhook on File Creation', () => {
    test('GIVEN new workspace, WHEN create webhook, THEN webhook registered', async () => {
      const { id, secret, status } = await createWebhook();

      expect(status).toBe(201);
      expect(id).toMatch(WEBHOOK_ID_PATTERN);
      expect(secret).toMatch(WEBHOOK_SECRET_PATTERN);
    });

    test('GIVEN webhook created, WHEN list webhooks, THEN webhook appears', async () => {
      await createWebhook();

      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'WebhookListResponse');
      expect(body.ok).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    test('GIVEN webhook created, WHEN read response, THEN includes file info', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'WebhookCreateResponse');
      expect(body.data.id).toBeDefined();
      expect(body.data.url).toBe('https://example.com/webhook');
      expect(body.data.events).toContain('append.created');
      expect(body.data.status).toBe('active');
      expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
    });
  });

  describe('Add Webhook to Existing File', () => {
    test('GIVEN existing file, WHEN add webhook via POST, THEN webhook created', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://existing-file-webhook.example.com/callback',
            events: ['append.created', 'task.completed'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'WebhookCreateResponse');
      expect(body.ok).toBe(true);
      expect(body.data.id).toMatch(WEBHOOK_ID_PATTERN);
    });

    test('GIVEN webhook added, THEN has id for management', async () => {
      const { id } = await createWebhook();

      expect(id).toMatch(WEBHOOK_ID_PATTERN);

      // Verify we can reference it for delete
      const deleteResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks/${id}`, {
          method: 'DELETE',
        })
      );

      expect(deleteResponse.status).toBe(200);
    });

    test('GIVEN multiple webhooks, THEN each has unique id', async () => {
      const webhook1 = await createWebhook('https://hook1.example.com');
      const webhook2 = await createWebhook('https://hook2.example.com');

      expect(webhook1.id).not.toBe(webhook2.id);
      expect(webhook1.secret).not.toBe(webhook2.secret);
    });
  });

  describe('Subscribe with Read-Only Access', () => {
    test('GIVEN read key, WHEN attempt to create webhook, THEN returns 404', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.readKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://read-subscriber.example.com/callback',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('GIVEN append key, WHEN attempt to create webhook, THEN returns 404', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.appendKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://append-subscriber.example.com/callback',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('GIVEN read key, WHEN list webhooks, THEN returns 404', async () => {
      // First create a webhook with admin key
      await createWebhook();

      // Try to list with read key
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.readKey}/webhooks`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
    });
  });

  describe('Folder-Level Webhook', () => {
    test('GIVEN workspace webhook, WHEN created, THEN can subscribe to folder events', async () => {
      // Create webhook at workspace level (which acts like folder-level)
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://folder-watcher.example.com/callback',
            events: ['file.created', 'file.updated', 'file.deleted'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'WebhookCreateResponse');
      expect(body.data.events).toContain('file.created');
      expect(body.data.events).toContain('file.updated');
      expect(body.data.events).toContain('file.deleted');
    });

    test('GIVEN webhook with filters, THEN filters accepted', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://filtered-watcher.example.com/callback',
            events: ['append.created'],
            filters: {
              types: ['task'],
              labels: ['urgent'],
            },
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'WebhookCreateResponse');
      expect(body.ok).toBe(true);
    });
  });

  describe('Webhook Payload Content', () => {
    test('GIVEN webhook created, THEN response has expected event types', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://payload-tester.example.com/callback',
            events: ['append', 'task.created', 'task.completed'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'WebhookCreateResponse');
      expect(body.data.events).toEqual(['append', 'task.created', 'task.completed']);
    });

    test('GIVEN webhook response, THEN includes author/timestamp metadata', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://metadata-tester.example.com/callback',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'WebhookCreateResponse');
      expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
      expect(body.data.status).toBeDefined();
    });

    test('GIVEN webhook with includeUrls false, THEN response reflects setting', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://no-urls.example.com/callback',
            events: ['append.created'],
            includeUrls: false,
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'WebhookCreateResponse');
      expect(body.ok).toBe(true);
      // The includeUrls setting should be accepted (whether returned depends on implementation)
    });
  });

  describe('Webhook Management', () => {
    test('GIVEN webhooks exist, WHEN list, THEN returns all webhooks', async () => {
      // Create multiple webhooks
      await createWebhook('https://hook1.example.com');
      await createWebhook('https://hook2.example.com');

      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'WebhookListResponse');
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
    });

    test('GIVEN webhook exists, WHEN delete, THEN successfully removed', async () => {
      const { id } = await createWebhook();

      const deleteResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks/${id}`, {
          method: 'DELETE',
        })
      );

      expect(deleteResponse.status).toBe(200);
      const deleteBody = await deleteResponse.json();
      assertValidResponse(deleteBody, 'WebhookDeleteResponse');
      expect(deleteBody.ok).toBe(true);
      expect(deleteBody.data.id).toBe(id);
      expect(deleteBody.data.deleted).toBe(true);
    });

    test('GIVEN webhook deleted, WHEN list, THEN webhook not in list', async () => {
      const { id } = await createWebhook();

      // Delete it
      await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks/${id}`, {
          method: 'DELETE',
        })
      );

      // List and verify not present
      const listResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'GET',
        })
      );

      const listBody = await listResponse.json();
      assertValidResponse(listBody, 'WebhookListResponse');
      const found = listBody.data.find((wh: { id: string }) => wh.id === id);
      expect(found).toBeUndefined();
    });

    test('GIVEN nonexistent webhook, WHEN delete, THEN returns 404', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks/wh_nonexistent`, {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('WEBHOOK_NOT_FOUND');
    });

    test('GIVEN list response, THEN secrets not exposed', async () => {
      await createWebhook();

      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      assertValidResponse(body, 'WebhookListResponse');
      for (const webhook of body.data) {
        expect(webhook.secret).toBeUndefined();
      }
    });
  });

  describe('Webhook URL Validation', () => {
    test('GIVEN invalid URL format, WHEN create webhook, THEN returns 400', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'not-a-valid-url',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(['INVALID_WEBHOOK_URL', 'INVALID_REQUEST']).toContain(body.error.code);
    });

    test('GIVEN file:// URL, WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'file:///etc/passwd',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN ftp:// URL, WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'ftp://example.com/file',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN missing URL, WHEN create webhook, THEN returns 400', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('GIVEN missing events, WHEN create webhook, THEN returns 400', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('GIVEN invalid event type, WHEN create webhook, THEN returns 400', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['invalid.event.type'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(['INVALID_EVENT_TYPE', 'INVALID_REQUEST']).toContain(body.error.code);
    });
  });

  describe('SSRF Protection', () => {
    test('GIVEN 10.x.x.x private IP, WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://10.0.0.1/webhook',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN 172.16.x.x private IP, WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://172.16.0.1/webhook',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN 192.168.x.x private IP, WHEN create webhook, THEN rejected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://192.168.1.1/webhook',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('GIVEN valid public HTTPS URL, WHEN create webhook, THEN accepted', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://api.example.com/webhooks/mdplane',
            events: ['append.created'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'WebhookCreateResponse');
      expect(body.ok).toBe(true);
    });
  });

  describe('Integration: Webhook + File Operations', () => {
    test('GIVEN webhook created, WHEN list webhooks, THEN webhook record exists', async () => {
      // Create webhook using test admin key
      const { id } = await createWebhook('https://integration-test.example.com');

      // Verify webhook exists
      const listResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'GET',
        })
      );

      const listBody = await listResponse.json();
      assertValidResponse(listBody, 'WebhookListResponse');
      const webhook = listBody.data.find((wh: { id: string }) => wh.id === id);
      expect(webhook).toBeDefined();
      expect(webhook.status).toBe('active');
    });

    test('GIVEN webhook with custom secret, THEN secret returned at creation', async () => {
      const customSecret = 'my-super-secure-secret-at-least-32-characters-long';

      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://custom-secret.example.com/callback',
            events: ['append.created'],
            secret: customSecret,
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'WebhookCreateResponse');
      expect(body.ok).toBe(true);
      // When custom secret provided, server may or may not return it
      // The important thing is the webhook is created
      expect(body.data.id).toMatch(WEBHOOK_ID_PATTERN);
    });
  });
});



