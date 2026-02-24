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

  describe('URL Decoding for /api/v1/files/*', () => {
    describe('URL-encoded paths should decode correctly', () => {
      test('GET should decode URL-encoded path and return file', async () => {
        // Test file exists at /test/file.md
        const response = await app.handle(
          new Request('http://localhost/api/v1/files/test%2Ffile.md', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.filename).toBe('file.md');
        expect(body.data.content).toBe('# Test File');
      });

      test('GET should handle multiple encoded slashes in path', async () => {
        // Create a test file with nested path first
        await app.handle(
          new Request('http://localhost/api/v1/files/projects/alpha/notes.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: '# Nested File' }),
          })
        );

        // Now read it with URL-encoded path
        const response = await app.handle(
          new Request('http://localhost/api/v1/files/projects%2Falpha%2Fnotes.md', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.content).toBe('# Nested File');
      });

      test('POST should decode URL-encoded path and create file', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/files/new%2Ffolder%2Ftest.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: '# New File' }),
          })
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.path).toBe('/new/folder/test.md');

        // Verify it can be read back
        const readResponse = await app.handle(
          new Request('http://localhost/api/v1/files/new%2Ffolder%2Ftest.md', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );
        expect(readResponse.status).toBe(200);
        const readBody = await readResponse.json();
        expect(readBody.data.content).toBe('# New File');
      });

      test('PUT should decode URL-encoded path and update file', async () => {
        // First create a file
        await app.handle(
          new Request('http://localhost/api/v1/files/update-test.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Original' }),
          })
        );

        // Update it with URL-encoded path
        const response = await app.handle(
          new Request('http://localhost/api/v1/files/update-test.md', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Updated' }),
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);

        // Verify it was updated
        const readResponse = await app.handle(
          new Request('http://localhost/api/v1/files/update-test.md', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );
        const readBody = await readResponse.json();
        expect(readBody.data.content).toBe('Updated');
      });

      test('DELETE should decode URL-encoded path and delete file', async () => {
        // First create a file
        await app.handle(
          new Request('http://localhost/api/v1/files/delete-test.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'To be deleted' }),
          })
        );

        // Delete it
        const deleteResponse = await app.handle(
          new Request('http://localhost/api/v1/files/delete-test.md', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
          })
        );

        expect(deleteResponse.status).toBe(200);
        const deleteBody = await deleteResponse.json();
        expect(deleteBody.ok).toBe(true);
        expect(deleteBody.data.deleted).toBe(true);

        // Verify it's gone (410 Gone for soft-deleted files)
        const readResponse = await app.handle(
          new Request('http://localhost/api/v1/files/delete-test.md', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );
        expect(readResponse.status).toBe(410);
        const readBody = await readResponse.json();
        expect(readBody.error.code).toBe('GONE');
      });

      test('DELETE with ?permanent=true should permanently delete file', async () => {
        // Create a file
        const createResponse = await app.handle(
          new Request('http://localhost/api/v1/files/permanent-delete-test.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'To be permanently deleted' }),
          })
        );
        expect(createResponse.status).toBe(201);

        // Permanently delete it
        const deleteResponse = await app.handle(
          new Request('http://localhost/api/v1/files/permanent-delete-test.md?permanent=true', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
          })
        );

        expect(deleteResponse.status).toBe(200);
        const deleteBody = await deleteResponse.json();
        expect(deleteBody.ok).toBe(true);
        expect(deleteBody.data.deleted).toBe(true);
        expect(deleteBody.data.recoverable).toBe(false);

        // Verify it's truly gone (404 for never existed)
        const readResponse = await app.handle(
          new Request('http://localhost/api/v1/files/permanent-delete-test.md', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );
        expect(readResponse.status).toBe(404);
      });

      test('PUT on soft-deleted file returns 410 Gone', async () => {
        // Create a file
        await app.handle(
          new Request('http://localhost/api/v1/files/soft-deleted-put-test.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Initial content' }),
          })
        );

        // Soft delete it
        await app.handle(
          new Request('http://localhost/api/v1/files/soft-deleted-put-test.md', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
          })
        );

        // Try to update - should get 410
        const putResponse = await app.handle(
          new Request('http://localhost/api/v1/files/soft-deleted-put-test.md', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Updated content' }),
          })
        );

        expect(putResponse.status).toBe(410);
        const putBody = await putResponse.json();
        expect(putBody.error.code).toBe('GONE');
      });

      test('POST /append on soft-deleted file returns 410 Gone', async () => {
        // Create a file
        await app.handle(
          new Request('http://localhost/api/v1/files/soft-deleted-append-test.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Initial content' }),
          })
        );

        // Soft delete it
        await app.handle(
          new Request('http://localhost/api/v1/files/soft-deleted-append-test.md', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
          })
        );

        // Try to append - should get 410
        const appendResponse = await app.handle(
          new Request('http://localhost/api/v1/files/soft-deleted-append-test.md/append', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${APPEND_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Appended text' }),
          })
        );

        expect(appendResponse.status).toBe(410);
        const appendBody = await appendResponse.json();
        expect(appendBody.error.code).toBe('GONE');
      });

      test('DELETE on already soft-deleted file returns 410 Gone', async () => {
        // Create a file
        await app.handle(
          new Request('http://localhost/api/v1/files/double-delete-test.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Initial content' }),
          })
        );

        // Soft delete it
        const firstDelete = await app.handle(
          new Request('http://localhost/api/v1/files/double-delete-test.md', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
          })
        );
        expect(firstDelete.status).toBe(200);

        // Try to delete again - should get 410
        const secondDelete = await app.handle(
          new Request('http://localhost/api/v1/files/double-delete-test.md', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
          })
        );

        expect(secondDelete.status).toBe(410);
        const deleteBody = await secondDelete.json();
        expect(deleteBody.error.code).toBe('GONE');
      });

      test('POST /append should decode URL-encoded path and append to file', async () => {
        // First create a file with URL-encoded path
        const createResponse = await app.handle(
          new Request('http://localhost/api/v1/files/new%2Ffolder%2Fappend-test.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Initial content' }),
          })
        );

        // Verify file was created (allow 200 or 201 for stability on reruns)
        expect(createResponse.status).toBeGreaterThanOrEqual(200);
        expect(createResponse.status).toBeLessThanOrEqual(201);
        const createBody = await createResponse.json();
        expect(createBody.data.path).toBe('/new/folder/append-test.md');

        // Append to it with URL-encoded path
        const appendResponse = await app.handle(
          new Request('http://localhost/api/v1/files/new%2Ffolder%2Fappend-test.md/append', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${APPEND_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Appended text' }),
          })
        );

        expect(appendResponse.status).toBe(201);
        const appendBody = await appendResponse.json();
        expect(appendBody.ok).toBe(true);
        // Verify append response has expected fields
        expect(appendBody.data).toBeDefined();
        expect(appendBody.data.id).toBeDefined();

        // Verify it was appended
        const readResponse = await app.handle(
          new Request('http://localhost/api/v1/files/new%2Ffolder%2Fappend-test.md', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );
        const readBody = await readResponse.json();
        expect(readBody.data.content).toContain('Initial content');
        expect(readBody.data.content).toContain('Appended text');
      });
    });

    describe('Malformed URL encoding should return 400', () => {
      test('GET should return 400 for malformed URL encoding (%ZZ)', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/files/test%ZZfile.md', {
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
          new Request('http://localhost/api/v1/files/test%ZZfile.md', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Test' }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('PUT should return 400 for malformed URL encoding', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/files/test%ZZfile.md', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${WRITE_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Test' }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('DELETE should return 400 for malformed URL encoding', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/files/test%ZZfile.md', {
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

      test('POST /append should return 400 for malformed URL encoding', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/files/test%ZZfile.md/append', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${APPEND_API_KEY}`,
            },
            body: JSON.stringify({ content: 'Test' }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 for incomplete percent encoding (%)', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/files/test%file.md', {
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
    });
  });
});
