import { eq, and, isNull, desc } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { capabilityKeys } from '../../db/schema';
import { hashKey, validateKey, generateKey, generateScopedKey } from '../../core/capability-keys';
import { logAction } from '../../services/audit';
import type {
  Permission,
  ScopeType,
  CapabilitiesCheckResult,
  CreateKeyInput,
  CreateKeyResult,
  CreateKeyData,
  ListKeysInput,
  ListKeysResult,
  RevokeKeyInput,
  RevokeKeyResult,
} from './types';
import { mapPermission, isPermissionEscalation, truncateKey, truncateKeyForSecurity } from './validation';

function generateKeyId(): string {
  return `key_${generateKey(16)}`;
}

export async function checkCapabilities(keys: string[]): Promise<CapabilitiesCheckResult[]> {
  return Promise.all(
    keys.map(async (keyString) => {
      const truncatedKey = truncateKeyForSecurity(keyString);
      const isRoot = validateKey(keyString, 'root');
      const isScoped = validateKey(keyString, 'scoped');

      if (!keyString || (!isRoot && !isScoped)) {
        return { key: truncatedKey, valid: false, error: 'NOT_FOUND' as const };
      }

      const keyHash = hashKey(keyString);
      const keyRecord = await db.query.capabilityKeys.findFirst({
        where: (fields, { eq }) => eq(fields.keyHash, keyHash),
      });

      if (!keyRecord) {
        return { key: truncatedKey, valid: false, error: 'NOT_FOUND' as const };
      }

      if (keyRecord.expiresAt !== null && new Date(keyRecord.expiresAt) < new Date()) {
        return { key: truncatedKey, valid: false, error: 'EXPIRED' as const };
      }

      if (keyRecord.revokedAt !== null) {
        return { key: truncatedKey, valid: false, error: 'REVOKED' as const };
      }

      return {
        key: truncatedKey,
        valid: true,
        permission: keyRecord.permission,
        scope: keyRecord.scopeType as ScopeType,
        scopeId: keyRecord.workspaceId,
      };
    })
  );
}

export async function checkCapabilitiesInWorkspace(input: {
  keys: string[];
  workspaceId: string;
}): Promise<CapabilitiesCheckResult[]> {
  const { keys, workspaceId } = input;
  return Promise.all(
    keys.map(async (keyString) => {
      const truncatedKey = truncateKeyForSecurity(keyString);
      const isRoot = validateKey(keyString, 'root');
      const isScoped = validateKey(keyString, 'scoped');

      if (!keyString || (!isRoot && !isScoped)) {
        return { key: truncatedKey, valid: false, error: 'NOT_FOUND' as const };
      }

      const keyHash = hashKey(keyString);
      const keyRecord = await db.query.capabilityKeys.findFirst({
        where: (fields, { eq }) => eq(fields.keyHash, keyHash),
      });

      if (!keyRecord) {
        return { key: truncatedKey, valid: false, error: 'NOT_FOUND' as const };
      }

      const belongsToWorkspace = keyRecord.workspaceId === workspaceId;
      const isExpired = keyRecord.expiresAt !== null && new Date(keyRecord.expiresAt) < new Date();
      const isRevoked = keyRecord.revokedAt !== null;

      if (isExpired) {
        return {
          key: truncatedKey,
          valid: false,
          error: 'EXPIRED' as const,
          ...(belongsToWorkspace && { status: 'expired' as const }),
        };
      }

      if (isRevoked) {
        return {
          key: truncatedKey,
          valid: false,
          error: 'REVOKED' as const,
          ...(belongsToWorkspace && { status: 'revoked' as const }),
        };
      }

      if (belongsToWorkspace) {
        return {
          key: truncatedKey,
          valid: true,
          permission: keyRecord.permission,
          scope: keyRecord.scopeType as ScopeType,
          scopeId: keyRecord.workspaceId,
          path: keyRecord.scopePath ?? undefined,
          status: 'active' as const,
        };
      }

      return {
        key: truncatedKey,
        valid: true,
        permission: keyRecord.permission,
        scope: keyRecord.scopeType as ScopeType,
        scopeId: keyRecord.workspaceId,
      };
    })
  );
}

