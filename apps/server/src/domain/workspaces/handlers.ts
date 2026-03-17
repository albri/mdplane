import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '../../core/auth';
import { db, sqlite } from '../../db';
import { capabilityKeys, workspaces, userWorkspaces } from '../../db/schema';
import { generateKey, hashKey } from '../../core/capability-keys';
import { validateAndGetFileKey } from '../../shared';
import { serverEnv } from '../../config/env';
import type {
  DeleteWorkspaceResponseBody,
  RotateAllWorkspaceKeysResponseBody,
  SessionOwnershipResult,
  WorkspaceRenameResponseBody,
} from './types';

const BASE_URL = serverEnv.baseUrl;
const APP_URL = serverEnv.appUrl;
const KEY_CUSTODY_WARNING = 'Store these keys now. They are shown once and cannot be retrieved again.';
const ROOT_PERMISSIONS = ['read', 'append', 'write'] as const;

function normalizeWorkspaceName(rawName: string): string | null {
  const normalized = rawName.trim();
  if (normalized.length === 0) {
    return null;
  }
  return normalized;
}

export async function validateSessionAndOwnership(request: Request, workspaceId: string): Promise<SessionOwnershipResult> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return { ok: false, status: 401, error: { code: 'UNAUTHORIZED', message: 'No valid session' } };
  }

  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws || ws.deletedAt) {
    return { ok: false, status: 404, error: { code: 'NOT_FOUND', message: 'Workspace not found' } };
  }

  const membership = await db.query.userWorkspaces.findFirst({
    where: and(eq(userWorkspaces.userId, session.user.id), eq(userWorkspaces.workspaceId, workspaceId)),
  });
  if (!membership) {
    return { ok: false, status: 404, error: { code: 'NOT_FOUND', message: 'Workspace not found' } };
  }

  return { ok: true, userId: session.user.id };
}

export async function handleDeleteWorkspace(
  request: Request,
  workspaceId: string
): Promise<{ status: number; body: DeleteWorkspaceResponseBody }> {
  const authResult = await validateSessionAndOwnership(request, workspaceId);
  if (!authResult.ok) {
    return { status: authResult.status, body: { ok: false, error: authResult.error } };
  }

  const now = new Date().toISOString();
  sqlite.query(`UPDATE workspaces SET deleted_at = ? WHERE id = ?`).run(now, workspaceId);

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        message: 'Workspace deleted successfully',
      },
    },
  };
}

