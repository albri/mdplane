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

  describe('POST /w/:writeKey/claim - Without Session', () => {
    test('should return 401 when no session cookie is provided', async () => {
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
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('OAuth session required. Login via GitHub or Google first.');
    });

    test('should return 401 for invalid session token', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: INVALID_SESSION_COOKIE,
          },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /w/:writeKey/claim - With Valid Session (OAuth Claim)', () => {
    describe('Successful Claim', () => {
      test('should return 200 with workspaceId and no apiKey for valid session', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.workspaceId).toBeDefined();
        expect(body.data.workspaceId).toMatch(WORKSPACE_ID_PATTERN);
        expect(body.data.apiKey).toBeUndefined();
        expect(body.data.message).toBe('claimed');
        assertValidResponse(body, 'ClaimWorkspaceResponse');
      });

      test('should return workspaceId in response', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        const body = await response.json();
        expect(body.data.workspaceId).toBeDefined();
        expect(body.data.workspaceId).toMatch(WORKSPACE_ID_PATTERN);
      });

      test('should not return API key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        const body = await response.json();
        expect(body.data.apiKey).toBeUndefined();
      });

      test('should return message "claimed"', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(oauthUser),
            },
            body: JSON.stringify({}),
          })
        );

        const body = await response.json();
        expect(body.data.message).toBe('claimed');
      });
    });

    describe('Already Claimed Workspace', () => {
      test('should return 400 ALREADY_CLAIMED if workspace already claimed', async () => {
        // First claim the workspace
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

        // Try to claim again with a different user
        const anotherUser = await createTestOAuthSession('another@example.com', 'Another User');
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
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('ALREADY_CLAIMED');
        expect(body.error.message).toBe('Workspace is already claimed by another user');
      });
    });

    describe('Invalid Write Key', () => {
      test('should return 404 for invalid write key', async () => {
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
        expect(body.error.code).toBe('NOT_FOUND');
        expect(body.error.message).toBe('Workspace not found');
      });

      test('should return 404 for read key (not write key)', async () => {
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
        expect(body.ok).toBe(false);
      });

      test('should return 404 for append key (not write key)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.appendKey}/claim`, {
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
      });
    });
  });

});