export async function createScopedKey(input: CreateKeyInput): Promise<CreateKeyResult> {
  const { workspaceId, parentPermission, requestedPermission, paths, boundAuthor, allowedTypes, wipLimit, displayName, expiresAt } = input;
  const internalPermission = mapPermission(requestedPermission);

  if (isPermissionEscalation(parentPermission, internalPermission)) {
    return { ok: false, status: 404, error: { code: 'PERMISSION_DENIED', message: 'Cannot create key with higher permission than parent' } };
  }

  const newKey = generateScopedKey(internalPermission);
  const keyHash = hashKey(newKey);
  const keyId = generateKeyId();
  const nowIso = new Date().toISOString();
  const scopePath = paths?.[0] ?? null;
  const scopeType = scopePath ? 'folder' : 'workspace';

  await db.insert(capabilityKeys).values({
    id: keyId,
    workspaceId,
    prefix: newKey.substring(0, 4),
    keyHash,
    permission: internalPermission,
    scopeType,
    scopePath,
    boundAuthor: boundAuthor ?? null,
    wipLimit: wipLimit ?? null,
    allowedTypes: allowedTypes ? JSON.stringify(allowedTypes) : null,
    displayName: displayName ?? null,
    createdAt: nowIso,
    expiresAt: expiresAt ?? null,
  });

  logAction({
    workspaceId,
    action: 'key.create',
    resourceType: 'key',
    resourceId: keyId,
    actorType: 'capability_url',
    metadata: { permission: internalPermission, scopeType, scopePath, boundAuthor, displayName },
  });

  const responseData: CreateKeyData = { id: keyId, key: newKey, permission: internalPermission, createdAt: nowIso };
  if (boundAuthor) responseData.boundAuthor = boundAuthor;
  if (displayName) responseData.displayName = displayName;
  if (wipLimit !== undefined && wipLimit !== null) responseData.wipLimit = wipLimit;
  if (allowedTypes) responseData.allowedTypes = allowedTypes;
  if (expiresAt) responseData.expiresAt = expiresAt;

  return { ok: true, data: responseData };
}

export async function listKeys(input: ListKeysInput): Promise<ListKeysResult> {
  const { workspaceId, includeRevoked } = input;
  const keys = await db.query.capabilityKeys.findMany({
    where: includeRevoked
      ? eq(capabilityKeys.workspaceId, workspaceId)
      : and(eq(capabilityKeys.workspaceId, workspaceId), isNull(capabilityKeys.revokedAt)),
    orderBy: [desc(capabilityKeys.createdAt)],
  });

  const keyList = keys.map((k) => {
    const keyData: ListKeysResult['data'][number] = {
      id: k.id,
      key: truncateKey(k.prefix),
      permission: k.permission,
      createdAt: k.createdAt,
      revoked: k.revokedAt !== null,
    };
    if (k.boundAuthor) keyData.boundAuthor = k.boundAuthor;
    if (k.displayName) keyData.displayName = k.displayName;
    if (k.wipLimit !== null) keyData.wipLimit = k.wipLimit;
    if (k.lastUsedAt) keyData.lastUsedAt = k.lastUsedAt;
    if (k.allowedTypes) keyData.allowedTypes = JSON.parse(k.allowedTypes);
    if (k.expiresAt) keyData.expiresAt = k.expiresAt;
    return keyData;
  });

  return { ok: true, data: keyList };
}

export async function revokeKey(input: RevokeKeyInput): Promise<RevokeKeyResult> {
  const { workspaceId, keyId } = input;
  const keyToRevoke = await db.query.capabilityKeys.findFirst({
    where: and(eq(capabilityKeys.id, keyId), eq(capabilityKeys.workspaceId, workspaceId)),
  });

  if (!keyToRevoke) {
    return { ok: false, status: 404, error: { code: 'KEY_NOT_FOUND', message: 'Key not found' } };
  }

  const now = new Date().toISOString();
  const revokeStmt = sqlite.prepare('UPDATE capability_keys SET revoked_at = ? WHERE id = ?');
  revokeStmt.run(now, keyId);

  logAction({
    workspaceId,
    action: 'key.revoke',
    resourceType: 'key',
    resourceId: keyId,
    actorType: 'capability_url',
    metadata: { revokedKeyPermission: keyToRevoke.permission },
  });

  return { ok: true, data: { id: keyId, revoked: true as const } };
}

