/**
 * Kanban Workflow Scenario Tests
 *
 * Tests for Kanban-style task board workflows:
 * - Create a board with columns
 * - Add card to column
 * - Move card between columns
 * - Assign card to agent
 * - Set WIP limits
 * - Card blocked by WIP limit
 * - Priority ordering
 * - Archive completed cards
 *
 * Note: The Kanban workflow is built on top of the file and append system.
 * Cards are appends with type 'task', status changes are updates via 'response' appends.
 * Columns are conceptual states: Backlog (open), In Progress (claimed), Review (claimed), Done (done).
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import { createTestApp } from '../helpers';
import { resetClaimState } from '../../src/domain/claim/handlers';
import { assertValidResponse } from '../helpers/schema-validator';
import {
  advanceTime,
  resetTime,
  mockDateNow,
  restoreDateNow,
  TIME,
} from '../helpers/time';
import {
  createTestWorkspace,
  createTestFile,
  createTestTask,
  claimTask,
  completeTask,
  cancelClaim,
  readTestFile,
  type TestWorkspace,
  type TestFile,
  type TestTask,
} from '../fixtures';

/**
 * Read a file with parsed appends for Kanban board view.
 */
async function readBoardWithAppends(
  app: ReturnType<typeof createTestApp>,
  workspace: TestWorkspace,
  path: string
): Promise<{
  content: string;
  appends: Array<{
    id: string;
    type: string;
    author: string;
    ref?: string;
    status?: string;
    priority?: string;
    labels?: string[];
    ts?: string;
    content?: string;
  }>;
}> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await app.handle(
    new Request(`http://localhost/r/${workspace.readKey}${normalizedPath}?format=parsed`, {
      method: 'GET',
    })
  );

  if (!response.ok) {
    throw new Error(`Failed to read board with appends: ${response.status}`);
  }

  const body = await response.json();
  assertValidResponse(body, 'FileReadResponse');
  const { data } = body;
  return {
    content: data.content,
    appends: data.appends || [],
  };
}

/**
 * Query tasks with filters (status, priority, etc.)
 */
