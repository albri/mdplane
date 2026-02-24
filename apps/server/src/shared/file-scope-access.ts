import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { files } from '../db/schema';
import type { CapabilityKeyRecord, KeyValidationResult, Permission } from './types';
import { validateCapabilityKeyForCapabilityRoute } from './capability-key-validation';

type ValidateAndGetFileKeyInput = {
  keyString: string;
  requiredPermission?: Permission;
  pathHint?: string;
};

export async function validateAndGetFileKey({
  keyString,
  requiredPermission,
  pathHint,
}: ValidateAndGetFileKeyInput): Promise<KeyValidationResult> {
  return validateCapabilityKeyForCapabilityRoute({
    keyString,
    lookupByHash: async (keyHash) => {
      const keyRecord = await db.query.capabilityKeys.findFirst({
        where: (fields, { eq: eqField }) => eqField(fields.keyHash, keyHash),
      });
      return keyRecord as CapabilityKeyRecord | null;
    },
    requiredPermission,
    pathHint,
  });
}

type FindFileForScopeInput = {
  workspaceId: string;
  capKey: Pick<CapabilityKeyRecord, 'scopeType' | 'scopePath'>;
  options?: { includeDeleted?: boolean };
};

export async function findFileForScope({
  workspaceId,
  capKey,
  options = {},
}: FindFileForScopeInput) {
  const includeDeleted = options.includeDeleted ?? false;

  if (capKey.scopeType === 'file' && capKey.scopePath) {
    if (includeDeleted) {
      return db.query.files.findFirst({
        where: and(eq(files.workspaceId, workspaceId), eq(files.path, capKey.scopePath)),
      });
    }

    return db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, workspaceId),
        eq(files.path, capKey.scopePath),
        isNull(files.deletedAt)
      ),
    });
  }

  if (includeDeleted) {
    return db.query.files.findFirst({
      where: eq(files.workspaceId, workspaceId),
    });
  }

  return db.query.files.findFirst({
    where: and(eq(files.workspaceId, workspaceId), isNull(files.deletedAt)),
  });
}
