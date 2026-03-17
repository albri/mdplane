/**
 * Capability Key Test Fixtures
 *
 * Factory functions for creating special capability keys for testing.
 * Supports expired, revoked, file-scoped, folder-scoped, and bound author keys.
 *
 * @example
 * ```typescript
 * const app = createTestApp();
 * const workspace = await createTestWorkspace(app);
 * const expiredKey = await createExpiredKey(workspace, 'read');
 * const fileScopedKey = await createFileScopedKey(workspace, 'read', '/path/to/file.md');
 * ```
 */

import { sqlite } from '../../src/db';
import { generateKey, hashKey } from '../../src/core/capability-keys';
import type { TestWorkspace } from './workspace';

export type Permission = 'read' | 'append' | 'write';
export type ScopeType = 'workspace' | 'folder' | 'file';

export interface SpecialKeyOptions {
  /** Permission level */
  permission: Permission;
  /** Scope type (default: 'workspace') */
  scopeType?: ScopeType;
  /** Scope path (default: '/') */
  scopePath?: string;
  /** Bound author for author-restricted keys */
  boundAuthor?: string;
  /** WIP limit for append keys */
  wipLimit?: number;
  /** Allowed append types (JSON array) */
  allowedTypes?: string[];
  /** Display name for the key */
  displayName?: string;
  /** Whether the key is expired */
  expired?: boolean;
  /** Whether the key is revoked */
  revoked?: boolean;
}

/**
 * Create a special capability key directly in the database.
 *
 * This bypasses the API to create keys with special properties
 * that can't be created via normal endpoints (e.g., expired keys).
 *
 * @param workspace - Test workspace to create the key in
 * @param options - Key configuration options
 * @returns The plaintext key string
 */
export function createSpecialKey(
  workspace: TestWorkspace,
  options: SpecialKeyOptions
): string {
  const key = generateKey(22);
  const keyHash = hashKey(key);
  const keyId = generateKey(16);
  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

  const scopeType = options.scopeType ?? 'workspace';
  const scopePath = options.scopePath ?? '/';
  const expiresAt = options.expired ? pastDate : null;
  const revokedAt = options.revoked ? pastDate : null;
  const boundAuthor = options.boundAuthor ?? null;
  const wipLimit = options.wipLimit ?? null;
  const allowedTypes = options.allowedTypes ? JSON.stringify(options.allowedTypes) : null;
  const displayName = options.displayName ?? null;

  sqlite.exec(`
    INSERT INTO capability_keys (
      id, workspace_id, prefix, key_hash, permission, scope_type, scope_path,
      bound_author, wip_limit, allowed_types, display_name, created_at, expires_at, revoked_at
    ) VALUES (
      '${keyId}', '${workspace.workspaceId}', '${key.substring(0, 4)}', '${keyHash}',
      '${options.permission}', '${scopeType}', '${scopePath}',
      ${boundAuthor ? `'${boundAuthor}'` : 'NULL'},
      ${wipLimit !== null ? wipLimit : 'NULL'},
      ${allowedTypes ? `'${allowedTypes}'` : 'NULL'},
      ${displayName ? `'${displayName}'` : 'NULL'},
      '${now}',
      ${expiresAt ? `'${expiresAt}'` : 'NULL'},
      ${revokedAt ? `'${revokedAt}'` : 'NULL'}
    )
  `);

  return key;
}

/**
 * Create an expired capability key.
 */
export function createExpiredKey(workspace: TestWorkspace, permission: Permission): string {
  return createSpecialKey(workspace, { permission, expired: true });
}

/**
 * Create a revoked capability key.
 */
export function createRevokedKey(workspace: TestWorkspace, permission: Permission): string {
  return createSpecialKey(workspace, { permission, revoked: true });
}

/**
 * Create a file-scoped capability key.
 */
export function createFileScopedKey(
  workspace: TestWorkspace,
  permission: Permission,
  filePath: string
): string {
  return createSpecialKey(workspace, { permission, scopeType: 'file', scopePath: filePath });
}

/**
 * Create a folder-scoped capability key.
 */
export function createFolderScopedKey(
  workspace: TestWorkspace,
  permission: Permission,
  folderPath: string
): string {
  return createSpecialKey(workspace, { permission, scopeType: 'folder', scopePath: folderPath });
}

/**
 * Create a bound author capability key.
 */
export function createBoundAuthorKey(
  workspace: TestWorkspace,
  permission: Permission,
  boundAuthor: string
): string {
  return createSpecialKey(workspace, { permission, boundAuthor });
}

/**
 * Create a WIP-limited capability key.
 */
export function createWipLimitedKey(
  workspace: TestWorkspace,
  permission: Permission,
  wipLimit: number
): string {
  return createSpecialKey(workspace, { permission, wipLimit });
}

/**
 * Create a capability key with allowed types restriction.
 */
export function createAllowedTypesKey(
  workspace: TestWorkspace,
  permission: Permission,
  allowedTypes: string[]
): string {
  return createSpecialKey(workspace, { permission, allowedTypes });
}

