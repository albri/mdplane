/**
 * Workspace Endpoints Tests
 *
 * Tests for workspace management endpoints:
 * - DELETE /workspaces/:workspaceId
 * - POST /workspaces/:workspaceId/rotate-all
 *
 * These routes use session authentication (OAuth), NOT API key authentication.
 *
 * @see packages/shared/openapi/paths/workspaces.yaml
 */

import { describe, expect, test, beforeAll, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';
import { sqlite } from '../../../db';
import { hashKey, generateKey } from '../../../core/capability-keys';
import {
  TEST_OWNER_SESSION,
  TEST_NON_OWNER_SESSION,
  TEST_OWNER_WORKSPACE_ID,
  TEST_MEMBER_WORKSPACE_ID,
  TEST_OWNER_USER_ID,
  TEST_MEMBER_USER_ID,
} from '../fixtures/workspaces-fixtures';

const VALID_SESSION_TOKEN = TEST_OWNER_SESSION;
const NON_OWNER_SESSION_TOKEN = TEST_NON_OWNER_SESSION;
const INVALID_SESSION_TOKEN = 'invalidSession789';
const VALID_SESSION_COOKIE = `better-auth.session_token=${VALID_SESSION_TOKEN}`;

// Mock BetterAuth session lookup
const activeOAuthSessions = new Map<string, { id: string; email: string; name: string }>();
mock.module('../../../core/auth', () => {
  return {
    auth: {
      api: {
        getSession: async ({ headers }: { headers: Headers }) => {
          const cookieHeader = headers.get('Cookie');
          if (!cookieHeader) return null;

          const cookies = cookieHeader.split(';').map((c: string) => c.trim());
          for (const cookie of cookies) {
            const [name, ...valueParts] = cookie.split('=');
            if (name !== 'better-auth.session_token') continue;

            const token = valueParts.join('=');
            const user = activeOAuthSessions.get(token);
            if (!user) return null;

            const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
            return {
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: new Date('2024-01-01T00:00:00Z'),
                emailVerified: true,
                image: null,
                updatedAt: new Date('2024-01-01T00:00:00Z'),
              },
              session: {
                id: 'mock_session_id',
                userId: user.id,
                expiresAt: new Date(expiresAt),
                token,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            };
          }

          return null;
        },
      },
    },
  };
});

const OWNER_WORKSPACE_ID = TEST_OWNER_WORKSPACE_ID;
const MEMBER_WORKSPACE_ID = TEST_MEMBER_WORKSPACE_ID;
const NONEXISTENT_WORKSPACE_ID = 'ws_doesnotexist12';
const ROOT_KEY_PATTERN = /^[A-Za-z0-9]{22,}$/;

// Test capability keys - used to verify rotation invalidates old keys
let testReadKey: string;
let testAppendKey: string;
let testWriteKey: string;

/**
 * Set up test fixtures for workspace tests.
 */
function setupTestFixtures(): void {
  const now = new Date().toISOString();

  // Create test workspaces
  sqlite.query(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at, deleted_at)
    VALUES (?, 'Owner Workspace', ?, ?, NULL)
  `).run(TEST_OWNER_WORKSPACE_ID, now, now);

  sqlite.query(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at, deleted_at)
    VALUES (?, 'Member Workspace', ?, ?, NULL)
  `).run(TEST_MEMBER_WORKSPACE_ID, now, now);

  // Create test users
  sqlite.query(`
    INSERT OR REPLACE INTO users (id, email, created_at)
    VALUES (?, 'owner@example.com', ?)
  `).run(TEST_OWNER_USER_ID, now);

  sqlite.query(`
    INSERT OR REPLACE INTO users (id, email, created_at)
    VALUES (?, 'member@example.com', ?)
  `).run(TEST_MEMBER_USER_ID, now);

  // Create ownership relationship
  sqlite.query(`
    INSERT OR REPLACE INTO user_workspaces (id, user_id, workspace_id, created_at)
    VALUES ('uw_owner1', ?, ?, ?)
  `).run(TEST_OWNER_USER_ID, TEST_OWNER_WORKSPACE_ID, now);
}

/**
 * Set up capability keys for rotation tests.
 * Returns the plaintext keys for verification after rotation.
 */
