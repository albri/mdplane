/**
 * API Keys - Bearer Token Authentication Tests
 */

import { describe, expect, test, beforeAll, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { resetApiKeysTestData } from '../fixtures/api-keys-fixtures';
import {
  activeOAuthSessions,
  VALID_SESSION_TOKEN,
  OTHER_SESSION_TOKEN,
  ISO_TIMESTAMP_PATTERN,
  VALID_WORKSPACE_ID,
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

describe('API Key Authentication (Bearer Token)', () => {
  let app: TestApp;

  // Test API key for authentication tests
  const VALID_API_KEY = 'sk_live_testValidApiKey12345678';
  const EXPIRED_API_KEY = 'sk_live_testExpiredKey12345678';
  const DELETED_API_KEY = 'sk_live_testDeletedKey12345678';
  const READ_ONLY_API_KEY = 'sk_live_testReadOnlyKey1234567';
  const INVALID_API_KEY = 'sk_live_invalidKeyNotInDb1234';

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

  describe('Successful Authentication', () => {
    test('should authenticate requests with valid API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should update lastUsed timestamp on successful use', async () => {
      // Use the API key
      await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      // Check the key's lastUsed in the list
      const listResponse = await app.handle(
        new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
          method: 'GET',
          headers: { Cookie: VALID_SESSION_COOKIE },
        })
      );

      expect(listResponse.status).toBe(200);
      const listBody = await listResponse.json();
      const usedKey = listBody.data.keys.find((k: { prefix: string }) =>
        VALID_API_KEY.startsWith(k.prefix.replace('...', ''))
      );
      expect(usedKey?.lastUsedAt).toMatch(ISO_TIMESTAMP_PATTERN);
    });
  });

  describe('Authentication Failures', () => {
    test('should return 401 for expired API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${EXPIRED_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 401 for deleted API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${DELETED_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 401 for invalid key format', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer invalid_format_key',
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 401 for unknown key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${INVALID_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 401 when Authorization header is missing', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 401 for malformed Bearer token', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: 'BearerMissingSpace',
          },
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('Scope Enforcement', () => {
    test('should allow read operation with read scope', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${READ_ONLY_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
    });

    test('should reject write operation with read-only key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/new-file.md', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${READ_ONLY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: '# New File' }),
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    test('should reject append operation with read-only key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test%2Ffile.md/append', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${READ_ONLY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Additional content' }),
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Deleted Key Behavior', () => {
    test('deleted key should fail on subsequent use', async () => {
      // Create a key
      const createResponse = await app.handle(
        new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: VALID_SESSION_COOKIE,
          },
          body: JSON.stringify({
            name: 'Key to Test Deletion Auth',
            permissions: ['read'],
          }),
        })
      );

      const createBody = await createResponse.json();
      const apiKey = createBody.data.key;
      const keyId = createBody.data.id;

      // Verify the key works
      const authResponse1 = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
        })
      );
      expect(authResponse1.status).toBe(200);

      // Delete the key
      await app.handle(
        new Request(`http://localhost/workspaces/${VALID_WORKSPACE_ID}/api-keys/${keyId}`, {
          method: 'DELETE',
          headers: { Cookie: VALID_SESSION_COOKIE },
        })
      );

      // Verify the key no longer works
      const authResponse2 = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
        })
      );
      expect(authResponse2.status).toBe(401);
    });
  });
});

