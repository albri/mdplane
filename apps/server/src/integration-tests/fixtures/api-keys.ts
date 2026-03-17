/**
 * API Key Test Fixtures
 *
 * Factory functions for creating test API keys directly in database.
 * Uses '__int_' prefix for easy identification and cleanup.
 */

import { db } from '../../db';
import { apiKeys } from '../../db/schema';
import { generateApiKey, hashKey, generateKey, type ApiKeyMode } from '../../core/capability-keys';
import { CONFIG } from '../config';

/**
 * Represents a created API key.
 */
export interface TestApiKey {
  /** API key identifier in database */
  id: string;
  /** Plaintext API key for authentication */
  plaintextKey: string;
  /** API key name */
  name: string;
  /** API key mode (live or test) */
  mode: ApiKeyMode;
  /** Workspace ID */
  workspaceId: string;
  /** Key prefix (first few characters for identification) */
  keyPrefix: string;
  /** Scopes (JSON array) */
  scopes: string[] | null;
}

/**
 * Options for creating an API key.
 */
export interface CreateApiKeyOptions {
  /** Workspace ID */
  workspaceId: string;
  /** API key name */
  name?: string;
  /** API key mode (default: 'test') */
  mode?: ApiKeyMode;
  /** Scopes (JSON array) */
  scopes?: string[];
  /** Rate limit overrides (JSON object) */
  rateLimit?: Record<string, number>;
  /** Expiration date (ISO string) */
  expiresAt?: string | null;
}

/**
 * Create a test API key directly in database.
 *
 * @param options - API key configuration options
 * @returns The API key with plaintext key for authentication
 */
export async function createTestApiKey(
  options: CreateApiKeyOptions
): Promise<TestApiKey> {
  const keyId = `${CONFIG.TEST_PREFIX}ak_${generateKey(12)}`;
  const plaintextKey = generateApiKey(options.mode ?? 'test');
  const keyHash = hashKey(plaintextKey);
  const keyPrefix = plaintextKey.substring(0, 12);
  const now = new Date().toISOString();

  const key = await db.insert(apiKeys).values({
    id: keyId,
    workspaceId: options.workspaceId,
    name: options.name ?? `${CONFIG.TEST_PREFIX}Test API Key`,
    keyHash,
    keyPrefix,
    mode: options.mode ?? 'test',
    scopes: options.scopes ? JSON.stringify(options.scopes) : null,
    createdAt: now,
    expiresAt: options.expiresAt ?? null,
    lastUsedAt: null,
    revokedAt: null,
    rateLimit: options.rateLimit ? JSON.stringify(options.rateLimit) : null,
  }).returning();

  console.log(`[FIXTURE] Created API key: ${keyId}`);

  return {
    id: key[0].id,
    plaintextKey,
    name: key[0].name ?? options.name ?? `${CONFIG.TEST_PREFIX}Test API Key`,
    mode: key[0].mode as ApiKeyMode,
    workspaceId: key[0].workspaceId,
    keyPrefix: key[0].keyPrefix,
    scopes: options.scopes ?? null,
  };
}

// Note: Use createTestCapabilityKey from ./capability-keys directly
// This file only exports API key-related fixtures
