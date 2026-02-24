import { beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { sqlite } from '../../../db';
import { hashKey } from '../../../core/capability-keys';

export const TEST_WORKSPACE_ID = 'ws_export_test_12345';
export const OTHER_WORKSPACE_ID = 'ws_export_other_9999';

// API keys for testing - must match API key pattern sk_(live|test)_[A-Za-z0-9]{20,}
export const VALID_EXPORT_KEY = 'sk_live_exportTestKey12345678';
export const VALID_READ_ONLY_KEY = 'sk_live_readOnlyTestKey12345';
export const EXPIRED_KEY = 'sk_live_expiredExportKey12345';
export const REVOKED_KEY = 'sk_live_revokedExportKey12345';
export const INVALID_KEY = 'sk_live_invalidKeyNotInDb1234';
export const MALFORMED_KEY = 'invalid_format_key';
export const OTHER_WORKSPACE_KEY = 'sk_live_otherWorkspaceKey123';

export const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
export const JOB_ID_PATTERN = /^exp_[A-Za-z0-9]+$/;

export type TestApp = {
  handle: (request: Request) => Response | Promise<Response>;
};

export function setupTestFixtures(): void {
  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

  // Clean up any export jobs created by previous tests.
  sqlite.exec(
    `DELETE FROM export_jobs WHERE workspace_id IN ('${TEST_WORKSPACE_ID}', '${OTHER_WORKSPACE_ID}')`
  );

  // Create test workspaces
  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${TEST_WORKSPACE_ID}', 'Export Test Workspace', '${now}', '${now}')
  `);

  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${OTHER_WORKSPACE_ID}', 'Other Workspace', '${now}', '${now}')
  `);

  // Create test files in workspace
  sqlite.exec(`
    INSERT OR REPLACE INTO files (id, workspace_id, path, content, created_at, updated_at)
    VALUES ('file_export_1', '${TEST_WORKSPACE_ID}', '/test.md', '# Test File', '${now}', '${now}')
  `);

  sqlite.exec(`
    INSERT OR REPLACE INTO files (id, workspace_id, path, content, created_at, updated_at)
    VALUES ('file_export_2', '${TEST_WORKSPACE_ID}', '/folder/nested.md', '# Nested File', '${now}', '${now}')
  `);

  // Create test API keys
  const testKeys = [
    {
      rawKey: VALID_EXPORT_KEY,
      id: 'key_export_valid',
      workspaceId: TEST_WORKSPACE_ID,
      scopes: ['read', 'export'],
      expiresAt: null,
      revokedAt: null,
    },
    {
      rawKey: VALID_READ_ONLY_KEY,
      id: 'key_export_readonly',
      workspaceId: TEST_WORKSPACE_ID,
      scopes: ['read'],
      expiresAt: null,
      revokedAt: null,
    },
    {
      rawKey: EXPIRED_KEY,
      id: 'key_export_expired',
      workspaceId: TEST_WORKSPACE_ID,
      scopes: ['read', 'export'],
      expiresAt: pastDate,
      revokedAt: null,
    },
    {
      rawKey: REVOKED_KEY,
      id: 'key_export_revoked',
      workspaceId: TEST_WORKSPACE_ID,
      scopes: ['read', 'export'],
      expiresAt: null,
      revokedAt: pastDate,
    },
    {
      rawKey: OTHER_WORKSPACE_KEY,
      id: 'key_export_other_ws',
      workspaceId: OTHER_WORKSPACE_ID,
      scopes: ['read', 'export'],
      expiresAt: null,
      revokedAt: null,
    },
  ];

  for (const testKey of testKeys) {
    const keyHash = hashKey(testKey.rawKey);
    const keyPrefix = testKey.rawKey.substring(0, 12) + '...';

    sqlite.exec(`
      INSERT OR REPLACE INTO api_keys (
        id, workspace_id, name, key_hash, key_prefix, mode, scopes, created_at, expires_at, revoked_at
      ) VALUES (
        '${testKey.id}',
        '${testKey.workspaceId}',
        'Test Key',
        '${keyHash}',
        '${keyPrefix}',
        'live',
        '${JSON.stringify(testKey.scopes)}',
        '${now}',
        ${testKey.expiresAt ? `'${testKey.expiresAt}'` : 'NULL'},
        ${testKey.revokedAt ? `'${testKey.revokedAt}'` : 'NULL'}
      )
    `);
  }
}

export { assertValidResponse } from '../../../../tests/helpers/schema-validator';

