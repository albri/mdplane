/**
 * API Keys - Create API Key Tests
 * POST /workspaces/:workspaceId/api-keys
 */

import { describe, expect, test, beforeAll, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { resetApiKeysTestData } from '../fixtures/api-keys-fixtures';
import {
  activeOAuthSessions,
  VALID_SESSION_TOKEN,
  OTHER_SESSION_TOKEN,
  API_KEY_PATTERN,
  KEY_ID_PATTERN,
  ISO_TIMESTAMP_PATTERN,
  VALID_WORKSPACE_ID,
  NON_EXISTENT_WORKSPACE_ID,
  OTHER_USER_WORKSPACE_ID,
  VALID_SESSION_COOKIE,
  VALID_PERMISSIONS,
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

describe('Create API Key', () => {
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

  describe('POST /workspaces/:workspaceId/api-keys - Create API Key', () => {
    describe('Successful Creation', () => {
      test('should return 201 with API key data', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'CI Pipeline',
              permissions: ['read', 'append'],
            }),
          })
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        assertValidResponse(body, 'ApiKeyCreateResponse');
        expect(body.ok).toBe(true);
      });

      test('should return full key only at creation time (sk_live_... format)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Test Key',
              permissions: ['read'],
            }),
          })
        );

        const body = await response.json();
        assertValidResponse(body, 'ApiKeyCreateResponse');
        expect(body.data.key).toMatch(API_KEY_PATTERN);
        expect(body.data.key.startsWith('sk_live_') || body.data.key.startsWith('sk_test_')).toBe(true);
      });

      test('should return key id starting with key_', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Test Key',
              permissions: ['read'],
            }),
          })
        );

        const body = await response.json();
        expect(body.data.id).toMatch(KEY_ID_PATTERN);
      });

      test('should return name in response', async () => {
        const keyName = 'My CI Pipeline Key';
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: keyName,
              permissions: ['read', 'write'],
            }),
          })
        );

        const body = await response.json();
        expect(body.data.name).toBe(keyName);
      });

      test('should return permissions in response', async () => {
        const permissions = ['read', 'append'];
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Scoped Key',
              permissions,
            }),
          })
        );

        const body = await response.json();
        expect(body.data.permissions).toEqual(permissions);
      });

      test('should return created timestamp', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Timestamped Key',
              permissions: ['read'],
            }),
          })
        );

        const body = await response.json();
        expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should support optional expiresInSeconds', async () => {
        const expiresInSeconds = 86400; // 24 hours
        const now = Date.now();
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Expiring Key',
              permissions: ['read'],
              expiresInSeconds,
            }),
          })
        );

        const body = await response.json();
        expect(body.data.expiresAt).toBeDefined();
        // Verify it's approximately 24 hours from now (within 5 seconds tolerance)
        const expiresAtTime = new Date(body.data.expiresAt).getTime();
        expect(expiresAtTime).toBeGreaterThan(now + expiresInSeconds * 1000 - 5000);
        expect(expiresAtTime).toBeLessThan(now + expiresInSeconds * 1000 + 5000);
      });

      test('should support all valid permissions: read, append, write, export', async () => {
        for (const scope of VALID_PERMISSIONS) {
          const response = await app.handle(
            new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Cookie: VALID_SESSION_COOKIE,
              },
              body: JSON.stringify({
                name: `Key with ${scope}`,
                permissions: [scope],
              }),
            })
          );

          expect(response.status).toBe(201);
          const body = await response.json();
          expect(body.data.permissions).toContain(scope);
        }
      });

      test('should generate unique keys for each creation', async () => {
        const response1 = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Key 1',
              permissions: ['read'],
            }),
          })
        );

        const response2 = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Key 2',
              permissions: ['read'],
            }),
          })
        );

        const body1 = await response1.json();
        const body2 = await response2.json();
        expect(body1.data.key).not.toBe(body2.data.key);
        expect(body1.data.id).not.toBe(body2.data.id);
      });
    });

    describe('Authentication & Authorization', () => {
      test('should return 401 without session cookie', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Test Key',
              permissions: ['read'],
            }),
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
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Test Key',
              permissions: ['read'],
            }),
          })
        );

        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FORBIDDEN');
      });

      test('should return 404 for non-existent workspace', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${NON_EXISTENT_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Test Key',
              permissions: ['read'],
            }),
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('Validation', () => {
      test('should return 400 when name is missing', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              permissions: ['read'],
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 when name exceeds max length (64 chars)', async () => {
        const longName = 'a'.repeat(65);
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: longName,
              permissions: ['read'],
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 when permissions is missing', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Test Key',
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 when permissions is empty array', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Test Key',
              permissions: [],
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 for invalid permission value', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Test Key',
              permissions: ['invalid_scope'],
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 when permissions contains mix of valid and invalid', async () => {
        const response = await app.handle(
          new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: VALID_SESSION_COOKIE,
            },
            body: JSON.stringify({
              name: 'Test Key',
              permissions: ['read', 'delete_all'],
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });
    });
  });
});

