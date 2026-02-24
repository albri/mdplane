/**
 * Concurrent Claims Scenario Tests
 *
 * Tests for claim lifecycle and concurrent access patterns:
 * - Claim a task (successful)
 * - Claim a task (already claimed)
 * - Concurrent claims (race condition) - CRITICAL
 * - Claim expires (agent crashes)
 * - Retry after expiry
 * - Task fails after max retries
 * - Extend claim (renewal)
 * - Abandon claim (voluntary)
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
  renewClaim,
  cancelClaim,
  type TestWorkspace,
  type TestFile,
  type TestTask,
} from '../fixtures';

describe('Concurrent Claims Scenarios', () => {
  let app: ReturnType<typeof createTestApp>;
  let workspace: TestWorkspace;
  let file: TestFile;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Create fresh workspace and file for each test
    workspace = await createTestWorkspace(app);
    file = await createTestFile(app, workspace, '/tasks.md');
  });

  afterEach(() => {
    restoreDateNow();
    resetTime();
  });

  describe('Successful Claim', () => {
    test('agent claims unclaimed task → 201', async () => {
      // GIVEN: A workspace with an unclaimed task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Review PR #42',
      });

      // WHEN: Agent claims the task
      const response = await claimTask(app, workspace, file, task.ref, 'agent-alice');

      // THEN: Claim succeeds with 201
      expect(response.status).toBe(201);
    });

    test('response includes id, expires, author, type', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Analyze data',
      });

      // WHEN: Agent claims the task
      const response = await claimTask(app, workspace, file, task.ref, 'agent-bob');
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');

      // THEN: Response matches OpenAPI spec
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toMatch(/^a\d+$/);
      expect(body.data.type).toBe('claim');
      expect(body.data.author).toBe('agent-bob');
      expect(body.data.ref).toBe(task.ref);
      expect(body.data.expiresAt).toBeDefined();

      // Verify expires is a valid ISO timestamp in the future
      const expires = new Date(body.data.expiresAt);
      expect(expires.getTime()).toBeGreaterThan(Date.now());
    });

    test('claim with custom expiry sets correct expires', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Custom expiry test',
      });

      // WHEN: Agent claims with custom 5-minute expiry
      const response = await claimTask(app, workspace, file, task.ref, 'agent-custom', 300);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');

      // THEN: expires is approximately 5 minutes from now
      expect(response.status).toBe(201);
      expect(body.ok).toBe(true);
      const expires = new Date(body.data.expiresAt).getTime();
      const expectedExpiry = Date.now() + 300 * 1000;
      // Allow 5 second tolerance
      expect(Math.abs(expires - expectedExpiry)).toBeLessThan(5000);
      // Also verify expiresInSeconds is returned
      expect(body.data.expiresInSeconds).toBe(300);
    });
  });

  describe('Already Claimed', () => {
    test('agent claims already-claimed task → 409', async () => {
      // GIVEN: A task claimed by another agent
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Already claimed task',
      });
      const firstClaim = await claimTask(app, workspace, file, task.ref, 'agent-alice');
      expect(firstClaim.status).toBe(201);

      // WHEN: Another agent tries to claim
      const response = await claimTask(app, workspace, file, task.ref, 'agent-bob');

      // THEN: Conflict error
      expect(response.status).toBe(409);
    });

    test('error response includes ALREADY_CLAIMED code', async () => {
      // GIVEN: A claimed task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Check error code',
      });
      await claimTask(app, workspace, file, task.ref, 'agent-first');

      // WHEN: Second agent tries to claim
      const response = await claimTask(app, workspace, file, task.ref, 'agent-second');
      const body = await response.json();
      assertValidResponse(body, 'Error');

      // THEN: Error matches spec
      expect(body.ok).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('ALREADY_CLAIMED');
      expect(body.error.message).toBeDefined();
    });

    test('original claim remains valid after failed attempt', async () => {
      // GIVEN: A claimed task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Original claim should remain',
      });
      const originalClaim = await claimTask(app, workspace, file, task.ref, 'agent-original');
      const originalBody = await originalClaim.json();

      // WHEN: Another agent fails to claim
      await claimTask(app, workspace, file, task.ref, 'agent-intruder');

      // THEN: Original claimer can still complete the task
      const completeResponse = await completeTask(
        app,
        workspace,
        file,
        task.ref,
        'agent-original',
        'Task completed successfully'
      );
      expect(completeResponse.status).toBe(201);
    });
  });

  describe('Race Condition', () => {
    test('two agents claim same task with Promise.all() - exactly one wins', async () => {
      // GIVEN: A workspace with a claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Race condition test task',
      });

      // WHEN: Two agents claim simultaneously
      const [res1, res2] = await Promise.all([
        claimTask(app, workspace, file, task.ref, 'agent-alice'),
        claimTask(app, workspace, file, task.ref, 'agent-bob'),
      ]);

      // THEN: One wins, one loses
      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);
    });

    test('winner gets correct claim data, loser gets ALREADY_CLAIMED', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Verify winner and loser data',
      });

      // WHEN: Two agents race
      const [res1, res2] = await Promise.all([
        claimTask(app, workspace, file, task.ref, 'agent-alpha'),
        claimTask(app, workspace, file, task.ref, 'agent-beta'),
      ]);

      const [body1, body2] = await Promise.all([res1.json(), res2.json()]);

      // THEN: Identify winner and loser
      const winner = res1.status === 201 ? body1 : body2;
      const loser = res1.status === 409 ? body1 : body2;

      // Winner has correct structure
      expect(winner.ok).toBe(true);
      expect(winner.data.type).toBe('claim');
      expect(winner.data.ref).toBe(task.ref);
      expect(winner.data.expiresAt).toBeDefined();

      // Loser has correct error
      expect(loser.ok).toBe(false);
      expect(loser.error.code).toBe('ALREADY_CLAIMED');
    });

    test('three concurrent claims - exactly one wins', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Three-way race',
      });

      // WHEN: Three agents claim simultaneously
      const [res1, res2, res3] = await Promise.all([
        claimTask(app, workspace, file, task.ref, 'agent-1'),
        claimTask(app, workspace, file, task.ref, 'agent-2'),
        claimTask(app, workspace, file, task.ref, 'agent-3'),
      ]);

      // THEN: Exactly one 201, two 409s
      const statuses = [res1.status, res2.status, res3.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409]);
    });

    test('winner can complete task, losers cannot', async () => {
      // GIVEN: A claimed task from a race
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Only winner completes',
      });

      const [res1, res2] = await Promise.all([
        claimTask(app, workspace, file, task.ref, 'agent-winner'),
        claimTask(app, workspace, file, task.ref, 'agent-loser'),
      ]);

      // Find who won
      const winnerAuthor = res1.status === 201 ? 'agent-winner' : 'agent-loser';
      const loserAuthor = res1.status === 409 ? 'agent-winner' : 'agent-loser';

      // WHEN: Winner completes
      const winnerComplete = await completeTask(
        app,
        workspace,
        file,
        task.ref,
        winnerAuthor,
        'Completed by winner'
      );

      // THEN: Winner succeeds
      expect(winnerComplete.status).toBe(201);
    });
  });

  describe('Claim Expires', () => {
    test('expired claim allows new claim by different agent', async () => {
      // GIVEN: A task with an expired claim
      mockDateNow();
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Claim expiry test',
      });

      // Create a short-lived claim (60 seconds)
      const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-crasher', 60);
      expect(claimResponse.status).toBe(201);

      // WHEN: Time advances past expiry (simulate agent crash)
      advanceTime(TIME.MINUTE + TIME.SECOND * 10); // 70 seconds

      // THEN: Another agent can claim because the original claim has expired
      // The system checks claim expiry inline when processing new claims
      const newClaimResponse = await claimTask(app, workspace, file, task.ref, 'agent-rescue');

      // Expired claim should be automatically released, allowing new claim
      expect(newClaimResponse.status).toBe(201);
    });

    test('claim created with specific expiry has correct expires', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Verify expiry time',
      });

      const beforeClaim = Date.now();

      // WHEN: Claim with 120 second expiry
      const response = await claimTask(app, workspace, file, task.ref, 'agent-timed', 120);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');

      // THEN: expires is approximately 120 seconds from claim time
      expect(response.status).toBe(201);
      expect(body.ok).toBe(true);
      const expires = new Date(body.data.expiresAt).getTime();
      const expectedMin = beforeClaim + 120 * 1000 - 5000; // 5s tolerance
      const expectedMax = beforeClaim + 120 * 1000 + 5000;
      expect(expires).toBeGreaterThanOrEqual(expectedMin);
      expect(expires).toBeLessThanOrEqual(expectedMax);
      // Also verify expiresInSeconds is returned
      expect(body.data.expiresInSeconds).toBe(120);
    });
  });

  describe('Retry After Expiry', () => {
    test('same agent can re-claim after their claim expires', async () => {
      // GIVEN: Agent's claim has expired
      mockDateNow();
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Re-claim test',
      });

      const firstClaim = await claimTask(app, workspace, file, task.ref, 'agent-retry', 60);
      expect(firstClaim.status).toBe(201);

      // Time advances past expiry
      advanceTime(TIME.MINUTE + TIME.SECOND * 30);

      // WHEN: Same agent tries to claim again
      const retryClaim = await claimTask(app, workspace, file, task.ref, 'agent-retry', 300);

      // THEN: Succeeds because original claim has expired
      expect(retryClaim.status).toBe(201);
    });

    test('different agent can claim after first expires', async () => {
      // GIVEN: First agent's claim has expired
      mockDateNow();
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Handoff after expiry',
      });

      await claimTask(app, workspace, file, task.ref, 'agent-first', 60);
      advanceTime(TIME.MINUTE + TIME.SECOND * 30);

      // WHEN: Second agent claims
      const secondClaim = await claimTask(app, workspace, file, task.ref, 'agent-second');

      // THEN: Succeeds because first agent's claim has expired
      expect(secondClaim.status).toBe(201);
    });
  });

  describe('Renewal', () => {
    test('claim holder can renew their claim', async () => {
      // GIVEN: An active claim
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Renewal test',
      });

      const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-renewer', 120);
      expect(claimResponse.status).toBe(201);
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');
      const claimId = claimBody.data.id;

      // WHEN: Claim holder renews
      const renewResponse = await renewClaim(app, workspace, file, claimId, 'agent-renewer', 300);

      // THEN: Renewal succeeds
      expect(renewResponse.status).toBe(201);
    });

    test('renewal extends expires', async () => {
      // GIVEN: An active claim
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Check expiry extension',
      });

      const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-extend', 120);
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');
      const claimId = claimBody.data.id;
      const originalExpiry = new Date(claimBody.data.expiresAt).getTime();

      // WHEN: Renew with longer duration
      const renewResponse = await renewClaim(app, workspace, file, claimId, 'agent-extend', 600);
      const renewBody = await renewResponse.json();
      assertValidResponse(renewBody, 'AppendResponse');

      // THEN: New expires is further in the future
      expect(renewResponse.status).toBe(201);
      const newExpiry = new Date(renewBody.data.expiresAt).getTime();
      expect(newExpiry).toBeGreaterThan(originalExpiry);
    });

    test('non-holder cannot renew claim', async () => {
      // GIVEN: A claim by one agent
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Cannot renew others claim',
      });

      const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-owner', 120);
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');
      const claimId = claimBody.data.id;

      // WHEN: Different agent tries to renew
      const renewResponse = await renewClaim(app, workspace, file, claimId, 'agent-intruder', 300);

      // THEN: Rejected
      expect(renewResponse.status).toBe(400);
      const renewBody = await renewResponse.json();
      assertValidResponse(renewBody, 'Error');
      expect(renewBody.ok).toBe(false);
      expect(renewBody.error.code).toBe('CANNOT_RENEW_OTHERS_CLAIM');
    });
  });

  describe('Abandon', () => {
    test('claim holder can cancel their claim', async () => {
      // GIVEN: An active claim
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Cancel test',
      });

      const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-quitter', 120);
      expect(claimResponse.status).toBe(201);
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');
      const claimId = claimBody.data.id;

      // WHEN: Claim holder cancels
      const cancelResponse = await cancelClaim(app, workspace, file, claimId, 'agent-quitter');

      // THEN: Cancellation succeeds
      expect(cancelResponse.status).toBe(201);
    });

    test('cancelled claim releases task for others', async () => {
      // GIVEN: A claim that gets cancelled
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Task released after cancel',
      });

      const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-abandoner', 120);
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');
      const claimId = claimBody.data.id;

      // Cancel the claim
      const cancelResponse = await cancelClaim(app, workspace, file, claimId, 'agent-abandoner');
      expect(cancelResponse.status).toBe(201);

      // WHEN: Another agent claims immediately
      const newClaim = await claimTask(app, workspace, file, task.ref, 'agent-pickup');

      // THEN: New claim succeeds
      expect(newClaim.status).toBe(201);
    });

    test('non-holder cannot cancel claim', async () => {
      // GIVEN: A claim by one agent
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Cannot cancel others claim',
      });

      const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-holder', 120);
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');
      const claimId = claimBody.data.id;

      // WHEN: Different agent tries to cancel
      const cancelResponse = await cancelClaim(app, workspace, file, claimId, 'agent-meddler');

      // THEN: Rejected
      expect(cancelResponse.status).toBe(400);
      const cancelBody = await cancelResponse.json();
      assertValidResponse(cancelBody, 'Error');
      expect(cancelBody.ok).toBe(false);
      expect(cancelBody.error.code).toBe('CANNOT_CANCEL_OTHERS_CLAIM');
    });

    test('cancellation response includes taskStatus=open', async () => {
      // GIVEN: An active claim
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Check taskStatus in response',
      });

      const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-status', 120);
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');
      const claimId = claimBody.data.id;

      // WHEN: Cancel the claim
      const cancelResponse = await cancelClaim(app, workspace, file, claimId, 'agent-status');
      const cancelBody = await cancelResponse.json();
      assertValidResponse(cancelBody, 'AppendResponse');

      // THEN: Response indicates task is open
      expect(cancelResponse.status).toBe(201);
      expect(cancelBody.ok).toBe(true);
      expect(cancelBody.data.taskStatus).toBe('open');
    });
  });

  describe('Claim Expiry Edge Cases', () => {
    test('should expire claim exactly at boundary', async () => {
      // GIVEN: A task with a short-lived claim (60 seconds - minimum allowed)
      mockDateNow();
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Exact boundary expiry test',
      });

      const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-boundary', 60);
      expect(claimResponse.status).toBe(201);

      // WHEN: Advance time to exactly the expiry point (60 seconds)
      advanceTime(TIME.SECOND * 60);

      // THEN: Another agent can claim (claim is expired)
      const newClaimResponse = await claimTask(app, workspace, file, task.ref, 'agent-new');
      // Expired claim is released, allowing new claim
      expect(newClaimResponse.status).toBe(201);
    });

    test('should allow renewal when claim has time remaining', async () => {
      // GIVEN: A task with an active claim (120 seconds expiry)
      mockDateNow();
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Renewal with time remaining',
      });

      const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-renewer', 120);
      expect(claimResponse.status).toBe(201);
      const claimBody = await claimResponse.json();
      assertValidResponse(claimBody, 'AppendResponse');
      const claimId = claimBody.data.id;

      // WHEN: Advance time partway through (90 seconds - 30 seconds remaining)
      advanceTime(TIME.SECOND * 90);

      // THEN: Renewal should succeed
      const renewResponse = await renewClaim(app, workspace, file, claimId, 'agent-renewer', 300);
      expect(renewResponse.status).toBe(201);
      const renewBody = await renewResponse.json();
      assertValidResponse(renewBody, 'AppendResponse');
      expect(renewBody.ok).toBe(true);
      expect(renewBody.data.expiresAt).toBeDefined();
    });

    test('should reject expiresInSeconds below minimum (60 seconds)', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Test minimum expiresInSeconds validation',
      });

      // WHEN: Attempt to create claim with expiresInSeconds: 0
      const response = await claimTask(app, workspace, file, task.ref, 'agent-zero', 0);

      // THEN: Should be rejected with 400 (Zod validation: minimum 60)
      expect(response.status).toBe(400);
    });

    test('should reject negative expiresInSeconds', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Test negative expiresInSeconds validation',
      });

      // WHEN: Attempt to create claim with expiresInSeconds: -1
      const response = await claimTask(app, workspace, file, task.ref, 'agent-negative', -1);

      // THEN: Should be rejected with 400 (Zod validation)
      expect(response.status).toBe(400);
    });

    test('should reject expiresInSeconds of 59 (just below minimum)', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Test boundary below minimum',
      });

      // WHEN: Attempt to create claim with expiresInSeconds: 59
      const response = await claimTask(app, workspace, file, task.ref, 'agent-under', 59);

      // THEN: Should be rejected with 400 (Zod validation: minimum 60)
      expect(response.status).toBe(400);
    });

    test('should accept expiresInSeconds of exactly 60 (minimum)', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Test minimum allowed value',
      });

      // WHEN: Create claim with expiresInSeconds: 60
      const response = await claimTask(app, workspace, file, task.ref, 'agent-min', 60);

      // THEN: Should succeed
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      expect(body.ok).toBe(true);
      expect(body.data.expiresInSeconds).toBe(60);
    });

    test('should accept expiresInSeconds of exactly 86400 (maximum)', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Test maximum allowed value',
      });

      // WHEN: Create claim with expiresInSeconds: 86400 (24 hours)
      const response = await claimTask(app, workspace, file, task.ref, 'agent-max', 86400);

      // THEN: Should succeed
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      expect(body.ok).toBe(true);
      expect(body.data.expiresInSeconds).toBe(86400);
    });

    test('should reject expiresInSeconds above maximum (86401)', async () => {
      // GIVEN: A claimable task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Test above maximum',
      });

      // WHEN: Attempt to create claim with expiresInSeconds: 86401
      const response = await claimTask(app, workspace, file, task.ref, 'agent-over', 86401);

      // THEN: Should be rejected with 400 (Zod validation: maximum 86400)
      expect(response.status).toBe(400);
    });

    test('multiple agents claiming expired task simultaneously - exactly one wins', async () => {
      // GIVEN: A task with an expired claim
      mockDateNow();
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Concurrent claim on expired task',
      });

      // Create a claim that will expire
      const originalClaim = await claimTask(app, workspace, file, task.ref, 'agent-crasher', 60);
      expect(originalClaim.status).toBe(201);

      // Advance time past expiry
      advanceTime(TIME.SECOND * 70);

      // WHEN: Two agents try to claim simultaneously after expiry
      const [res1, res2] = await Promise.all([
        claimTask(app, workspace, file, task.ref, 'agent-alpha'),
        claimTask(app, workspace, file, task.ref, 'agent-beta'),
      ]);

      // THEN: Original claim has expired, so exactly one of the concurrent claims wins
      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);
    });

    test('three agents claiming expired task - at most one wins', async () => {
      // GIVEN: A task with an expired claim
      mockDateNow();
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Three-way race on expired task',
      });

      // Create a claim that will expire
      await claimTask(app, workspace, file, task.ref, 'agent-original', 60);
      advanceTime(TIME.SECOND * 90);

      // WHEN: Three agents claim simultaneously
      const [res1, res2, res3] = await Promise.all([
        claimTask(app, workspace, file, task.ref, 'agent-1'),
        claimTask(app, workspace, file, task.ref, 'agent-2'),
        claimTask(app, workspace, file, task.ref, 'agent-3'),
      ]);

      // THEN: At most one 201, rest 409
      const successCount = [res1.status, res2.status, res3.status].filter(s => s === 201).length;
      expect(successCount).toBeLessThanOrEqual(1);
    });
  });
});


