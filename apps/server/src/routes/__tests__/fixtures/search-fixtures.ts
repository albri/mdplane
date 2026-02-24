import { sqlite } from '../../../db';
import { generateKey, hashKey } from '../../../core/capability-keys';

export const TEST_READ_KEY = 'srcR8k2mP9qL3nR7mQ2pN4';
export const TEST_FOLDER_READ_KEY = 'srcFldR8k2mP9qL3nR7mQ2';
export const TEST_FILE_READ_KEY = 'srcFilR8k2mP9qL3nR7mQ2';
export const TEST_API_KEY = 'sk_test_search_api_key_01';
export const TEST_EXPIRED_API_KEY = 'sk_test_search_api_key_expired';
export const TEST_REVOKED_API_KEY = 'sk_test_search_api_key_revoked';
export const TEST_EXPIRED_KEY = 'srcExpired0P9qL3nR7mQ2';
export const TEST_REVOKED_KEY = 'srcRevoked0P9qL3nR7mQ2';

const TEST_WORKSPACE_ID = 'ws_test_search';

export function resetTestSearch(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetTestSearch cannot be called in production');
  }
  setupTestFixtures();
}

function setupTestFixtures(): void {
  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString();

  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${TEST_WORKSPACE_ID}', 'Test Search Workspace', '${now}', '${now}')
  `);

  const keysToInsert = [
    { key: TEST_READ_KEY, permission: 'read', scopeType: 'workspace', scopePath: '/', expiresAt: null, revokedAt: null },
    { key: TEST_FOLDER_READ_KEY, permission: 'read', scopeType: 'folder', scopePath: '/projects', expiresAt: null, revokedAt: null },
    { key: TEST_FILE_READ_KEY, permission: 'read', scopeType: 'file', scopePath: '/projects/alpha/tasks.md', expiresAt: null, revokedAt: null },
    { key: TEST_EXPIRED_KEY, permission: 'read', scopeType: 'workspace', scopePath: '/', expiresAt: pastDate, revokedAt: null },
    { key: TEST_REVOKED_KEY, permission: 'read', scopeType: 'workspace', scopePath: '/', expiresAt: null, revokedAt: pastDate },
  ];

  for (const keyData of keysToInsert) {
    const keyHash = hashKey(keyData.key);
    const id = generateKey(16);
    sqlite.exec(`DELETE FROM capability_keys WHERE key_hash = '${keyHash}'`);
    sqlite.exec(`
      INSERT INTO capability_keys (
        id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at, expires_at, revoked_at
      ) VALUES (
        '${id}', '${TEST_WORKSPACE_ID}', '${keyData.key.substring(0, 4)}', '${keyHash}',
        '${keyData.permission}', '${keyData.scopeType}', '${keyData.scopePath}', '${now}',
        ${keyData.expiresAt ? `'${keyData.expiresAt}'` : 'NULL'},
        ${keyData.revokedAt ? `'${keyData.revokedAt}'` : 'NULL'}
      )
    `);
  }

  const apiKeysToInsert = [
    {
      id: 'api_key_1',
      key: TEST_API_KEY,
      name: 'Test API Key',
      expiresAt: null,
      revokedAt: null,
    },
    {
      id: 'api_key_2',
      key: TEST_EXPIRED_API_KEY,
      name: 'Expired API Key',
      expiresAt: pastDate,
      revokedAt: null,
    },
    {
      id: 'api_key_3',
      key: TEST_REVOKED_API_KEY,
      name: 'Revoked API Key',
      expiresAt: null,
      revokedAt: pastDate,
    },
  ];

  for (const apiKey of apiKeysToInsert) {
    const apiKeyHash = hashKey(apiKey.key);
    sqlite.exec(`
      INSERT OR REPLACE INTO api_keys (
        id, workspace_id, name, key_hash, key_prefix, mode, scopes, created_at, expires_at, revoked_at
      ) VALUES (
        '${apiKey.id}',
        '${TEST_WORKSPACE_ID}',
        '${apiKey.name}',
        '${apiKeyHash}',
        'sk_test_',
        'test',
        '["read","search"]',
        '${now}',
        ${apiKey.expiresAt ? `'${apiKey.expiresAt}'` : 'NULL'},
        ${apiKey.revokedAt ? `'${apiKey.revokedAt}'` : 'NULL'}
      )
    `);
  }

  createTestData();
}

function createTestData(): void {
  const now = new Date().toISOString();
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

  const testFiles = [
    {
      id: 'file_1',
      path: '/projects/alpha/tasks.md',
      content: `---
title: Alpha Tasks
status: active
skills:
  - security
  - audit
author: jordan
priority: high
tags:
  - backend
  - api
---
# Alpha Project Tasks

Authentication module implementation.`,
    },
    {
      id: 'file_2',
      path: '/projects/beta/notes.md',
      content: `---
title: Beta Notes
status: active
skills:
  - frontend
author: alex
priority: medium
---
# Beta Project Notes

UI components and styling.`,
    },
    {
      id: 'file_3',
      path: '/projects/gamma/readme.md',
      content: `---
title: Gamma Readme
status: draft
customField: value
---
# Gamma Project

This is a simple readme file.`,
    },
  ];

  for (const file of testFiles) {
    sqlite.exec(`DELETE FROM appends WHERE file_id = '${file.id}'`);
    sqlite.exec(`DELETE FROM files WHERE id = '${file.id}'`);
    sqlite.exec(`DELETE FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '${file.path}'`);
    sqlite.exec(`
      INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
      VALUES ('${file.id}', '${TEST_WORKSPACE_ID}', '${file.path}', '${file.content.replace(/'/g, "''")}', '${oneDayAgo}', '${now}')
    `);
  }

  const testAppends = [
    { id: 'append_1', fileId: 'file_1', appendId: 'a1', author: 'jordan', type: 'task', status: 'pending', priority: 'high', labels: '["bug","urgent"]', content: 'Fix critical bug in authentication module' },
    { id: 'append_2', fileId: 'file_1', appendId: 'a2', author: 'jordan', type: 'task', status: 'claimed', priority: 'critical', labels: '["backend"]', content: 'Review critical security vulnerability' },
    { id: 'append_3', fileId: 'file_1', appendId: 'a3', author: 'alex', type: 'task', status: 'completed', priority: 'medium', labels: '["bug"]', content: 'Update documentation for API' },
    { id: 'append_4', fileId: 'file_2', appendId: 'a4', author: 'jordan', type: 'comment', status: null, priority: null, labels: null, content: 'This is a test comment about bugs' },
    { id: 'append_5', fileId: 'file_2', appendId: 'a5', author: 'alex', type: 'task', status: 'pending', priority: 'high', labels: '["frontend","urgent"]', content: 'Implement new authentication flow' },
    { id: 'append_6', fileId: 'file_3', appendId: 'a6', author: 'sam', type: 'task', status: 'pending', priority: 'low', labels: '["docs"]', content: 'Simple task for search testing' },
  ];

  for (const append of testAppends) {
    sqlite.exec(`
      INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, priority, labels, created_at, content_preview)
      VALUES ('${append.id}', '${append.fileId}', '${append.appendId}', '${append.author}', '${append.type}',
              ${append.status ? `'${append.status}'` : 'NULL'},
              ${append.priority ? `'${append.priority}'` : 'NULL'},
              ${append.labels ? `'${append.labels}'` : 'NULL'},
              '${now}', '${append.content.replace(/'/g, "''")}')
    `);
  }
}
