/**
 * Claims Lifecycle Tests
 *
 * Verify claim/release/renew/expire/concurrency with real timing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { bootstrap, type BootstrappedWorkspace, apiRequest } from '../helpers/api-client';

describe('04 - Claims Lifecycle', () => {
  let workspace: BootstrappedWorkspace;
  const taskFileName = `__int_claims_${Date.now()}.md`;
  let taskAppendId: string;
  let claimAppendId: string;

  beforeAll(async () => {
    workspace = await bootstrap();

    const createResponse = await apiRequest('PUT', `/w/${workspace.writeKey}/${taskFileName}`, {
      body: { content: '# Integration Test Claims\n\nTesting claim lifecycle.' },
    });
    expect(createResponse.status).toBe(201);

    const taskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
      body: {
        author: '__int_orchestrator',
        type: 'task',
        content: 'Test task for claim lifecycle verification',
        priority: 'high',
      },
    });
    expect(taskResponse.status).toBe(201);
    const taskData = await taskResponse.json();
    taskAppendId = taskData.data.id;
  });

  afterAll(async () => {
    await apiRequest('DELETE', `/w/${workspace.writeKey}/${taskFileName}`);
  });

  test('setup: task created successfully', () => {
    expect(taskAppendId).toMatch(/^a\d+$/);
  });

  describe('Claim Lifecycle', () => {
    test('can claim a task with expiresInSeconds=60', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'claim',
          ref: taskAppendId,
          expiresInSeconds: 60,
          content: 'Claiming task for integration test',
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.serverTime).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.type).toBe('claim');
      expect(data.data.author).toBe('__int_agent');
      expect(data.data.ref).toBe(taskAppendId);

      expect(data.data.expiresAt).toBeDefined();
      expect(data.data.expiresInSeconds).toBeDefined();
      expect(typeof data.data.expiresInSeconds).toBe('number');
      expect(data.data.expiresInSeconds).toBe(60);

      const expiresAt = new Date(data.data.expiresAt);
      const now = Date.now();
      expect(expiresAt.getTime()).toBeGreaterThan(now);
      expect(expiresAt.getTime()).toBeLessThan(now + 65_000);

      claimAppendId = data.data.id;
    });

    test('claim shows up in parsed file read', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${taskFileName}?format=parsed&appends=10`);
      expect(response.status).toBe(200);
      const data = await response.json();

      const claimAppend = data.data.appends.find((a: { id: string }) => a.id === claimAppendId);
      expect(claimAppend).toBeDefined();
      expect(claimAppend.type).toBe('claim');
      expect(claimAppend.expiresAt).toBeDefined();
    });

    test('can renew claim (expiresAt increased)', async () => {
      const readResponse = await apiRequest('GET', `/r/${workspace.readKey}/${taskFileName}?format=parsed&appends=10`);
      const readData = await readResponse.json();
      const originalClaim = readData.data.appends.find((a: { id: string }) => a.id === claimAppendId);
      const originalExpiry = new Date(originalClaim.expiresAt).getTime();

      const renewResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'renew',
          ref: claimAppendId,
          expiresInSeconds: 60,
          content: 'Renewing claim for continued work',
        },
      });

      expect(renewResponse.status).toBe(201);
      const renewData = await renewResponse.json();
      expect(renewData.ok).toBe(true);
      expect(renewData.data.type).toBe('renew');
      expect(renewData.data.ref).toBe(claimAppendId);

      const newExpiry = new Date(renewData.data.expiresAt).getTime();
      expect(newExpiry).toBeGreaterThan(originalExpiry);

      const now = Date.now();
      expect(newExpiry).toBeGreaterThan(now);
      expect(newExpiry).toBeLessThan(now + 65_000);
    });

    test('non-holder cannot renew others claim', async () => {
      const newTaskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_orchestrator',
          type: 'task',
          content: 'Task for renew protection test',
        },
      });
      expect(newTaskResponse.status).toBe(201);
      const newTaskData = await newTaskResponse.json();
      const newTaskId = newTaskData.data.id;

      const claimResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'claim',
          ref: newTaskId,
          expiresInSeconds: 300,
        },
      });
      expect(claimResponse.status).toBe(201);
      const claimData = await claimResponse.json();
      const claimId = claimData.data.id;

      const renewResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_intruder',
          type: 'renew',
          ref: claimId,
          expiresInSeconds: 300,
        },
      });

      expect(renewResponse.status).toBe(400);
      const errorData = await renewResponse.json();
      expect(errorData.ok).toBe(false);
      expect(errorData.error.code).toBe('CANNOT_RENEW_OTHERS_CLAIM');
    });

    test('can complete task with response (claim released)', async () => {
      const newTaskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_orchestrator',
          type: 'task',
          content: 'Task for completion test',
        },
      });
      expect(newTaskResponse.status).toBe(201);
      const newTaskData = await newTaskResponse.json();
      const newTaskId = newTaskData.data.id;

      const claimResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'claim',
          ref: newTaskId,
          expiresInSeconds: 60,
        },
      });
      expect(claimResponse.status).toBe(201);

      const responseResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'response',
          ref: newTaskId,
          content: 'Task completed successfully in integration test',
        },
      });

      expect(responseResponse.status).toBe(201);
      const responseData = await responseResponse.json();
      expect(responseData.ok).toBe(true);
      expect(responseData.data.type).toBe('response');
      expect(responseData.data.ref).toBe(newTaskId);

      const fileResponse = await apiRequest('GET', `/r/${workspace.readKey}/${taskFileName}?format=parsed&appends=10`);
      const fileData = await fileResponse.json();

      const taskAppend = fileData.data.appends.find((a: { id: string }) => a.id === newTaskId);
      expect(taskAppend).toBeDefined();
      expect(taskAppend.status).toBe('done');
    });

    test('cannot claim already-completed task', async () => {
      const newTaskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_orchestrator',
          type: 'task',
          content: 'Task for completed claim test',
        },
      });
      expect(newTaskResponse.status).toBe(201);
      const newTaskData = await newTaskResponse.json();
      const completedTaskId = newTaskData.data.id;

      const completeResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'response',
          ref: completedTaskId,
          content: 'Task completed',
        },
      });
      expect(completeResponse.status).toBe(201);

      const claimResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_another_agent',
          type: 'claim',
          ref: completedTaskId,
          content: 'Trying to claim completed task',
        },
      });

      expect(claimResponse.status).toBeGreaterThanOrEqual(400);
      expect(claimResponse.status).toBeLessThan(500);
      const data = await claimResponse.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('TASK_ALREADY_COMPLETE');
    });

    test('claim holder can cancel their claim', async () => {
      const newTaskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_orchestrator',
          type: 'task',
          content: 'Task for cancel test',
        },
      });
      expect(newTaskResponse.status).toBe(201);
      const newTaskData = await newTaskResponse.json();
      const newTaskId = newTaskData.data.id;

      const claimResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'claim',
          ref: newTaskId,
          expiresInSeconds: 300,
        },
      });
      expect(claimResponse.status).toBe(201);
      const claimData = await claimResponse.json();
      const claimId = claimData.data.id;

      const cancelResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'cancel',
          ref: claimId,
          content: 'Cancelling claim - task is no longer needed',
        },
      });

      expect(cancelResponse.status).toBe(201);
      const cancelData = await cancelResponse.json();
      expect(cancelData.ok).toBe(true);
      expect(cancelData.data.type).toBe('cancel');
      expect(cancelData.data.ref).toBe(claimId);

      const fileResponse = await apiRequest('GET', `/r/${workspace.readKey}/${taskFileName}?format=parsed&appends=20`);
      const fileData = await fileResponse.json();

      const taskAppend = fileData.data.appends.find((a: { id: string }) => a.id === newTaskId);
      expect(taskAppend).toBeDefined();
      expect(taskAppend.status).toBe('open');
    });

    test('non-holder cannot cancel others claim', async () => {
      const newTaskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_orchestrator',
          type: 'task',
          content: 'Task for cancel protection test',
        },
      });
      expect(newTaskResponse.status).toBe(201);
      const newTaskData = await newTaskResponse.json();
      const newTaskId = newTaskData.data.id;

      const claimResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'claim',
          ref: newTaskId,
          expiresInSeconds: 300,
        },
      });
      expect(claimResponse.status).toBe(201);
      const claimData = await claimResponse.json();
      const claimId = claimData.data.id;

      const cancelResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_meddler',
          type: 'cancel',
          ref: claimId,
          content: 'Trying to cancel someone elses claim',
        },
      });

      expect(cancelResponse.status).toBe(400);
      const errorData = await cancelResponse.json();
      expect(errorData.ok).toBe(false);
      expect(errorData.error.code).toBe('CANNOT_CANCEL_OTHERS_CLAIM');
    });

    test('append API does not support block/unblock (requires control API)', async () => {
      const blockResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'block',
          ref: claimAppendId,
          content: 'Attempting to block claim',
        },
      });

      expect(blockResponse.status).toBe(400);
      const errorData = await blockResponse.json();
      expect(errorData.ok).toBe(false);
      expect(errorData.error.code).toBe('INVALID_REQUEST');

      const unblockResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_agent',
          type: 'unblock',
          ref: claimAppendId,
          content: 'Attempting to unblock claim',
        },
      });

      expect(unblockResponse.status).toBe(400);
      const unblockErrorData = await unblockResponse.json();
      expect(unblockErrorData.ok).toBe(false);
      expect(unblockErrorData.error.code).toBe('INVALID_REQUEST');
    });
  });

  describe('Claim Expiry', () => {
    test('claim expires after 60 seconds (real timing)', async () => {
      const newTaskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_orchestrator',
          type: 'task',
          content: 'Task for expiry test',
        },
      });
      expect(newTaskResponse.status).toBe(201);
      const newTaskData = await newTaskResponse.json();
      const newTaskId = newTaskData.data.id;

      const claimResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_expiring_agent',
          type: 'claim',
          ref: newTaskId,
          expiresInSeconds: 60,
        },
      });
      expect(claimResponse.status).toBe(201);
      const claimData = await claimResponse.json();
      const claimId = claimData.data.id;

      const startTime = Date.now();
      const maxWaitTime = 90_000;
      const intervalMs = 500;
      let reclaimSucceeded = false;
      let lastError = '';

      while (Date.now() - startTime < maxWaitTime) {
        const reclaimResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
          body: {
            author: '__int_new_agent',
            type: 'claim',
            ref: newTaskId,
            expiresInSeconds: 60,
          },
        });

        if (reclaimResponse.status === 201) {
          reclaimSucceeded = true;
          const reclaimData = await reclaimResponse.json();
          expect(reclaimData.ok).toBe(true);
          expect(reclaimData.data.author).toBe('__int_new_agent');
          break;
        } else if (reclaimResponse.status === 409) {
          lastError = `409 ALREADY_CLAIMED at ${Date.now() - startTime}ms`;
        } else if (reclaimResponse.status >= 500) {
          lastError = `Server error ${reclaimResponse.status} at ${Date.now() - startTime}ms`;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }

      if (!reclaimSucceeded) {
        throw new Error(
          `Claim did not expire within ${maxWaitTime}ms. ` +
          `Last error: ${lastError}. ` +
          `This suggests, the background expiry job may not be running or the API does not expire claims as expected.`
        );
      }
    }, 120_000);
  });

  describe('Concurrent Claims', () => {
    test('two agents claim same task concurrently - exactly one succeeds', async () => {
      const newTaskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_orchestrator',
          type: 'task',
          content: 'Task for concurrency test',
        },
      });
      expect(newTaskResponse.status).toBe(201);
      const newTaskData = await newTaskResponse.json();
      const newTaskId = newTaskData.data.id;

      const [res1, res2] = await Promise.all([
        apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
          body: {
            author: '__int_racer_1',
            type: 'claim',
            ref: newTaskId,
            expiresInSeconds: 300,
          },
        }),
        apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
          body: {
            author: '__int_racer_2',
            type: 'claim',
            ref: newTaskId,
            expiresInSeconds: 300,
          },
        }),
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      const winnerResponse = res1.status === 201 ? res1 : res2;
      const loserResponse = res1.status === 409 ? res1 : res2;

      const winnerData = await winnerResponse.json();
      const loserData = await loserResponse.json();

      expect(winnerData.ok).toBe(true);
      expect(winnerData.data.type).toBe('claim');
      expect(winnerData.data.expiresAt).toBeDefined();

      expect(loserData.ok).toBe(false);
      expect(loserData.error.code).toBe('ALREADY_CLAIMED');
    });

    test('three concurrent claims - exactly one wins', async () => {
      const newTaskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_orchestrator',
          type: 'task',
          content: 'Task for three-way race',
        },
      });
      expect(newTaskResponse.status).toBe(201);
      const newTaskData = await newTaskResponse.json();
      const newTaskId = newTaskData.data.id;

      const [res1, res2, res3] = await Promise.all([
        apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
          body: { type: 'claim', ref: newTaskId, author: 'agent_1', expiresInSeconds: 300 },
        }),
        apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
          body: { type: 'claim', ref: newTaskId, author: 'agent_2', expiresInSeconds: 300 },
        }),
        apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
          body: { type: 'claim', ref: newTaskId, author: 'agent_3', expiresInSeconds: 300 },
        }),
      ]);

      const statuses = [res1.status, res2.status, res3.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409]);
    });

    test('second claim on already-claimed task returns 409 ALREADY_CLAIMED', async () => {
      const newTaskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_orchestrator',
          type: 'task',
          content: 'Task for sequential claim test',
        },
      });
      expect(newTaskResponse.status).toBe(201);
      const newTaskData = await newTaskResponse.json();
      const newTaskId = newTaskData.data.id;

      const firstClaim = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_first',
          type: 'claim',
          ref: newTaskId,
          expiresInSeconds: 300,
        },
      });
      expect(firstClaim.status).toBe(201);

      const secondClaim = await apiRequest('POST', `/a/${workspace.appendKey}/${taskFileName}`, {
        body: {
          author: '__int_second',
          type: 'claim',
          ref: newTaskId,
          expiresInSeconds: 300,
        },
      });

      expect(secondClaim.status).toBe(409);
      const errorData = await secondClaim.json();
      expect(errorData.ok).toBe(false);
      expect(errorData.error.code).toBe('ALREADY_CLAIMED');
    });
  });
});
