/**
 * User Test Fixtures with Session Support
 *
 * Factory functions for creating test users and sessions directly in database.
 * Uses '__int_' prefix for easy identification and cleanup.
 */

import { db } from '../../db';
import { authUser, authSession } from '../../db/schema';
import { generateKey } from '../../core/capability-keys';
import { CONFIG } from '../config';
import type { TestUser } from './users';

/**
 * Represents a user with session.
 */
export interface TestUserWithSession extends TestUser {
  /** Session token for authentication */
  sessionToken: string;
}

/**
 * Options for creating a user with session.
 */
export interface CreateUserWithSessionOptions {
  /** User email (default: auto-generated) */
  email?: string;
  /** User name (default: 'Test User') */
  name?: string;
  /** Session expiration in milliseconds (default: 7 days) */
  sessionExpiresIn?: number;
}

/**
 * Create a test user with session in BetterAuth tables.
 *
 * Creates user in authUser table and session in authSession table.
 *
 * @param options - Optional user and session configuration
 * @returns Object with userId, sessionToken, and email
 */
export async function createTestUserWithSession(
  options: CreateUserWithSessionOptions = {}
): Promise<TestUserWithSession> {
  const userId = `${CONFIG.TEST_PREFIX}usr_${generateKey(12)}`;
  const sessionToken = `${CONFIG.TEST_PREFIX}ses_${generateKey(16)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (options.sessionExpiresIn ?? 60 * 60 * 24 * 7 * 1000)); // 7 days default

  const userEmail = options.email ?? `test.${userId.substring(5)}@integration.test`;
  const userName = options.name ?? 'Test User';

  await db.insert(authUser).values({
    id: userId,
    name: userName,
    email: userEmail,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(authSession).values({
    id: sessionToken,
    userId,
    token: sessionToken,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[FIXTURE] Created user with session: ${userId}`);

  return {
    id: userId,
    email: userEmail,
    name: userName,
    createdAt: new Date(now).toISOString(),
    sessionToken,
  };
}
