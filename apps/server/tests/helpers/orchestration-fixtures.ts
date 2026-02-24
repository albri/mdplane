/**
 * Orchestration Test Fixtures
 *
 * Test-only constants and helper functions for orchestration endpoint tests.
 * Moved from apps/server/src/routes/orchestration.ts to separate test code from production.
 */

import { sqlite, initializeDatabase } from '../../src/db';
import { hashKey, generateKey } from '../../src/core/capability-keys';

// Test keys - must match constants used in tests
export const TEST_READ_KEY = 'orchR8k2mP9qL3nR7mQ2pN4';
export const TEST_APPEND_KEY = 'orchA8k2mP9qL3nR7mQ2pN4';
export const TEST_WRITE_KEY = 'orchW8k2mP9qL3nR7mQ2pN4';
export const TEST_EXPIRED_KEY = 'orchExpired0P9qL3nR7mQ2';
export const TEST_REVOKED_KEY = 'orchRevoked0P9qL3nR7mQ2';

export const TEST_WORKSPACE_ID = 'ws_test_orchestration';

/**
 * Set up test fixtures for orchestration tests.
 * Uses INSERT OR REPLACE for idempotency - safe to call multiple times.
 */
export function setupTestFixtures(): void {
  // Ensure database tables exist
  initializeDatabase();

  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString();

  // Create test workspace
  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${TEST_WORKSPACE_ID}', 'Test Orchestration Workspace', '${now}', '${now}')
  `);

  // Create capability keys for testing
  const keysToInsert = [
    { key: TEST_READ_KEY, permission: 'read', expiresAt: null, revokedAt: null },
    { key: TEST_WRITE_KEY, permission: 'write', expiresAt: null, revokedAt: null },
    { key: TEST_APPEND_KEY, permission: 'append', expiresAt: null, revokedAt: null },
    { key: TEST_EXPIRED_KEY, permission: 'read', expiresAt: pastDate, revokedAt: null },
    { key: TEST_REVOKED_KEY, permission: 'read', expiresAt: null, revokedAt: pastDate },
  ];

  for (const keyData of keysToInsert) {
    const keyHash = hashKey(keyData.key);
    const id = generateKey(16);
    // Delete any existing keys with the same hash to avoid duplicates
    sqlite.exec(`DELETE FROM capability_keys WHERE key_hash = '${keyHash}'`);
    sqlite.exec(`
      INSERT INTO capability_keys (
        id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at, expires_at, revoked_at
      ) VALUES (
        '${id}', '${TEST_WORKSPACE_ID}', '${keyData.key.substring(0, 4)}', '${keyHash}',
        '${keyData.permission}', 'workspace', '/', '${now}',
        ${keyData.expiresAt ? `'${keyData.expiresAt}'` : 'NULL'},
        ${keyData.revokedAt ? `'${keyData.revokedAt}'` : 'NULL'}
      )
    `);
  }

  createTestData();
}

/**
 * Create test data (tasks, claims, heartbeats)
 */
function createTestData(): void {
  const now = new Date().toISOString();
  const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

  // Create a test file
  const testFileId = `file_orch_${generateKey(8)}`;
  sqlite.exec(`
    INSERT OR IGNORE INTO files (id, workspace_id, path, content, created_at, updated_at)
    VALUES ('${testFileId}', '${TEST_WORKSPACE_ID}', '/tasks.md', '# Tasks', '${now}', '${now}')
  `);

  // Get the file ID (in case it already existed)
  const file = sqlite.query(`
    SELECT id FROM files WHERE workspace_id = ? AND path = '/tasks.md' AND deleted_at IS NULL
  `).get(TEST_WORKSPACE_ID) as { id: string } | null;

  if (!file) return;
  const fileId = file.id;

  // Create test appends (tasks and claims)
  const appendsToInsert = [
    // Pending task
    { appendId: 'a1', author: 'user-1', type: 'task', status: null, priority: 'high', ref: null, expiresAt: null },
    // Another pending task
    { appendId: 'a2', author: 'user-2', type: 'task', status: null, priority: 'medium', ref: null, expiresAt: null },
    // Claimed task (has active claim)
    { appendId: 'a3', author: 'user-1', type: 'task', status: null, priority: 'low', ref: null, expiresAt: null },
    // Active claim for a3
    { appendId: 'a4', author: 'agent-1', type: 'claim', status: 'active', priority: null, ref: 'a3', expiresAt: futureDate },
    // Completed task
    { appendId: 'a5', author: 'user-1', type: 'task', status: null, priority: 'medium', ref: null, expiresAt: null },
    // Response for a5 (marks it completed)
    { appendId: 'a6', author: 'agent-1', type: 'response', status: null, priority: null, ref: 'a5', expiresAt: null },
  ];

  for (const append of appendsToInsert) {
    const id = `${fileId}_${append.appendId}`;
    sqlite.exec(`
      INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, priority, ref, expires_at, created_at, content_preview)
      VALUES ('${id}', '${fileId}', '${append.appendId}', '${append.author}', 
        ${append.type ? `'${append.type}'` : 'NULL'},
        ${append.status ? `'${append.status}'` : 'NULL'},
        ${append.priority ? `'${append.priority}'` : 'NULL'},
        ${append.ref ? `'${append.ref}'` : 'NULL'},
        ${append.expiresAt ? `'${append.expiresAt}'` : 'NULL'},
        '${now}', 'Test content')
    `);
  }

  // Create heartbeat for agent
  const lastSeenUnix = Math.floor(Date.now() / 1000);
  sqlite.exec(`
    INSERT OR REPLACE INTO heartbeats (workspace_id, author, status, last_seen, current_task)
    VALUES ('${TEST_WORKSPACE_ID}', 'agent-1', 'busy', ${lastSeenUnix}, 'a3')
  `);
}

/**
 * Reset test data for consistent test state.
 * @throws Error if called in production environment
 */
export function resetOrchestrationTestData(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetOrchestrationTestData cannot be called in production');
  }
  setupTestFixtures();
  sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}')`);
  sqlite.exec(`DELETE FROM heartbeats WHERE workspace_id = '${TEST_WORKSPACE_ID}'`);
  createTestData();
}
