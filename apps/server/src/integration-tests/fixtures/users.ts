/**
 * User Test Fixtures
 *
 * Factory functions for creating test users directly in database.
 * Uses '__int_' prefix for easy identification and cleanup.
 */

import { db } from '../../db';
import { users } from '../../db/schema';
import { generateKey } from '../../core/capability-keys';
import { CONFIG } from '../config';

/**
 * Represents a created test user.
 */
export interface TestUser {
  /** Unique user identifier */
  id: string;
  /** User email */
  email: string;
  /** User name */
  name: string;
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Options for creating a test user.
 */
export interface CreateUserOptions {
  /** User email (default: auto-generated) */
  email?: string;
  /** User name (default: 'Test User') */
  name?: string;
}

/**
 * Create a test user directly in database.
 *
 * @param options - Optional user configuration
 * @returns The created user entity
 */
export async function createTestUser(options: CreateUserOptions = {}): Promise<TestUser> {
  const userId = `${CONFIG.TEST_PREFIX}usr_${generateKey(12)}`;
  const now = new Date().toISOString();

  const user = await db.insert(users).values({
    id: userId,
    email: options.email ?? `test.${userId.substring(5)}@integration.test`,
    createdAt: now,
  }).returning();

  console.log(`[FIXTURE] Created user: ${userId}`);

  return {
    id: user[0].id,
    email: user[0].email,
    name: 'Test User',
    createdAt: user[0].createdAt,
  };
}
