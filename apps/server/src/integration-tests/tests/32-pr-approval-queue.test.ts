/**
 * PR Approval Queue Workflow Integration Tests
 * 
 * Tests multi-agent PR review workflow:
 * 1. Create PR queue file
 * 2. Alice's agent adds PR review request
 * 3. Bob's agent reads queue
 * 4. Bob's agent claims the review task
 * 5. Bob's agent completes review
 * 6. Verify queue state
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('32 - PR Approval Queue Workflow', () => {
  let workspace: BootstrappedWorkspace;
  const QUEUE_PATH = '/__int_pr_queue.md';
  const ALICE_AGENT = '__int_agent_alice';
  const BOB_AGENT = '__int_agent_bob';
  
  let prTaskId: string;

  // Bootstrap workspace
  beforeAll(async () => {
    workspace = await bootstrap();
  });

  // 1. Create PR queue file
  test('create PR queue file', async () => {
    const queueContent = `# PR Review Queue

## Pending Reviews

## In Review

## Completed
`;

    const response = await apiRequest('PUT', `/w/${workspace.writeKey}${QUEUE_PATH}`, {
      body: { content: queueContent },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // 2. Alice's agent adds PR review request
  test('Alice adds PR review request', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${QUEUE_PATH}`, {
      body: {
        author: ALICE_AGENT,
        type: 'task',
        content: 'Please review PR #42: Add user authentication',
        priority: 'high',
        labels: ['pr-review', 'security'],
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
    // Task status is 'open' per OpenAPI spec (not 'pending')
    expect(data.data.status).toBe('open');

    prTaskId = data.data.id;
  });

  // 3. Bob's agent reads queue
  test('Bob reads PR queue', async () => {
    // Use format=parsed to get appends array
    const response = await apiRequest('GET', `/r/${workspace.readKey}${QUEUE_PATH}?format=parsed&appends=100`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.appends).toBeDefined();

    // Find Alice's PR request
    const prRequest = data.data.appends.find((a: any) => a.id === prTaskId);
    expect(prRequest).toBeDefined();
    expect(prRequest.author).toBe(ALICE_AGENT);
    expect(prRequest.content).toContain('PR #42');
  });

  // 4. Bob's agent claims the review task
  test('Bob claims PR review task', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${QUEUE_PATH}`, {
      body: {
        author: BOB_AGENT,
        type: 'claim',
        ref: prTaskId,
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.expiresAt).toBeDefined();
  });

  // 5. Bob's agent completes review with approval
  test('Bob completes PR review with approval', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${QUEUE_PATH}`, {
      body: {
        author: BOB_AGENT,
        type: 'response',
        ref: prTaskId,
        content: 'Approved PR #42 ✓ - LGTM, good security implementation',
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // 6. Verify queue state shows completed review
  test('queue shows completed review', async () => {
    // Use format=parsed to get appends array
    const response = await apiRequest('GET', `/r/${workspace.readKey}${QUEUE_PATH}?format=parsed&appends=100`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.appends).toBeDefined();

    // Should have task, claim, and response
    expect(data.data.appends.length).toBeGreaterThanOrEqual(3);

    // Find the response
    const approval = data.data.appends.find((a: any) =>
      a.type === 'response' && a.ref === prTaskId
    );
    expect(approval).toBeDefined();
    expect(approval.content).toContain('Approved');
  });

  // 7. Alice can see her PR was reviewed
  test('Alice sees PR was reviewed', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}${QUEUE_PATH}?format=parsed`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);

    // Find the original task
    const task = data.data.appends.find((a: any) => a.id === prTaskId);
    expect(task).toBeDefined();
  });

  // 8. Multiple PRs can be queued
  test('multiple PRs can be queued', async () => {
    // Add more PR requests
    const prs = [
      { pr: '#43', desc: 'Fix login bug' },
      { pr: '#44', desc: 'Update dependencies' },
    ];

    for (const { pr, desc } of prs) {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}${QUEUE_PATH}`, {
        body: {
          author: ALICE_AGENT,
          type: 'task',
          content: `Please review PR ${pr}: ${desc}`,
          priority: 'medium',
        },
      });
      expect(response.status).toBe(201);
    }

    // Verify all PRs are in queue
    const listResp = await apiRequest('GET', `/r/${workspace.readKey}${QUEUE_PATH}?format=parsed&appends=100`);
    const listData = await listResp.json();

    const tasks = listData.data.appends.filter((a: any) => a.type === 'task');
    expect(tasks.length).toBeGreaterThanOrEqual(3);
  });

  // 9. Audit trail shows complete workflow
  test('audit trail shows complete workflow', async () => {
    // Use format=parsed to get appends array
    const response = await apiRequest('GET', `/r/${workspace.readKey}${QUEUE_PATH}?format=parsed&appends=100`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.appends).toBeDefined();

    // Verify we have all types
    const types = data.data.appends.map((a: any) => a.type);
    expect(types).toContain('task');
    expect(types).toContain('claim');
    expect(types).toContain('response');

    // Verify both agents participated
    const authors = [...new Set(data.data.appends.map((a: any) => a.author))];
    expect(authors).toContain(ALICE_AGENT);
    expect(authors).toContain(BOB_AGENT);
  });
});
