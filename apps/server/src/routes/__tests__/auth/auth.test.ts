/**
 * Authentication Endpoint Tests
 *
 * Tests for session-based authentication endpoints.
 * Uses module mocking to test BetterAuth integration without real sessions.
 *
 * Endpoints:
 * - GET /auth/me - Get current user
 * - POST /auth/logout - Logout
 *
 * @see docs/API Design.md - Authentication section
 */

import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';
import { createOwnedWorkspaceForUser } from '../fixtures/auth-fixtures';

// Mock session data returned by BetterAuth
const MOCK_USER = {
  id: 'user_mock123456789',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  emailVerified: true,
  image: null,
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const MOCK_SESSION = {
  user: MOCK_USER,
  session: {
    id: 'session_mock123',
    userId: MOCK_USER.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    token: 'mock-session-token',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Control mock behavior
let mockSessionActive = false;
let mockSignOutCalled = false;

// Mock the auth module before importing the route
// Note: We must also mock auth.handler since the main index.ts uses it
mock.module('../../../core/auth', () => ({
  auth: {
    api: {
      getSession: async () => (mockSessionActive ? MOCK_SESSION : null),
      signOut: async () => {
        mockSignOutCalled = true;
        mockSessionActive = false;
      },
    },
    // Mock handler for Elysia .mount() - returns a no-op function
    handler: () => new Response('mock auth handler'),
  },
}));

// Import route AFTER mocking
const { authRoute } = await import('../../auth');

// Constants and Patterns

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const CLAIMED_WORKSPACE_ID = 'ws_test_auth_me_claimed';
const DELETED_WORKSPACE_ID = 'ws_test_auth_me_deleted';

describe('Authentication Endpoints', () => {
  const buildApp = () => new Elysia().use(authRoute);
  type TestApp = ReturnType<typeof buildApp>;
  let app: TestApp;

  beforeEach(() => {
    // Reset mock state before each test
    mockSessionActive = false;
    mockSignOutCalled = false;
    // Recreate app to ensure clean state
    app = buildApp();
  });

  // GET /auth/me - Get Current User
  describe('GET /auth/me - Get Current User', () => {
    describe('Authenticated User', () => {
      test('should return 200 with valid session', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/me', { method: 'GET' })
        );

        expect(response.status).toBe(200);
      });

      test('should return ok: true with valid session', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/me', { method: 'GET' })
        );

        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return user email', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/me', { method: 'GET' })
        );

        const body = await response.json();
        expect(body.data.email).toBe(MOCK_USER.email);
      });

      test('should return workspaces array', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/me', { method: 'GET' })
        );

        const body = await response.json();
        expect(body.data.workspaces).toBeDefined();
        expect(Array.isArray(body.data.workspaces)).toBe(true);
      });

      test('should include claimed workspaces from user_workspaces', async () => {
        mockSessionActive = true;

        const workspaceId = CLAIMED_WORKSPACE_ID;
        createOwnedWorkspaceForUser({
          workspaceId,
          userId: MOCK_USER.id,
          name: 'Test Workspace',
        });

        const response = await app.handle(new Request('http://localhost/auth/me', { method: 'GET' }));
        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'MeResponse');

        expect(Array.isArray(body.data.workspaces)).toBe(true);
        const found = body.data.workspaces.find((w: { id: string }) => w.id === workspaceId);
        expect(found).toBeDefined();
        expect(found.name).toBe('Test Workspace');
      });

      test('should exclude deleted workspaces from /auth/me', async () => {
        mockSessionActive = true;

        const workspaceId = DELETED_WORKSPACE_ID;
        createOwnedWorkspaceForUser({
          workspaceId,
          userId: MOCK_USER.id,
          name: 'Deleted Workspace',
          deletedAt: new Date().toISOString(),
        });

        const response = await app.handle(new Request('http://localhost/auth/me', { method: 'GET' }));
        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'MeResponse');

        const found = body.data.workspaces.find((w: { id: string }) => w.id === workspaceId);
        expect(found).toBeUndefined();
      });

      test('should return created timestamp in ISO format', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/me', { method: 'GET' })
        );

        const body = await response.json();
        expect(body.data.createdAt).toBeDefined();
        expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should return user id', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/me', { method: 'GET' })
        );

        const body = await response.json();
        expect(body.data.id).toBe(MOCK_USER.id);
      });

      test('should match MeResponse schema', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/me', { method: 'GET' })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'MeResponse');
      });
    });

    describe('Unauthenticated User', () => {
      test('should return 401 without valid session', async () => {
        // mockSessionActive is false by default
        const response = await app.handle(
          new Request('http://localhost/auth/me', { method: 'GET' })
        );

        expect(response.status).toBe(401);
      });

      test('should return ok: false without valid session', async () => {
        const response = await app.handle(
          new Request('http://localhost/auth/me', { method: 'GET' })
        );

        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return error object without valid session', async () => {
        const response = await app.handle(
          new Request('http://localhost/auth/me', { method: 'GET' })
        );

        const body = await response.json();
        expect(body.error).toBeDefined();
        expect(body.error.code).toBe('UNAUTHORIZED');
      });
    });
  });

  // POST /auth/logout - Logout
  describe('POST /auth/logout - Logout', () => {
    describe('Successful Logout', () => {
      test('should return 200 on logout', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/logout', { method: 'POST' })
        );

        expect(response.status).toBe(200);
      });

      test('should return ok: true on logout', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/logout', { method: 'POST' })
        );

        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return status: logged_out', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/logout', { method: 'POST' })
        );

        const body = await response.json();
        expect(body.data.status).toBe('logged_out');
      });

      test('should call signOut on BetterAuth', async () => {
        mockSessionActive = true;

        await app.handle(
          new Request('http://localhost/auth/logout', { method: 'POST' })
        );

        expect(mockSignOutCalled).toBe(true);
      });

      test('should clear session cookie', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/logout', { method: 'POST' })
        );

        const setCookie = response.headers.get('Set-Cookie');
        expect(setCookie).toBeDefined();
        expect(setCookie).toContain('Max-Age=0');
      });

      test('should return 401 without active session', async () => {
        // mockSessionActive is false by default
        const response = await app.handle(
          new Request('http://localhost/auth/logout', { method: 'POST' })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('UNAUTHORIZED');
      });

      test('should match LogoutResponse schema', async () => {
        mockSessionActive = true;

        const response = await app.handle(
          new Request('http://localhost/auth/logout', { method: 'POST' })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'LogoutResponse');
      });
    });
  });

  // Session Invalidation Tests
  describe('Session Invalidation', () => {
    test('should invalidate session on logout', async () => {
      mockSessionActive = true;

      // Verify session is valid before logout
      const beforeResponse = await app.handle(
        new Request('http://localhost/auth/me', { method: 'GET' })
      );
      expect(beforeResponse.status).toBe(200);

      // Logout (mock signOut sets mockSessionActive = false)
      await app.handle(
        new Request('http://localhost/auth/logout', { method: 'POST' })
      );

      // Session should now be invalid
      const afterResponse = await app.handle(
        new Request('http://localhost/auth/me', { method: 'GET' })
      );
      expect(afterResponse.status).toBe(401);
    });
  });
});
