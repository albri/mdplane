/**
 * API Keys - URL Decoding Tests
 * Tests for URL-encoded path handling in /api/v1/files/* and /api/v1/folders/*
 */

import { describe, expect, test, beforeAll, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { resetApiKeysTestData } from '../fixtures/api-keys-fixtures';
import {
  activeOAuthSessions,
  VALID_SESSION_TOKEN,
  OTHER_SESSION_TOKEN,
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

describe('URL Decoding Tests', () => {
  let app: TestApp;

  const VALID_API_KEY = 'sk_live_testValidApiKey12345678';
  const WRITE_API_KEY = 'sk_live_testValidApiKey12345678'; // Same key has write scope
  const APPEND_API_KEY = 'sk_live_testAppendKey12345678'; // Key has append scope

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

  describe('URL Decoding for /api/v1/folders/*', () => {
    describe('URL-encoded paths should decode correctly', () => {
      test('GET should decode URL-encoded folder path', async () => {
        // Create a test file in a folder
        await app.handle(
          new Request('http://localhost/api/v1/files/projects%2Falpha%2Fnotes.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: '# Notes' }),
          })
        );

        // Read the folder with URL-encoded path
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/projects%2Falpha', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.path).toBe('/projects/alpha/');
      });

      test('GET should handle multiple encoded slashes in folder path', async () => {
        // Create a test file in a nested folder
        await app.handle(
          new Request('http://localhost/api/v1/files/folder1%2Ffolder2%2Ffolder3%2Ffile.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: '# Nested File' }),
          })
        );

        // Read the folder with URL-encoded path
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/folder1%2Ffolder2', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.path).toBe('/folder1/folder2/');
      });

      test('POST should decode URL-encoded parent path', async () => {
        // Create a folder in a URL-encoded parent path
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/projects%2Falpha', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ name: 'new-folder' }),
          })
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.path).toBe('/projects/alpha/new-folder');
      });

      test('DELETE should decode URL-encoded folder path', async () => {
        // Create a folder first
        await app.handle(
          new Request('http://localhost/api/v1/folders/test%2Fdelete-me', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ name: 'folder' }),
          })
        );

        // Delete it with URL-encoded path
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/test%2Fdelete-me%2Ffolder', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.deleted).toBe(true);
      });
    });

    describe('Path traversal should return 400', () => {
      test('GET should return 400 for path traversal (..)', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/..%2F', {
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
        expect(body.error.message).toContain('Path traversal');
      });

      test('GET should return 400 for path traversal with prefix (../test)', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/..%2Ftest', {
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
        expect(body.error.message).toContain('Path traversal');
      });

      test('GET should return 400 for path traversal in middle (test/../other)', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/test%2F..%2Fother', {
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

      test('POST should return 400 for path traversal in parent path', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/..%2F', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ name: 'new-folder' }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
        expect(body.error.message).toContain('Path traversal');
      });

      test('DELETE should return 400 for path traversal', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/..%2F', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
        expect(body.error.message).toContain('Path traversal');
      });
    });

    describe('Malformed URL encoding should return 400', () => {
      test('GET should return 400 for malformed URL encoding (%ZZ)', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/test%ZZfolder', {
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
        expect(body.error.message).toContain('Invalid URL encoding');
      });

      test('POST should return 400 for malformed URL encoding', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/test%ZZfolder', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ name: 'new-folder' }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('DELETE should return 400 for malformed URL encoding', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/folders/test%ZZfolder', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });
    });
  });
});
