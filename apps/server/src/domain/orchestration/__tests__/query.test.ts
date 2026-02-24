/**
 * Orchestration Query Domain Service Tests
 *
 * Tests verify:
 * - Board model shape is correct
 * - Filters work correctly (status, agent, folder, priority)
 * - SQL injection is prevented in priority filter
 * - Pagination works correctly
 *
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { sqlite } from '../../../db';
import {
  queryOrchestrationBoard,
  type OrchestrationQueryFilters,
} from '../query';
import {
  resetOrchestrationDomainWorkspace,
  setupOrchestrationDomainWorkspace,
} from './fixtures/orchestration-domain-fixtures';

const TEST_WORKSPACE_ID = 'ws_domain_orch_test';

// Deterministic file ID for test isolation
const TEST_FILE_ID = 'file_domain_orch_test_fixed';

function setupTestFixtures(): void {
  const now = setupOrchestrationDomainWorkspace({
    workspaceId: TEST_WORKSPACE_ID,
    workspaceName: 'Domain Test Workspace',
    fileId: TEST_FILE_ID,
    filePath: '/tasks.md',
    fileContent: '# Tasks',
  });
  const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
  const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

  const fileId = TEST_FILE_ID;

  // Create test tasks with different priorities and states
  const tasks = [
    // Pending tasks
    { appendId: 'task_p1', author: 'user-1', type: 'task', priority: 'high', ref: null, expiresAt: null },
    { appendId: 'task_p2', author: 'user-2', type: 'task', priority: 'medium', ref: null, expiresAt: null },
    { appendId: 'task_p3', author: 'user-1', type: 'task', priority: 'low', ref: null, expiresAt: null },
    // Task with active claim
    { appendId: 'task_c1', author: 'user-1', type: 'task', priority: 'critical', ref: null, expiresAt: null },
    { appendId: 'claim_c1', author: 'agent-1', type: 'claim', priority: null, ref: 'task_c1', expiresAt: futureDate, status: 'active' },
    // Task with expired claim (stalled)
    { appendId: 'task_s1', author: 'user-1', type: 'task', priority: 'high', ref: null, expiresAt: null },
    { appendId: 'claim_s1', author: 'agent-2', type: 'claim', priority: null, ref: 'task_s1', expiresAt: pastDate, status: 'active' },
    // Completed task
    { appendId: 'task_x1', author: 'user-1', type: 'task', priority: 'medium', ref: null, expiresAt: null },
    { appendId: 'resp_x1', author: 'agent-1', type: 'response', priority: null, ref: 'task_x1', expiresAt: null },
  ];

  const insertAppend = sqlite.query(`
    INSERT INTO appends (id, file_id, append_id, author, type, priority, ref, expires_at, status, created_at, content_preview)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of tasks) {
    insertAppend.run(
      `${fileId}_${t.appendId}`,
      fileId,
      t.appendId,
      t.author,
      t.type,
      t.priority,
      t.ref,
      t.expiresAt,
      (t as { status?: string }).status ?? null,
      now,
      `Test content for ${t.appendId}`
    );
  }

  // Create heartbeats
  const lastSeenUnix = Math.floor(Date.now() / 1000);
  const staleSeenUnix = lastSeenUnix - 600; // 10 minutes ago
  const upsertHeartbeat = sqlite.query(`
    INSERT OR REPLACE INTO heartbeats (workspace_id, author, status, last_seen, current_task)
    VALUES (?, ?, ?, ?, ?)
  `);
  upsertHeartbeat.run(TEST_WORKSPACE_ID, 'agent-1', 'busy', lastSeenUnix, 'task_c1');
  upsertHeartbeat.run(TEST_WORKSPACE_ID, 'agent-2', 'idle', staleSeenUnix, null);
}

function cleanupTestFixtures(): void {
  resetOrchestrationDomainWorkspace(TEST_WORKSPACE_ID);
}

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

describe('Orchestration Query Domain Service', () => {
  beforeAll(() => {
    setupTestFixtures();
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  describe('queryOrchestrationBoard', () => {
    test('returns correct board shape', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, {});

      expect(board).toHaveProperty('summary');
      expect(board).toHaveProperty('tasks');
      expect(board).toHaveProperty('claims');
      expect(board).toHaveProperty('agents');
      expect(board).toHaveProperty('workload');
      expect(board).toHaveProperty('pagination');

      expect(board.summary).toHaveProperty('pending');
      expect(board.summary).toHaveProperty('claimed');
      expect(board.summary).toHaveProperty('completed');
      expect(board.summary).toHaveProperty('stalled');
      expect(board.summary).toHaveProperty('cancelled');

      expect(Array.isArray(board.tasks)).toBe(true);
      expect(Array.isArray(board.claims)).toBe(true);
      expect(Array.isArray(board.agents)).toBe(true);
    });

    test('returns correct summary counts', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, {});

      // 3 pending tasks (task_p1, task_p2, task_p3)
      expect(board.summary.pending).toBe(3);
      // 1 claimed task (task_c1)
      expect(board.summary.claimed).toBe(1);
      // 1 completed task (task_x1)
      expect(board.summary.completed).toBe(1);
      // 1 stalled task (task_s1 with expired claim)
      expect(board.summary.stalled).toBe(1);
    });

    test('task counts match summary counts across flat status model', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, {});
      const pendingTasks = tasksByStatus(board.tasks, 'pending');
      const claimedTasks = tasksByStatus(board.tasks, 'claimed');
      const stalledTasks = tasksByStatus(board.tasks, 'stalled');
      const completedTasks = tasksByStatus(board.tasks, 'completed');
      const cancelledTasks = tasksByStatus(board.tasks, 'cancelled');

      expect(pendingTasks.length).toBe(board.summary.pending);
      expect(pendingTasks.length).toBe(3);

      expect(claimedTasks.length).toBe(board.summary.claimed);
      expect(claimedTasks.length).toBe(1);

      expect(stalledTasks.length).toBe(board.summary.stalled);
      expect(stalledTasks.length).toBe(1);
      expect(completedTasks.length).toBe(board.summary.completed);
      expect(completedTasks.length).toBe(1);
      expect(cancelledTasks.length).toBe(board.summary.cancelled);
      expect(cancelledTasks.length).toBe(0);

      const pendingIds = pendingTasks.map(t => t.id).sort();
      expect(pendingIds).toEqual(['task_p1', 'task_p2', 'task_p3']);

      const claimedIds = claimedTasks.map(t => t.id);
      expect(claimedIds).toEqual(['task_c1']);

      const stalledIds = stalledTasks.map(t => t.id);
      expect(stalledIds).toEqual(['task_s1']);
    });

    test('filters by status=pending', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, { status: 'pending' });

      // Should only return pending tasks - exact count
      expect(tasksByStatus(board.tasks, 'pending').length).toBe(3);
      expect(tasksByStatus(board.tasks, 'claimed').length).toBe(0);
      expect(tasksByStatus(board.tasks, 'stalled').length).toBe(0);

      // Verify no completed tasks leaked in
      const pendingIds = tasksByStatus(board.tasks, 'pending').map(t => t.id);
      expect(pendingIds).not.toContain('task_x1');
    });

    test('filters by status=claimed', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, { status: 'claimed' });

      expect(tasksByStatus(board.tasks, 'pending').length).toBe(0);
      expect(tasksByStatus(board.tasks, 'claimed').length).toBe(1);
      expect(tasksByStatus(board.tasks, 'stalled').length).toBe(0);
    });

    test('filters by agent', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, { agent: 'agent-1' });

      // Should only return claims by agent-1
      for (const claim of board.claims) {
        expect(claim.author).toBe('agent-1');
      }
      // Should only return tasks claimed by agent-1
      for (const task of tasksByStatus(board.tasks, 'claimed')) {
        expect(task.claim?.author).toBe('agent-1');
      }
    });

    test('filters by priority', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, { priority: 'high' });

      for (const task of board.tasks) {
        expect(task.priority).toBe('high');
      }
    });

    test('filters by multiple priorities (comma-separated)', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, { priority: 'high,critical' });

      for (const task of board.tasks) {
        expect(['high', 'critical']).toContain(task.priority ?? '');
      }
    });

    test('SECURITY: prevents SQL injection in priority filter', () => {
      // Attempt SQL injection via priority parameter
      const maliciousInput = "high'; DROP TABLE appends; --";

      // Should not throw and should return empty or filtered results
      expect(() => {
        queryOrchestrationBoard(TEST_WORKSPACE_ID, { priority: maliciousInput });
      }).not.toThrow();

      // Verify database is intact
      const count = sqlite.query('SELECT COUNT(*) as count FROM appends').get() as { count: number };
      expect(count.count).toBeGreaterThan(0);
    });

    test('returns agent statuses correctly', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, {});

      expect(board.agents.length).toBeGreaterThanOrEqual(2);

      const agent1 = board.agents.find(a => a.author === 'agent-1');
      const agent2 = board.agents.find(a => a.author === 'agent-2');

      expect(agent1).toBeDefined();
      expect(agent1?.status).toBe('busy');

      expect(agent2).toBeDefined();
      expect(agent2?.status).toBe('stale'); // 10 minutes old heartbeat
    });

    test('returns workload per agent', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, {});

      expect(board.workload).toBeDefined();
      expect(typeof board.workload).toBe('object');

      if (board.workload['agent-1']) {
        expect(board.workload['agent-1']).toHaveProperty('activeClaims');
        expect(board.workload['agent-1']).toHaveProperty('completedToday');
      }
    });

    test('respects pagination limit', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, { limit: 2 });

      const totalTasks = board.tasks.length;
      expect(totalTasks).toBeLessThanOrEqual(2);
    });

    test('returns pagination info', () => {
      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, { limit: 1 });

      expect(board.pagination).toHaveProperty('hasMore');
      if (board.pagination.hasMore) {
        expect(board.pagination.cursor).toBeDefined();
      }
    });

    test('isAdmin flag enables canForceExpire on claims', () => {
      const boardNonAdmin = queryOrchestrationBoard(TEST_WORKSPACE_ID, {}, false);
      const boardAdmin = queryOrchestrationBoard(TEST_WORKSPACE_ID, {}, true);

      for (const claim of boardNonAdmin.claims) {
        expect(claim.canForceExpire).toBeUndefined();
      }

      for (const claim of boardAdmin.claims) {
        expect(claim.canForceExpire).toBe(true);
      }
    });

    test('mutation invariant: cancelled claims are excluded from active buckets and workload', () => {
      const now = new Date().toISOString();

      sqlite.exec(`
        INSERT INTO appends (id, file_id, append_id, author, type, ref, created_at, content_preview)
        VALUES ('${TEST_FILE_ID}_cancel_c1', '${TEST_FILE_ID}', 'cancel_c1', 'agent-1', 'cancel', 'claim_c1', '${now}', 'Cancelled')
      `);

      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, {});

      expect(board.summary.cancelled).toBe(1);
      expect(board.summary.claimed).toBe(0);
      expect(tasksByStatus(board.tasks, 'claimed').map((t) => t.id)).not.toContain('task_c1');
      expect(board.claims.map((c) => c.id)).not.toContain('claim_c1');
      expect(board.workload['agent-1']?.activeClaims ?? 0).toBe(0);
    });

    test('mutation invariant: completed claims are excluded from active buckets and claims list', () => {
      const now = new Date().toISOString();

      sqlite.exec(`
        INSERT INTO appends (id, file_id, append_id, author, type, ref, created_at, content_preview)
        VALUES ('${TEST_FILE_ID}_resp_c1', '${TEST_FILE_ID}', 'resp_c1', 'agent-1', 'response', 'claim_c1', '${now}', 'Done')
      `);

      const board = queryOrchestrationBoard(TEST_WORKSPACE_ID, {});

      expect(board.summary.completed).toBe(2);
      expect(board.summary.claimed).toBe(0);
      expect(tasksByStatus(board.tasks, 'claimed').map((t) => t.id)).not.toContain('task_c1');
      expect(board.claims.map((c) => c.id)).not.toContain('claim_c1');
      expect(board.workload['agent-1']?.activeClaims ?? 0).toBe(0);
    });
  });
});

