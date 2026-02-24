/**
 * Workspace Orchestration Endpoint Tests
 *
 * TDD tests for session-authenticated orchestration endpoints.
 *
 * Endpoints:
 * - GET /workspaces/:workspaceId/orchestration - Orchestration board view
 * - POST /workspaces/:workspaceId/orchestration/claims/:claimId/renew - Renew a claim
 * - POST /workspaces/:workspaceId/orchestration/claims/:claimId/complete - Complete a claimed task
 * - POST /workspaces/:workspaceId/orchestration/claims/:claimId/cancel - Cancel a claim
 * - POST /workspaces/:workspaceId/orchestration/claims/:claimId/block - Mark claim as blocked
 *
 * Returns the same shape as capability orchestration (OrchestrationReadOnlyResponse).
 *
 * @see packages/shared/openapi/paths/orchestration.yaml
 */

import { describe, expect, test, beforeAll, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { initializeDatabase } from '../../../db';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';
import {
  ORCH_TEST_PENDING_TASK_APPEND_ID,
  ORCH_VALID_WORKSPACE_ID,
  resetWorkspaceOrchestrationFixtures,
} from '../fixtures/workspace-orchestration-fixtures';

const VALID_WORKSPACE_ID = ORCH_VALID_WORKSPACE_ID;
const NON_EXISTENT_WORKSPACE_ID = 'ws_nonexistent_orch';
const VALID_SESSION_TOKEN = 'orchTestSession123';
const OTHER_SESSION_TOKEN = 'orchOtherSession456';
const VALID_SESSION_COOKIE = `better-auth.session_token=${VALID_SESSION_TOKEN}`;
const OTHER_USER_SESSION_COOKIE = `better-auth.session_token=${OTHER_SESSION_TOKEN}`;

type TestOrchestrationTask = {
  status: 'pending' | 'claimed' | 'stalled' | 'completed' | 'cancelled';
  id: string;
  claim?: { author?: string };
};

function tasksByStatus<T extends TestOrchestrationTask = TestOrchestrationTask>(
  tasks: Array<{ status: string }>,
  status: TestOrchestrationTask['status']
): T[] {
  return tasks.filter((task) => task.status === status) as T[];
}

// Mock BetterAuth session lookup
const activeOAuthSessions = new Map<string, { id: string; email: string; name: string; sessionToken: string }>();
mock.module('../../../core/auth', () => ({
  auth: {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const cookieHeader = headers.get('Cookie');
        if (!cookieHeader) return null;
        const cookies = cookieHeader.split(';').map((c: string) => c.trim());
        for (const cookie of cookies) {
          const [name, ...valueParts] = cookie.split('=');
          if (name !== 'better-auth.session_token') continue;
          const token = valueParts.join('=');
          const user = activeOAuthSessions.get(token);
          if (!user) return null;
          return {
            user: { id: user.id, email: user.email, name: user.name, createdAt: new Date(), emailVerified: true, image: null, updatedAt: new Date() },
            session: { id: 'mock_session_id', userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), token, createdAt: new Date(), updatedAt: new Date() },
          };
        }
        return null;
      },
      signOut: async () => {},
    },
    handler: () => new Response('mock auth handler'),
  },
}));

