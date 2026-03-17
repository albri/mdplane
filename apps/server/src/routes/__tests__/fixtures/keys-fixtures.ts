import { sqlite } from '../../../db';
import { generateKey, hashKey } from '../../../core/capability-keys';

export const TEST_ADMIN_KEY = 'keyW8k2mP9qL3nR7mQ2pN4';
export const TEST_APPEND_KEY = 'keyA8k2mP9qL3nR7mQ2pN4';
export const TEST_READ_KEY = 'keyR8k2mP9qL3nR7mQ2pN4';
export const TEST_EXPIRED_SCOPED_KEY = 'a_keyExpired0P9qL3nR7mQ';

export const TEST_OTHER_ADMIN_KEY = 'keyW9k3nQ0rM4oS8pT5uV6';
const TEST_OTHER_WORKSPACE_ID = 'ws_test_keys_other';

const TEST_WORKSPACE_ID = 'ws_test_keys';

export function resetKeysTestData(): void {
  setupTestFixtures();
}

function setupTestFixtures(): void {
  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString();

  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${TEST_WORKSPACE_ID}', 'Test Workspace Keys', '${now}', '${now}')
  `);

  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${TEST_OTHER_WORKSPACE_ID}', 'Test Workspace Keys Other', '${now}', '${now}')
  `);

  const otherKeyHash = hashKey(TEST_OTHER_ADMIN_KEY);
  const otherKeyId = generateKey(16);
  sqlite.exec(`DELETE FROM capability_keys WHERE key_hash = '${otherKeyHash}'`);
  sqlite.exec(`
    INSERT INTO capability_keys (
      id, workspace_id, prefix, key_hash, permission, scope_type, scope_path,
      bound_author, wip_limit, created_at, expires_at, revoked_at
    ) VALUES (
      '${otherKeyId}', '${TEST_OTHER_WORKSPACE_ID}', '${TEST_OTHER_ADMIN_KEY.substring(0, 4)}', '${otherKeyHash}',
      'write', 'workspace', '/',
      NULL, NULL, '${now}', NULL, NULL
    )
  `);

  const keysToInsert = [
    { key: TEST_ADMIN_KEY, permission: 'write', boundAuthor: null, wipLimit: null, expiresAt: null, revokedAt: null },
    { key: TEST_APPEND_KEY, permission: 'append', boundAuthor: null, wipLimit: null, expiresAt: null, revokedAt: null },
    { key: TEST_READ_KEY, permission: 'read', boundAuthor: null, wipLimit: null, expiresAt: null, revokedAt: null },
    { key: TEST_EXPIRED_SCOPED_KEY, permission: 'append', boundAuthor: null, wipLimit: null, expiresAt: pastDate, revokedAt: null },
  ];

  for (const keyData of keysToInsert) {
    const keyHash = hashKey(keyData.key);
    const id = generateKey(16);
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

  sqlite.exec(`DELETE FROM appends WHERE file_id = 'file_keys_test'`);
  sqlite.exec(`DELETE FROM files WHERE id = 'file_keys_test'`);
  sqlite.exec(`DELETE FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '/path/to/file.md'`);
  sqlite.exec(`
    INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
    VALUES ('file_keys_test', '${TEST_WORKSPACE_ID}', '/path/to/file.md', '# Test', '${now}', '${now}')
  `);

  sqlite.exec(`DELETE FROM appends WHERE file_id = 'file_docs_readme'`);
  sqlite.exec(`DELETE FROM files WHERE id = 'file_docs_readme'`);
  sqlite.exec(`DELETE FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '/docs/readme.md'`);
  sqlite.exec(`
    INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
    VALUES ('file_docs_readme', '${TEST_WORKSPACE_ID}', '/docs/readme.md', '# Docs Readme', '${now}', '${now}')
  `);

  sqlite.exec(`DELETE FROM appends WHERE file_id = 'file_docs_guides'`);
  sqlite.exec(`DELETE FROM files WHERE id = 'file_docs_guides'`);
  sqlite.exec(`DELETE FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '/docs/guides/getting-started.md'`);
  sqlite.exec(`
    INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
    VALUES ('file_docs_guides', '${TEST_WORKSPACE_ID}', '/docs/guides/getting-started.md', '# Getting Started', '${now}', '${now}')
  `);

  sqlite.exec(`DELETE FROM appends WHERE file_id = 'file_src_index'`);
  sqlite.exec(`DELETE FROM files WHERE id = 'file_src_index'`);
  sqlite.exec(`DELETE FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '/src/index.ts'`);
  sqlite.exec(`
    INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
    VALUES ('file_src_index', '${TEST_WORKSPACE_ID}', '/src/index.ts', '# Src Index', '${now}', '${now}')
  `);
}
