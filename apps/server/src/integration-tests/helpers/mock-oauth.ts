/**
 * Mock OAuth Helper
 *
 * Creates mock BetterAuth sessions directly in the database for testing
 * OAuth-protected endpoints without calling real OAuth providers.
 */

import { db } from '../../db';
import { authUser, authSession } from '../../db/schema';
import { CONFIG } from '../config';
import { eq } from 'drizzle-orm';

const AUTH_BASE_URL = `${CONFIG.TEST_API_URL}/api/auth`;

function stableTestPassword(email: string): string {
  const base = Buffer.from(email, 'utf8')
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 24);
  return `${CONFIG.TEST_PREFIX}pw_${base}`;
}

/**
 * Create a mock user in the database.
 *
 * @param email - User email
 * @returns The user ID
 */
export async function createMockUser(email: string): Promise<string> {
  const existing = await db.select().from(authUser).where(eq(authUser.email, email));
  if (existing.length > 0) {
    const id = existing[0]!.id as string;
    console.log(`[MOCK-OAUTH] Reusing existing user: ${id} (${email})`);
    return id;
  }

  const userId = `${CONFIG.TEST_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  await db.insert(authUser).values({
    id: userId,
    name: 'Test User',
    email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const user = await db.select().from(authUser).where(eq(authUser.id, userId));
  if (!user || user.length === 0) {
    throw new Error(`Failed to create user: ${userId}`);
  }

  console.log(`[MOCK-OAUTH] Created user: ${userId} (${email})`);

  return userId;
}

/**
 * Create a mock session in the database.
 *
 * @param userId - User ID to create session for
 * @returns The session token (id field)
 */
export async function createMockSession(userId: string): Promise<string> {
  const sessionToken = `${CONFIG.TEST_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 24 * 7 * 1000); // 7 days

  await db.insert(authSession).values({
    id: sessionToken,
    userId,
    token: sessionToken,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  const session = await db.select().from(authSession).where(eq(authSession.id, sessionToken));
  if (!session || session.length === 0) {
    throw new Error(`Failed to create session: ${sessionToken}`);
  }

  console.log(`[MOCK-OAUTH] Created session: ${sessionToken.substring(0, 12)}... for user: ${userId}`);

  return sessionToken;
}

/**
 * Create a mock user with session.
 *
 * @param email - User email (default: test@integration.test)
 * @returns Object with userId, sessionToken, and email
 */
export async function createUserWithSession(email?: string): Promise<{
  userId: string;
  sessionToken: string;
  email: string;
}> {
  const actualEmail = email || `${CONFIG.TEST_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}@integration.test`;
  const password = stableTestPassword(actualEmail);

  // Best-effort sign-up (may already exist)
  await fetch(`${AUTH_BASE_URL}/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: actualEmail, password, name: 'Test User' }),
  }).catch(() => undefined);

  const res = await fetch(`${AUTH_BASE_URL}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: actualEmail, password }),
  });

  if (!res.ok) {
    throw new Error(`Failed to sign in via BetterAuth: ${res.status} ${await res.text()}`);
  }

  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/(?:^|,\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/);
  const signedCookieValue = match?.[1];
  if (!signedCookieValue) {
    throw new Error(`Failed to extract BetterAuth session cookie from set-cookie: ${setCookie}`);
  }

  const json = await res.json();
  const userId = (json?.user?.id || json?.data?.user?.id) as string | undefined;
  if (!userId) {
    throw new Error(`Sign-in response missing user id: ${JSON.stringify(json)}`);
  }

  return { userId, sessionToken: signedCookieValue, email: actualEmail };
}

/**
 * Get an auth cookie header value for a session token.
 *
 * @param sessionToken - Session token
 * @returns Cookie header value
 */
export function getAuthCookie(sessionToken: string): string {
  return `better-auth.session_token=${sessionToken}`;
}

/**
 * Get auth headers with Cookie for a session token.
 *
 * @param sessionToken - Session token
 * @returns Headers object with Cookie
 */
export function getAuthHeaders(sessionToken: string): Record<string, string> {
  return {
    Cookie: getAuthCookie(sessionToken),
  };
}
