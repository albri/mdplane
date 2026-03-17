/**
 * Concurrent Claims Workflow Integration Test
 *
 * Tests claim lifecycle and concurrent access patterns.
 * Reference: apps/server/tests/scenarios/concurrent-claims.test.ts
 *
 * Covered: , , , , 
 * NOT covered (require time mocking): , , 
 *
 * Critical tests:
 * - Race condition: exactly one claim wins (Promise.all)
 * - Claim renewal by holder
 * - Non-holder rejection for renewal/cancel
 * - Claim cancellation
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('34 - Concurrent Claims Workflow', () => {
  let workspace: BootstrappedWorkspace;
  const testPath = '__int_concurrent_claims';

  // Task IDs created during setup
  const taskIds: string[] = [];

  beforeAll(async () => {
    // Bootstrap workspace
    workspace = await bootstrap();

    // Create file
    const content = `# Concurrent Claims Test\n\n## Tasks\n`;
    const createRes = await apiRequest('PUT', `/w/${workspace.writeKey}/${testPath}`, {
      body: { content },
    });
    if (createRes.status !== 201) {
      throw new Error(`Failed to create file: ${createRes.status}`);
    }

    // Create 10 tasks for our tests
    for (let i = 1; i <= 10; i++) {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: {
          type: 'task',
          author: 'test-setup',
          content: `Task ${i}: Test task for claiming`,
          priority: 'medium',
        },
      });
      if (response.status !== 201) {
        throw new Error(`Failed to create task ${i}: ${response.status}`);
      }
      const data = await response.json();
      taskIds.push(data.data.id);
    }
  });

  afterAll(async () => {
    // Cleanup: delete test file
    await apiRequest('DELETE', `/w/${workspace.writeKey}/${testPath}`);
  });

  test('setup: tasks created successfully', () => {
    expect(taskIds.length).toBe(10);
    expect(taskIds[0]).toMatch(/^a\d+$/);
  });

  describe('Successful Claim', () => {
    test('agent claims unclaimed task → 201', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: {
          type: 'claim',
          ref: taskIds[0],
          author: 'agent-alice',
          expiresInSeconds: 300,
        },
      });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.serverTime).toBeDefined(); // Required per OpenAPI AppendResponse
      expect(data.data.type).toBe('claim');
      expect(data.data.author).toBe('agent-alice');
      expect(data.data.ref).toBe(taskIds[0]);
      expect(data.data.expiresAt).toBeDefined();
      expect(data.data.expiresInSeconds).toBeDefined(); // Required per OpenAPI SingleAppendResult
      expect(typeof data.data.expiresInSeconds).toBe('number');
    });

    test('claim response includes all required fields', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: {
          type: 'claim',
          ref: taskIds[1],
          author: 'agent-bob',
          expiresInSeconds: 120,
        },
      });
      expect(response.status).toBe(201);
      const data = await response.json();
      // Required fields per OpenAPI AppendResponse
      expect(data.ok).toBe(true);
      expect(data.serverTime).toBeDefined();
      // Required fields per OpenAPI SingleAppendResult
      expect(data.data.id).toBeDefined();
      expect(data.data.id).toMatch(/^a\d+$/);
      expect(data.data.type).toBe('claim');
      expect(data.data.author).toBe('agent-bob');
      expect(data.data.ts).toBeDefined();
      expect(data.data.ref).toBe(taskIds[1]);
      expect(data.data.expiresAt).toBeDefined();
      expect(data.data.expiresInSeconds).toBeDefined();
      // Verify expiresAt is a valid future timestamp
      const expiresAt = new Date(data.data.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Already Claimed', () => {
    test('agent claims already-claimed task → 409', async () => {
      // First claim succeeds
      const firstClaim = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: {
          type: 'claim',
          ref: taskIds[2],
          author: 'agent-first',
          expiresInSeconds: 300,
        },
      });
      expect(firstClaim.status).toBe(201);

      // Second claim fails with 409
      const secondClaim = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: {
          type: 'claim',
          ref: taskIds[2],
          author: 'agent-second',
          expiresInSeconds: 300,
        },
      });
      expect(secondClaim.status).toBe(409);
      const data = await secondClaim.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('ALREADY_CLAIMED');
    });
  });

  describe('Race Condition', () => {
    test('two agents claim same task with Promise.all() - exactly one wins', async () => {
      // Use taskIds[3] for this race
      const [res1, res2] = await Promise.all([
        apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
          body: {
            type: 'claim',
            ref: taskIds[3],
            author: 'agent-racer-1',
            expiresInSeconds: 300,
          },
        }),
        apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
          body: {
            type: 'claim',
            ref: taskIds[3],
            author: 'agent-racer-2',
            expiresInSeconds: 300,
          },
        }),
      ]);

      // Exactly one 201, one 409
      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);
    });

    test('three concurrent claims - exactly one wins', async () => {
      // Use taskIds[4] for this race
      const [res1, res2, res3] = await Promise.all([
        apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
          body: { type: 'claim', ref: taskIds[4], author: 'agent-1', expiresInSeconds: 300 },
        }),
        apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
          body: { type: 'claim', ref: taskIds[4], author: 'agent-2', expiresInSeconds: 300 },
        }),
        apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
          body: { type: 'claim', ref: taskIds[4], author: 'agent-3', expiresInSeconds: 300 },
        }),
      ]);

      const statuses = [res1.status, res2.status, res3.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409]);
    });

    test('winner gets correct claim data, loser gets ALREADY_CLAIMED', async () => {
      // Use taskIds[5] for this race
      const [res1, res2] = await Promise.all([
        apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
          body: { type: 'claim', ref: taskIds[5], author: 'agent-alpha', expiresInSeconds: 300 },
        }),
        apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
          body: { type: 'claim', ref: taskIds[5], author: 'agent-beta', expiresInSeconds: 300 },
        }),
      ]);

      const [body1, body2] = await Promise.all([res1.json(), res2.json()]);
      const winner = res1.status === 201 ? body1 : body2;
      const loser = res1.status === 409 ? body1 : body2;

      expect(winner.ok).toBe(true);
      expect(winner.data.type).toBe('claim');
      expect(winner.data.expiresAt).toBeDefined();

      expect(loser.ok).toBe(false);
      expect(loser.error.code).toBe('ALREADY_CLAIMED');
    });
  });

  describe('Claim Renewal', () => {
    test('claim holder can renew their claim', async () => {
      // Use taskIds[6] for renewal test
      const claimRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'claim', ref: taskIds[6], author: 'agent-renewer', expiresInSeconds: 60 },
      });
      expect(claimRes.status).toBe(201);
      const claimData = await claimRes.json();
      const claimId = claimData.data.id; // Get claim ID
      const originalExpiry = new Date(claimData.data.expiresAt).getTime();

      // Renew claim with longer expiry using 'renew' type - ref is CLAIM ID
      const renewRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'renew', ref: claimId, author: 'agent-renewer', expiresInSeconds: 300 },
      });
      // Renewal should succeed
      expect(renewRes.status).toBe(201);
      const renewData = await renewRes.json();
      const newExpiry = new Date(renewData.data.expiresAt).getTime();
      expect(newExpiry).toBeGreaterThan(originalExpiry);
    });
  });

  describe('Complete Task', () => {
    test('claim holder can complete task with response', async () => {
      // Use taskIds[7] for completion test
      const claimRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'claim', ref: taskIds[7], author: 'agent-completer', expiresInSeconds: 300 },
      });
      expect(claimRes.status).toBe(201);

      // Complete with response
      const responseRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: {
          type: 'response',
          ref: taskIds[7],
          author: 'agent-completer',
          content: 'Task completed successfully!',
        },
      });
      expect(responseRes.status).toBe(201);
      const data = await responseRes.json();
      expect(data.ok).toBe(true);
      expect(data.data.type).toBe('response');
      expect(data.data.ref).toBe(taskIds[7]);
      // Note: content is stored but not returned in SingleAppendResult per OpenAPI spec
    });

    test('non-holder cannot renew others claim', async () => {
      // Use taskIds[8] for protection test
      const claimRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'claim', ref: taskIds[8], author: 'agent-holder', expiresInSeconds: 300 },
      });
      expect(claimRes.status).toBe(201);
      const claimData = await claimRes.json();
      const claimId = claimData.data.id;

      // Different agent tries to renew claim
      const renewRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: {
          type: 'renew',
          ref: claimId,
          author: 'agent-intruder',
          expiresInSeconds: 300,
        },
      });
      // Should fail - cannot renew others' claim
      expect(renewRes.status).toBe(400);
      const data = await renewRes.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('CANNOT_RENEW_OTHERS_CLAIM');
    });

    test('claim holder can cancel their claim', async () => {
      // Use taskIds[9] for cancel test
      const claimRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'claim', ref: taskIds[9], author: 'agent-canceller', expiresInSeconds: 300 },
      });
      expect(claimRes.status).toBe(201);
      const claimData = await claimRes.json();
      const claimId = claimData.data.id;

      // Cancel claim
      const cancelRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'cancel', ref: claimId, author: 'agent-canceller' },
      });
      expect(cancelRes.status).toBe(201);
      const cancelData = await cancelRes.json();
      expect(cancelData.ok).toBe(true);
      expect(cancelData.data.type).toBe('cancel');
      expect(cancelData.data.taskStatus).toBe('open'); // Task is now open for others
    });

    test('non-holder cannot cancel others claim', async () => {
      // First create a new task for this test (we've used all 10)
      const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'task', author: 'test-setup', content: 'Extra task for cancel test', priority: 'medium' },
      });
      expect(taskRes.status).toBe(201);
      const taskData = await taskRes.json();
      const extraTaskId = taskData.data.id;

      // Claim it
      const claimRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'claim', ref: extraTaskId, author: 'agent-owner', expiresInSeconds: 300 },
      });
      expect(claimRes.status).toBe(201);
      const claimData = await claimRes.json();
      const claimId = claimData.data.id;

      // Different agent tries to cancel
      const cancelRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'cancel', ref: claimId, author: 'agent-meddler' },
      });
      expect(cancelRes.status).toBe(400);
      const data = await cancelRes.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('CANNOT_CANCEL_OTHERS_CLAIM');
    });
  });

  describe('Audit Trail', () => {
    test('file contains all claims, responses, renewals, and cancellations', async () => {
      const response = await apiRequest(
        'GET',
        `/r/${workspace.readKey}/${testPath}?format=parsed&appends=100`
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.appends).toBeDefined();
      expect(Array.isArray(data.data.appends)).toBe(true);
      // Should have multiple appends from our tests
      expect(data.data.appends.length).toBeGreaterThan(10);
      // Verify we have all append types from our tests
      const types = data.data.appends.map((a: { type: string }) => a.type);
      expect(types).toContain('task');
      expect(types).toContain('claim');
      expect(types).toContain('response');
      expect(types).toContain('renew');
      expect(types).toContain('cancel');
    });
  });
});

