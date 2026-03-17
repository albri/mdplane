import { sqlite } from '../../../db'
import { hashKey } from '../../../core/capability-keys'
import { resetApiKeyRateLimits } from '../../../domain/api-keys/handlers'

const USER_OWNED_WORKSPACE = 'ws_test123456789'
const OTHER_USER_WORKSPACE = 'ws_otheruser123'
const FRESH_WORKSPACE = 'ws_freshworkspace'
const TEST_SESSION_USER_ID = 'usr_test_user'

const VALID_SCOPES = ['read', 'append', 'write', 'export'] as const
type Scope = (typeof VALID_SCOPES)[number]

const TEST_API_KEYS: Record<string, {
  id: string
  workspaceId: string
  scopes: Scope[]
  expiresAt: string | null
  revokedAt: string | null
}> = {}

export function resetApiKeysTestData(): void {
  resetApiKeyRateLimits()

  sqlite.exec(
    `DELETE FROM api_keys WHERE workspace_id IN ('${USER_OWNED_WORKSPACE}', '${OTHER_USER_WORKSPACE}', '${FRESH_WORKSPACE}')`
  )

  sqlite.exec(
    `DELETE FROM appends WHERE file_id IN (
      SELECT id FROM files WHERE workspace_id IN ('${USER_OWNED_WORKSPACE}', '${OTHER_USER_WORKSPACE}', '${FRESH_WORKSPACE}')
    )`
  )

  sqlite.exec(
    `DELETE FROM files WHERE workspace_id IN ('${USER_OWNED_WORKSPACE}', '${OTHER_USER_WORKSPACE}', '${FRESH_WORKSPACE}')`
  )

  sqlite.exec(
    `DELETE FROM folders WHERE workspace_id IN ('${USER_OWNED_WORKSPACE}', '${OTHER_USER_WORKSPACE}', '${FRESH_WORKSPACE}')`
  )

  for (const key of Object.keys(TEST_API_KEYS)) {
    delete TEST_API_KEYS[key as keyof typeof TEST_API_KEYS]
  }

  setupTestFixtures()
}

function setupTestFixtures(): void {
  const now = new Date().toISOString()
  const pastDate = new Date(Date.now() - 86400000).toISOString()

  sqlite.exec(`
    INSERT INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${USER_OWNED_WORKSPACE}', 'User Workspace', '${now}', '${now}')
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      last_activity_at = excluded.last_activity_at
  `)

  sqlite.exec(`
    INSERT INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${OTHER_USER_WORKSPACE}', 'Other User Workspace', '${now}', '${now}')
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      last_activity_at = excluded.last_activity_at
  `)

  sqlite.exec(`
    INSERT INTO workspaces (id, name, created_at, last_activity_at)
    VALUES ('${FRESH_WORKSPACE}', 'Fresh Workspace', '${now}', '${now}')
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      last_activity_at = excluded.last_activity_at
  `)

  sqlite.exec(`
    INSERT INTO user_workspaces (id, user_id, workspace_id, created_at)
    VALUES ('uw_test_user_ws', '${TEST_SESSION_USER_ID}', '${USER_OWNED_WORKSPACE}', '${now}')
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      workspace_id = excluded.workspace_id
  `)

  sqlite.exec(`
    INSERT INTO user_workspaces (id, user_id, workspace_id, created_at)
    VALUES ('uw_test_user_fresh_ws', '${TEST_SESSION_USER_ID}', '${FRESH_WORKSPACE}', '${now}')
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      workspace_id = excluded.workspace_id
  `)

  const testKeys = [
    {
      rawKey: 'sk_live_testValidApiKey12345678',
      id: 'key_validApiKey123',
      scopes: ['read', 'write'] as Scope[],
      expiresAt: null,
      revokedAt: null,
    },
    {
      rawKey: 'sk_live_testExpiredKey12345678',
      id: 'key_expiredApiKey123',
      scopes: ['read'] as Scope[],
      expiresAt: pastDate,
      revokedAt: null,
    },
    {
      rawKey: 'sk_live_testDeletedKey12345678',
      id: 'key_deletedApiKey123',
      scopes: ['read'] as Scope[],
      expiresAt: null,
      revokedAt: pastDate,
    },
    {
      rawKey: 'sk_live_testReadOnlyKey1234567',
      id: 'key_readOnlyApiKey12',
      scopes: ['read'] as Scope[],
      expiresAt: null,
      revokedAt: null,
    },
    {
      rawKey: 'sk_live_testAppendKey12345678',
      id: 'key_appendApiKey123',
      scopes: ['read', 'append', 'write'] as Scope[],
      expiresAt: null,
      revokedAt: null,
    },
  ]

  for (const testKey of testKeys) {
    const keyHash = hashKey(testKey.rawKey)
    const keyPrefix = testKey.rawKey.substring(0, 12) + '...'

    sqlite.exec(`
      INSERT OR IGNORE INTO api_keys (
        id, workspace_id, name, key_hash, key_prefix, mode, scopes, created_at, expires_at, last_used_at, revoked_at
      ) VALUES (
        '${testKey.id}', '${USER_OWNED_WORKSPACE}', 'Test Key', '${keyHash}', '${keyPrefix}',
        'live', '${JSON.stringify(testKey.scopes)}', '${now}',
        ${testKey.expiresAt ? `'${testKey.expiresAt}'` : 'NULL'},
        NULL,
        ${testKey.revokedAt ? `'${testKey.revokedAt}'` : 'NULL'}
      )
    `)

    TEST_API_KEYS[testKey.rawKey] = {
      id: testKey.id,
      workspaceId: USER_OWNED_WORKSPACE,
      scopes: testKey.scopes,
      expiresAt: testKey.expiresAt,
      revokedAt: testKey.revokedAt,
    }
  }

  const fileId = 'file_test_api_keys'
  sqlite.exec(`
    INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
    VALUES ('${fileId}', '${USER_OWNED_WORKSPACE}', '/test/file.md', '# Test File', '${now}', '${now}')
    ON CONFLICT(id) DO UPDATE SET
      workspace_id = excluded.workspace_id,
      path = excluded.path,
      content = excluded.content,
      updated_at = excluded.updated_at
  `)
}
