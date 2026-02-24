import { describe, expect, test, beforeAll, beforeEach, afterAll } from 'bun:test';
import type { Elysia } from 'elysia';
import type { TestWorkspace } from '../../../../tests/fixtures';
import { sqlite } from '../../../db';
import { flushAuditQueue } from '../fixtures/audit-service-fixtures';
import {
  setupWebhookTests,
  teardownWebhookTests,
  resetMockServer,
  getMockServerUrl,
  assertValidResponse,
  WEBHOOK_ID_PATTERN,
  WEBHOOK_SECRET_PATTERN,
  ISO_TIMESTAMP_PATTERN,
  INVALID_KEY,
  VALID_EVENTS,
  type WebhookTestContext,
} from './test-setup';

describe('Webhook Creation', () => {
  let ctx: WebhookTestContext;
  let app: Elysia;
  let VALID_ADMIN_KEY: string;
  let VALID_APPEND_KEY: string;
  let VALID_READ_KEY: string;
  let EXPIRED_ADMIN_KEY: string;
  let REVOKED_ADMIN_KEY: string;

  beforeAll(async () => {
    ctx = await setupWebhookTests();
    app = ctx.app;
    VALID_ADMIN_KEY = ctx.adminKey;
    VALID_APPEND_KEY = ctx.appendKey;
    VALID_READ_KEY = ctx.readKey;
    EXPIRED_ADMIN_KEY = ctx.expiredKey;
    REVOKED_ADMIN_KEY = ctx.revokedKey;
  });

  afterAll(() => {
    teardownWebhookTests();
  });

  beforeEach(() => {
    resetMockServer();
  });

  describe('Successful Creation', () => {
    test('should return 201 with id and secret', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['file.created', 'file.updated'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'WebhookCreateResponse');
      expect(body.ok).toBe(true);
      expect(body.data.id).toMatch(WEBHOOK_ID_PATTERN);
      expect(body.data.secret).toMatch(WEBHOOK_SECRET_PATTERN);
    });

    test('should return ok: true in response', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['append.created'],
          }),
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return id starting with wh_', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['file.created'],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.id).toMatch(WEBHOOK_ID_PATTERN);
    });

    test('should return secret starting with whsec_', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['file.created'],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.secret).toMatch(WEBHOOK_SECRET_PATTERN);
    });

    test('should return created timestamp', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['file.created'],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
    });

    test('should return the provided URL in response', async () => {
      const webhookUrl = 'https://api.myservice.com/webhooks/mdplane';
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            events: ['file.created'],
          }),
        })
      );

      const body = await response.json();
      expect(body.data.url).toBe(webhookUrl);
    });

    test('should return the provided events in response', async () => {
      const events = ['file.created', 'file.updated', 'append.created'];
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events,
          }),
        })
      );

      const body = await response.json();
      expect(body.data.events).toEqual(events);
    });

    test('should accept optional filters parameter', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            events: ['file.created'],
            filters: { types: ['task'] },
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
    });

    test('should generate unique id for each webhook', async () => {
      const response1 = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook1', events: ['file.created'] }),
        })
      );
      const response2 = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook2', events: ['file.created'] }),
        })
      );

      const body1 = await response1.json();
      const body2 = await response2.json();
      expect(body1.data.id).not.toBe(body2.data.id);
    });

    test('should generate unique secret for each webhook', async () => {
      const response1 = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook1', events: ['file.created'] }),
        })
      );
      const response2 = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook2', events: ['file.created'] }),
        })
      );

      const body1 = await response1.json();
      const body2 = await response2.json();
      expect(body1.data.secret).not.toBe(body2.data.secret);
    });

    test('writes capability actor type to audit log', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook-audit-capability',
            events: ['file.created'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      const webhookId = body.data.id as string;

      await flushAuditQueue();

      const entry = sqlite
        .query(`
          SELECT actor_type as actorType, actor
          FROM audit_logs
          WHERE workspace_id = ? AND action = 'webhook.create' AND resource_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .get(ctx.testWorkspace.workspaceId, webhookId) as
          | { actorType: string | null; actor: string | null }
          | null;

      expect(entry).not.toBeNull();
      expect(entry?.actorType).toBe('capability_url');
      expect(entry?.actor).toBeNull();
    });
  });

  describe('Validation Errors', () => {
    test('should return 400 when URL is missing', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should return 400 when events array is missing', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook' }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should accept empty events array (schema allows it)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook', events: [] }),
        })
      );
      expect(response.status).toBe(201);
    });

    test('should return 400 for invalid event type', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook', events: ['invalid.event.type'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(['INVALID_EVENT_TYPE', 'INVALID_REQUEST']).toContain(body.error.code);
    });

    test('should return 400 when events contains mix of valid and invalid', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook', events: ['file.created', 'not.a.valid.event'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(['INVALID_EVENT_TYPE', 'INVALID_REQUEST']).toContain(body.error.code);
    });

    test('should return 400 for invalid URL format', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'not-a-valid-url', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });

  describe('Input Validation Edge Cases', () => {
    describe('URL Validation Edge Cases', () => {
      test('should return 400 for empty URL string', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: '', events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for URL with only whitespace', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: '   ', events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should accept URL with leading/trailing whitespace (trims)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: '  https://example.com/webhook  ', events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(201);
      });

      test('should return 400 for very long URL (>2000 chars)', async () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(2001);
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: longUrl, events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(400);
      });

      test('should accept URL with unicode characters', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://例え.jp/webhook', events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(201);
      });

      test('should return 400 for URL with control characters', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://example.com/webhook\x00', events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for URL as number instead of string', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 12345, events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });
    });

    describe('Events Array Validation Edge Cases', () => {
      test('should return 400 for events as string instead of array', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://example.com/webhook', events: 'file.created' }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for events with null items', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://example.com/webhook', events: ['file.created', null, 'file.updated'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for events with number items', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://example.com/webhook', events: [1, 2, 3] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for event type in wrong case', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://example.com/webhook', events: ['FILE.CREATED'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for event type with whitespace', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://example.com/webhook', events: [' file.created '] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });
    });

    describe('JSON Body Validation Edge Cases', () => {
      test('should return 400 for empty object {}', async () => {
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
      });

      test('should return 400 for array instead of object', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ url: 'https://example.com/webhook', events: ['file.created'] }]),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for invalid JSON', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{ invalid json }',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should ignore extra unexpected fields', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: getMockServerUrl() + '/webhook',
              events: ['file.created'],
              extraField: 'should be ignored',
              anotherExtra: 123,
            }),
          })
        );
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return 400 for null values in required fields', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: null, events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });
    });
  });

  describe('Authorization', () => {
    test('should return 404 for read-only key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_READ_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(404);
    });

    test('should return 404 for append-only key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_APPEND_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(404);
    });

    test('should return 404 for invalid key format', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${INVALID_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(404);
    });

    test('should return 404 for expired key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${EXPIRED_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(404);
    });

    test('should return 404 for revoked key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${REVOKED_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(404);
    });
  });
});
