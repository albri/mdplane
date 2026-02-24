/**
 * API Keys - ETag and If-Match Tests
 * Tests for ETag response headers and If-Match concurrency control
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

describe('ETag and If-Match', () => {
  let app: TestApp;

  const VALID_API_KEY = 'sk_live_testValidApiKey12345678';
  const WRITE_API_KEY = 'sk_live_testAppendKey12345678';

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

  describe('GET /api/v1/files/* - ETag Response Header', () => {
    test('should return ETag response header', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const etag = response.headers.get('ETag');
      expect(etag).toBeDefined();
      expect(etag).toMatch(/^[a-f0-9]{16}$/);
    });

    test('ETag header should match computed ETag in body', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const body = await response.json();
      const etagHeader = response.headers.get('ETag');
      expect(etagHeader).toBe(body.data.etag);
    });

    test('ETag should change when file content changes', async () => {
      // Get initial ETag
      const response1 = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const etag1 = response1.headers.get('ETag');
      if (!etag1) throw new Error('Missing ETag header');

      // Update the file
      await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WRITE_API_KEY}`,
            'If-Match': etag1,
          },
          body: JSON.stringify({ content: 'Updated content' }),
        })
      );

      // Get new ETag
      const response2 = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const etag2 = response2.headers.get('ETag');
      expect(etag2).toBeDefined();
      expect(etag2).not.toBe(etag1);
    });
  });

  describe('PUT /api/v1/files/* - If-Match Concurrency Control', () => {
    test('should return 200 when If-Match matches current ETag', async () => {
      // Get current ETag
      const getResponse = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const etag = getResponse.headers.get('ETag');
      if (!etag) throw new Error('Missing ETag header');
      if (!etag) throw new Error('Missing ETag header');

      // Update with correct If-Match
      const putResponse = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WRITE_API_KEY}`,
            'If-Match': etag,
          },
          body: JSON.stringify({ content: 'New content' }),
        })
      );

      expect(putResponse.status).toBe(200);
      const body = await putResponse.json();
      expect(body.ok).toBe(true);
    });

    test('should return 412 when If-Match does not match current ETag', async () => {
      // Get current ETag
      const getResponse = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const etag = getResponse.headers.get('ETag');
      if (!etag) throw new Error('Missing ETag header');

      // Update the file with one request
      await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WRITE_API_KEY}`,
            'If-Match': etag,
          },
          body: JSON.stringify({ content: 'First update' }),
        })
      );

      // Try to update again with old ETag (simulating concurrent modification)
      const conflictResponse = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WRITE_API_KEY}`,
            'If-Match': etag,
          },
          body: JSON.stringify({ content: 'Second update' }),
        })
      );

      expect(conflictResponse.status).toBe(412);
      const body = await conflictResponse.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toBe('File was modified since last read');
      expect(body.error.details?.currentEtag).toBeDefined();
      expect(body.error.details?.providedEtag).toBe(etag);
    });

    test('should accept If-Match with quotes (HTTP standard)', async () => {
      const getResponse = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const etag = getResponse.headers.get('ETag');

      // Send If-Match with quotes as per HTTP standard
      const putResponse = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WRITE_API_KEY}`,
            'If-Match': `"${etag}"`,
          },
          body: JSON.stringify({ content: 'Updated with quoted etag' }),
        })
      );

      expect(putResponse.status).toBe(200);
    });

    test('should allow PUT without If-Match (last-write-wins)', async () => {
      const putResponse = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WRITE_API_KEY}`,
          },
          body: JSON.stringify({ content: 'Update without If-Match' }),
        })
      );

      expect(putResponse.status).toBe(200);
      const body = await putResponse.json();
      expect(body.ok).toBe(true);
    });

    test('should return new ETag header on successful PUT', async () => {
      const getResponse = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const oldEtag = getResponse.headers.get('ETag');
      if (!oldEtag) throw new Error('Missing ETag header');

      // Update the file
      const putResponse = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WRITE_API_KEY}`,
            'If-Match': oldEtag,
          },
          body: JSON.stringify({ content: 'New content' }),
        })
      );

      expect(putResponse.status).toBe(200);
      const newEtag = putResponse.headers.get('ETag');
      expect(newEtag).toBeDefined();
      expect(newEtag).not.toBe(oldEtag);

      // Verify new ETag matches response body
      const body = await putResponse.json();
      expect(newEtag).toBe(body.data.etag);
    });

    test('412 error body should match OpenAPI Error schema', async () => {
      const etag = 'wrongetag12345678';

      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WRITE_API_KEY}`,
            'If-Match': etag,
          },
          body: JSON.stringify({ content: 'Content' }),
        })
      );

      expect(response.status).toBe(412);
      const body = await response.json();

      // Validate Error schema
      expect(body.ok).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toBe('File was modified since last read');
      expect(body.error.details).toBeDefined();
      expect(typeof body.error.details.currentEtag).toBe('string');
      expect(typeof body.error.details.providedEtag).toBe('string');
    });
  });

  describe('ETag Header Format', () => {
    test('ETag should be 16-character hex string', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const etag = response.headers.get('ETag');
      expect(etag).toMatch(/^[a-f0-9]{16}$/);
    });

    test('ETag should be consistent for same content', async () => {
      const response1 = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const response2 = await app.handle(
        new Request('http://localhost/api/v1/files/test/file.md', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const etag1 = response1.headers.get('ETag');
      const etag2 = response2.headers.get('ETag');
      expect(etag1).toBe(etag2);
    });
  });
});

