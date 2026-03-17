/**
 * Workspace Test Fixtures
 *
 * Factory functions for creating test workspaces directly in database.
 * Uses '__int_' prefix for easy identification and cleanup.
 */

import { db } from '../../db';
import { workspaces, capabilityKeys, userWorkspaces } from '../../db/schema';
import { generateKey, hashKey, generateScopedKey, type Permission } from '../../core/capability-keys';
import { CONFIG } from '../config';
import type { TestCapabilityKey } from './capability-keys';

export async function linkUserToWorkspace(options: {
  userId: string;
  workspaceId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(userWorkspaces).values({
    id: `${CONFIG.TEST_PREFIX}uw_${generateKey(16)}`,
    userId: options.userId,
    workspaceId: options.workspaceId,
    createdAt: now,
  });
}

/**
 * Represents a created test workspace.
 */
export interface TestWorkspace {
  /** Unique workspace identifier */
  id: string;
  /** Workspace name */
  name: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last activity timestamp */
  lastActivityAt: string;
}

/**
 * Options for creating a test workspace.
 */
export interface CreateWorkspaceOptions {
  /** Workspace name (default: auto-generated with prefix) */
  name?: string;
  /** Whether workspace is claimed (default: false) */
  claimed?: boolean;
  /** Claim email if claimed (default: test@integration.test) */
  claimedByEmail?: string;
  /** Initial storage used bytes (default: 0) */
  storageUsedBytes?: number;
}

/**
 * Create a test workspace directly in database.
 *
 * @param options - Optional workspace configuration
 * @returns The created workspace entity
 */
export async function createTestWorkspace(options: CreateWorkspaceOptions = {}): Promise<TestWorkspace> {
  const workspaceId = `${CONFIG.TEST_PREFIX}ws_${generateKey(16)}`;
  const now = new Date().toISOString();
  
  const workspace = await db.insert(workspaces).values({
    id: workspaceId,
    name: options.name ?? `${CONFIG.TEST_PREFIX}Test Workspace ${workspaceId.substring(5)}`,
    createdAt: now,
    claimedAt: options.claimed ? now : null,
    claimedByEmail: options.claimed ? (options.claimedByEmail ?? 'test@integration.test') : null,
    lastActivityAt: now,
    storageUsedBytes: options.storageUsedBytes ?? 0,
  }).returning();

  console.log(`[FIXTURE] Created workspace: ${workspaceId}`);

  return {
    id: workspace[0].id,
    name: workspace[0].name!,
    createdAt: workspace[0].createdAt,
    lastActivityAt: workspace[0].lastActivityAt,
  };
}

/**
 * Options for creating capability keys.
 */
export interface CapabilityKeyOptions {
  /** Permission level */
  permission: Permission;
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
 * Create a capability key for a workspace.
 *
 * @param workspaceId - Workspace ID
 * @param options - Key configuration options
 * @returns Object with plaintext key and database entity
 */
export async function createCapabilityKey(
  workspaceId: string,
  options: CapabilityKeyOptions
): Promise<TestCapabilityKey> {
  const keyId = `${CONFIG.TEST_PREFIX}ck_${generateKey(12)}`;
  const plaintextKey = generateScopedKey(options.permission);
  const keyHash = hashKey(plaintextKey);
  const now = new Date().toISOString();

  const key = await db.insert(capabilityKeys).values({
    id: keyId,
    workspaceId,
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

/**
 * Represents a workspace with capability keys.
 */
export interface TestWorkspaceWithKeys extends TestWorkspace {
  /** Read capability key */
  readKey: TestCapabilityKey;
  /** Append capability key */
  appendKey: TestCapabilityKey;
  /** Write capability key */
  writeKey: TestCapabilityKey;
}

/**
 * Create a test workspace with all three capability keys (read, append, write).
 *
 * @param options - Optional workspace configuration
 * @returns Workspace with capability keys
 */
export async function createTestWorkspaceWithKeys(options: CreateWorkspaceOptions = {}): Promise<TestWorkspaceWithKeys> {
  const workspace = await createTestWorkspace(options);

  const [readKey, appendKey, writeKey] = await Promise.all([
    createCapabilityKey(workspace.id, { permission: 'read' }),
    createCapabilityKey(workspace.id, { permission: 'append' }),
    createCapabilityKey(workspace.id, { permission: 'write' }),
  ]);

  return {
    ...workspace,
    readKey,
    appendKey,
    writeKey,
  };
}
