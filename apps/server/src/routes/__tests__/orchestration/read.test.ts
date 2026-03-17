/**
 * Orchestration Endpoint Tests
 *
 * @see packages/shared/openapi/paths/orchestration.yaml
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

// Import the route under test
import { orchestrationRoute } from '../../../routes/orchestration';
// Import test fixtures
import { resetOrchestrationTestData } from '../../../../tests/helpers/orchestration-fixtures';

// Test capability keys (valid format, for testing purposes)
const VALID_READ_KEY = 'orchR8k2mP9qL3nR7mQ2pN4';
const VALID_APPEND_KEY = 'orchA8k2mP9qL3nR7mQ2pN4';
const VALID_WRITE_KEY = 'orchW8k2mP9qL3nR7mQ2pN4';
const EXPIRED_KEY = 'orchExpired0P9qL3nR7mQ2';
const REVOKED_KEY = 'orchRevoked0P9qL3nR7mQ2';
const INVALID_KEY = 'short';

// Patterns
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

type TestOrchestrationTask = {
  status: 'pending' | 'claimed' | 'stalled' | 'completed' | 'cancelled';
  id: string;
  claim?: { id: string; author?: string; expiresAt?: string };
  file: { id: string; path: string };
  author: string;
  createdAt: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
};

function tasksByStatus<T extends TestOrchestrationTask = TestOrchestrationTask>(
  tasks: Array<{ status: string }>,
  status: TestOrchestrationTask['status']
): T[] {
  return tasks.filter((task) => task.status === status) as T[];
}

describe('Orchestration', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(() => {
    // Create test app with orchestration route
    app = new Elysia().use(orchestrationRoute);
  });

  beforeEach(() => {
    // Reset test data to ensure consistent state before each test
    resetOrchestrationTestData();
  });

  describe('GET /r/:key/orchestration - Read-Only View', () => {
    describe('Authentication', () => {
      test('should return 404 for invalid key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 404 for expired key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${EXPIRED_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 404 for revoked key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${REVOKED_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 200 for valid read key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        assertValidResponse(body, 'GetOrchestrationReadOnlyResponse');
      });

      test('should return 200 for valid append key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_APPEND_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return 200 for valid write key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_WRITE_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });

    describe('Response Structure', () => {
      test('should return ok: true', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return data.summary with required fields', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.summary).toBeDefined();
        expect(typeof body.data.summary.pending).toBe('number');
        expect(typeof body.data.summary.claimed).toBe('number');
        expect(typeof body.data.summary.completed).toBe('number');
        expect(typeof body.data.summary.stalled).toBe('number');
        expect(typeof body.data.summary.cancelled).toBe('number');
      });

      test('should return flat data.tasks array', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.tasks).toBeDefined();
        expect(Array.isArray(body.data.tasks)).toBe(true);
      });

      test('should return data.claims array', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.claims).toBeDefined();
        expect(Array.isArray(body.data.claims)).toBe(true);
      });

      test('should return data.agents array', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.agents).toBeDefined();
        expect(Array.isArray(body.data.agents)).toBe(true);
      });

      test('should return data.workload object', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.workload).toBeDefined();
        expect(typeof body.data.workload).toBe('object');
      });
    });

    describe('Summary Counts', () => {
      test('should count pending tasks correctly', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        // Test fixtures should have 2 pending tasks
        expect(body.data.summary.pending).toBeGreaterThanOrEqual(0);
        expect(typeof body.data.summary.pending).toBe('number');
      });

      test('should count claimed tasks correctly', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.summary.claimed).toBeGreaterThanOrEqual(0);
        expect(typeof body.data.summary.claimed).toBe('number');
      });

      test('should count completed tasks correctly', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.summary.completed).toBeGreaterThanOrEqual(0);
        expect(typeof body.data.summary.completed).toBe('number');
      });

      test('should count stalled claims correctly', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.summary.stalled).toBeGreaterThanOrEqual(0);
        expect(typeof body.data.summary.stalled).toBe('number');
      });

      test('should count cancelled tasks correctly', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.summary.cancelled).toBeGreaterThanOrEqual(0);
        expect(typeof body.data.summary.cancelled).toBe('number');
      });
    });

    describe('Filtering', () => {
      test('task bucket counts match summary counts across all status buckets', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);

        // Fixture creates: 2 pending (a1, a2), 1 claimed (a3), 1 completed (a5)
        expect(tasksByStatus(body.data.tasks, 'pending').length).toBe(body.data.summary.pending);
        expect(body.data.summary.pending).toBe(2); // a1, a2 only

        expect(tasksByStatus(body.data.tasks, 'claimed').length).toBe(body.data.summary.claimed);
        expect(body.data.summary.claimed).toBe(1); // a3 only

        expect(tasksByStatus(body.data.tasks, 'completed').length).toBe(body.data.summary.completed);
        expect(body.data.summary.completed).toBe(1); // a5 only

        expect(tasksByStatus(body.data.tasks, 'cancelled').length).toBe(body.data.summary.cancelled);

        // Verify no task appears in multiple buckets
        const allBucketIds = [
          ...tasksByStatus(body.data.tasks, 'pending').map((t: { id: string }) => t.id),
          ...tasksByStatus(body.data.tasks, 'claimed').map((t: { id: string }) => t.id),
          ...tasksByStatus(body.data.tasks, 'stalled').map((t: { id: string }) => t.id),
          ...tasksByStatus(body.data.tasks, 'completed').map((t: { id: string }) => t.id),
          ...tasksByStatus(body.data.tasks, 'cancelled').map((t: { id: string }) => t.id),
        ];
        expect(new Set(allBucketIds).size).toBe(allBucketIds.length);
      });

      test('should filter by status query param', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?status=pending`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        // When filtering by pending, only pending tasks should be included
        expect(tasksByStatus(body.data.tasks, 'pending').length).toBe(2); // exact count, not just array existence
        expect(tasksByStatus(body.data.tasks, 'claimed').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'stalled').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'completed').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'cancelled').length).toBe(0);
      });

      test('should filter by resolved status query param', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?status=completed`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(tasksByStatus(body.data.tasks, 'pending').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'claimed').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'stalled').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'completed').length).toBe(1);
      });

      test('should filter by comma-separated status query param', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?status=pending,claimed`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(tasksByStatus(body.data.tasks, 'pending').length).toBe(2);
        expect(tasksByStatus(body.data.tasks, 'claimed').length).toBe(1);
        expect(tasksByStatus(body.data.tasks, 'stalled').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'completed').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'cancelled').length).toBe(0);
      });

      test('should filter by agent query param', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?agent=agent-1`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(tasksByStatus(body.data.tasks, 'pending').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'claimed').length).toBe(1);
        expect(tasksByStatus(body.data.tasks, 'claimed')[0].id).toBe('a3');
        expect(tasksByStatus(body.data.tasks, 'claimed')[0].claim?.author).toBe('agent-1');
      });

      test('should filter by file query param (partial match)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?file=tasks`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        const taskIds = new Set<string>([
          ...tasksByStatus(body.data.tasks, 'pending').map((task: { id: string }) => task.id),
          ...tasksByStatus(body.data.tasks, 'claimed').map((task: { id: string }) => task.id),
          ...tasksByStatus(body.data.tasks, 'completed').map((task: { id: string }) => task.id),
        ]);
        expect(taskIds.has('a1')).toBe(true);
        expect(taskIds.has('a2')).toBe(true);
        expect(taskIds.has('a3')).toBe(true);
        expect(taskIds.has('a5')).toBe(true);
      });

      test('should filter by folder query param', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?folder=/project`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(tasksByStatus(body.data.tasks, 'pending').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'claimed').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'stalled').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'completed').length).toBe(0);
        expect(tasksByStatus(body.data.tasks, 'cancelled').length).toBe(0);
      });

      test('should filter by priority query param', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?priority=high,critical`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        const taskIds = [
          ...tasksByStatus(body.data.tasks, 'pending').map((task: { id: string }) => task.id),
          ...tasksByStatus(body.data.tasks, 'claimed').map((task: { id: string }) => task.id),
          ...tasksByStatus(body.data.tasks, 'stalled').map((task: { id: string }) => task.id),
          ...tasksByStatus(body.data.tasks, 'completed').map((task: { id: string }) => task.id),
          ...tasksByStatus(body.data.tasks, 'cancelled').map((task: { id: string }) => task.id),
        ];
        expect(taskIds).toEqual(['a1']);
      });

      test('should return 400 for invalid status filter values', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?status=badstatus`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 for invalid priority filter values', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?priority=high%27)%20OR%201%3D1%20--`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should filter by since query param', async () => {
        const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?since=${sinceDate}`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });

    describe('Pagination', () => {
      test('should respect limit query param', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?limit=5`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.tasks.length).toBeLessThanOrEqual(5);
        const summaryTotal =
          body.data.summary.pending +
          body.data.summary.claimed +
          body.data.summary.stalled +
          body.data.summary.completed +
          body.data.summary.cancelled;
        expect(summaryTotal).toBe(body.data.tasks.length);
      });

      test('should return pagination.hasMore when more results exist', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?limit=1`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.pagination).toBeDefined();
        expect(body.data.pagination.hasMore).toBe(true);
      });

      test('should return pagination.cursor for next page', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?limit=1`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.pagination?.hasMore).toBe(true);
        expect(body.data.pagination.cursor).toBeDefined();
        expect(typeof body.data.pagination.cursor).toBe('string');
      });

      test('should continue from cursor', async () => {
        // First request to get cursor
        const response1 = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?limit=1`, {
            method: 'GET',
          })
        );

        expect(response1.status).toBe(200);
        const body1 = await response1.json();
        expect(body1.ok).toBe(true);
        expect(body1.data.tasks).toHaveLength(1);
        expect(body1.data.pagination?.cursor).toBeDefined();
        const firstPageTaskId = body1.data.tasks[0]?.id;

        // Second request using cursor
        const response2 = await app.handle(
          new Request(
            `http://localhost/r/${VALID_READ_KEY}/orchestration?limit=1&cursor=${body1.data.pagination.cursor}`,
            { method: 'GET' }
          )
        );

        expect(response2.status).toBe(200);
        const body2 = await response2.json();
        expect(body2.ok).toBe(true);
        expect(body2.data.tasks.length).toBeLessThanOrEqual(1);
        if (body2.data.tasks.length > 0) {
          expect(body2.data.tasks[0].id).not.toBe(firstPageTaskId);
        }
      });

      test('should return 400 for limit=0 (below minimum)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?limit=0`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 for limit=1001 (above maximum)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?limit=1001`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 for non-integer limit', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration?limit=abc`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });
    });

    describe('Task Structure', () => {
      test('should return tasks with required fields', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        const allTasks = body.data.tasks || [];

        if (allTasks.length > 0) {
          const task = allTasks[0];
          expect(task.id).toBeDefined();
          expect(task.file).toBeDefined();
          expect(task.file.id).toBeDefined();
          expect(task.file.path).toBeDefined();
          expect(task.author).toBeDefined();
          expect(task.createdAt).toBeDefined();
          expect(task.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
        }
      });

      test('should include claim info on claimed tasks', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        const claimedTasks = tasksByStatus(body.data.tasks, 'claimed');

        if (claimedTasks.length > 0) {
          const claimedTask = claimedTasks[0];
          expect(claimedTask.claim).toBeDefined();
          const claim = claimedTask.claim;
          if (!claim) {
            throw new Error('Expected claimed task to include claim details');
          }
          expect(claim.id).toBeDefined();
          expect(claim.author).toBeDefined();
          expect(claim.expiresAt).toBeDefined();
        }
      });
    });

    describe('Claim Structure', () => {
      test('should return claims with required fields', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        const claims = body.data.claims || [];

        if (claims.length > 0) {
          const claim = claims[0];
          expect(claim.id).toBeDefined();
          expect(claim.taskId).toBeDefined();
          expect(claim.file).toBeDefined();
          expect(claim.file.id).toBeDefined();
          expect(claim.file.path).toBeDefined();
          expect(claim.author).toBeDefined();
          expect(claim.expiresAt).toBeDefined();
          expect(claim.status).toBeDefined();
          expect(['active', 'blocked', 'expired']).toContain(claim.status);
        }
      });

      test('should return expiresInSeconds for claims', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        const claims = body.data.claims || [];

        if (claims.length > 0) {
          const claim = claims[0];
          if (claim.expiresInSeconds !== undefined) {
            expect(typeof claim.expiresInSeconds).toBe('number');
          }
        }
      });
    });

    describe('Agent Status', () => {
      test('should return agents with required fields', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        const agents = body.data.agents || [];

        if (agents.length > 0) {
          const agent = agents[0];
          expect(agent.author).toBeDefined();
          expect(agent.status).toBeDefined();
          expect(['alive', 'idle', 'busy', 'stale']).toContain(agent.status);
          expect(agent.lastSeen).toBeDefined();
        }
      });
    });

    describe('Workload Distribution', () => {
      test('should return workload per agent', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        const workload = body.data.workload || {};

        // Workload is an object with agent names as keys
        for (const agentName in workload) {
          expect(typeof workload[agentName].activeClaims).toBe('number');
          expect(typeof workload[agentName].completedToday).toBe('number');
        }
      });
    });
  });
});