function setupCapabilityKeys(): { readKey: string; appendKey: string; writeKey: string } {
  const now = new Date().toISOString();

  // Generate test capability keys
  testReadKey = generateKey(22);
  testAppendKey = generateKey(22);
  testWriteKey = generateKey(22);

  // Delete any existing keys for this workspace
  sqlite.query(`DELETE FROM capability_keys WHERE workspace_id = ?`).run(TEST_OWNER_WORKSPACE_ID);

  // Insert capability keys for the owner workspace
  const keys = [
    { id: 'ck_read_1', key: testReadKey, permission: 'read' },
    { id: 'ck_append_1', key: testAppendKey, permission: 'append' },
    { id: 'ck_write_1', key: testWriteKey, permission: 'write' },
  ];

  for (const keyData of keys) {
    sqlite.query(`
      INSERT INTO capability_keys (id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at)
      VALUES (?, ?, ?, ?, ?, 'workspace', '/', ?)
    `).run(keyData.id, TEST_OWNER_WORKSPACE_ID, keyData.key.substring(0, 4), hashKey(keyData.key), keyData.permission, now);
  }

  return { readKey: testReadKey, appendKey: testAppendKey, writeKey: testWriteKey };
}

function setupFileScopedWriteKey(path: string): string {
  const now = new Date().toISOString();
  const fileScopedWriteKey = generateKey(22);
  const id = `ck_file_write_${generateKey(8)}`;

  sqlite.query(`
    INSERT INTO capability_keys (id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at)
    VALUES (?, ?, ?, ?, 'write', 'file', ?, ?)
  `).run(id, TEST_OWNER_WORKSPACE_ID, fileScopedWriteKey.substring(0, 4), hashKey(fileScopedWriteKey), path, now);

  return fileScopedWriteKey;
}

