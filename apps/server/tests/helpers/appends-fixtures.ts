/**
 * Appends Test Fixtures
 *
 * Test-only constants and helper functions for append operations tests.
 * Moved from apps/server/src/routes/appends.ts to separate test code from production.
 */

import { sqlite } from '../../src/db';
import { hashKey, generateKey } from '../../src/core/capability-keys';

// Test keys - must match constants used in tests
export const TEST_READ_KEY = 'appR8k2mP9qL3nR7mQ2pN4';
export const TEST_WRITE_KEY = 'appW8k2mP9qL3nR7mQ2pN4';
export const TEST_APPEND_KEY = 'appA8k2mP9qL3nR7mQ2pN4';
export const TEST_EXPIRED_KEY = 'appExpired0P9qL3nR7mQ2';
export const TEST_REVOKED_KEY = 'appRevoked0P9qL3nR7mQ2';
export const TEST_BOUND_AUTHOR_KEY = 'appBound0P9qL3nR7mQ2pN4';
export const TEST_WIP_LIMITED_KEY = 'appWip0P9qL3nR7mQ2pN401';

export const TEST_WORKSPACE_ID = 'ws_test_appends';

let testFixturesInitialized = false;

/**
 * Set up test fixtures for append operations tests.
 * Creates workspace, capability keys, files, and appends.
 * Uses INSERT OR REPLACE for idempotency - safe to call multiple times.
 */
export function setupTestFixtures(): void {
  const isProduction = process.env.MP_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) return; // Never run in production
  if (testFixturesInitialized) return;

  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

  // Create test workspace
  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${TEST_WORKSPACE_ID}', 'Test Workspace Appends', '${now}', '${now}')
  `);

  // Create capability keys for testing
  const keysToInsert = [
    { key: TEST_READ_KEY, permission: 'read', boundAuthor: null, wipLimit: null, expiresAt: null, revokedAt: null },
    { key: TEST_WRITE_KEY, permission: 'write', boundAuthor: null, wipLimit: null, expiresAt: null, revokedAt: null },
    { key: TEST_APPEND_KEY, permission: 'append', boundAuthor: null, wipLimit: null, expiresAt: null, revokedAt: null },
    { key: TEST_EXPIRED_KEY, permission: 'append', boundAuthor: null, wipLimit: null, expiresAt: pastDate, revokedAt: null },
    { key: TEST_REVOKED_KEY, permission: 'append', boundAuthor: null, wipLimit: null, expiresAt: null, revokedAt: pastDate },
    { key: TEST_BOUND_AUTHOR_KEY, permission: 'append', boundAuthor: 'bound-agent', wipLimit: null, expiresAt: null, revokedAt: null },
    { key: TEST_WIP_LIMITED_KEY, permission: 'append', boundAuthor: null, wipLimit: 2, expiresAt: null, revokedAt: null },
  ];

  for (const keyData of keysToInsert) {
    const keyHash = hashKey(keyData.key);
    const id = generateKey(16);
    // Delete any existing keys with the same hash to avoid duplicates
    sqlite.exec(`DELETE FROM capability_keys WHERE key_hash = '${keyHash}'`);
    sqlite.exec(`
      INSERT INTO capability_keys (
        id, workspace_id, prefix, key_hash, permission, scope_type, scope_path,
        bound_author, wip_limit, created_at, expires_at, revoked_at
      ) VALUES (
        '${id}', '${TEST_WORKSPACE_ID}', '${keyData.key.substring(0, 4)}', '${keyHash}',
        '${keyData.permission}', 'workspace', '/',
        ${keyData.boundAuthor ? `'${keyData.boundAuthor}'` : 'NULL'},
        ${keyData.wipLimit !== null ? keyData.wipLimit : 'NULL'},
        '${now}',
        ${keyData.expiresAt ? `'${keyData.expiresAt}'` : 'NULL'},
        ${keyData.revokedAt ? `'${keyData.revokedAt}'` : 'NULL'}
      )
    `);
  }

  // Create test files - delete first to ensure clean state
  const testFiles = [
    { id: 'file_test_1', path: '/path/to/file.md', content: '# Test File' },
    { id: 'file_claimed', path: '/path/to/claimed-task.md', content: '# Claimed Task File' },
  ];

  for (const file of testFiles) {
    // Delete appends first (FK constraint requires child records deleted before parent)
    sqlite.exec(`DELETE FROM appends WHERE file_id = '${file.id}'`);
    // Delete any existing file with same id or path in this workspace
    sqlite.exec(`DELETE FROM files WHERE id = '${file.id}'`);
    sqlite.exec(`DELETE FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '${file.path}'`);
    sqlite.exec(`
      INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
      VALUES ('${file.id}', '${TEST_WORKSPACE_ID}', '${file.path}', '${file.content}', '${now}', '${now}')
    `);
  }

  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_1', 'file_test_1', 'a1', 'agent-1', 'task', 'open', '${now}')
  `);

  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_4', 'file_test_1', 'a4', 'agent-1', 'task', 'open', '${now}')
  `);
  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
    VALUES ('append_2', 'file_test_1', 'a2', 'agent-1', 'claim', 'a4', 'active', '${new Date(Date.now() + 3600000).toISOString()}', '${now}')
  `);

  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, ref, status, created_at)
    VALUES ('append_3', 'file_test_1', 'a3', 'agent-1', 'blocked', 'a1', 'active', '${now}')
  `);

  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_claimed_task', 'file_claimed', 'a1', 'agent-1', 'task', 'open', '${now}')
  `);
  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
    VALUES ('append_claimed', 'file_claimed', 'a2', 'agent-other', 'claim', 'a1', 'active', '${new Date(Date.now() + 3600000).toISOString()}', '${now}')
  `);

  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_wip_task', 'file_test_1', 'a5', 'agent-1', 'task', 'open', '${now}')
  `);
  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_wip_task_1', 'file_test_1', 'a6', 'agent-1', 'task', 'open', '${now}')
  `);
  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_wip_task_2', 'file_test_1', 'a7', 'agent-1', 'task', 'open', '${now}')
  `);
  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
    VALUES ('append_wip_1', 'file_test_1', 'a10', 'agent-1', 'claim', 'a6', 'active', '${new Date(Date.now() + 3600000).toISOString()}', '${now}')
  `);
  sqlite.exec(`
    INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
    VALUES ('append_wip_2', 'file_test_1', 'a11', 'agent-1', 'claim', 'a7', 'active', '${new Date(Date.now() + 3600000).toISOString()}', '${now}')
  `);

  testFixturesInitialized = true;
}

/**
 * Reset appends test data for consistent test state.
 * Called before each test to ensure consistent state.
 * @throws Error if called in production environment
 */
export function resetAppendsTestData(): void {
  const isProduction = process.env.MP_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) {
    throw new Error('resetAppendsTestData() cannot be called in production');
  }
  // Reset to allow re-initialization
  testFixturesInitialized = false;
  setupTestFixtures();
}
