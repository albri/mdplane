/**
 * Heartbeat Test Fixtures
 *
 * Test-only constants and helper functions for heartbeat endpoint tests.
 * Moved from apps/server/src/routes/heartbeat.ts to separate test code from production.
 */

import { sqlite } from '../../src/db';
import { hashKey, generateKey } from '../../src/core/capability-keys';

// Test keys - must match constants used in tests
export const TEST_APPEND_KEY = 'hbA8k2mP9qL3nR7mQ2pN4xK';
export const TEST_READ_KEY = 'hbR8k2mP9qL3nR7mQ2pN4xK';
export const TEST_FOLDER_READ_KEY = 'hbFR8k2mP9qL3nR7mQ2pN4';
export const TEST_EXPIRED_KEY = 'hbExpired0P9qL3nR7mQ2pN';
export const TEST_REVOKED_KEY = 'hbRevoked0P9qL3nR7mQ2pN';
export const TEST_BOUND_AUTHOR_KEY = 'hbBound0P9qL3nR7mQ2pN4xK';

export const TEST_API_KEY = 'sk_live_testHeartbeatKey12345';
export const TEST_INVALID_API_KEY = 'sk_live_invalidHeartbeatKey';
export const TEST_READ_ONLY_API_KEY = 'sk_live_testReadOnlyHb12345';
export const TEST_EXPIRED_API_KEY = 'sk_live_testExpiredHb12345';
export const TEST_REVOKED_API_KEY = 'sk_live_testRevokedHb12345';

export const TEST_WORKSPACE_ID = 'ws_test_heartbeat';

let testFixturesInitialized = false;

/**
 * Set up test fixtures for heartbeat tests.
 * Uses INSERT OR REPLACE for idempotency - safe to call multiple times.
 */
