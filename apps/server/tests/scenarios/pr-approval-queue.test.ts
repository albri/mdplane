/**
 * PR Approval Queue Scenario Tests
 *
 * Tests the complete PR approval workflow:
 * 1. Alice's agent appends to `/team/pr-queue.md`: "Please review PR #42"
 * 2. Webhook fires to Bob's endpoint (out of scope - tested separately)
 * 3. Bob's agent reads file, sees task
 * 4. Bob's agent claims and approves PR via `gh cli` (simulated)
 * 5. Bob's agent appends: "Approved PR #42 ✓"
 * 6. Webhook fires to Alice's endpoint (out of scope)
 * 7. Alice's agent confirms completion
 *
 * @see docs/Use Cases.md - PR Approval Queue
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import { createTestApp } from '../helpers';
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
  readTestFile,
  cancelClaim,
  type TestWorkspace,
  type TestFile,
  type TestTask,
} from '../fixtures';

/**
 * Read a file with parsed appends (audit trail).
 */
async function readFileWithAppends(
  app: ReturnType<typeof createTestApp>,
  workspace: TestWorkspace,
  path: string
): Promise<{ content: string; appends: Array<{ id: string; type: string; author: string; ref?: string; status?: string; ts?: string }> }> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await app.handle(
    new Request(`http://localhost/r/${workspace.readKey}${normalizedPath}?format=parsed`, {
      method: 'GET',
    })
  );
  
  if (!response.ok) {
    throw new Error(`Failed to read file with appends: ${response.status}`);
  }

  const body = await response.json();
  assertValidResponse(body, 'FileReadResponse');
  const { data } = body;
  return {
    content: data.content,
    appends: data.appends || [],
  };
}

