import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';
import { sqlite } from '../../../db';
import { flushAuditQueue } from '../fixtures/audit-service-fixtures';
import {
  TEST_NON_OWNER_SESSION,
  TEST_MEMBER_USER_ID,
  TEST_OWNER_SESSION,
  TEST_OWNER_USER_ID,
  TEST_OWNER_WORKSPACE_ID,
} from '../fixtures/workspaces-fixtures';

type SessionUser = { id: string; email: string; name: string };

const activeOAuthSessions = new Map<string, SessionUser>();

mock.module('../../../core/auth', () => {
  return {
    auth: {
      api: {
        getSession: async ({ headers }: { headers: Headers }) => {
          const cookieHeader = headers.get('Cookie');
          if (!cookieHeader) return null;

          const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
          for (const cookie of cookies) {
            const [name, ...valueParts] = cookie.split('=');
            if (name !== 'better-auth.session_token') continue;

            const token = valueParts.join('=');
            const user = activeOAuthSessions.get(token);
            if (!user) return null;

            return {
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: new Date('2024-01-01T00:00:00Z'),
                emailVerified: true,
                image: null,
                updatedAt: new Date('2024-01-01T00:00:00Z'),
              },
            };
          }

          return null;
        },
      },
    },
  };
});

const OWNER_WORKSPACE_ID = TEST_OWNER_WORKSPACE_ID;
const OWNER_SESSION_COOKIE = `better-auth.session_token=${TEST_OWNER_SESSION}`;
const MEMBER_SESSION_COOKIE = `better-auth.session_token=${TEST_NON_OWNER_SESSION}`;
const AUDIT_ENTRY_TIMEOUT_MS = 500;
const AUDIT_ENTRY_POLL_INTERVAL_MS = 25;

function resetWorkspaceFixtures() {
  const now = new Date().toISOString();

  sqlite
    .query(`DELETE FROM webhook_deliveries WHERE webhook_id IN (SELECT id FROM webhooks WHERE workspace_id = ?)`)
    .run(OWNER_WORKSPACE_ID);
  sqlite.query(`DELETE FROM webhooks WHERE workspace_id = ?`).run(OWNER_WORKSPACE_ID);

  sqlite
    .query(
      `
      INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at, deleted_at)
      VALUES (?, 'Workspace Under Test', ?, ?, NULL)
    `
    )
    .run(OWNER_WORKSPACE_ID, now, now);

  sqlite
    .query(
      `
      INSERT OR REPLACE INTO users (id, email, created_at)
      VALUES (?, 'owner@example.com', ?), (?, 'member@example.com', ?)
    `
    )
    .run(TEST_OWNER_USER_ID, now, TEST_MEMBER_USER_ID, now);

  sqlite
    .query(
      `
      INSERT OR REPLACE INTO user_workspaces (id, user_id, workspace_id, created_at)
      VALUES
        ('uw_owner_webhooks', ?, ?, ?)
    `
    )
    .run(TEST_OWNER_USER_ID, OWNER_WORKSPACE_ID, now);
}

type WebhookAuditEntry = { actorType: string | null; actor: string | null };

function getWebhookCreateAuditEntry(workspaceId: string, webhookId: string): WebhookAuditEntry | null {
  return sqlite
    .query(`
      SELECT actor_type as actorType, actor
      FROM audit_logs
      WHERE workspace_id = ? AND action = 'webhook.create' AND resource_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(workspaceId, webhookId) as WebhookAuditEntry | null;
}

async function waitForWebhookCreateAuditEntry(
  workspaceId: string,
  webhookId: string
): Promise<WebhookAuditEntry | null> {
  const deadline = Date.now() + AUDIT_ENTRY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await flushAuditQueue();
    const entry = getWebhookCreateAuditEntry(workspaceId, webhookId);
    if (entry) {
      return entry;
    }
    await Bun.sleep(AUDIT_ENTRY_POLL_INTERVAL_MS);
  }

  return null;
}

describe('Workspace webhooks routes', () => {
  type TestApp = { handle: (request: Request) => Promise<Response> | Response };
  let app: TestApp;

  beforeAll(async () => {
    const mod = await import('../../webhooks');
    app = new Elysia().use(mod.webhooksRoute);

    activeOAuthSessions.set(TEST_OWNER_SESSION, {
      id: TEST_OWNER_USER_ID,
      email: 'owner@example.com',
      name: 'Owner',
    });
    activeOAuthSessions.set(TEST_NON_OWNER_SESSION, {
      id: TEST_MEMBER_USER_ID,
      email: 'member@example.com',
      name: 'Member',
    });
  });

  beforeEach(() => {
    resetWorkspaceFixtures();
  });

  test('GET /workspaces/:workspaceId/webhooks returns list for workspace owner', async () => {
    const response = await app.handle(
      new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/webhooks`, {
        headers: { Cookie: OWNER_SESSION_COOKIE },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    assertValidResponse(body, 'WebhookListResponse');
  });

  test('POST /workspaces/:workspaceId/webhooks returns 404 for user without workspace ownership', async () => {
    const response = await app.handle(
      new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/webhooks`, {
        method: 'POST',
        headers: {
          Cookie: MEMBER_SESSION_COOKIE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['file.created'],
        }),
      })
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  test('POST then GET workspace webhooks works for owner', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/webhooks`, {
        method: 'POST',
        headers: {
          Cookie: OWNER_SESSION_COOKIE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['file.created', 'task.completed'],
        }),
      })
    );

    expect(createResponse.status).toBe(201);
    const createdBody = await createResponse.json();
    expect(createdBody.ok).toBe(true);
    assertValidResponse(createdBody, 'WebhookCreateResponse');

    const listResponse = await app.handle(
      new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/webhooks`, {
        headers: { Cookie: OWNER_SESSION_COOKIE },
      })
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0].url).toBe('https://example.com/webhook');
  });

  test('workspace webhook mutations write session actor type to audit log', async () => {
    const createResponse = await app.handle(
      new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/webhooks`, {
        method: 'POST',
        headers: {
          Cookie: OWNER_SESSION_COOKIE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook-audit-session',
          events: ['file.created'],
        }),
      })
    );

    expect(createResponse.status).toBe(201);
    const createdBody = await createResponse.json();
    const webhookId = createdBody.data.id as string;

    const entry = await waitForWebhookCreateAuditEntry(OWNER_WORKSPACE_ID, webhookId);

    expect(entry).not.toBeNull();
    expect(entry?.actorType).toBe('session');
    expect(entry?.actor).toBe(TEST_OWNER_USER_ID);
  });
});
