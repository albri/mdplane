/**
 * API Keys - Folder CRUD Tests
 */

import { describe, expect, test, beforeAll, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { resetApiKeysTestData } from '../fixtures/api-keys-fixtures';
import {
  activeOAuthSessions,
  VALID_SESSION_TOKEN,
  OTHER_SESSION_TOKEN,
  ISO_TIMESTAMP_PATTERN,
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

describe('API Key Folder CRUD', () => {
  let app: TestApp;

  const VALID_API_KEY = 'sk_live_testValidApiKey12345678';
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

  describe('POST /api/v1/folders/* - Create Folder', () => {
    test('should create folder at root with valid API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
          body: JSON.stringify({ name: 'new-folder' }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'FolderCreateResponse');
      expect(body.ok).toBe(true);
      expect(body.data.path).toBe('/new-folder');
      expect(body.data.urls).toBeDefined();
      expect(body.data.urls.read).toContain('/r/');
      expect(body.data.urls.append).toContain('/a/');
      expect(body.data.urls.write).toContain('/w/');
      expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
    });

    test('should create folder in parent path with valid API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders/parent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
          body: JSON.stringify({ name: 'child-folder' }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.path).toBe('/parent/child-folder');
    });

    test('should return 401 without Authorization header', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'test-folder' }),
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authorization header required');
    });

    test('should return 401 with invalid API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${INVALID_API_KEY}`,
          },
          body: JSON.stringify({ name: 'test-folder' }),
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 403 with read-only API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${READ_ONLY_API_KEY}`,
          },
          body: JSON.stringify({ name: 'test-folder' }),
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toBe('Insufficient scope');
    });

    test('should return 422 without folder name (schema validation)', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      // This codebase normalizes validation errors to 400.
      expect(response.status).toBe(400);
    });

    test('should return 409 when folder already exists', async () => {
      // Create folder first
      await app.handle(
        new Request('http://localhost/api/v1/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
          body: JSON.stringify({ name: 'duplicate-folder' }),
        })
      );

      // Try to create again
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
          body: JSON.stringify({ name: 'duplicate-folder' }),
        })
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FOLDER_ALREADY_EXISTS');
    });
  });

  describe('GET /api/v1/folders* - Query Validation', () => {
    test('should return 400 for invalid root folder query (depth=0)', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders?depth=0', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should return 400 for invalid folder query (limit=0)', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders/projects?limit=0', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should omit per-file capability urls from folder listing', async () => {
      await app.handle(
        new Request('http://localhost/api/v1/files/security/urls.md', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
          body: JSON.stringify({ content: '# URL Check' }),
        })
      );

      const response = await app.handle(
        new Request('http://localhost/api/v1/folders/security', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);

      const fileItems = (body.data.items as Array<{ type: string; name: string; urls?: unknown }>).filter(
        (item) => item.type === 'file'
      );
      expect(fileItems.length).toBeGreaterThan(0);
      expect(fileItems.some((item) => item.name === 'urls.md')).toBe(true);
      for (const item of fileItems) {
        expect(item.urls).toBeUndefined();
      }
    });
  });

  describe('DELETE /api/v1/folders/* - Delete Folder', () => {
    test('should delete empty folder with valid API key', async () => {
      // Create folder first
      await app.handle(
        new Request('http://localhost/api/v1/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
          body: JSON.stringify({ name: 'to-delete' }),
        })
      );

      // Delete the folder
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders/to-delete', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FolderDeleteResponse');
      expect(body.ok).toBe(true);
      expect(body.data.deleted).toBe(true);
      expect(body.data.path).toBe('/to-delete');
    });

    test('should return 401 without Authorization header', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders/some-folder', {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 401 with invalid API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders/some-folder', {
          method: 'DELETE',
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

    test('should return 403 with read-only API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders/some-folder', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${READ_ONLY_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    test('should return 404 for non-existent folder', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders/non-existent-folder', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FOLDER_NOT_FOUND');
    });

    test('should return 400 when trying to delete root folder', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/folders/', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      // Empty path should return 400
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });
});