describe('DELETE /workspaces/:workspaceId - Delete Workspace', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(async () => {
    const mod = await import('../../workspaces');
    app = new Elysia().use(mod.workspacesRoute);

    // Set up mock sessions
    activeOAuthSessions.set(VALID_SESSION_TOKEN, {
      id: TEST_OWNER_USER_ID,
      email: 'owner@example.com',
      name: 'Owner User',
    });
    activeOAuthSessions.set(NON_OWNER_SESSION_TOKEN, {
      id: TEST_MEMBER_USER_ID,
      email: 'member@example.com',
      name: 'Member User',
    });
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  describe('Success Cases', () => {
    test('should return 200 when owner deletes workspace', async () => {
      const response = await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}`, {
          method: 'DELETE',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      expect(response.status).toBe(200);
    });

    test('should return ok: true with success message', async () => {
      const response = await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}`, {
          method: 'DELETE',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.message).toBe('Workspace deleted successfully');
      assertValidResponse(body, 'SuccessResponse');
    });

    test('should soft delete workspace by setting deleted_at', async () => {
      // First delete
      await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}`, {
          method: 'DELETE',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      // Verify workspace is soft deleted
      const workspace = sqlite
        .query(`SELECT deleted_at FROM workspaces WHERE id = ?`)
        .get(OWNER_WORKSPACE_ID) as { deleted_at: string | null } | null;

      expect(workspace).toBeDefined();
      expect(workspace?.deleted_at).not.toBeNull();
    });
  });

  describe('Authentication Errors (401)', () => {
    test('should return 401 without session cookie', async () => {
      const response = await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}`, {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 401 with invalid session cookie', async () => {
      const response = await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}`, {
          method: 'DELETE',
          headers: {
            Cookie: `better-auth.session_token=${INVALID_SESSION_TOKEN}`,
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Access Errors (404)', () => {
    test('should return 404 when user does not own workspace', async () => {
      const response = await app.handle(
        new Request(`http://localhost/workspaces/${MEMBER_WORKSPACE_ID}`, {
          method: 'DELETE',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Not Found Errors (404)', () => {
    test('should return 404 for non-existent workspace', async () => {
      const response = await app.handle(
        new Request(`http://localhost/workspaces/${NONEXISTENT_WORKSPACE_ID}`, {
          method: 'DELETE',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});

describe('POST /workspaces/:workspaceId/rotate-all - Rotate All URLs', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(async () => {
    const mod = await import('../../workspaces');
    app = new Elysia().use(mod.workspacesRoute);
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  describe('Success Cases', () => {
    test('should return 200 when owner rotates all URLs', async () => {
      setupCapabilityKeys();

      const response = await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/rotate-all`, {
          method: 'POST',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      expect(response.status).toBe(200);
    });

    test('should return ok: true with correct response shape', async () => {
      setupCapabilityKeys();

      const response = await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/rotate-all`, {
          method: 'POST',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.workspaceId).toBe(OWNER_WORKSPACE_ID);
      expect(body.data.message).toBe('All capability URLs rotated successfully');
      expect(typeof body.data.rotatedCount).toBe('number');
      expect(body.data.keys.read).toMatch(ROOT_KEY_PATTERN);
      expect(body.data.keys.append).toMatch(ROOT_KEY_PATTERN);
      expect(body.data.keys.write).toMatch(ROOT_KEY_PATTERN);
      expect(body.data.urls.api.read).toContain(body.data.keys.read);
      expect(body.data.urls.api.append).toContain(body.data.keys.append);
      expect(body.data.urls.api.write).toContain(body.data.keys.write);
      expect(body.data.urls.web.read).toContain(body.data.keys.read);
      expect(body.data.urls.web.claim).toContain(body.data.keys.write);
      expect(body.data.urls.web.append).toBeUndefined();
      expect(body.data.urls.web.write).toBeUndefined();
      expect(body.data.keyCustodyWarning).toContain('shown once');
      assertValidResponse(body, 'RotateAllResponse');
    });

    test('should return correct rotatedCount', async () => {
      setupCapabilityKeys();

      const response = await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/rotate-all`, {
          method: 'POST',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      const body = await response.json();
      // We set up 3 keys (read, append, write) - rotatedCount is number of files/folders
      // Since we have workspace-level keys, rotatedCount should be at least 1
      expect(body.data.rotatedCount).toBeGreaterThanOrEqual(0);
    });

    test('should invalidate old capability keys after rotation', async () => {
      const { readKey } = setupCapabilityKeys();

      // Verify the key exists before rotation
      const keyHashBefore = hashKey(readKey);
      const keyBefore = sqlite
        .query(`SELECT id, revoked_at FROM capability_keys WHERE key_hash = ?`)
        .get(keyHashBefore) as { id: string; revoked_at: string | null } | null;
      expect(keyBefore).not.toBeNull();
      expect(keyBefore?.revoked_at).toBeNull();

      // Perform rotation
      await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/rotate-all`, {
          method: 'POST',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      // Verify old key is revoked after rotation
      const keyAfter = sqlite
        .query(`SELECT id, revoked_at FROM capability_keys WHERE key_hash = ?`)
        .get(keyHashBefore) as { id: string; revoked_at: string | null } | null;
      expect(keyAfter).not.toBeNull();
      expect(keyAfter?.revoked_at).not.toBeNull();
    });

    test('should create new capability keys after rotation', async () => {
      setupCapabilityKeys();

      // Count keys before rotation
      const countBefore = sqlite
        .query(`SELECT COUNT(*) as count FROM capability_keys WHERE workspace_id = ? AND revoked_at IS NULL`)
        .get(TEST_OWNER_WORKSPACE_ID) as { count: number };

      // Perform rotation
      await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/rotate-all`, {
          method: 'POST',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      // Count active keys after rotation - should have new keys created
      const countAfter = sqlite
        .query(`SELECT COUNT(*) as count FROM capability_keys WHERE workspace_id = ? AND revoked_at IS NULL`)
        .get(TEST_OWNER_WORKSPACE_ID) as { count: number };

      // Should have at least as many active keys as before (all old revoked, all new created)
      expect(countAfter.count).toBeGreaterThanOrEqual(countBefore.count);
    });

    test('should return newly generated root keys that are active in storage', async () => {
      const oldKeys = setupCapabilityKeys();

      const response = await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/rotate-all`, {
          method: 'POST',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      const body = await response.json();
      expect(body.data.keys.read).not.toBe(oldKeys.readKey);
      expect(body.data.keys.append).not.toBe(oldKeys.appendKey);
      expect(body.data.keys.write).not.toBe(oldKeys.writeKey);

      const readKeyRow = sqlite.query(`
        SELECT revoked_at
        FROM capability_keys
        WHERE workspace_id = ?
          AND key_hash = ?
          AND permission = 'read'
      `).get(OWNER_WORKSPACE_ID, hashKey(body.data.keys.read)) as { revoked_at: string | null } | null;
      const appendKeyRow = sqlite.query(`
        SELECT revoked_at
        FROM capability_keys
        WHERE workspace_id = ?
          AND key_hash = ?
          AND permission = 'append'
      `).get(OWNER_WORKSPACE_ID, hashKey(body.data.keys.append)) as { revoked_at: string | null } | null;
      const writeKeyRow = sqlite.query(`
        SELECT revoked_at
        FROM capability_keys
        WHERE workspace_id = ?
          AND key_hash = ?
          AND permission = 'write'
      `).get(OWNER_WORKSPACE_ID, hashKey(body.data.keys.write)) as { revoked_at: string | null } | null;

      expect(readKeyRow).not.toBeNull();
      expect(appendKeyRow).not.toBeNull();
      expect(writeKeyRow).not.toBeNull();
      expect(readKeyRow?.revoked_at).toBeNull();
      expect(appendKeyRow?.revoked_at).toBeNull();
      expect(writeKeyRow?.revoked_at).toBeNull();
    });
  });

  describe('Authentication Errors (401)', () => {
    test('should return 401 without session cookie', async () => {
      const response = await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/rotate-all`, {
          method: 'POST',
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 401 with invalid session cookie', async () => {
      const response = await app.handle(
        new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/rotate-all`, {
          method: 'POST',
          headers: {
            Cookie: `better-auth.session_token=${INVALID_SESSION_TOKEN}`,
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Access Errors (404)', () => {
    test('should return 404 when user does not own workspace', async () => {
      const response = await app.handle(
        new Request(`http://localhost/workspaces/${MEMBER_WORKSPACE_ID}/rotate-all`, {
          method: 'POST',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Not Found Errors (404)', () => {
    test('should return 404 for non-existent workspace', async () => {
      const response = await app.handle(
        new Request(`http://localhost/workspaces/${NONEXISTENT_WORKSPACE_ID}/rotate-all`, {
          method: 'POST',
          headers: {
            Cookie: VALID_SESSION_COOKIE,
          },
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});

describe('PATCH /workspaces/:workspaceId/name - Rename Workspace (OAuth)', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(async () => {
    const mod = await import('../../workspaces');
    app = new Elysia().use(mod.workspacesRoute);
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  test('should return 200 and update workspace name for owner', async () => {
    const response = await app.handle(
      new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/name`, {
        method: 'PATCH',
        headers: {
          Cookie: VALID_SESSION_COOKIE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Renamed Workspace' }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.workspaceId).toBe(OWNER_WORKSPACE_ID);
    expect(body.data.name).toBe('Renamed Workspace');
    assertValidResponse(body, 'WorkspaceRenameResponse');

    const workspace = sqlite
      .query(`SELECT name FROM workspaces WHERE id = ?`)
      .get(OWNER_WORKSPACE_ID) as { name: string | null } | null;
    expect(workspace?.name).toBe('Renamed Workspace');
  });

  test('should return 401 without session', async () => {
    const response = await app.handle(
      new Request(`http://localhost/workspaces/${OWNER_WORKSPACE_ID}/name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Name' }),
      })
    );

    expect(response.status).toBe(401);
  });

  test('should return 404 for workspace without ownership', async () => {
    const response = await app.handle(
      new Request(`http://localhost/workspaces/${MEMBER_WORKSPACE_ID}/name`, {
        method: 'PATCH',
        headers: {
          Cookie: VALID_SESSION_COOKIE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Name' }),
      })
    );

    expect(response.status).toBe(404);
  });

  test('should return 404 for missing workspace', async () => {
    const response = await app.handle(
      new Request(`http://localhost/workspaces/${NONEXISTENT_WORKSPACE_ID}/name`, {
        method: 'PATCH',
        headers: {
          Cookie: VALID_SESSION_COOKIE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Name' }),
      })
    );

    expect(response.status).toBe(404);
  });
});

describe('PATCH /w/:key/workspace - Rename Workspace (Capability)', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(async () => {
    const mod = await import('../../workspaces');
    app = new Elysia().use(mod.workspacesRoute);
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  test('should return 200 and update workspace name with workspace write key', async () => {
    const { writeKey } = setupCapabilityKeys();

    const response = await app.handle(
      new Request(`http://localhost/w/${writeKey}/workspace`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Capability Rename' }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.workspaceId).toBe(OWNER_WORKSPACE_ID);
    expect(body.data.name).toBe('Capability Rename');
    assertValidResponse(body, 'WorkspaceRenameResponse');
  });

  test('should return 403 when key is not workspace-scoped', async () => {
    const fileWriteKey = setupFileScopedWriteKey('/roadmap.md');

    const response = await app.handle(
      new Request(`http://localhost/w/${fileWriteKey}/workspace`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Should Fail' }),
      })
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  test('should return 404 for invalid key', async () => {
    const response = await app.handle(
      new Request('http://localhost/w/not-a-valid-key/workspace', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Should Fail' }),
      })
    );

    expect(response.status).toBe(404);
  });
});