describe('Workspace Orchestration', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;
  let testFileId: string;
  let testTaskAppendId: string;
  let testPendingTaskAppendId: string;
  let testClaimAppendId: string;

  beforeAll(async () => {
    const mod = await import('../../workspace-orchestration');
    app = new Elysia().use(mod.workspaceOrchestrationRoute);
    await initializeDatabase();
    activeOAuthSessions.set(VALID_SESSION_TOKEN, { id: 'usr_orch_owner', email: 'orch@example.com', name: 'Orch User', sessionToken: VALID_SESSION_TOKEN });
    activeOAuthSessions.set(OTHER_SESSION_TOKEN, { id: 'usr_orch_other', email: 'other@example.com', name: 'Other User', sessionToken: OTHER_SESSION_TOKEN });
  });

  beforeEach(async () => {
    const fixtures = await resetWorkspaceOrchestrationFixtures();
    testFileId = fixtures.fileId;
    testTaskAppendId = fixtures.taskAppendId;
    testPendingTaskAppendId = ORCH_TEST_PENDING_TASK_APPEND_ID;
    testClaimAppendId = fixtures.claimAppendId;
  });

  describe('GET /workspaces/:workspaceId/orchestration', () => {
    test('returns 401 without session', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration`));
      expect(res.status).toBe(401);
    });

    test('returns 404 for non-existent workspace', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${NON_EXISTENT_WORKSPACE_ID}/orchestration`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(404);
    });

    test('returns 404 for non-member user to prevent workspace enumeration', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration`, { headers: { Cookie: OTHER_USER_SESSION_COOKIE } }));
      expect(res.status).toBe(404);
    });

    test('returns 200 with orchestration board for owner', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data).toBeDefined();
      // Should have same shape as capability orchestration
      expect(json.data.summary).toBeDefined();
      expect(json.data.tasks).toBeDefined();
      expect(json.data.claims).toBeDefined();
      expect(json.data.agents).toBeDefined();
      expect(json.data.workload).toBeDefined();
    });

    test('supports status filter query param', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration?status=pending`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(tasksByStatus(body.data.tasks, 'pending').map((task: { id: string }) => task.id)).toEqual([testPendingTaskAppendId]);
      expect(tasksByStatus(body.data.tasks, 'claimed')).toHaveLength(0);
      expect(tasksByStatus(body.data.tasks, 'stalled')).toHaveLength(0);
      expect(tasksByStatus(body.data.tasks, 'completed')).toHaveLength(0);
      expect(tasksByStatus(body.data.tasks, 'cancelled')).toHaveLength(0);
    });

    test('supports priority filter query param', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration?priority=high,critical`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      const filteredTaskIds = [
        ...tasksByStatus(body.data.tasks, 'pending').map((task: { id: string }) => task.id),
        ...tasksByStatus(body.data.tasks, 'claimed').map((task: { id: string }) => task.id),
        ...tasksByStatus(body.data.tasks, 'stalled').map((task: { id: string }) => task.id),
        ...tasksByStatus(body.data.tasks, 'completed').map((task: { id: string }) => task.id),
        ...tasksByStatus(body.data.tasks, 'cancelled').map((task: { id: string }) => task.id),
      ];
      expect(filteredTaskIds).toEqual([testTaskAppendId]);
    });

    test('supports agent filter query param', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration?agent=claimer-agent`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(tasksByStatus(body.data.tasks, 'claimed')).toHaveLength(1);
      expect(tasksByStatus(body.data.tasks, 'claimed')[0].id).toBe(testTaskAppendId);
      expect(tasksByStatus(body.data.tasks, 'claimed')[0].claim?.author).toBe('claimer-agent');
      expect(tasksByStatus(body.data.tasks, 'pending')).toHaveLength(0);
    });

    test('supports file filter query param', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration?file=tasks`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      const filteredTaskIds = new Set<string>([
        ...tasksByStatus(body.data.tasks, 'pending').map((task: { id: string }) => task.id),
        ...tasksByStatus(body.data.tasks, 'claimed').map((task: { id: string }) => task.id),
      ]);
      expect(filteredTaskIds.has(testTaskAppendId)).toBe(true);
      expect(filteredTaskIds.has(testPendingTaskAppendId)).toBe(true);
    });

    test('supports folder filter query param', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration?folder=/ops`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(tasksByStatus(body.data.tasks, 'pending')).toHaveLength(0);
      expect(tasksByStatus(body.data.tasks, 'claimed')).toHaveLength(0);
      expect(tasksByStatus(body.data.tasks, 'stalled')).toHaveLength(0);
      expect(tasksByStatus(body.data.tasks, 'completed')).toHaveLength(0);
      expect(tasksByStatus(body.data.tasks, 'cancelled')).toHaveLength(0);
    });

    test('supports limit query param', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration?limit=1`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.pagination).toBeDefined();
      expect(body.data.tasks.length).toBeLessThanOrEqual(1);
      expect(body.data.pagination.hasMore).toBe(true);
      expect(typeof body.data.pagination.cursor).toBe('string');
    });

    test('supports cursor query param', async () => {
      const firstPage = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration?limit=1`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(firstPage.status).toBe(200);
      const firstBody = await firstPage.json();
      expect(firstBody.ok).toBe(true);
      expect(firstBody.data.tasks).toHaveLength(1);
      const cursor = firstBody.data.pagination?.cursor;
      expect(typeof cursor).toBe('string');
      if (typeof cursor !== 'string') {
        throw new Error('Expected cursor to be returned for paginated response');
      }

      const secondPage = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration?limit=1&cursor=${encodeURIComponent(cursor)}`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(secondPage.status).toBe(200);
      const secondBody = await secondPage.json();
      expect(secondBody.ok).toBe(true);
      expect(secondBody.data.tasks.length).toBeLessThanOrEqual(1);
      if (secondBody.data.tasks.length > 0) {
        expect(secondBody.data.tasks[0].id).not.toBe(firstBody.data.tasks[0].id);
      }
    });

    test('returns 400 for invalid status filter values', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration?status=badstatus`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('returns 400 for invalid priority filter values', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration?priority=urgent`, { headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });
  });

  describe('POST /workspaces/:workspaceId/orchestration/claims/:claimId/renew', () => {
    test('returns 401 without session', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/renew`, { method: 'POST' }));
      expect(res.status).toBe(401);
    });

    test('returns 404 for non-existent claim', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/ap_nonexistent/renew`, { method: 'POST', headers: { Cookie: VALID_SESSION_COOKIE } }));
      expect(res.status).toBe(404);
    });

    test('returns 400 Error schema for invalid body type', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/renew`, {
        method: 'POST',
        headers: { Cookie: VALID_SESSION_COOKIE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInSeconds: 'invalid' }),
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('returns 200 and renews claim for owner', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/renew`, {
        method: 'POST',
        headers: { Cookie: VALID_SESSION_COOKIE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInSeconds: 600 }),
      }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.claim).toBeDefined();
      expect(json.data.appendId).toBeDefined();
    });
  });

  describe('POST /workspaces/:workspaceId/orchestration/claims/:claimId/complete', () => {
    test('returns 401 without session', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/complete`, { method: 'POST' }));
      expect(res.status).toBe(401);
    });

    test('returns 200 and completes claim for owner', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/complete`, {
        method: 'POST',
        headers: { Cookie: VALID_SESSION_COOKIE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Task completed' }),
      }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.claim).toBeDefined();
      expect(json.data.claim.status).toBe('completed');
    });

    test('returns 400 Error schema for invalid body type', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/complete`, {
        method: 'POST',
        headers: { Cookie: VALID_SESSION_COOKIE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 42 }),
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });
  });

  describe('POST /workspaces/:workspaceId/orchestration/claims/:claimId/cancel', () => {
    test('returns 401 without session', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/cancel`, { method: 'POST' }));
      expect(res.status).toBe(401);
    });

    test('returns 200 and cancels claim for owner', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/cancel`, {
        method: 'POST',
        headers: { Cookie: VALID_SESSION_COOKIE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'No longer needed' }),
      }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.claim).toBeDefined();
      expect(json.data.claim.status).toBe('cancelled');
    });
  });

  describe('POST /workspaces/:workspaceId/orchestration/claims/:claimId/block', () => {
    test('returns 401 without session', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/block`, { method: 'POST' }));
      expect(res.status).toBe(401);
    });

    test('returns 200 and blocks claim for owner', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/block`, {
        method: 'POST',
        headers: { Cookie: VALID_SESSION_COOKIE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Waiting for external dependency' }),
      }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.claim).toBeDefined();
      expect(json.data.claim.status).toBe('blocked');
    });

    test('returns 400 when reason is missing', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/block`, {
        method: 'POST',
        headers: { Cookie: VALID_SESSION_COOKIE, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }));
      expect(res.status).toBe(400);
    });

    test('returns 400 Error schema for invalid reason type', async () => {
      const res = await app.handle(new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/orchestration/claims/${testClaimAppendId}/block`, {
        method: 'POST',
        headers: { Cookie: VALID_SESSION_COOKIE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 123 }),
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });
  });
});

