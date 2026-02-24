/**
 * Append Operations Integration Tests
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('08 - Append Operations', () => {
  let workspace: BootstrappedWorkspace;
  const testFileName = `${uniqueName('append')}.md`;
  let appendId: string;

  beforeAll(async () => {
    workspace = await bootstrap();
    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
      body: { content: '# Append Test File\n\nTest file for append operations.' },
    });
  });

  test('POST /a/:key/:path appends to file', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: '__int_test',
        type: 'comment',
        content: 'This is a test comment',
      },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
    appendId = data.data.id;
  });

  test('POST /a/:key/append appends when body.path is provided', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}/append`, {
      body: {
        path: testFileName,
        author: '__int_test_body_path',
        type: 'comment',
        content: 'This uses body.path with a workspace append key',
      },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
  });

  test('POST /w/:key/:path appends with write key', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/${testFileName}`, {
      body: {
        author: '__int_write',
        type: 'comment',
        content: 'Comment via write key',
      },
    });
    expect(response.status).toBe(201);
  });

  test('append as task creates task', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: '__int_task',
        type: 'task',
        content: 'Complete integration test verification',
      },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.data.type).toBe('task');
  });

  test('GET /r/:key/ops/file/append/:id returns append', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/file/append/${appendId}`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.id).toBe(appendId);
    expect(data.data.author).toBe('__int_test');
  });

  test('GET /a/:key/ops/file/stats returns append stats', async () => {
    const response = await apiRequest('GET', `/a/${workspace.appendKey}/ops/file/stats`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data).toBeDefined();
  });

  test('claim type returns expiresAt', async () => {
    const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: '__int_claim_task',
        type: 'task',
        content: 'Task to be claimed for expiry test',
      },
    });
    expect(taskRes.status).toBe(201);
    const taskData = await taskRes.json();
    const taskId = taskData.data.id;

    const claimRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: '__int_claimer',
        type: 'claim',
        ref: taskId,
      },
    });
    expect(claimRes.status).toBe(201);
    const claimData = await claimRes.json();
    expect(claimData.data.expiresAt).toBeDefined();
  });

  test('appends visible in file read', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFileName}?format=parsed&appends=10`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.appends).toBeDefined();
    expect(data.data.appends.length).toBeGreaterThan(0);
  });

  // Additional append type tests
  describe('all append types', () => {
    let taskForResponse: string;
    let taskForBlocked: string;
    let taskForAnswer: string;
    let claimForRenew: string;
    let taskForCancel: string;
    let taskForVote: string;

    test('response type completes a task', async () => {
      // Create a task first
      const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_response_task',
          type: 'task',
          content: 'Task to be completed via response',
        },
      });
      expect(taskRes.status).toBe(201);
      const taskData = await taskRes.json();
      taskForResponse = taskData.data.id;

      // Complete with response
      const responseRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_responder',
          type: 'response',
          ref: taskForResponse,
          content: 'Done! Task completed.',
        },
      });
      expect(responseRes.status).toBe(201);
      const responseData = await responseRes.json();
      expect(responseData.data.type).toBe('response');
      expect(responseData.data.ref).toBe(taskForResponse);
    });

    test('blocked type signals blocker on task', async () => {
      // Create a task first
      const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_blocked_task',
          type: 'task',
          content: 'Task that will be blocked',
        },
      });
      expect(taskRes.status).toBe(201);
      const taskData = await taskRes.json();
      taskForBlocked = taskData.data.id;

      // Mark as blocked
      const blockedRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_blocker',
          type: 'blocked',
          ref: taskForBlocked,
          content: 'Blocked on API design decision',
        },
      });
      expect(blockedRes.status).toBe(201);
      const blockedData = await blockedRes.json();
      expect(blockedData.data.type).toBe('blocked');
      expect(blockedData.data.ref).toBe(taskForBlocked);
    });

    test('answer type responds to a blocked item', async () => {
      // First create a task that will be blocked
      const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_answer_task',
          type: 'task',
          content: 'Task that needs clarification',
        },
      });
      expect(taskRes.status).toBe(201);
      const taskData = await taskRes.json();
      const taskId = taskData.data.id;

      // Block the task with a question
      const blockedRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_questioner',
          type: 'blocked',
          ref: taskId,
          content: 'What is the meaning of life?',
        },
      });
      expect(blockedRes.status).toBe(201);
      const blockedData = await blockedRes.json();
      taskForAnswer = blockedData.data.id;

      // Answer the blocked item
      const answerRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_answerer',
          type: 'answer',
          ref: taskForAnswer,
          content: '42',
        },
      });
      expect(answerRes.status).toBe(201);
      const answerData = await answerRes.json();
      expect(answerData.data.type).toBe('answer');
      expect(answerData.data.ref).toBe(taskForAnswer);
    });

    test('renew type extends claim expiry', async () => {
      // Create a task
      const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_renew_task',
          type: 'task',
          content: 'Task for renew test',
        },
      });
      expect(taskRes.status).toBe(201);
      const taskData = await taskRes.json();
      const taskId = taskData.data.id;

      // Claim it
      const claimRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_renewer',
          type: 'claim',
          ref: taskId,
        },
      });
      expect(claimRes.status).toBe(201);
      const claimData = await claimRes.json();
      claimForRenew = claimData.data.id;
      const originalExpiry = claimData.data.expiresAt;

      // Renew the claim
      const renewRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_renewer',
          type: 'renew',
          ref: claimForRenew,
          content: 'Need more time',
        },
      });
      expect(renewRes.status).toBe(201);
      const renewData = await renewRes.json();
      expect(renewData.data.type).toBe('renew');
      expect(renewData.data.expiresAt).toBeDefined();
      // New expiry should be later than original
      expect(new Date(renewData.data.expiresAt).getTime()).toBeGreaterThan(
        new Date(originalExpiry).getTime()
      );
    });

    test('cancel type cancels a claim', async () => {
      // Create a task
      const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_cancel_task',
          type: 'task',
          content: 'Task with claim to be cancelled',
        },
      });
      expect(taskRes.status).toBe(201);
      const taskData = await taskRes.json();
      const taskId = taskData.data.id;

      // Claim the task
      const claimRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_canceller',
          type: 'claim',
          ref: taskId,
        },
      });
      expect(claimRes.status).toBe(201);
      const claimData = await claimRes.json();
      taskForCancel = claimData.data.id; // This is the claim ID

      // Cancel the claim
      const cancelRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_canceller',
          type: 'cancel',
          ref: taskForCancel,
          content: 'No longer needed',
        },
      });
      expect(cancelRes.status).toBe(201);
      const cancelData = await cancelRes.json();
      expect(cancelData.data.type).toBe('cancel');
      expect(cancelData.data.ref).toBe(taskForCancel);
    });

    test('vote type with +1 value', async () => {
      // Create a task to vote on
      const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_vote_task',
          type: 'task',
          content: 'Task to vote on',
        },
      });
      expect(taskRes.status).toBe(201);
      const taskData = await taskRes.json();
      taskForVote = taskData.data.id;

      // Vote +1
      const voteRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_voter',
          type: 'vote',
          ref: taskForVote,
          value: '+1',
        },
      });
      expect(voteRes.status).toBe(201);
      const voteData = await voteRes.json();
      expect(voteData.data.type).toBe('vote');
      expect(voteData.data.ref).toBe(taskForVote);
    });

    test('vote type with -1 value', async () => {
      // Vote -1 on same task
      const voteRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_voter2',
          type: 'vote',
          ref: taskForVote,
          value: '-1',
        },
      });
      expect(voteRes.status).toBe(201);
      const voteData = await voteRes.json();
      expect(voteData.data.type).toBe('vote');
    });
  });

  // Multi-append tests
  describe('atomic multi-append', () => {
    test('multi-append creates multiple appends atomically', async () => {
      // Create a task first
      const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_multi_task',
          type: 'task',
          content: 'Task for multi-append test',
        },
      });
      expect(taskRes.status).toBe(201);
      const taskData = await taskRes.json();
      const taskId = taskData.data.id;

      // Multi-append: complete task + create follow-up
      // Use the file path endpoint; /append also works when body.path is supplied.
      const multiRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
        body: {
          author: '__int_multi',
          appends: [
            {
              type: 'response',
              ref: taskId,
              content: 'Done!',
            },
            {
              type: 'task',
              content: 'Follow-up task',
            },
          ],
        },
      });
      expect(multiRes.status).toBe(201);
      const multiData = await multiRes.json();
      expect(multiData.ok).toBe(true);
      expect(multiData.data.appends).toBeDefined();
      expect(multiData.data.appends.length).toBe(2);
      expect(multiData.data.appends[0].type).toBe('response');
      expect(multiData.data.appends[1].type).toBe('task');
    });
  });
});