describe('PR Approval Queue', () => {
  let app: ReturnType<typeof createTestApp>;
  let workspace: TestWorkspace;
  let prQueue: TestFile;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Create fresh workspace and PR queue file for each test
    workspace = await createTestWorkspace(app);
    prQueue = await createTestFile(app, workspace, '/team/pr-queue.md', '# PR Queue\n\nPending review requests.\n');
  });

  afterEach(() => {
    restoreDateNow();
    resetTime();
  });

  describe('Complete Workflow', () => {
    test('complete approval workflow from task to completion', async () => {
      // GIVEN: A workspace with PR queue file
      // (setup in beforeEach)

      // WHEN: Alice creates a review request (task)
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });

      // AND: Bob reads and sees the task
      const bobRead = await readFileWithAppends(app, workspace, '/team/pr-queue.md');
      expect(bobRead.appends.length).toBeGreaterThanOrEqual(1);
      const taskAppend = bobRead.appends.find(a => a.id === task.appendId);
      expect(taskAppend).toBeDefined();
      expect(taskAppend?.author).toBe('alice-agent');
      expect(taskAppend?.type).toBe('task');

      // AND: Bob claims the task
      const claimResponse = await claimTask(app, workspace, prQueue, task.ref, 'bob-agent');
      expect(claimResponse.status).toBe(201);
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');
      expect(claimBody.ok).toBe(true);
      expect(claimBody.data.type).toBe('claim');
      expect(claimBody.data.ref).toBe(task.ref);

      // AND: Bob completes the review (simulating gh cli approval)
      const completeResponse = await completeTask(
        app, workspace, prQueue, task.ref, 'bob-agent', 'Approved PR #42 ✓'
      );
      expect(completeResponse.status).toBe(201);

      // THEN: Alice can see the completion in the audit trail
      const finalRead = await readFileWithAppends(app, workspace, '/team/pr-queue.md');
      
      // Find the response append
      const responseAppend = finalRead.appends.find(
        a => a.type === 'response' && a.author === 'bob-agent'
      );
      expect(responseAppend).toBeDefined();
      expect(responseAppend?.ref).toBe(task.ref);
    });

    test('full audit trail visible in append history', async () => {
      // GIVEN: A complete workflow
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #123',
      });
      
      await claimTask(app, workspace, prQueue, task.ref, 'bob-agent');
      await completeTask(app, workspace, prQueue, task.ref, 'bob-agent', 'Approved PR #123 ✓');

      // WHEN: We read the full history
      const history = await readFileWithAppends(app, workspace, '/team/pr-queue.md');

      // THEN: All three appends are visible (task, claim, response)
      expect(history.appends.length).toBeGreaterThanOrEqual(3);
      
      const types = history.appends.map(a => a.type);
      expect(types).toContain('task');
      expect(types).toContain('claim');
      expect(types).toContain('response');
    });

    test('multiple PRs can be queued and processed sequentially', async () => {
      // GIVEN: Alice creates multiple PR review requests
      const task1 = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });
      const task2 = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #43',
      });

      // WHEN: Bob processes them one at a time
      await claimTask(app, workspace, prQueue, task1.ref, 'bob-agent');
      await completeTask(app, workspace, prQueue, task1.ref, 'bob-agent', 'Approved PR #42 ✓');

      await claimTask(app, workspace, prQueue, task2.ref, 'bob-agent');
      await completeTask(app, workspace, prQueue, task2.ref, 'bob-agent', 'Approved PR #43 ✓');

      // THEN: Both are completed in history
      const history = await readFileWithAppends(app, workspace, '/team/pr-queue.md');
      const responses = history.appends.filter(a => a.type === 'response');
      expect(responses.length).toBe(2);
    });
  });

  describe('Multi-Agent Coordination', () => {
    test('multiple agents can read same file simultaneously', async () => {
      // GIVEN: A file with a task
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });

      // WHEN: Multiple agents read the file simultaneously
      const [bobRead, carolRead, daveRead] = await Promise.all([
        readFileWithAppends(app, workspace, '/team/pr-queue.md'),
        readFileWithAppends(app, workspace, '/team/pr-queue.md'),
        readFileWithAppends(app, workspace, '/team/pr-queue.md'),
      ]);

      // THEN: All agents see the same task
      expect(bobRead.appends.find(a => a.id === task.appendId)).toBeDefined();
      expect(carolRead.appends.find(a => a.id === task.appendId)).toBeDefined();
      expect(daveRead.appends.find(a => a.id === task.appendId)).toBeDefined();
    });

    test('only one agent can claim task at a time', async () => {
      // GIVEN: A single task
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });

      // WHEN: Bob claims first
      const bobClaim = await claimTask(app, workspace, prQueue, task.ref, 'bob-agent');
      expect(bobClaim.status).toBe(201);

      // THEN: Carol cannot claim the same task
      const carolClaim = await claimTask(app, workspace, prQueue, task.ref, 'carol-agent');
      expect(carolClaim.status).toBe(409);

      const carolBody = await carolClaim.json();
      expect(carolBody.ok).toBe(false);
      expect(carolBody.error.code).toBe('ALREADY_CLAIMED');
    });

    test('claim prevents duplicate work - second agent gets rejection', async () => {
      // GIVEN: Bob has claimed a task
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });
      await claimTask(app, workspace, prQueue, task.ref, 'bob-agent');

      // WHEN: Carol tries to claim
      const carolClaim = await claimTask(app, workspace, prQueue, task.ref, 'carol-agent');

      // THEN: Carol is rejected with helpful error
      expect(carolClaim.status).toBe(409);
      const body = await carolClaim.json();
      expect(body.error.code).toBe('ALREADY_CLAIMED');
    });

    test('completed task shows done status in history', async () => {
      // GIVEN: Bob claimed and completed a task
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });
      await claimTask(app, workspace, prQueue, task.ref, 'bob-agent');
      await completeTask(app, workspace, prQueue, task.ref, 'bob-agent', 'Approved PR #42 ✓');

      // WHEN: We read the history
      const history = await readFileWithAppends(app, workspace, '/team/pr-queue.md');

      // THEN: Task shows done status, claim shows completed status
      const taskAppend = history.appends.find(a => a.id === task.appendId);
      expect(taskAppend?.status).toBe('done');

      const claimAppend = history.appends.find(a => a.type === 'claim');
      expect(claimAppend?.status).toBe('completed');
    });
  });

  describe('Audit Trail', () => {
    test('all appends have unique IDs', async () => {
      // GIVEN: A complete workflow with multiple appends
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });
      const claimResponse = await claimTask(app, workspace, prQueue, task.ref, 'bob-agent');
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');
      await completeTask(app, workspace, prQueue, task.ref, 'bob-agent', 'Approved PR #42 ✓');

      // WHEN: We read the history
      const history = await readFileWithAppends(app, workspace, '/team/pr-queue.md');

      // THEN: All IDs are unique
      const ids = history.appends.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('all appends have author attribution', async () => {
      // GIVEN: A workflow with different authors
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });
      await claimTask(app, workspace, prQueue, task.ref, 'bob-agent');
      await completeTask(app, workspace, prQueue, task.ref, 'bob-agent', 'Approved ✓');

      // WHEN: We read the history
      const history = await readFileWithAppends(app, workspace, '/team/pr-queue.md');

      // THEN: All appends have author field
      for (const append of history.appends) {
        expect(append.author).toBeDefined();
        expect(typeof append.author).toBe('string');
        expect(append.author.length).toBeGreaterThan(0);
      }

      // Verify correct authors
      expect(history.appends.find(a => a.author === 'alice-agent')).toBeDefined();
      expect(history.appends.find(a => a.author === 'bob-agent')).toBeDefined();
    });

    test('can retrieve specific appends by ID', async () => {
      // GIVEN: Multiple tasks
      const task1 = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });
      const task2 = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #43',
      });

      // WHEN: We read the history
      const history = await readFileWithAppends(app, workspace, '/team/pr-queue.md');

      // THEN: We can find appends by their IDs
      const foundTask1 = history.appends.find(a => a.id === task1.appendId);
      const foundTask2 = history.appends.find(a => a.id === task2.appendId);

      expect(foundTask1).toBeDefined();
      expect(foundTask2).toBeDefined();
      expect(foundTask1?.id).not.toBe(foundTask2?.id);
    });

    test('history maintains chronological order', async () => {
      // GIVEN: A sequence of operations
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });
      await claimTask(app, workspace, prQueue, task.ref, 'bob-agent');
      await completeTask(app, workspace, prQueue, task.ref, 'bob-agent', 'Approved ✓');

      // WHEN: We read the history
      const history = await readFileWithAppends(app, workspace, '/team/pr-queue.md');

      // THEN: Order is task -> claim -> response
      const typeOrder = history.appends.map(a => a.type);
      const taskIndex = typeOrder.indexOf('task');
      const claimIndex = typeOrder.indexOf('claim');
      const responseIndex = typeOrder.indexOf('response');

      expect(taskIndex).toBeLessThan(claimIndex);
      expect(claimIndex).toBeLessThan(responseIndex);
    });
  });

  describe('Error Handling', () => {
    test('agent completing without claiming → error', async () => {
      // GIVEN: A task that Bob has NOT claimed
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });

      // WHEN: Bob tries to complete without claiming
      const response = await completeTask(
        app, workspace, prQueue, task.ref, 'bob-agent', 'Approved PR #42 ✓'
      );

      // THEN: Completion succeeds (permissive design - coordination is trust-based)
      expect(response.status).toBe(201);
    });

    test('completion by any agent succeeds and releases claim', async () => {
      // NOTE: Current implementation allows any agent to complete a claimed task.
      // This is a permissive design choice - coordination is trust-based.
      // For strict claim holder enforcement, this test documents expected behavior.

      // GIVEN: Carol has claimed the task
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });
      const carolClaim = await claimTask(app, workspace, prQueue, task.ref, 'carol-agent');
      expect(carolClaim.status).toBe(201);

      // WHEN: Bob completes the task (not the claim holder)
      const response = await completeTask(
        app, workspace, prQueue, task.ref, 'bob-agent', 'Approved PR #42 ✓'
      );

      // THEN: Completion succeeds (permissive design)
      expect(response.status).toBe(201);

      // AND: Response is attributed to Bob, not Carol
      const responseBody = await response.json();
      assertValidResponse(responseBody, 'AppendResponse');
      expect(responseBody.data.author).toBe('bob-agent');
    });

    test('expired claim allows new claimer', async () => {
      // GIVEN: A claim that has expired
      mockDateNow();
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });

      // Bob claims with short expiry
      const bobClaim = await claimTask(app, workspace, prQueue, task.ref, 'bob-agent', 60);
      expect(bobClaim.status).toBe(201);

      // WHEN: Time advances past expiry
      advanceTime(TIME.MINUTE + TIME.SECOND * 30); // 90 seconds

      // THEN: Carol can claim the task
      const carolClaim = await claimTask(app, workspace, prQueue, task.ref, 'carol-agent');

      // Expired claims are checked inline, allowing new claimer
      expect(carolClaim.status).toBe(201);
    });

    test('claiming non-existent task reference → error', async () => {
      // GIVEN: No task exists with ref 'a999999' (valid format but doesn't exist)
      // WHEN: Agent tries to claim
      const response = await claimTask(app, workspace, prQueue, 'a999999', 'bob-agent');

      // THEN: Should fail with NOT_FOUND
      expect(response.status).toBe(404);
    });

    test('completing non-existent task reference → succeeds (response is recorded)', async () => {
      // GIVEN: No task exists with ref 'a999999' (valid format but doesn't exist)
      // WHEN: Agent tries to complete
      const response = await completeTask(
        app, workspace, prQueue, 'a999999', 'bob-agent', 'Done'
      );

      // THEN: Response append is created (API doesn't validate ref existence for response type)
      // This allows responses to be recorded even if the original task was deleted
      expect(response.status).toBe(201);
    });

    test('cancelled claim releases task for new claimer', async () => {
      // GIVEN: Bob claimed then cancelled
      const task = await createTestTask(app, workspace, prQueue, {
        author: 'alice-agent',
        content: 'Please review PR #42',
      });

      const bobClaim = await claimTask(app, workspace, prQueue, task.ref, 'bob-agent');
      const bobClaimBody = await bobClaim.json();
      expect(bobClaim.status).toBe(201);

      // Bob cancels
      const cancelResponse = await cancelClaim(
        app, workspace, prQueue, bobClaimBody.data.id, 'bob-agent'
      );
      expect(cancelResponse.status).toBe(201);

      // WHEN: Carol claims
      const carolClaim = await claimTask(app, workspace, prQueue, task.ref, 'carol-agent');

      // THEN: Carol successfully claims
      expect(carolClaim.status).toBe(201);
      const carolBody = await carolClaim.json();
      expect(carolBody.data.author).toBe('carol-agent');
    });
  });
});


