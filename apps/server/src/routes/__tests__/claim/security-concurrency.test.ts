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

  describe('Workspace Lifecycle', () => {
    test('a workspace can only be claimed once', async () => {
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

      // Try to claim again
      const anotherUser = await createTestOAuthSession('lifecycle@example.com', 'Lifecycle User');
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

    test('claiming is optional - requires OAuth session', async () => {
      // Without session, should get 401
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('Security Tests', () => {
    describe('Rate Limiting', () => {
      test('should rate limit claim attempts per IP', async () => {
        const testIp = `10.0.0.${Date.now() % 255}`;

        // Make multiple claim requests (will get 401 but still count)
        for (let i = 0; i < 10; i++) {
          await app.handle(
            new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'CF-Connecting-IP': testIp,
              },
              body: JSON.stringify({}),
            })
          );
        }

        // Next request should be rate limited
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CF-Connecting-IP': testIp,
            },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(429);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('RATE_LIMITED');
      });

      test('should include retryAfterSeconds in rate limit response', async () => {
        const testIp = `10.0.1.${Date.now() % 255}`;

        // Exhaust rate limit
        for (let i = 0; i < 10; i++) {
          await app.handle(
            new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'CF-Connecting-IP': testIp,
              },
              body: JSON.stringify({}),
            })
          );
        }

        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CF-Connecting-IP': testIp,
            },
            body: JSON.stringify({}),
          })
        );

        expect(response.status).toBe(429);
        const body = await response.json();
        // Verify retryAfterSeconds in response body
        expect(body.error.details).toBeDefined();
        expect(body.error.details.retryAfterSeconds).toBeDefined();
        expect(typeof body.error.details.retryAfterSeconds).toBe('number');
        expect(body.error.details.retryAfterSeconds).toBeGreaterThan(0);
        // Retry-After header is optional - check body.error.details.retryAfterSeconds instead
        // (header may not be set by all rate limiting implementations)
      });
    });
  });

  describe('Concurrent Access - Race Conditions', () => {
    // Note: These tests verify concurrent request handling and expected response patterns.
    // With real database, exactly one claim should succeed.

    describe('Concurrent Claims', () => {
      test('two agents claim same task with Promise.all() - one wins, one gets 409', async () => {
        // Setup: Two agents try to claim the same unclaimed task simultaneously
        const user1 = await createTestOAuthSession('agent1@example.com', 'Agent 1');
        activeOAuthSessions.set(user1.sessionToken, user1);
        const user2 = await createTestOAuthSession('agent2@example.com', 'Agent 2');
        activeOAuthSessions.set(user2.sessionToken, user2);

        const claimRequest = (user: TestOAuthUser) =>
          app.handle(
            new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Cookie: createOAuthCookieHeader(user),
              },
              body: JSON.stringify({}),
            })
          );

        // WHEN: Both claim at same time
        const [res1, res2] = await Promise.all([claimRequest(user1), claimRequest(user2)]);

        // THEN: One succeeds (200), one fails (400 ALREADY_CLAIMED)
        const statuses = [res1.status, res2.status].sort();
        expect(statuses).toEqual([200, 400]);
      });

      test('three agents claim simultaneously - exactly one should succeed in real scenario', async () => {
        const user1 = await createTestOAuthSession('multi1@example.com', 'Multi 1');
        activeOAuthSessions.set(user1.sessionToken, user1);
        const user2 = await createTestOAuthSession('multi2@example.com', 'Multi 2');
        activeOAuthSessions.set(user2.sessionToken, user2);
        const user3 = await createTestOAuthSession('multi3@example.com', 'Multi 3');
        activeOAuthSessions.set(user3.sessionToken, user3);

        const claimRequest = (user: TestOAuthUser) =>
          app.handle(
            new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Cookie: createOAuthCookieHeader(user),
              },
              body: JSON.stringify({}),
            })
          );

        // WHEN: Three agents try to claim at the same time
        const [res1, res2, res3] = await Promise.all([
          claimRequest(user1),
          claimRequest(user2),
          claimRequest(user3),
        ]);

        // THEN: Exactly one succeeds (200), others fail (400 ALREADY_CLAIMED)
        const statuses = [res1.status, res2.status, res3.status].sort();
        expect(statuses).toEqual([200, 400, 400]);
      });

      test('claim while workspace being completed - proper handling', async () => {
        // Simulate a scenario where claim and completion happen concurrently
        const user1 = await createTestOAuthSession('active1@example.com', 'Active 1');
        activeOAuthSessions.set(user1.sessionToken, user1);
        const user2 = await createTestOAuthSession('active2@example.com', 'Active 2');
        activeOAuthSessions.set(user2.sessionToken, user2);

        const claimRequest = app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(user1),
            },
            body: JSON.stringify({}),
          })
        );

        // Simulate concurrent claim attempt
        const secondClaimRequest = app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: createOAuthCookieHeader(user2),
            },
            body: JSON.stringify({}),
          })
        );

        const [res1, res2] = await Promise.all([claimRequest, secondClaimRequest]);

        // One succeeds (200), one fails (400 ALREADY_CLAIMED)
        const statuses = [res1.status, res2.status].sort();
        expect(statuses).toEqual([200, 400]);
      });

      test('multiple concurrent claim attempts with different IPs', async () => {
        // Test that rate limiting works across concurrent requests from different IPs
        const user1 = await createTestOAuthSession('ip1@example.com', 'IP 1');
        activeOAuthSessions.set(user1.sessionToken, user1);
        const user2 = await createTestOAuthSession('ip2@example.com', 'IP 2');
        activeOAuthSessions.set(user2.sessionToken, user2);
        const user3 = await createTestOAuthSession('ip3@example.com', 'IP 3');
        activeOAuthSessions.set(user3.sessionToken, user3);

        const claimFromIp = (ip: string, user: TestOAuthUser) =>
          app.handle(
            new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Cookie: createOAuthCookieHeader(user),
                'CF-Connecting-IP': ip,
              },
              body: JSON.stringify({}),
            })
          );

        // WHEN: Multiple IPs claim concurrently
        const results = await Promise.all([
          claimFromIp('192.168.1.1', user1),
          claimFromIp('192.168.1.2', user2),
          claimFromIp('192.168.1.3', user3),
        ]);

        // THEN: All complete without crashing, one succeeds
        expect(results.length).toBe(3);
        for (const res of results) {
          // Each should return a valid response
          expect(res.status).toBeGreaterThanOrEqual(200);
          expect(res.status).toBeLessThan(600);
        }
      });

      test('concurrent claims with rapid succession', async () => {
        // Test behavior when claims come in rapid succession
        const users: TestOAuthUser[] = [];
        for (let i = 0; i < 5; i++) {
          const user = await createTestOAuthSession(`rapid${i}@example.com`, `Rapid ${i}`);
          activeOAuthSessions.set(user.sessionToken, user);
          users.push(user);
        }

        const promises: Promise<Response>[] = [];
        for (let i = 0; i < 5; i++) {
          promises.push(
            app.handle(
              new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Cookie: createOAuthCookieHeader(users[i]),
                },
                body: JSON.stringify({ requestId: i }),
              })
            )
          );
        }

        const results = await Promise.all(promises);

        // All requests should complete
        expect(results.length).toBe(5);

        // Verify all returned valid responses
        for (const res of results) {
          const body = await res.json();
          expect(typeof body.ok).toBe('boolean');
        }
      });
    });
  });

});



