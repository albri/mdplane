/**
 * WebSocket Test Fixtures
 *
 * Test-only constants and helper functions for WebSocket endpoint tests.
 * Moved from apps/server/src/routes/websocket.ts to separate test code from production.
 */

import { sqlite, initializeDatabase } from '../../src/db';
import { hashKey, generateKey } from '../../src/core/capability-keys';

// Test keys - must match constants used in tests
export const TEST_READ_KEY = 'wsR8k2mP9qL3nR7mQ2pN4x';
export const TEST_APPEND_KEY = 'wsA8k2mP9qL3nR7mQ2pN4x';
export const TEST_WRITE_KEY = 'wsW8k2mP9qL3nR7mQ2pN4x';
export const TEST_REVOKED_KEY = 'wsRevoked0P9qL3nR7mQ2xZ';
export const TEST_EXPIRED_KEY = 'wsExpired0P9qL3nR7mQ2xZ';

// Folder test keys
export const TEST_FOLDER_READ_KEY = 'wsFolderR8k2mP9qL3nR7mQ2';
export const TEST_FOLDER_APPEND_KEY = 'wsFolderA8k2mP9qL3nR7mQ2';
export const TEST_FOLDER_WRITE_KEY = 'wsFolderW8k2mP9qL3nR7mQ2';

export const TEST_WORKSPACE_ID = 'ws_test_websocket';

let testFixturesInitialized = false;

/**
 * Set up test fixtures for WebSocket tests.
 * Uses INSERT OR REPLACE for idempotency - safe to call multiple times.
 */
export function setupTestFixtures(): void {
  // Ensure database tables exist
  initializeDatabase();

  const isProduction = process.env.MP_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) return; // Never run in production
  if (testFixturesInitialized) return;

  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

  // Create test workspace
  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${TEST_WORKSPACE_ID}', 'Test WS Workspace', '${now}', '${now}')
  `);

  // Create capability keys for testing
  const keysToInsert = [
    { key: TEST_READ_KEY, permission: 'read', expiresAt: null, revokedAt: null },
    { key: TEST_APPEND_KEY, permission: 'append', expiresAt: null, revokedAt: null },
    { key: TEST_WRITE_KEY, permission: 'write', expiresAt: null, revokedAt: null },
    { key: TEST_REVOKED_KEY, permission: 'read', expiresAt: null, revokedAt: pastDate },
    { key: TEST_EXPIRED_KEY, permission: 'read', expiresAt: pastDate, revokedAt: null },
    // Folder keys
    { key: TEST_FOLDER_READ_KEY, permission: 'read', expiresAt: null, revokedAt: null },
    { key: TEST_FOLDER_APPEND_KEY, permission: 'append', expiresAt: null, revokedAt: null },
    { key: TEST_FOLDER_WRITE_KEY, permission: 'write', expiresAt: null, revokedAt: null },
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

  testFixturesInitialized = true;
}

/**
 * Reset WebSocket test data for consistent test state.
 * @throws Error if called in production environment
 */
export function resetWebsocketTestData(): void {
  const isProduction = process.env.MP_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) {
    throw new Error('resetWebsocketTestData() cannot be called in production');
  }
  // Reset the flag to allow re-initialization
  testFixturesInitialized = false;
  setupTestFixtures();
}
