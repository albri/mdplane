/**
 * Workspace Claiming Endpoint Tests
 *
 * Tests for OAuth-only workspace claiming.
 *
 * Endpoints:
 * - POST /w/:writeKey/claim - Claim a workspace (requires OAuth session)
 *
 * @see docs/API Design.md - Claiming Workspaces section
 */

import { describe, expect, test, beforeAll, beforeEach, mock } from 'bun:test';
import type { Elysia } from 'elysia';

// Import test app factory
import { createTestApp } from '../../../../tests/helpers';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

// Import route reset function
import { resetClaimState } from '../fixtures/claim-state-fixtures';

// Import test fixtures
import {
  createTestWorkspace,
  cleanupTestWorkspaces,
} from '../../../../tests/fixtures/workspace';
import {
  createTestOAuthSession,
  createOAuthCookieHeader,
  cleanupTestOAuthSessions,
  type TestOAuthUser,
} from '../../../../tests/fixtures/oauth-session';

// Track active OAuth sessions for mocking BetterAuth
let activeOAuthSessions = new Map<string, TestOAuthUser>();

// Mock the auth module before importing test app
// This mocks BetterAuth's getSession to return test sessions
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
              const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

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
                  token: user.sessionToken,
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

// Key patterns
const WORKSPACE_ID_PATTERN = /^ws_[A-Za-z0-9]{12,}$/;
const API_KEY_LIVE_PATTERN = /^sk_live_[A-Za-z0-9]{20,}$/;

// Invalid session cookie (wrong format)
const INVALID_SESSION_COOKIE = 'session=invalidToken123';

describe('Workspace Claiming', () => {
  let app: ReturnType<typeof createTestApp>;
  let oauthUser: TestOAuthUser;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;

  beforeAll(async () => {
    // Create test app with all routes (including bootstrap for workspace creation)
    app = createTestApp();
    // Create OAuth session for tests
    oauthUser = await createTestOAuthSession('claim-test@example.com', 'Claim Tester');
  });

  beforeEach(async () => {
    // Reset claim state and cleanup between tests
    resetClaimState();
    cleanupTestWorkspaces();
    cleanupTestOAuthSessions();
    activeOAuthSessions.clear();

    // Recreate OAuth user after cleanup
    oauthUser = await createTestOAuthSession('claim-test@example.com', 'Claim Tester');

    // Add to mock sessions map for BetterAuth mock
    activeOAuthSessions.set(oauthUser.sessionToken, oauthUser);

    // Create a fresh workspace for each test
    workspace = await createTestWorkspace(app);
  });

  describe('Error Response Consistency', () => {
    /**
     * Standard error response structure:
     * {
     *   ok: false,
     *   error: {
     *     code: 'ERROR_CODE',
     *     message: 'Human readable description',
     *     details?: { ... }
     *   }
     * }
     */

    describe('Error Structure Consistency', () => {
      test('401 errors should have standard structure', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error).toBeDefined();
        expect(body.error.code).toBeDefined();
        expect(typeof body.error.code).toBe('string');
        expect(body.error.message).toBeDefined();
        expect(typeof body.error.message).toBe('string');
      });

      test('404 errors should have standard structure', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/invalidKey123/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error).toBeDefined();
        expect(body.error.code).toBeDefined();
        expect(typeof body.error.code).toBe('string');
        expect(body.error.message).toBeDefined();
        expect(typeof body.error.message).toBe('string');
      });

      test('409 errors should have standard structure', async () => {
        // First claim
        await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        // Second claim attempt with different user
        const anotherUser = await createTestOAuthSession('conflict@example.com', 'Conflict User');
        activeOAuthSessions.set(anotherUser.sessionToken, anotherUser);
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(anotherUser),
            },
            body: JSON.stringify({}),
          })
        );

        // Should be 400 ALREADY_CLAIMED (not 409)
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error).toBeDefined();
        expect(body.error.code).toBeDefined();
        expect(typeof body.error.code).toBe('string');
        expect(body.error.message).toBeDefined();
        expect(typeof body.error.message).toBe('string');
      });
    });

    describe('Error Code Consistency', () => {
      test('should use UNAUTHORIZED for missing session', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error.code).toBe('UNAUTHORIZED');
      });

      test('should use NOT_FOUND for invalid write key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/invalidKey123/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('NOT_FOUND');
      });

      test('should use NOT_FOUND for non-write keys', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.readKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('NOT_FOUND');
      });

      test('should use ALREADY_CLAIMED for duplicate claims', async () => {
        // First claim
        await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        // Second claim attempt with different user
        const anotherUser = await createTestOAuthSession('duplicate@example.com', 'Duplicate User');
        activeOAuthSessions.set(anotherUser.sessionToken, anotherUser);
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(anotherUser),
            },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('ALREADY_CLAIMED');
      });
    });

    describe('HTTP Status Code Consistency', () => {
      test('401 should be used for authentication issues', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error.code).toBe('UNAUTHORIZED');
      });

      test('404 should be used for invalid write key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/invalidKey123/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('NOT_FOUND');
      });

      test('400 should be used for already claimed errors', async () => {
        // First claim
        await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        // Second claim attempt with different user
        const anotherUser = await createTestOAuthSession('status@example.com', 'Status User');
        activeOAuthSessions.set(anotherUser.sessionToken, anotherUser);
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(anotherUser),
            },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('ALREADY_CLAIMED');
      });
    });

    describe('Error Message Quality', () => {
      test('error messages should be human-readable', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        );

        const body = await response.json();
        expect(body.error.message.length).toBeGreaterThan(5);
        // Should not contain stack traces or internal paths
        expect(body.error.message).not.toContain('at ');
        expect(body.error.message).not.toContain('node_modules');
      });

      test('error messages should not expose internal details', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/invalidKey123/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        const body = await response.json();
        // Should not expose database details or internal paths
        expect(body.error.message).not.toContain('sqlite');
        expect(body.error.message).not.toContain('drizzle');
        expect(body.error.message).not.toContain('C:\\');
      });
    });
  });
});




