/**
 * Capability Key Test Fixtures
 *
 * Factory functions for creating test capability keys directly in database.
 */

import { capabilityKeys } from '../../db/schema';
import { generateScopedKey, hashKey, generateKey, type Permission } from '../../core/capability-keys';
import { CONFIG } from '../config';
import { db } from '../../db';

/**
 * Represents a created capability key.
 */
export interface TestCapabilityKey {
  /** Key identifier in database */
  id: string;
  /** Plaintext key string for authentication */
  plaintextKey: string;
  /** Permission level */
  permission: Permission;
  /** Scope type */
  scopeType: 'workspace' | 'folder' | 'file';
  /** Scope path */
  scopePath: string | null;
  /** Workspace ID */
  workspaceId: string;
}

/**
 * Options for creating capability keys.
 */
export interface CreateCapabilityKeyOptions {
  /** Permission level */
  permission: Permission;
  /** Workspace ID */
  workspaceId: string;
  /** Scope type (default: 'workspace') */
  scopeType?: 'workspace' | 'folder' | 'file';
  /** Scope path (default: '/') */
  scopePath?: string;
  /** Bound author for author-restricted keys */
  boundAuthor?: string;
  /** WIP limit for append keys */
  wipLimit?: number;
  /** Allowed append types (JSON array) */
  allowedTypes?: string[];
  /** Display name for key */
  displayName?: string;
}

/**
 * Create a test capability key directly in database.
 *
 * @param options - Key configuration options
 * @returns The capability key with plaintext key for authentication
 */
export async function createTestCapabilityKey(
  options: CreateCapabilityKeyOptions
): Promise<TestCapabilityKey> {
  const keyId = `${CONFIG.TEST_PREFIX}ck_${generateKey(12)}`;
  const plaintextKey = generateScopedKey(options.permission);
  const keyHash = hashKey(plaintextKey);
  const now = new Date().toISOString();

  const key = await db.insert(capabilityKeys).values({
    id: keyId,
    workspaceId: options.workspaceId,
    prefix: plaintextKey.substring(0, 4),
    keyHash,
    permission: options.permission,
    scopeType: options.scopeType ?? 'workspace',
    scopePath: options.scopePath ?? '/',
    boundAuthor: options.boundAuthor ?? null,
    wipLimit: options.wipLimit ?? null,
    allowedTypes: options.allowedTypes ? JSON.stringify(options.allowedTypes) : null,
    displayName: options.displayName ?? null,
    createdAt: now,
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
  }).returning();

  console.log(`[FIXTURE] Created capability key: ${keyId} (${options.permission})`);

  return {
    id: key[0].id,
    plaintextKey,
    permission: key[0].permission,
    scopeType: key[0].scopeType,
    scopePath: key[0].scopePath,
    workspaceId: key[0].workspaceId,
  };
}
