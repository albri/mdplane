/**
 * Folder Test Fixtures
 *
 * Test-only constants and helper functions for folder operations tests.
 * Moved from apps/server/src/routes/folders.ts to separate test code from production.
 */

import { sqlite } from '../../src/db';
import { hashKey, generateKey } from '../../src/core/capability-keys';

// Test keys - must match constants used in tests
export const TEST_READ_KEY = 'fldR8k2mP9qL3nR7mQ2pN4';
export const TEST_WRITE_KEY = 'fldW8k2mP9qL3nR7mQ2pN4';
export const TEST_APPEND_KEY = 'fldA8k2mP9qL3nR7mQ2pN4';
export const TEST_EXPIRED_KEY = 'fldExpired0P9qL3nR7mQ2';
export const TEST_REVOKED_KEY = 'fldRevoked0P9qL3nR7mQ2';

export const TEST_WORKSPACE_ID = 'ws_test_folders';

/**
 * Set up test fixtures for folder operations tests.
 * Creates workspace, capability keys, and initial test files.
 * Uses INSERT OR REPLACE for idempotency - safe to call multiple times.
 */
export function setupTestFixtures(): void {
  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

  // Create test workspace
  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${TEST_WORKSPACE_ID}', 'Test Workspace', '${now}', '${now}')
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

  // Create test files with folder structure
  const testFiles = [
    { path: '/README.md', content: '# Root README' },
    { path: '/docs/README.md', content: '# Docs README' },
    { path: '/docs/guides/intro.md', content: '# Intro Guide' },
    { path: '/docs/guides/advanced.md', content: '# Advanced Guide' },
    { path: '/docs/guides/tips.md', content: '# Tips' },
    { path: '/src/index.ts', content: '// Main entry' },
    { path: '/src/utils/helpers.ts', content: '// Helpers' },
  ];

  for (const file of testFiles) {
    const fileId = generateKey(16);
    // Delete appends first (FK constraint requires child records deleted before parent)
    sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '${file.path}')`);
    // Delete any existing file with same path in this workspace to avoid duplicates
    sqlite.exec(`DELETE FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '${file.path}'`);
    sqlite.exec(`
      INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
      VALUES ('${fileId}', '${TEST_WORKSPACE_ID}', '${file.path}', '${file.content}', '${now}', '${now}')
    `);
  }
}

/**
 * Reset test folders to their initial state.
 * Called before each test to ensure consistent state.
 * @throws Error if called in production environment
 */
export function resetTestFolders(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetTestFolders cannot be called in production');
  }
  setupTestFixtures();

  const now = new Date().toISOString();

  // Test files that should exist for folder listing tests
  const testFiles = [
    { path: '/README.md', content: '# Root README' },
    { path: '/docs/README.md', content: '# Docs README' },
    { path: '/docs/guides/intro.md', content: '# Intro Guide' },
    { path: '/docs/guides/advanced.md', content: '# Advanced Guide' },
    { path: '/docs/guides/tips.md', content: '# Tips' },
    { path: '/src/index.ts', content: '// Main entry' },
    { path: '/src/utils/helpers.ts', content: '// Helpers' },
  ];

  for (const file of testFiles) {
    // Check if file exists
    const existingFile = sqlite.query(`
      SELECT id, deleted_at FROM files
      WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '${file.path}'
    `).get() as { id: string; deleted_at: string | null } | null;

    if (!existingFile) {
      // Create the file
      const fileId = generateKey(16);
      sqlite.exec(`
        INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
        VALUES ('${fileId}', '${TEST_WORKSPACE_ID}', '${file.path}', '${file.content}', '${now}', '${now}')
      `);
    } else if (existingFile.deleted_at) {
      // Restore the file if it was soft-deleted
      sqlite.exec(`
        UPDATE files SET deleted_at = NULL, updated_at = '${now}'
        WHERE id = '${existingFile.id}'
      `);
    }
  }
}
