/**
 * OAuth Session Test Fixtures
 *
 * Provides utilities to create mock OAuth sessions for testing
 * features that require BetterAuth authentication.
 */

import type { Elysia } from 'elysia';
import { sqlite } from '../../src/db';
import { generateKey } from '../../src/core/capability-keys';

export interface TestOAuthUser {
  id: string;
  email: string;
  name: string;
  sessionToken: string;
}

/**
 * Creates a mock OAuth user and session in BetterAuth tables.
 *
 * This simulates what happens after a user completes GitHub/Google OAuth:
 * 1. BetterAuth creates a user in the `user` table
 * 2. BetterAuth creates a session in the `session` table
 * 3. BetterAuth sets the `better-auth.session_token` cookie
 *
 * @param email - User email (defaults to random)
 * @param name - User name (defaults to 'Test User')
 * @returns TestOAuthUser with session token for use in Cookie header
 */
export async function createTestOAuthSession(
  email?: string,
  name?: string
): Promise<TestOAuthUser> {
  let userId = `usr_${generateKey(16)}`;
  const sessionId = `ses_${generateKey(16)}`;
  const sessionToken = generateKey(32); // BetterAuth stores token directly (not hashed)
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days from now

  const userEmail = email ?? `test-${generateKey(8)}@example.com`;
  const userName = name ?? 'Test User';

  // Insert user into BetterAuth user table (idempotent by email).
  // If a user with this email already exists, reuse its id.
  const existing = sqlite
    .query<{ id: string }, [string]>('SELECT id FROM user WHERE email = ?')
    .get(userEmail);
  if (existing?.id) {
    userId = existing.id;
    sqlite.exec(`UPDATE user SET name = '${userName}', updated_at = ${now} WHERE id = '${userId}'`);
  } else {
    sqlite.exec(`
      INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES ('${userId}', '${userName}', '${userEmail}', 1, ${now}, ${now})
    `);
  }

  // Insert session into BetterAuth session table
  sqlite.exec(`
    INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id)
    VALUES ('${sessionId}', ${expiresAt}, '${sessionToken}', ${now}, ${now}, '${userId}')
  `);

  return {
    id: userId,
    email: userEmail,
    name: userName,
    sessionToken,
  };
}

/**
 * Creates a Cookie header value for a BetterAuth session.
 * BetterAuth uses the cookie name: better-auth.session_token
 *
 * @param tokenOrUser - Either the session token string or a TestOAuthUser object
 * @returns Cookie header value
 */
export function createOAuthCookieHeader(tokenOrUser: string | TestOAuthUser): string {
  const token = typeof tokenOrUser === 'string' ? tokenOrUser : tokenOrUser.sessionToken;
  return `better-auth.session_token=${token}`;
}

/**
 * Helper to make an authenticated request with OAuth session.
 *
 * @param app - Elysia app instance
 * @param method - HTTP method
 * @param url - Request URL
 * @param oauthUser - OAuth user from createTestOAuthSession
 * @param body - Optional request body
 * @returns Response
 */
export async function authenticatedRequest(
  app: Elysia,
  method: string,
  url: string,
  oauthUser: TestOAuthUser,
  body?: unknown
): Promise<Response> {
  const headers: Record<string, string> = {
    Cookie: createOAuthCookieHeader(oauthUser.sessionToken),
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  return app.handle(
    new Request(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  );
}

/**
 * Cleanup test OAuth sessions and users.
 * Call this in afterEach/afterAll to prevent test pollution.
 */
export function cleanupTestOAuthSessions(): void {
  try {
    // Delete all test sessions (those with usr_ prefix in user_id)
    sqlite.exec(`DELETE FROM session WHERE user_id LIKE 'usr_%'`);
    // Delete all test users
    sqlite.exec(`DELETE FROM user WHERE id LIKE 'usr_%'`);
  } catch {
    // Ignore errors if tables don't exist
  }
}