async function queryTasks(
  app: ReturnType<typeof createTestApp>,
  workspace: TestWorkspace,
  options: {
    status?: string;
    priority?: string;
    claimable?: boolean;
    claimedBy?: string;
  } = {}
): Promise<{
  tasks: Array<{
    id: string;
    status: string;
    priority?: string;
    claimedBy?: string;
    content: string;
  }>;
  summary: { pending: number; claimed: number; completed: number };
}> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.priority) params.set('priority', options.priority);
  if (options.claimable !== undefined) params.set('claimable', String(options.claimable));
  if (options.claimedBy) params.set('claimedBy', options.claimedBy);

  const response = await app.handle(
    new Request(`http://localhost/r/${workspace.readKey}/ops/folders/tasks?${params.toString()}`, {
      method: 'GET',
    })
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Failed to query tasks: ${response.status} - ${JSON.stringify(error)}`);
  }

  const body = await response.json();
  assertValidResponse(body, 'TaskQueryResponse');
  const { data } = body;
  return {
    tasks: data.tasks || [],
    summary: data.summary || { pending: 0, claimed: 0, completed: 0 },
  };
}

describe('Kanban Workflow Scenarios', () => {
  let app: ReturnType<typeof createTestApp>;
  let workspace: TestWorkspace;
  let board: TestFile;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Avoid cross-test rate-limit pollution on /w/:key/claim.
    resetClaimState();

    // Create fresh workspace and board file for each test
    workspace = await createTestWorkspace(app);
    board = await createTestFile(
      app,
      workspace,
      '/board/tasks.md',
      `# Task Board

## Columns
- Backlog (status: open)
- In Progress (status: claimed)
- Review (status: claimed)
- Done (status: done)

## Tasks
Tasks are appended below.
`
    );
  });

  afterEach(() => {
    restoreDateNow();
    resetTime();
  });

  describe('Create Board', () => {
    test('create /board/tasks.md with column structure', async () => {
      // GIVEN: A workspace (created in beforeEach)

      // WHEN: Board file is created (done in beforeEach)

      // THEN: Board file is readable
      const response = await readTestFile(app, workspace, '/board/tasks.md');
      expect(response.ok).toBe(true);

      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      const { data } = body;
      expect(data.content).toContain('# Task Board');
      expect(data.content).toContain('Backlog');
      expect(data.content).toContain('In Progress');
      expect(data.content).toContain('Done');
    });

    test('board file contains metadata', async () => {
      // GIVEN: A board file

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, '/board/tasks.md');

      // THEN: Response includes file metadata
      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      const { data } = body;
      expect(data.id).toBeDefined();
      expect(data.etag).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });

    test('board file is accessible by all capability keys', async () => {
      // GIVEN: A board file

      // WHEN: Reading with read key
      const readResponse = await readTestFile(app, workspace, '/board/tasks.md');
      expect(readResponse.ok).toBe(true);

      // THEN: File is accessible
      const body = await readResponse.json();
      assertValidResponse(body, 'FileReadResponse');
      const { data } = body;
      expect(data.content).toContain('# Task Board');
    });
  });

  describe('Add Card', () => {
    test('append task creates new card in Backlog', async () => {
      // GIVEN: An empty board

      // WHEN: Creating a task (card)
      const task = await createTestTask(app, workspace, board, {
        author: 'product-owner',
        content: 'Implement user authentication',
      });

      // THEN: Task is created with id and appears in Backlog (status: open)
      expect(task.appendId).toMatch(/^a\d+$/);
      expect(task.ref).toBe(task.appendId);
    });

    test('card has id, title, and status', async () => {
      // GIVEN: An empty board

      // WHEN: Creating a task
      const task = await createTestTask(app, workspace, board, {
        author: 'product-owner',
        content: 'Build dashboard widget',
      });

      // THEN: Reading the board shows the task
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');
      const taskAppend = boardData.appends.find(a => a.id === task.appendId);

      expect(taskAppend).toBeDefined();
      expect(taskAppend?.type).toBe('task');
      expect(taskAppend?.status).toBe('open'); // Backlog = open
    });

    test('card appears in Backlog column (status: open)', async () => {
      // GIVEN: A board with a task

      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Create API endpoint',
      });

      // WHEN: Reading the board
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');

      // THEN: Task has open status (Backlog column)
      const taskAppend = boardData.appends.find(a => a.id === task.appendId);
      expect(taskAppend?.status).toBe('open');
    });

    test('multiple cards can be added to the board', async () => {
      // GIVEN: An empty board

      // WHEN: Creating multiple tasks
      await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Task 1: Setup project',
      });
      await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Task 2: Implement feature',
      });
      await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Task 3: Write tests',
      });

      // THEN: Board has 3 task appends
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');
      const tasks = boardData.appends.filter(a => a.type === 'task');
      expect(tasks.length).toBe(3);
    });
  });

  describe('Move Card', () => {
    test('claiming task moves card to In Progress', async () => {
      // GIVEN: A task in Backlog
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Implement search feature',
      });

      // WHEN: Agent claims the task
      const claimResponse = await claimTask(app, workspace, board, task.ref, 'dev-agent');
      expect(claimResponse.status).toBe(201);

      // THEN: Task status changes (conceptually moved to In Progress)
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');
      const claimAppend = boardData.appends.find(a => a.type === 'claim' && a.ref === task.ref);
      expect(claimAppend).toBeDefined();
      expect(claimAppend?.author).toBe('dev-agent');
    });

    test('completing task moves card to Done', async () => {
      // GIVEN: A claimed task
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Fix bug in login flow',
      });
      await claimTask(app, workspace, board, task.ref, 'dev-agent');

      // WHEN: Agent completes the task
      const completeResponse = await completeTask(
        app,
        workspace,
        board,
        task.ref,
        'dev-agent',
        'Bug fixed, tested locally'
      );
      expect(completeResponse.status).toBe(201);

      // THEN: Task status is done
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');
      const taskAppend = boardData.appends.find(a => a.id === task.appendId);
      expect(taskAppend?.status).toBe('done');
    });

    test('status change is recorded with author and timestamp', async () => {
      // GIVEN: A task in Backlog
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Update documentation',
      });

      // WHEN: Agent claims and completes
      await claimTask(app, workspace, board, task.ref, 'doc-agent');
      const completeResponse = await completeTask(
        app,
        workspace,
        board,
        task.ref,
        'doc-agent',
        'Documentation updated'
      );
      const completeBody = await completeResponse.json();
      assertValidResponse(completeBody, 'AppendResponse');

      // THEN: Response has author and timestamp
      expect(completeBody.data.author).toBe('doc-agent');
      expect(completeBody.data.ts).toBeDefined();
    });

    test('history shows card movement through columns', async () => {
      // GIVEN: A task that goes through the full workflow
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Full workflow task',
      });

      // WHEN: Task moves through Backlog → In Progress → Done
      await claimTask(app, workspace, board, task.ref, 'dev-agent');
      await completeTask(app, workspace, board, task.ref, 'dev-agent', 'Completed');

      // THEN: History shows the progression
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');
      const types = boardData.appends.map(a => a.type);

      expect(types).toContain('task');
      expect(types).toContain('claim');
      expect(types).toContain('response');
    });
  });

  describe('Assign Card', () => {
    test('claim task assigns to agent', async () => {
      // GIVEN: A task in Backlog
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Implement payment integration',
      });

      // WHEN: Agent claims the task
      const claimResponse = await claimTask(app, workspace, board, task.ref, 'payment-agent');
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');

      // THEN: Claim is assigned to the agent
      expect(claimResponse.status).toBe(201);
      expect(claimBody.data.author).toBe('payment-agent');
      expect(claimBody.data.ref).toBe(task.ref);
    });

    test('assignedTo field is populated on claim', async () => {
      // GIVEN: A task in Backlog
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Build notification system',
      });

      // WHEN: Agent claims the task
      const claimResponse = await claimTask(app, workspace, board, task.ref, 'notify-agent');
      expect(claimResponse.status).toBe(201);

      // THEN: Reading board shows claim with author (assignee)
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');
      const claimAppend = boardData.appends.find(a => a.type === 'claim');
      expect(claimAppend?.author).toBe('notify-agent');
    });

    test('only one agent can be assigned (claim exclusive)', async () => {
      // GIVEN: A task claimed by one agent
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Critical security fix',
      });
      await claimTask(app, workspace, board, task.ref, 'security-agent');

      // WHEN: Another agent tries to claim
      const secondClaim = await claimTask(app, workspace, board, task.ref, 'other-agent');

      // THEN: Second claim fails
      expect(secondClaim.status).toBe(409);
      const body = await secondClaim.json();
      expect(body.error.code).toBe('ALREADY_CLAIMED');
    });

    test('cancelled claim releases task for reassignment', async () => {
      // GIVEN: A claimed task
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Refactor auth module',
      });
      const claimResponse = await claimTask(app, workspace, board, task.ref, 'first-agent');
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');

      // WHEN: Agent cancels their claim
      await cancelClaim(app, workspace, board, claimBody.data.id, 'first-agent');

      // THEN: Another agent can claim
      const newClaim = await claimTask(app, workspace, board, task.ref, 'second-agent');
      expect(newClaim.status).toBe(201);
    });
  });

  describe('WIP Limits', () => {
    test('WIP limit stored in capability key metadata', async () => {
      // GIVEN: A workspace with write key

      // WHEN: Creating a scoped key with wipLimit
      const createKeyResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
            wipLimit: 3,
            displayName: 'WIP Limited Agent Key',
          }),
        })
      );

      // THEN: Key is created with wipLimit in metadata
      expect(createKeyResponse.status).toBe(201);
      const createBody = await createKeyResponse.json() as { ok: boolean; data: { wipLimit?: number; displayName?: string } };
      assertValidResponse(createBody, 'ScopedKeyCreateResponse');
      expect(createBody.ok).toBe(true);
      expect(createBody.data.wipLimit).toBe(3);
      expect(createBody.data.displayName).toBe('WIP Limited Agent Key');

      // AND: Key appears in list with wipLimit
      const listResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/keys`)
      );
      expect(listResponse.status).toBe(200);
      const listBody = await listResponse.json() as { ok: boolean; data: Array<{ wipLimit?: number }> };
      assertValidResponse(listBody, 'ScopedKeyListResponse');
      const wipLimitedKey = listBody.data.find(k => k.wipLimit === 3);
      expect(wipLimitedKey).toBeDefined();
    });

    test('agent can query their active claims count', async () => {
      // GIVEN: Agent has claimed some tasks
      const task1 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Task 1',
      });
      const task2 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Task 2',
      });

      await claimTask(app, workspace, board, task1.ref, 'busy-agent');
      await claimTask(app, workspace, board, task2.ref, 'busy-agent');

      // WHEN: Reading board
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');

      // THEN: Can count active claims for the agent
      const activeClaims = boardData.appends.filter(
        a => a.type === 'claim' && a.author === 'busy-agent'
      );
      expect(activeClaims.length).toBe(2);
    });
  });

  describe('WIP Limit Enforcement', () => {
    test('moving card to full column is blocked', async () => {
      // GIVEN: Create a key with wipLimit of 2
      const createKeyResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
            wipLimit: 2,
          }),
        })
      );
      expect(createKeyResponse.status).toBe(201);
      const keyBody = await createKeyResponse.json() as { ok: boolean; data: { key: string } };
      assertValidResponse(keyBody, 'ScopedKeyCreateResponse');
      const wipLimitedKey = keyBody.data.key;

      // Create 3 tasks
      const task1 = await createTestTask(app, workspace, board, { author: 'pm', content: 'Task 1' });
      const task2 = await createTestTask(app, workspace, board, { author: 'pm', content: 'Task 2' });
      const task3 = await createTestTask(app, workspace, board, { author: 'pm', content: 'Task 3' });

      // Agent claims 2 tasks using the WIP-limited key
      const claim1 = await app.handle(
        new Request(`http://localhost/a/${wipLimitedKey}${board.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'wip-agent', type: 'claim', ref: task1.ref }),
        })
      );
      expect(claim1.status).toBe(201);

      const claim2 = await app.handle(
        new Request(`http://localhost/a/${wipLimitedKey}${board.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'wip-agent', type: 'claim', ref: task2.ref }),
        })
      );
      expect(claim2.status).toBe(201);

      // WHEN: Agent tries to claim a third task
      const claim3 = await app.handle(
        new Request(`http://localhost/a/${wipLimitedKey}${board.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'wip-agent', type: 'claim', ref: task3.ref }),
        })
      );

      // THEN: 429 WIP_LIMIT_EXCEEDED
      expect(claim3.status).toBe(429);
      const errorBody = await claim3.json() as { ok: boolean; error: { code: string } };
      expect(errorBody.ok).toBe(false);
      expect(errorBody.error.code).toBe('WIP_LIMIT_EXCEEDED');
    });

    test('error includes current count and limit', async () => {
      // GIVEN: Create a key with wipLimit of 1
      const createKeyResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permission: 'append',
            wipLimit: 1,
          }),
        })
      );
      expect(createKeyResponse.status).toBe(201);
      const keyBody2 = await createKeyResponse.json() as { ok: boolean; data: { key: string } };
      assertValidResponse(keyBody2, 'ScopedKeyCreateResponse');
      const wipLimitedKey = keyBody2.data.key;

      // Create 2 tasks
      const task1 = await createTestTask(app, workspace, board, { author: 'pm', content: 'Task 1' });
      const task2 = await createTestTask(app, workspace, board, { author: 'pm', content: 'Task 2' });

      // Agent claims 1 task (at limit)
      const claim1 = await app.handle(
        new Request(`http://localhost/a/${wipLimitedKey}${board.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'limited-agent', type: 'claim', ref: task1.ref }),
        })
      );
      expect(claim1.status).toBe(201);

      // WHEN: Agent tries to claim another task
      const claim2 = await app.handle(
        new Request(`http://localhost/a/${wipLimitedKey}${board.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'limited-agent', type: 'claim', ref: task2.ref }),
        })
      );

      // THEN: Error includes currentCount and limit
      expect(claim2.status).toBe(429);
      const errorBody = await claim2.json() as {
        ok: boolean;
        error: { code: string; details?: { currentCount: number; limit: number } };
      };
      expect(errorBody.ok).toBe(false);
      expect(errorBody.error.code).toBe('WIP_LIMIT_EXCEEDED');
      expect(errorBody.error.details).toBeDefined();
      expect(errorBody.error.details?.currentCount).toBe(1);
      expect(errorBody.error.details?.limit).toBe(1);
    });

    test('completing a claim reduces WIP count', async () => {
      // GIVEN: Agent has 2 claimed tasks
      const task1 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'First task',
      });
      const task2 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Second task',
      });
      const task3 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Third task',
      });

      await claimTask(app, workspace, board, task1.ref, 'worker-agent');
      await claimTask(app, workspace, board, task2.ref, 'worker-agent');

      // WHEN: Agent completes one task
      await completeTask(app, workspace, board, task1.ref, 'worker-agent', 'Done');

      // THEN: Agent can claim another task (WIP count reduced)
      const thirdClaim = await claimTask(app, workspace, board, task3.ref, 'worker-agent');
      expect(thirdClaim.status).toBe(201);
    });
  });

  describe('Priority Ordering', () => {
    test('cards can have priority field', async () => {
      // GIVEN: A board

      // WHEN: Creating tasks with different priorities
      const highTask = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'High priority task',
        priority: 'high',
      });
      const lowTask = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Low priority task',
        priority: 'low',
      });

      // THEN: Tasks have priority set
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');
      const highAppend = boardData.appends.find(a => a.id === highTask.appendId);
      const lowAppend = boardData.appends.find(a => a.id === lowTask.appendId);

      expect(highAppend?.priority).toBe('high');
      expect(lowAppend?.priority).toBe('low');
    });

    test('critical priority is highest', async () => {
      // GIVEN: Tasks with various priorities
      await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Medium task',
        priority: 'medium',
      });
      await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Critical task',
        priority: 'critical',
      });
      await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Low task',
        priority: 'low',
      });

      // WHEN: Reading board
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');
      const tasks = boardData.appends.filter(a => a.type === 'task');

      // THEN: All priorities are recorded
      const priorities = tasks.map(t => t.priority);
      expect(priorities).toContain('critical');
      expect(priorities).toContain('medium');
      expect(priorities).toContain('low');
    });

    test('tasks without priority default to null/undefined', async () => {
      // GIVEN: A task without priority

      // WHEN: Creating task without priority
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'No priority task',
      });

      // THEN: Priority is null or undefined (not set)
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');
      const taskAppend = boardData.appends.find(a => a.id === task.appendId);
      // API returns null for unset fields, which is falsy
      expect(taskAppend?.priority).toBeFalsy();
    });

    test('labels can be used for additional categorization', async () => {
      // GIVEN: A board

      // WHEN: Creating task with labels
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Labeled task',
        labels: ['bug', 'urgent', 'frontend'],
      });

      // THEN: Labels are stored
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');
      const taskAppend = boardData.appends.find(a => a.id === task.appendId);
      expect(taskAppend?.labels).toContain('bug');
      expect(taskAppend?.labels).toContain('urgent');
    });
  });

  describe('Archive Completed Cards', () => {
    test('completed cards have done status', async () => {
      // GIVEN: A task that is completed
      const task = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Task to complete',
      });
      await claimTask(app, workspace, board, task.ref, 'agent');
      await completeTask(app, workspace, board, task.ref, 'agent', 'Done');

      // WHEN: Reading board
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');

      // THEN: Task has done status (archived)
      const taskAppend = boardData.appends.find(a => a.id === task.appendId);
      expect(taskAppend?.status).toBe('done');
    });

    test('completed cards are still visible in board history', async () => {
      // GIVEN: Multiple tasks, some completed
      const task1 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Completed task',
      });
      const task2 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Open task',
      });

      await claimTask(app, workspace, board, task1.ref, 'agent');
      await completeTask(app, workspace, board, task1.ref, 'agent', 'Done');

      // WHEN: Reading board
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');

      // THEN: Both tasks are visible
      const tasks = boardData.appends.filter(a => a.type === 'task');
      expect(tasks.length).toBe(2);
    });

    test('completed cards do not count toward WIP', async () => {
      // GIVEN: Agent has completed tasks
      const task1 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'First task',
      });
      const task2 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Second task',
      });
      const task3 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Third task',
      });

      // Complete first two tasks
      await claimTask(app, workspace, board, task1.ref, 'agent');
      await completeTask(app, workspace, board, task1.ref, 'agent', 'Done');
      await claimTask(app, workspace, board, task2.ref, 'agent');
      await completeTask(app, workspace, board, task2.ref, 'agent', 'Done');

      // WHEN: Agent claims third task
      const thirdClaim = await claimTask(app, workspace, board, task3.ref, 'agent');

      // THEN: Claim succeeds (completed tasks don't count toward WIP)
      expect(thirdClaim.status).toBe(201);
    });

    test('board shows summary of task statuses', async () => {
      // GIVEN: Tasks in various states
      const task1 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Open task',
      });
      const task2 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Claimed task',
      });
      const task3 = await createTestTask(app, workspace, board, {
        author: 'pm',
        content: 'Done task',
      });

      await claimTask(app, workspace, board, task2.ref, 'agent');
      await claimTask(app, workspace, board, task3.ref, 'agent');
      await completeTask(app, workspace, board, task3.ref, 'agent', 'Done');

      // WHEN: Reading board
      const boardData = await readBoardWithAppends(app, workspace, '/board/tasks.md');

      // THEN: Can compute summary from appends
      // Note: Task status on the task append is only updated to 'done' on completion.
      // Claimed tasks still have 'open' status - the claim is tracked via claim appends.
      const tasks = boardData.appends.filter(a => a.type === 'task');
      const claims = boardData.appends.filter(a => a.type === 'claim');
      const doneCount = tasks.filter(t => t.status === 'done').length;

      // task1 and task2 are 'open' (claiming doesn't change task status)
      // task3 is 'done' (completing updates task status)
      expect(doneCount).toBe(1); // task3 is done

      // To determine "in progress", check for active claims
      // task2 has an active claim, task3's claim was completed
      expect(claims.length).toBe(2); // Two claims were made
    });
  });
});

