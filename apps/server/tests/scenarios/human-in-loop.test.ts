/**
 * Human-in-the-Loop Scenario Tests
 *
 * Tests the complete human review workflow:
 * 1. Agent writes draft to `/drafts/proposal.md`
 * 2. Webhook fires to human's notification endpoint (tested separately)
 * 3. Human reads draft, edits directly
 * 4. Webhook fires to agent's endpoint (tested separately)
 * 5. Agent reads feedback, continues work
 *
 * Tests verify the collaboration API, not actual webhook delivery.
 *
 * @see docs/Use Cases.md - Human reviews agent's work
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { createTestApp } from '../helpers';
import { assertValidResponse } from '../helpers/schema-validator';
import {
  createTestWorkspace,
  createTestFile,
  readTestFile,
  updateTestFile,
  type TestWorkspace,
  type TestFile,
} from '../fixtures';

// Append types used in human-in-the-loop scenarios
const FEEDBACK_TYPES = {
  COMMENT: 'comment',
  TASK: 'task',
  RESPONSE: 'response',
} as const;

// Pattern matchers
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const APPEND_ID_PATTERN = /^a[0-9]+$/;

/**
 * Helper to append content to a file.
 */
async function appendToFile(
  app: ReturnType<typeof createTestApp>,
  workspace: TestWorkspace,
  path: string,
  body: {
    type: string;
    author: string;
    content?: string;
    ref?: string;
    priority?: string;
    labels?: string[];
  }
): Promise<{ status: number; data?: { id: string; ts: string; type: string; author: string } }> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await app.handle(
    new Request(`http://localhost/a/${workspace.appendKey}${normalizedPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

  const responseBody = await response.json();
  assertValidResponse(responseBody, 'AppendResponse');
  return {
    status: response.status,
    data: responseBody.data,
  };
}

/**
 * Read a file with parsed appends (audit trail).
 */
async function readFileWithAppends(
  app: ReturnType<typeof createTestApp>,
  workspace: TestWorkspace,
  path: string
): Promise<{
  content: string;
  appends: Array<{
    id: string;
    type: string;
    author: string;
    content?: string;
    ref?: string;
    status?: string;
    ts?: string;
  }>;
}> {
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

describe('Human-in-the-Loop', () => {
  let app: ReturnType<typeof createTestApp>;
  let workspace: TestWorkspace;
  let draft: TestFile;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Create fresh workspace and draft file for each test
    workspace = await createTestWorkspace(app);
    draft = await createTestFile(
      app,
      workspace,
      '/drafts/proposal.md',
      '# Proposal: New Feature\n\n## Summary\n\nAgent-generated initial draft content.\n'
    );
  });

  describe('Complete Review Flow', () => {
    test('complete draft review and approval cycle', async () => {
      // GIVEN: A workspace with drafts folder (setup in beforeEach)

      // WHEN: Agent marks draft as ready for review
      const statusAppend = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Draft complete. Ready for review.',
      });
      expect(statusAppend.status).toBe(201);

      // AND: Human reviews and adds feedback
      const feedbackAppend = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'Please expand section 2 with more details about implementation.',
      });
      expect(feedbackAppend.status).toBe(201);

      // AND: Agent reads feedback
      const afterFeedback = await readFileWithAppends(app, workspace, draft.path);
      const humanFeedback = afterFeedback.appends.find(
        (a) => a.author === 'human-reviewer' && a.type === 'comment'
      );
      expect(humanFeedback).toBeDefined();
      expect(humanFeedback?.content).toContain('expand section 2');

      // AND: Agent appends revision
      const revisionAppend = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: '## Implementation Details\n\nExpanded content as requested.',
      });
      expect(revisionAppend.status).toBe(201);

      // THEN: Human approves
      const approvalAppend = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'Approved! Ready for publication.',
      });
      expect(approvalAppend.status).toBe(201);

      // AND: Full history is visible
      const finalHistory = await readFileWithAppends(app, workspace, draft.path);
      expect(finalHistory.appends.length).toBeGreaterThanOrEqual(4);
    });

    test('multiple round-trips between agent and human work correctly', async () => {
      // GIVEN: Initial draft

      // WHEN: Multiple feedback rounds
      // Round 1: Agent submits, human provides feedback
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-writer',
        content: 'First draft ready.',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-editor',
        content: 'Needs more detail in introduction.',
      });

      // Round 2: Agent revises, human provides more feedback
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-writer',
        content: 'Revised introduction with more context.',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-editor',
        content: 'Good! Now add a conclusion section.',
      });

      // Round 3: Agent adds conclusion, human approves
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-writer',
        content: 'Added conclusion section.',
      });
      const approval = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-editor',
        content: 'Approved! Excellent work.',
      });

      // THEN: All rounds are tracked
      expect(approval.status).toBe(201);
      const history = await readFileWithAppends(app, workspace, draft.path);

      // Count interactions by author
      const agentComments = history.appends.filter((a) => a.author === 'agent-writer');
      const humanComments = history.appends.filter((a) => a.author === 'human-editor');

      expect(agentComments.length).toBe(3);
      expect(humanComments.length).toBe(3);
    });

    test('human reads draft content correctly', async () => {
      // GIVEN: An agent-created draft
      const draftContent = '# Technical Specification\n\nDetailed technical content here.\n';
      const techDraft = await createTestFile(
        app,
        workspace,
        '/drafts/tech-spec.md',
        draftContent
      );

      // WHEN: Human reads the draft (simulated by using workspace keys)
      const readResponse = await readTestFile(app, workspace, techDraft.path);

      // THEN: Content is accessible
      expect(readResponse.status).toBe(200);
      const body = await readResponse.json();
      assertValidResponse(body, 'FileReadResponse');
      expect(body.data.content).toContain('Technical Specification');
    });
  });

  describe('Feedback Types', () => {
    test('human appends type: comment (inline feedback)', async () => {
      const result = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'This section is well written.',
      });

      expect(result.status).toBe(201);
      expect(result.data?.type).toBe('comment');
    });

    test('human creates type: task for requested changes', async () => {
      const result = await appendToFile(app, workspace, draft.path, {
        type: 'task',
        author: 'human-manager',
        content: 'Add section on error handling',
        priority: 'high',
      });

      expect(result.status).toBe(201);
      expect(result.data?.type).toBe('task');
    });

    test('agent can respond to human feedback', async () => {
      // Human adds feedback as a task
      const task = await appendToFile(app, workspace, draft.path, {
        type: 'task',
        author: 'human-reviewer',
        content: 'Clarify the API examples',
      });
      expect(task.status).toBe(201);

      // Agent responds with completion
      const response = await appendToFile(app, workspace, draft.path, {
        type: 'response',
        author: 'agent-drafter',
        content: 'Clarified examples with code snippets.',
        ref: task.data?.id,
      });

      expect(response.status).toBe(201);
      expect(response.data?.type).toBe('response');
    });

    test('agent can filter appends by type', async () => {
      // Add mixed feedback types
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'General comment.',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'task',
        author: 'human-reviewer',
        content: 'Action item.',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Agent note.',
      });

      // WHEN: Read all appends
      const history = await readFileWithAppends(app, workspace, draft.path);

      // THEN: Can filter by type
      const tasks = history.appends.filter((a) => a.type === 'task');
      const comments = history.appends.filter((a) => a.type === 'comment');

      expect(tasks.length).toBe(1);
      expect(comments.length).toBe(2);
    });
  });

  describe('Access Control', () => {
    test('agent has append access to drafts folder', async () => {
      // Agent can append comments/tasks using append key
      const result = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Agent can append.',
      });

      expect(result.status).toBe(201);
    });

    test('human has write access (full edit)', async () => {
      // Human can update file content using write key
      const updateResponse = await updateTestFile(
        app,
        workspace,
        draft.path,
        '# Proposal: New Feature\n\n## Summary\n\nHuman-edited content with improvements.\n'
      );

      expect(updateResponse.status).toBe(200);

      // Verify content was updated
      const readResponse = await readTestFile(app, workspace, draft.path);
      expect(readResponse.status).toBe(200);
      const body = await readResponse.json();
      assertValidResponse(body, 'FileReadResponse');
      expect(body.data.content).toContain('Human-edited content');
    });

    test('different permission levels work together', async () => {
      // GIVEN: Human has write access, agent has append access

      // WHEN: Human updates the file content
      await updateTestFile(
        app,
        workspace,
        draft.path,
        '# Updated Proposal\n\nHuman rewrote the introduction.\n'
      );

      // AND: Agent appends feedback
      const appendResult = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-assistant',
        content: 'Acknowledged the update.',
      });

      // THEN: Both operations succeed
      expect(appendResult.status).toBe(201);

      const finalRead = await readFileWithAppends(app, workspace, draft.path);
      expect(finalRead.content).toContain('Updated Proposal');
      expect(finalRead.appends.find((a) => a.author === 'agent-assistant')).toBeDefined();
    });

    test('agent cannot delete human feedback (append-only)', async () => {
      // Human adds feedback
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'Important feedback that should not be deleted.',
      });

      // Agent cannot delete the file (would need write key, which agent doesn't have)
      // Using append key for delete operation should fail
      const deleteResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.appendKey}${draft.path}`, {
          method: 'DELETE',
        })
      );

      expect(deleteResponse.status).toBe(404);
      const body = await deleteResponse.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('Conversation History', () => {
    test('all exchanges visible in append history', async () => {
      // Create a conversation
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Message 1',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'Message 2',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Message 3',
      });

      // Read history
      const history = await readFileWithAppends(app, workspace, draft.path);

      // All messages visible
      expect(history.appends.length).toBeGreaterThanOrEqual(3);
      expect(history.appends.find((a) => a.content === 'Message 1')).toBeDefined();
      expect(history.appends.find((a) => a.content === 'Message 2')).toBeDefined();
      expect(history.appends.find((a) => a.content === 'Message 3')).toBeDefined();
    });

    test('clear attribution (agent vs human)', async () => {
      // Add messages from different authors
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-alpha',
        content: 'Agent contribution.',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-bob',
        content: 'Human contribution.',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-beta',
        content: 'Another agent contribution.',
      });

      // Verify clear attribution
      const history = await readFileWithAppends(app, workspace, draft.path);

      for (const append of history.appends) {
        expect(append.author).toBeDefined();
        expect(typeof append.author).toBe('string');
        expect(append.author.length).toBeGreaterThan(0);
      }

      // Can distinguish agent from human by naming convention
      const agentMessages = history.appends.filter((a) => a.author.startsWith('agent-'));
      const humanMessages = history.appends.filter((a) => a.author.startsWith('human-'));

      expect(agentMessages.length).toBeGreaterThanOrEqual(2);
      expect(humanMessages.length).toBeGreaterThanOrEqual(1);
    });

    test('timestamps in chronological order', async () => {
      // Add messages sequentially
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'First message.',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'Second message.',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Third message.',
      });

      // Verify chronological order
      const history = await readFileWithAppends(app, workspace, draft.path);

      // All appends should have timestamps
      for (const append of history.appends) {
        expect(append.ts).toBeDefined();
        expect(append.ts).toMatch(ISO_TIMESTAMP_PATTERN);
      }

      // Verify order (earlier messages have earlier timestamps)
      const timestamps = history.appends.map((a) => new Date(a.ts!).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    test('can follow thread of conversation', async () => {
      // Create a threaded conversation using task/response
      const task = await appendToFile(app, workspace, draft.path, {
        type: 'task',
        author: 'human-manager',
        content: 'Please improve the executive summary.',
      });

      const response = await appendToFile(app, workspace, draft.path, {
        type: 'response',
        author: 'agent-drafter',
        content: 'Done. Added key metrics and outcomes.',
        ref: task.data?.id,
      });

      // Read and follow the thread
      const history = await readFileWithAppends(app, workspace, draft.path);

      const taskAppend = history.appends.find((a) => a.id === task.data?.id);
      const responseAppend = history.appends.find((a) => a.id === response.data?.id);

      expect(taskAppend).toBeDefined();
      expect(responseAppend).toBeDefined();
      expect(responseAppend?.ref).toBe(task.data?.id);
    });

    test('all appends have unique IDs', async () => {
      // Add multiple appends
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-1',
        content: 'A',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-1',
        content: 'B',
      });
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-2',
        content: 'C',
      });

      // Verify unique IDs
      const history = await readFileWithAppends(app, workspace, draft.path);
      const ids = history.appends.map((a) => a.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);

      // All IDs match pattern
      for (const id of ids) {
        expect(id).toMatch(APPEND_ID_PATTERN);
      }
    });
  });

  describe('Draft → Review → Approve Cycle', () => {
    test('draft starts with status: draft', async () => {
      // Agent creates draft and marks initial status
      const statusAppend = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Status: draft. Initial version for internal review.',
      });

      expect(statusAppend.status).toBe(201);

      // Verify status is trackable
      const history = await readFileWithAppends(app, workspace, draft.path);
      const draftStatus = history.appends.find((a) => a.content?.includes('Status: draft'));
      expect(draftStatus).toBeDefined();
    });

    test('human changes status to: under_review', async () => {
      // Agent marks as draft
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Status: draft',
      });

      // Human changes to under_review
      const reviewStatus = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'Status: under_review. Beginning formal review process.',
      });

      expect(reviewStatus.status).toBe(201);

      const history = await readFileWithAppends(app, workspace, draft.path);
      const underReview = history.appends.find((a) => a.content?.includes('Status: under_review'));
      expect(underReview).toBeDefined();
      expect(underReview?.author).toBe('human-reviewer');
    });

    test('human approves: status: approved', async () => {
      // Full lifecycle
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Status: draft',
      });

      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'Status: under_review',
      });

      const approval = await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-approver',
        content: 'Status: approved. Ready for publication.',
      });

      expect(approval.status).toBe(201);

      const history = await readFileWithAppends(app, workspace, draft.path);
      const approved = history.appends.find((a) => a.content?.includes('Status: approved'));
      expect(approved).toBeDefined();
    });

    test('status changes visible to agent', async () => {
      // Human makes status changes
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'Status: needs_revision',
      });

      // Agent reads and sees the status
      const history = await readFileWithAppends(app, workspace, draft.path);
      const latestStatus = history.appends.find((a) =>
        a.author.startsWith('human-') && a.content?.includes('Status:')
      );

      expect(latestStatus).toBeDefined();
      expect(latestStatus?.content).toContain('needs_revision');
    });

    test('timestamps track review timeline', async () => {
      // Create a review timeline
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Status: draft',
      });

      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'Status: under_review',
      });

      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-approver',
        content: 'Status: approved',
      });

      // Verify timeline is trackable
      const history = await readFileWithAppends(app, workspace, draft.path);
      const statusChanges = history.appends.filter((a) => a.content?.includes('Status:'));

      expect(statusChanges.length).toBe(3);

      // Each has a timestamp
      for (const change of statusChanges) {
        expect(change.ts).toBeDefined();
        expect(change.ts).toMatch(ISO_TIMESTAMP_PATTERN);
      }

      // Timeline is in order
      const timestamps = statusChanges.map((a) => new Date(a.ts!).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });

  describe('Integration: Multi-File Collaboration', () => {
    test('agent and human can work on multiple drafts simultaneously', async () => {
      // Create multiple drafts
      const draft1 = await createTestFile(
        app,
        workspace,
        '/drafts/feature-a.md',
        '# Feature A\n\nInitial content.\n'
      );
      const draft2 = await createTestFile(
        app,
        workspace,
        '/drafts/feature-b.md',
        '# Feature B\n\nInitial content.\n'
      );

      // Agent works on draft1, human on draft2
      await appendToFile(app, workspace, draft1.path, {
        type: 'comment',
        author: 'agent-drafter',
        content: 'Added section on API design.',
      });

      await appendToFile(app, workspace, draft2.path, {
        type: 'comment',
        author: 'human-editor',
        content: 'Revised introduction.',
      });

      // Verify isolation
      const history1 = await readFileWithAppends(app, workspace, draft1.path);
      const history2 = await readFileWithAppends(app, workspace, draft2.path);

      expect(history1.appends.find((a) => a.author === 'agent-drafter')).toBeDefined();
      expect(history2.appends.find((a) => a.author === 'human-editor')).toBeDefined();

      // Cross-file: agent work not in draft2, human work not in draft1
      expect(history1.appends.find((a) => a.author === 'human-editor')).toBeUndefined();
      expect(history2.appends.find((a) => a.author === 'agent-drafter')).toBeUndefined();
    });

    test('human feedback on one file does not affect others', async () => {
      const isolatedDraft = await createTestFile(
        app,
        workspace,
        '/drafts/isolated.md',
        '# Isolated Draft\n'
      );

      // Add feedback to main draft
      await appendToFile(app, workspace, draft.path, {
        type: 'comment',
        author: 'human-reviewer',
        content: 'Feedback for main draft.',
      });

      // Isolated draft should have no appends
      const isolatedHistory = await readFileWithAppends(app, workspace, isolatedDraft.path);
      expect(isolatedHistory.appends.length).toBe(0);
    });
  });
});