export async function handleRotateAllWorkspaceKeys(
  request: Request,
  workspaceId: string
): Promise<{ status: number; body: RotateAllWorkspaceKeysResponseBody }> {
  const authResult = await validateSessionAndOwnership(request, workspaceId);
  if (!authResult.ok) {
    return { status: authResult.status, body: { ok: false, error: authResult.error } };
  }

  const nowIso = new Date().toISOString();
  const activeKeys = await db.query.capabilityKeys.findMany({
    where: and(eq(capabilityKeys.workspaceId, workspaceId), isNull(capabilityKeys.revokedAt)),
  });

  const scopeSet = new Set<string>();
  const rootKeys: Partial<Record<(typeof ROOT_PERMISSIONS)[number], string>> = {};
  for (const key of activeKeys) {
    const scopeKey = `${key.scopeType}:${key.scopePath || '/'}`;
    scopeSet.add(scopeKey);
  }

  await db
    .update(capabilityKeys)
    .set({ revokedAt: nowIso })
    .where(and(eq(capabilityKeys.workspaceId, workspaceId), isNull(capabilityKeys.revokedAt)));

  for (const key of activeKeys) {
    const newKey = generateKey(22);
    const newKeyHash = hashKey(newKey);
    const newKeyId = generateKey(16);

    await db.insert(capabilityKeys).values({
      id: newKeyId,
      workspaceId,
      prefix: newKey.substring(0, 4),
      keyHash: newKeyHash,
      permission: key.permission,
      scopeType: key.scopeType,
      scopePath: key.scopePath,
      boundAuthor: key.boundAuthor,
      wipLimit: key.wipLimit,
      allowedTypes: key.allowedTypes,
      displayName: key.displayName,
      createdAt: nowIso,
      expiresAt: key.expiresAt,
    });

    if (
      key.scopeType === 'workspace'
      && (key.scopePath === '/' || key.scopePath == null)
      && (key.permission === 'read' || key.permission === 'append' || key.permission === 'write')
      && rootKeys[key.permission] == null
    ) {
      rootKeys[key.permission] = newKey;
    }
  }

  for (const permission of ROOT_PERMISSIONS) {
    if (rootKeys[permission] != null) {
      continue;
    }

    const newRootKey = generateKey(22);
    await db.insert(capabilityKeys).values({
      id: generateKey(16),
      workspaceId,
      prefix: newRootKey.substring(0, 4),
      keyHash: hashKey(newRootKey),
      permission,
      scopeType: 'workspace',
      scopePath: '/',
      createdAt: nowIso,
    });
    rootKeys[permission] = newRootKey;
  }

  const readKey = rootKeys.read;
  const appendKey = rootKeys.append;
  const writeKey = rootKeys.write;
  if (readKey == null || appendKey == null || writeKey == null) {
    return {
      status: 500,
      body: {
        ok: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to generate rotated workspace keys',
        },
      },
    };
  }
  const keys = {
    read: readKey,
    append: appendKey,
    write: writeKey,
  };

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        workspaceId,
        message: 'All capability URLs rotated successfully',
        rotatedCount: scopeSet.size,
        keys,
        urls: {
          api: {
            read: `${BASE_URL}/r/${keys.read}`,
            append: `${BASE_URL}/a/${keys.append}`,
            write: `${BASE_URL}/w/${keys.write}`,
          },
          web: {
            read: `${APP_URL}/r/${keys.read}`,
            claim: `${APP_URL}/claim/${keys.write}`,
          },
        },
        keyCustodyWarning: KEY_CUSTODY_WARNING,
      },
    },
  };
}

export async function handleRenameWorkspace(
  request: Request,
  workspaceId: string,
  name: string
): Promise<{ status: number; body: WorkspaceRenameResponseBody }> {
  const authResult = await validateSessionAndOwnership(request, workspaceId);
  if (!authResult.ok) {
    return { status: authResult.status, body: { ok: false, error: authResult.error } };
  }

  const normalizedName = normalizeWorkspaceName(name);
  if (normalizedName == null) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'Workspace name cannot be empty' } },
    };
  }

  const nowIso = new Date().toISOString();
  await db.update(workspaces).set({ name: normalizedName, lastActivityAt: nowIso }).where(eq(workspaces.id, workspaceId));

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        workspaceId,
        name: normalizedName,
        updatedAt: nowIso,
      },
    },
  };
}

export async function handleRenameWorkspaceViaWriteKey(
  keyString: string,
  name: string
): Promise<{ status: number; body: WorkspaceRenameResponseBody }> {
  const keyResult = await validateAndGetFileKey({ keyString, requiredPermission: 'write' });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  if (keyResult.key.scopeType !== 'workspace') {
    return {
      status: 403,
      body: {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only workspace-scoped write keys can rename workspaces',
        },
      },
    };
  }

  const normalizedName = normalizeWorkspaceName(name);
  if (normalizedName == null) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_REQUEST', message: 'Workspace name cannot be empty' } },
    };
  }

  const workspaceId = keyResult.key.workspaceId;
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });
  if (!workspace || workspace.deletedAt) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } },
    };
  }

  const nowIso = new Date().toISOString();
  await db.update(workspaces).set({ name: normalizedName, lastActivityAt: nowIso }).where(eq(workspaces.id, workspaceId));

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        workspaceId,
        name: normalizedName,
        updatedAt: nowIso,
      },
    },
  };
}
