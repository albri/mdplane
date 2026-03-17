import { sqlite } from '../../../db'
import { generateKey, hashKey } from '../../../core/capability-keys'

export const TEST_READ_KEY = 'filR8k2mP9qL3nR7mQ2pN4'
export const TEST_WRITE_KEY = 'filW8k2mP9qL3nR7mQ2pN4'
export const TEST_APPEND_KEY = 'filA8k2mP9qL3nR7mQ2pN4'
export const TEST_EXPIRED_KEY = 'filExpired0P9qL3nR7mQ2'
export const TEST_REVOKED_KEY = 'filRevoked0P9qL3nR7mQ2'
export const TEST_FILE_SCOPED_READ_KEY = 'filFSR8k2mP9qL3nR7mQ2p'

const TEST_WORKSPACE_ID = 'ws_test_files'

export function resetTestFiles(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetTestFiles cannot be called in production')
  }
  setupTestFixtures()
  createTestFiles(true)
}

function setupTestFixtures(): void {
  const now = new Date().toISOString()
  const pastDate = new Date(Date.now() - 86400000).toISOString()

  sqlite.exec(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${TEST_WORKSPACE_ID}', 'Test Workspace', '${now}', '${now}')
  `)

  const keysToInsert = [
    { key: TEST_READ_KEY, permission: 'read', expiresAt: null, revokedAt: null },
    { key: TEST_WRITE_KEY, permission: 'write', expiresAt: null, revokedAt: null },
    { key: TEST_APPEND_KEY, permission: 'append', expiresAt: null, revokedAt: null },
    { key: TEST_EXPIRED_KEY, permission: 'read', expiresAt: pastDate, revokedAt: null },
    { key: TEST_REVOKED_KEY, permission: 'read', expiresAt: null, revokedAt: pastDate },
  ]

  for (const keyData of keysToInsert) {
    const keyHash = hashKey(keyData.key)
    const id = generateKey(16)
    sqlite.exec(`DELETE FROM capability_keys WHERE key_hash = '${keyHash}'`)
    sqlite.exec(`
      INSERT INTO capability_keys (
        id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at, expires_at, revoked_at
      ) VALUES (
        '${id}', '${TEST_WORKSPACE_ID}', '${keyData.key.substring(0, 4)}', '${keyHash}',
        '${keyData.permission}', 'workspace', '/', '${now}',
        ${keyData.expiresAt ? `'${keyData.expiresAt}'` : 'NULL'},
        ${keyData.revokedAt ? `'${keyData.revokedAt}'` : 'NULL'}
      )
    `)
  }

  const fileScopedKeyHash = hashKey(TEST_FILE_SCOPED_READ_KEY)
  const fileScopedKeyId = generateKey(16)
  sqlite.exec(`DELETE FROM capability_keys WHERE key_hash = '${fileScopedKeyHash}'`)
  sqlite.exec(`
    INSERT INTO capability_keys (
      id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at, expires_at, revoked_at
    ) VALUES (
      '${fileScopedKeyId}', '${TEST_WORKSPACE_ID}', '${TEST_FILE_SCOPED_READ_KEY.substring(0, 4)}', '${fileScopedKeyHash}',
      'read', 'file', '/path/to/file.md', '${now}', NULL, NULL
    )
  `)

  createTestFiles()
}

function createTestFiles(cleanupOtherFiles: boolean = false): void {
  const now = new Date().toISOString()
  const earlierTime = new Date(Date.now() - 1000).toISOString()

  if (cleanupOtherFiles) {
    sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path NOT IN ('/path/to/file.md', '/existing/file.md'))`)
    sqlite.exec(`DELETE FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path NOT IN ('/path/to/file.md', '/existing/file.md')`)
  }

  sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '/new/file.md')`)
  sqlite.exec(`DELETE FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '/new/file.md'`)

  const existingFile = sqlite.query(`
    SELECT id, deleted_at FROM files
    WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '/path/to/file.md'
  `).get() as { id: string; deleted_at: string | null } | null

  if (!existingFile) {
    const fileId = generateKey(16)
    sqlite.exec(`
      INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
      VALUES ('${fileId}', '${TEST_WORKSPACE_ID}', '/path/to/file.md',
              '---\ntitle: Test File\nauthor: Test\n---\n# Test Content', '${earlierTime}', '${now}')
    `)
    const appendId = generateKey(16)
    sqlite.exec(`
      INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, created_at, content_preview)
      VALUES ('${appendId}', '${fileId}', 'a1', 'test-agent', 'task', 'open', '${now}', 'Test task content')
    `)
  } else if (existingFile.deleted_at) {
    sqlite.exec(`
      UPDATE files SET deleted_at = NULL, updated_at = '${now}',
        content = '---\ntitle: Test File\nauthor: Test\n---\n# Test Content'
      WHERE id = '${existingFile.id}'
    `)
  }

  const testFile = sqlite.query(`
    SELECT id FROM files WHERE workspace_id = ? AND path = '/path/to/file.md'
  `).get(TEST_WORKSPACE_ID) as { id: string } | null

  if (testFile) {
    sqlite.query(`DELETE FROM appends WHERE file_id = ? AND append_id = 'a1'`).run(testFile.id)
    const appendId = generateKey(16)
    sqlite.query(`
      INSERT INTO appends (id, file_id, append_id, author, type, status, created_at, content_preview)
      VALUES (?, ?, 'a1', 'test-agent', 'task', 'open', ?, 'Test task content')
    `).run(appendId, testFile.id, now)
  }

  const existingFileEntry = sqlite.query(`
    SELECT id, deleted_at FROM files
    WHERE workspace_id = '${TEST_WORKSPACE_ID}' AND path = '/existing/file.md'
  `).get() as { id: string; deleted_at: string | null } | null

  if (!existingFileEntry) {
    const fileId = generateKey(16)
    sqlite.exec(`
      INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
      VALUES ('${fileId}', '${TEST_WORKSPACE_ID}', '/existing/file.md', '# Existing File', '${now}', '${now}')
    `)
  } else if (existingFileEntry.deleted_at) {
    sqlite.exec(`
      UPDATE files SET deleted_at = NULL, updated_at = '${now}'
      WHERE id = '${existingFileEntry.id}'
    `)
  }
}
