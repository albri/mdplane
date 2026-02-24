/**
 * API Keys - List and Delete API Keys Tests
 * GET /workspaces/:workspaceId/api-keys
 * DELETE /workspaces/:workspaceId/api-keys/:keyId
 */

import { describe, expect, test, beforeAll, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { sqlite } from '../../../db';
import { resetApiKeysTestData } from '../fixtures/api-keys-fixtures';
import {
  activeOAuthSessions,
  VALID_SESSION_TOKEN,
  OTHER_SESSION_TOKEN,
  API_KEY_PREFIX_PATTERN,
  KEY_ID_PATTERN,
  ISO_TIMESTAMP_PATTERN,
  VALID_WORKSPACE_ID,
  OTHER_USER_WORKSPACE_ID,
  VALID_SESSION_COOKIE,
  type TestApp,
} from './test-setup';

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
            if (name === 'better-auth.session_token') {
              const token = valueParts.join('=');
              const user = activeOAuthSessions.get(token);
              if (!user) return null;

              const now = Date.now();
              const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

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
                  token: token,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              };
            }
          }
          return null;
        },
        signOut: async () => {},
      },
      handler: () => new Response('mock auth handler'),
    },
  };
});

import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

describe('List and Delete API Keys', () => {
  let app: TestApp;

  beforeAll(async () => {
    const mod = await import('../../../routes/api-keys');
    app = new Elysia().use(mod.apiKeysRoute);

    activeOAuthSessions.set(VALID_SESSION_TOKEN, {
      id: 'usr_test_user',
      email: 'test@example.com',
      name: 'Test User',
      sessionToken: VALID_SESSION_TOKEN,
    });
    activeOAuthSessions.set(OTHER_SESSION_TOKEN, {
      id: 'usr_other_user',
      email: 'other@example.com',
      name: 'Other User',
      sessionToken: OTHER_SESSION_TOKEN,
    });
  });

  beforeEach(() => {
    resetApiKeysTestData();
  });

  describe('GET /workspaces/:workspaceId/api-keys - List API Keys', () => {
    describe('Successful Listing', () => {
      test('should return 200 with array of API keys', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'GET',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'ApiKeyListResponse');
        expect(body.ok).toBe(true);
        expect(Array.isArray(body.data.keys)).toBe(true);
      });

      test('should return keyPrefix instead of full key', async () => {
        // First create a key
        await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'List Test Key',
              permissions: ['read'],
            }),
          })
        );

        // Then list keys
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'GET',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        const body = await response.json();
        expect(body.data.keys.length).toBeGreaterThan(0);
        for (const key of body.data.keys) {
          expect(key.prefix).toMatch(API_KEY_PREFIX_PATTERN);
          expect(key.key).toBeUndefined(); // Full key should never be returned
        }
      });

      test('should include id, name, prefix, permissions, created for each key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'GET',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        const body = await response.json();
        for (const key of body.data.keys) {
          expect(key.id).toMatch(KEY_ID_PATTERN);
          expect(key.name).toBeDefined();
          expect(key.prefix).toBeDefined();
          expect(Array.isArray(key.permissions)).toBe(true);
          expect(key.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
        }
      });

      test('should include optional expires if set', async () => {
        // Create key with expiration (24 hours from now)
        const expiresInSeconds = 86400;
        await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Expiring List Key',
              permissions: ['read'],
              expiresInSeconds,
            }),
          })
        );

        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'GET',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        const body = await response.json();
        const expiringKey = body.data.keys.find((k: { name: string }) => k.name === 'Expiring List Key');
        expect(expiringKey?.expiresAt).toBeDefined();
        expect(expiringKey?.expiresAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should include lastUsed timestamp when key has been used', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'GET',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        const body = await response.json();
        // lastUsedAt can be null if never used, or an ISO timestamp
        for (const key of body.data.keys) {
          if (key.lastUsedAt !== null && key.lastUsedAt !== undefined) {
            expect(key.lastUsedAt).toMatch(ISO_TIMESTAMP_PATTERN);
          }
        }
      });

      test('should return empty array if no keys exist', async () => {
        // Use a fresh workspace with no keys
        const response = await app.handle(
          new Request(`http://localhost/workspaces/ws_freshworkspace/api-keys`, {
            method: 'GET',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        const body = await response.json();
        expect(body.data.keys).toEqual([]);
      });
    });

    describe('Authentication & Authorization', () => {
      test('should return 401 without session cookie', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('UNAUTHORIZED');
      });

      test('should return 403 for non-owner of workspace', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${OTHER_USER_WORKSPACE_ID}/api-keys`, {
            method: 'GET',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('Data Integrity', () => {
      test('should return 500 if stored key permissions are invalid JSON', async () => {
        const now = new Date().toISOString();
        sqlite.exec(`
          INSERT OR REPLACE INTO api_keys (
            id, workspace_id, name, key_hash, key_prefix, mode, scopes, created_at, expires_at, last_used_at, revoked_at
          ) VALUES (
            'key_bad_scopes', '${VALID_WORKSPACE_ID}', 'Bad Scopes Key', 'bad_hash', 'sk_live_bad1...', 'live', 'not-json', '${now}', NULL, NULL, NULL
          )
        `);

        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'GET',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('SERVER_ERROR');
      });
    });
  });

  describe('DELETE /workspaces/:workspaceId/api-keys/:keyId - Delete API Key', () => {
    describe('Successful Deletion', () => {
      test('should return 200 on successful deletion', async () => {
        // First create a key
        const createResponse = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Key to Delete',
              permissions: ['read'],
            }),
          })
        );

        const createBody = await createResponse.json();
        const keyId = createBody.data.id;

        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys/${keyId}`, {
            method: 'DELETE',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'RevokeApiKeyResponse');
        expect(body.ok).toBe(true);
      });

      test('should return { id, revoked: true } in response', async () => {
        const createResponse = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Key for Delete Response',
              permissions: ['read'],
            }),
          })
        );

        const createBody = await createResponse.json();
        const keyId = createBody.data.id;

        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys/${keyId}`, {
            method: 'DELETE',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        const body = await response.json();
        assertValidResponse(body, 'RevokeApiKeyResponse');
        expect(body.data.id).toBe(keyId);
        expect(body.data.revoked).toBe(true);
      });

      test('deleted key should not appear in list', async () => {
        const createResponse = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Key to Remove from List',
              permissions: ['read'],
            }),
          })
        );

        const createBody = await createResponse.json();
        const keyId = createBody.data.id;

        // Delete the key
        await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys/${keyId}`, {
            method: 'DELETE',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        // Verify it's not in the list
        const listResponse = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'GET',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        expect(listResponse.status).toBe(200);
        const listBody = await listResponse.json();
        const deletedKey = listBody.data.keys.find((k: { id: string }) => k.id === keyId);
        expect(deletedKey).toBeUndefined();
      });
    });

    describe('Authentication & Authorization', () => {
      test('should return 401 without session cookie', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys/key_test123`, {
            method: 'DELETE',
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('UNAUTHORIZED');
      });

      test('should return 403 for non-owner of workspace', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${OTHER_USER_WORKSPACE_ID}/api-keys/key_test123`, {
            method: 'DELETE',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('Error Cases', () => {
      test('should return 404 for non-existent key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys/key_nonexistent`, {
            method: 'DELETE',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
      });

      test('should return 404 when deleting already deleted key', async () => {
        const createResponse = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Key to Double Delete',
              permissions: ['read'],
            }),
          })
        );

        const createBody = await createResponse.json();
        const keyId = createBody.data.id;

        // Delete once
        await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys/${keyId}`, {
            method: 'DELETE',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        // Try to delete again
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys/${keyId}`, {
            method: 'DELETE',
            headers: { Cookie: VALID_SESSION_COOKIE },
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
      });
    });
  });
});

