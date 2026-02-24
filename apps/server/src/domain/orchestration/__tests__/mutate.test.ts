/**
 * Orchestration Mutation Domain Service Tests
 *
 * Tests verify:
 * - Renew claim extends expiry
 * - Complete claim creates response append
 * - Cancel claim creates cancel append
 * - Block claim creates blocked append
 * - Error cases (not found, invalid state)
 *
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { sqlite } from '../../../db';
import {
  renewClaim,
  completeClaim,
  cancelClaim,
  blockClaim,
} from '../mutate';
import {
  resetOrchestrationDomainWorkspace,
  setupOrchestrationDomainWorkspace,
} from './fixtures/orchestration-domain-fixtures';

const TEST_WORKSPACE_ID = 'ws_mutate_test';
// Deterministic IDs for test isolation
const TEST_FILE_ID = 'file_mutate_test_fixed';
const TEST_TASK_ID = 'task_mutate_test';
const TEST_CLAIM_ID = 'claim_mutate_test';

// These are now constants but keep let for API compatibility with existing tests
let testFileId: string = TEST_FILE_ID;
let testClaimId: string = TEST_CLAIM_ID;
let testTaskId: string = TEST_TASK_ID;

function setupTestFixtures(): void {
  const now = setupOrchestrationDomainWorkspace({
    workspaceId: TEST_WORKSPACE_ID,
    workspaceName: 'Mutate Test Workspace',
    fileId: TEST_FILE_ID,
    filePath: '/tasks.md',
    fileContent: '# Tasks',
  });
  const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

  testFileId = TEST_FILE_ID;

  testTaskId = TEST_TASK_ID;
  sqlite.query(`
    INSERT INTO appends (id, file_id, append_id, author, type, priority, created_at, content_preview)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(`${testFileId}_${testTaskId}`, testFileId, testTaskId, 'user-1', 'task', 'high', now, 'Test task');

  testClaimId = TEST_CLAIM_ID;
  sqlite.query(`
    INSERT INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at, content_preview)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `${testFileId}_${testClaimId}`,
    testFileId,
    testClaimId,
    'agent-1',
    'claim',
    testTaskId,
    'active',
    futureDate,
    now,
    'Claimed'
  );
}

function cleanupTestFixtures(): void {
  resetOrchestrationDomainWorkspace(TEST_WORKSPACE_ID);
}

describe('Orchestration Mutation Domain Service', () => {
  beforeAll(() => {
    setupTestFixtures();
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  describe('renewClaim', () => {
    test('extends claim expiry', async () => {
      const result = await renewClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
        expiresInSeconds: 600,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.claim.expiresInSeconds).toBeGreaterThan(500);
        expect(result.appendId).toBeDefined();
      }
    });

    test('returns error for non-existent claim', async () => {
      const result = await renewClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: 'nonexistent',
        mutationAuthor: 'agent-1',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('APPEND_NOT_FOUND');
      }
    });

    test('allows renewing an expired claim and returns active status', async () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      sqlite.prepare('UPDATE appends SET expires_at = ? WHERE append_id = ?').run(pastDate, testClaimId);

      const result = await renewClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
        expiresInSeconds: 300,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.claim.status).toBe('active');
        expect(result.claim.expiresInSeconds).toBeGreaterThan(0);
      }
    });
  });

  describe('completeClaim', () => {
    test('creates response append', async () => {
      const result = await completeClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
        content: 'Task completed successfully',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.claim.status).toBe('completed');
        expect(result.appendId).toBeDefined();
      }
    });

    test('returns error for non-existent claim', async () => {
      const result = await completeClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: 'nonexistent',
        mutationAuthor: 'agent-1',
      });

      expect(result.ok).toBe(false);
    });

    test('returns INVALID_REQUEST for expired claim', async () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      sqlite.prepare('UPDATE appends SET expires_at = ? WHERE append_id = ?').run(pastDate, testClaimId);

      const result = await completeClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_REQUEST');
      }
    });
  });

  describe('cancelClaim', () => {
    test('creates cancel append', async () => {
      const result = await cancelClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
        reason: 'No longer needed',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.claim.status).toBe('cancelled');
        expect(result.appendId).toBeDefined();
      }
    });

    test('returns INVALID_REQUEST for completed claim', async () => {
      const completeResult = await completeClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
      });
      expect(completeResult.ok).toBe(true);

      const cancelResult = await cancelClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
      });

      expect(cancelResult.ok).toBe(false);
      if (!cancelResult.ok) {
        expect(cancelResult.code).toBe('INVALID_REQUEST');
      }
    });
  });

  describe('blockClaim', () => {
    test('returns INVALID_REQUEST for expired claim', async () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      sqlite.prepare('UPDATE appends SET expires_at = ? WHERE append_id = ?').run(pastDate, testClaimId);

      const result = await blockClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
        reason: 'Dependency unavailable',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_REQUEST');
      }
    });
  });

  describe('mutation ordering', () => {
    test('renew after complete is rejected', async () => {
      const completeResult = await completeClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
      });
      expect(completeResult.ok).toBe(true);

      const renewResult = await renewClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
      });

      expect(renewResult.ok).toBe(false);
      if (!renewResult.ok) {
        expect(renewResult.code).toBe('INVALID_REQUEST');
      }
    });

    test('complete after cancel is rejected', async () => {
      const cancelResult = await cancelClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
        reason: 'No longer needed',
      });
      expect(cancelResult.ok).toBe(true);

      const completeResult = await completeClaim({
        workspaceId: TEST_WORKSPACE_ID,
        claimId: testClaimId,
        mutationAuthor: 'agent-1',
      });

      expect(completeResult.ok).toBe(false);
      if (!completeResult.ok) {
        expect(completeResult.code).toBe('INVALID_REQUEST');
      }
    });
  });
});