export function setupTestFixtures(): void {
  const isProduction = process.env.MP_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) return; // Never run in production
  if (testFixturesInitialized) return;

  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

  // Create heartbeats table if it doesn't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS heartbeats (
      workspace_id TEXT NOT NULL,
      author TEXT NOT NULL,
      file_id TEXT,
      status TEXT DEFAULT 'alive',
      current_task TEXT,
      metadata TEXT,
      last_seen INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, author)
    )
  `);

  // Create test workspace
  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${TEST_WORKSPACE_ID}', 'Test Workspace Heartbeat', '${now}', '${now}')
  `);

  // Create capability keys for testing
  const keysToInsert = [
    {
      key: TEST_APPEND_KEY,
      permission: 'append',
      boundAuthor: null,
      scopeType: 'workspace',
      scopePath: '/',
      expiresAt: null,
      revokedAt: null,
    },
    {
      key: TEST_READ_KEY,
      permission: 'read',
      boundAuthor: null,
      scopeType: 'file',
      scopePath: '/test/file.md',
      expiresAt: null,
      revokedAt: null,
    },
    {
      key: TEST_FOLDER_READ_KEY,
      permission: 'read',
      boundAuthor: null,
      scopeType: 'folder',
      scopePath: '/test-folder/',
      expiresAt: null,
      revokedAt: null,
    },
    {
      key: TEST_EXPIRED_KEY,
      permission: 'append',
      boundAuthor: null,
      scopeType: 'workspace',
      scopePath: '/',
      expiresAt: pastDate,
      revokedAt: null,
    },
    {
      key: TEST_REVOKED_KEY,
      permission: 'append',
      boundAuthor: null,
      scopeType: 'workspace',
      scopePath: '/',
      expiresAt: null,
      revokedAt: pastDate,
    },
    {
      key: TEST_BOUND_AUTHOR_KEY,
      permission: 'append',
      boundAuthor: 'agent-alpha',
      scopeType: 'workspace',
      scopePath: '/',
      expiresAt: null,
      revokedAt: null,
    },
  ];

  for (const keyData of keysToInsert) {
    const keyHash = hashKey(keyData.key);
    const id = generateKey(16);
    // Delete any existing keys with the same hash to avoid duplicates
    sqlite.exec(`DELETE FROM capability_keys WHERE key_hash = '${keyHash}'`);
    sqlite.exec(`
      INSERT INTO capability_keys (
        id, workspace_id, prefix, key_hash, permission, scope_type, scope_path,
        bound_author, created_at, expires_at, revoked_at
      ) VALUES (
        '${id}', '${TEST_WORKSPACE_ID}', '${keyData.key.substring(0, 4)}', '${keyHash}',
        '${keyData.permission}', '${keyData.scopeType}', '${keyData.scopePath}',
        ${keyData.boundAuthor ? `'${keyData.boundAuthor}'` : 'NULL'},
        '${now}',
        ${keyData.expiresAt ? `'${keyData.expiresAt}'` : 'NULL'},
        ${keyData.revokedAt ? `'${keyData.revokedAt}'` : 'NULL'}
      )
    `);
  }

  // Create API keys for testing
  const apiKeysToInsert = [
    {
      rawKey: TEST_API_KEY,
      id: 'key_hbApiKey1',
      scopes: ['read', 'write'],
      expiresAt: null,
      revokedAt: null,
    },
    {
      rawKey: TEST_READ_ONLY_API_KEY,
      id: 'key_hbApiKey2',
      scopes: ['read'],
      expiresAt: null,
      revokedAt: null,
    },
    {
      rawKey: TEST_EXPIRED_API_KEY,
      id: 'key_hbApiKey3',
      scopes: ['read', 'write'],
      expiresAt: pastDate,
      revokedAt: null,
    },
    {
      rawKey: TEST_REVOKED_API_KEY,
      id: 'key_hbApiKey4',
      scopes: ['read', 'write'],
      expiresAt: null,
      revokedAt: pastDate,
    },
  ];

  for (const apiKeyData of apiKeysToInsert) {
    const keyHash = hashKey(apiKeyData.rawKey);
    const keyPrefix = apiKeyData.rawKey.substring(0, 12) + '...';

    sqlite.exec(`
      INSERT OR REPLACE INTO api_keys (
        id, workspace_id, name, key_hash, key_prefix, mode, scopes, created_at, expires_at, revoked_at
      ) VALUES (
        '${apiKeyData.id}', '${TEST_WORKSPACE_ID}', 'Test Key', '${keyHash}', '${keyPrefix}',
        'live', '${JSON.stringify(apiKeyData.scopes)}', '${now}',
        ${apiKeyData.expiresAt ? `'${apiKeyData.expiresAt}'` : 'NULL'},
        ${apiKeyData.revokedAt ? `'${apiKeyData.revokedAt}'` : 'NULL'}
      )
    `);
  }

  // Note: We do NOT clear heartbeats here.
  // Heartbeats are created by tests and should persist across test runs.
  // Tests that need a clean slate should handle cleanup themselves.

  testFixturesInitialized = true;
}

/**
 * Reset test fixtures for heartbeat tests.
 * @throws Error if called in production environment
 */
export function resetHeartbeatTestData(): void {
  const isProduction = process.env.MP_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) {
    throw new Error('resetHeartbeatTestData() cannot be called in production');
  }
  // Reset the flag to allow re-initialization
  testFixturesInitialized = false;
  setupTestFixtures();
}

/**
 * Create a heartbeat with a specific last_seen timestamp.
 * Useful for testing stale detection with valid staleThresholdSeconds values.
 *
 * @param author - The agent author name
 * @param status - The agent status (alive, idle, busy)
 * @param lastSeenSecondsAgo - How many seconds in the past the lastSeen should be
 */
export function createHeartbeatWithAge(
  author: string,
  status: 'alive' | 'idle' | 'busy' = 'alive',
  lastSeenSecondsAgo: number = 0
): void {
  const isProduction = process.env.MP_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) {
    throw new Error('createHeartbeatWithAge() cannot be called in production');
  }

  const lastSeen = Math.floor(Date.now() / 1000) - lastSeenSecondsAgo;
  sqlite.exec(`
    INSERT OR REPLACE INTO heartbeats (workspace_id, author, status, last_seen)
    VALUES ('${TEST_WORKSPACE_ID}', '${author}', '${status}', ${lastSeen})
  `);
}
