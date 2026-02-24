import { sqlite } from '../../db';
import { generateApiKey, hashKey } from '../../core/capability-keys';
import { generateApiKeyId, sanitizeApiKeyName } from '../../shared';
import { zApiKey, zApiKeyCreateRequest } from '@mdplane/shared';
import type { ApiKeyCreateRequest } from '@mdplane/shared';

type Scope = 'read' | 'append' | 'write' | 'export';
const zPermissions = zApiKey.shape.permissions;

type SessionOwnershipResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: { code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'FORBIDDEN'; message: string } };

type ApiKeyRateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

export type ApiKeyManagementHandlerDeps = {
  appUrl: string;
  maxNameLength: number;
  validateSessionAndOwnership: (request: Request, workspaceId: string) => Promise<SessionOwnershipResult>;
  rateLimiter: {
    check: (workspaceId: string) => ApiKeyRateLimitResult;
    increment: (workspaceId: string) => void;
  };
};

export async function handleCreateApiKey(input: {
  workspaceId: string;
  body: unknown;
  request: Request;
  deps: ApiKeyManagementHandlerDeps;
}): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const { workspaceId, body, request, deps } = input;
  const { validateSessionAndOwnership, maxNameLength, rateLimiter, appUrl } = deps;

  const authResult = await validateSessionAndOwnership(request, workspaceId);
  if (!authResult.ok) {
    return { status: authResult.status, body: { ok: false, error: authResult.error } };
  }

  let requestBody: ApiKeyCreateRequest;
  try {
    requestBody = zApiKeyCreateRequest.parse(body);
  } catch {
    return {
      status: 400,
      body: {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'Request validation failed' },
      },
    };
  }

  if (requestBody.name.length > maxNameLength) {
    return {
      status: 400,
      body: {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: `name must be <= ${maxNameLength} characters` },
      },
    };
  }

  const permissions = Array.from(new Set(requestBody.permissions));
  if (permissions.length === 0) {
    return {
      status: 400,
      body: {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'permissions must not be empty' },
      },
    };
  }

  const rateLimit = rateLimiter.check(workspaceId);
  if (!rateLimit.allowed) {
    return {
      status: 429,
      body: {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many API keys created. Please try again later.',
          details: { retryAfterSeconds: rateLimit.retryAfter },
        },
      },
    };
  }

  const sanitizedName = sanitizeApiKeyName(requestBody.name);
  const rawKey = generateApiKey('live');
  const keyId = generateApiKeyId();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.substring(0, 12) + '...';
  const now = new Date().toISOString();

  let expiresAt: string | null = null;
  if (requestBody.expiresInSeconds && typeof requestBody.expiresInSeconds === 'number') {
    expiresAt = new Date(Date.now() + requestBody.expiresInSeconds * 1000).toISOString();
  }

  const insertApiKeyStmt = sqlite.prepare(`
      INSERT INTO api_keys (
        id, workspace_id, name, key_hash, key_prefix, mode, scopes, created_at, expires_at, last_used_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  insertApiKeyStmt.run(
    keyId, workspaceId, sanitizedName, keyHash, keyPrefix,
    'live', JSON.stringify(permissions), now,
    expiresAt,
    null, null
  );

  rateLimiter.increment(workspaceId);

  return {
    status: 201,
    body: {
      ok: true,
      data: {
        id: keyId,
        key: rawKey,
        name: sanitizedName,
        permissions,
        createdAt: now,
        ...(expiresAt ? { expiresAt } : {}),
        webUrl: `${appUrl}/control/${workspaceId}/api-keys`,
      },
    },
  };
}

export async function handleListApiKeys(input: {
  workspaceId: string;
  request: Request;
  deps: ApiKeyManagementHandlerDeps;
}): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const { workspaceId, request, deps } = input;
  const { validateSessionAndOwnership, appUrl } = deps;

  const authResult = await validateSessionAndOwnership(request, workspaceId);
  if (!authResult.ok) {
    return { status: authResult.status, body: { ok: false, error: authResult.error } };
  }

  const keys = sqlite
    .query(
      `
      SELECT id, name, key_prefix, scopes, created_at, expires_at, last_used_at
      FROM api_keys
      WHERE workspace_id = ? AND revoked_at IS NULL
    `
    )
    .all(workspaceId) as Array<{
    id: string;
    name: string | null;
    key_prefix: string;
    scopes: string;
    created_at: string;
    expires_at: string | null;
    last_used_at: string | null;
  }>;

  const result: Array<{
    id: string;
    name: string;
    prefix: string;
    permissions: Scope[];
    createdAt: string;
    expiresAt?: string;
    lastUsedAt?: string;
  }> = [];

  for (const key of keys) {
    let permissions: Scope[];
    try {
      permissions = zPermissions.parse(JSON.parse(key.scopes || '[]'));
    } catch {
      return {
        status: 500,
        body: {
          ok: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'Stored API key permissions are invalid',
          },
        },
      };
    }

    result.push({
      id: key.id,
      name: key.name ?? '',
      prefix: key.key_prefix,
      permissions,
      createdAt: key.created_at,
      ...(key.expires_at ? { expiresAt: key.expires_at } : {}),
      ...(key.last_used_at ? { lastUsedAt: key.last_used_at } : {}),
    });
  }

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        keys: result,
        webUrl: `${appUrl}/control/${workspaceId}/api-keys`,
      },
    },
  };
}

export async function handleRevokeApiKey(input: {
  workspaceId: string;
  keyId: string;
  request: Request;
  deps: ApiKeyManagementHandlerDeps;
}): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const { workspaceId, keyId, request, deps } = input;
  const { validateSessionAndOwnership } = deps;

  const authResult = await validateSessionAndOwnership(request, workspaceId);
  if (!authResult.ok) {
    return { status: authResult.status, body: { ok: false, error: authResult.error } };
  }

  const key = sqlite
    .query(
      `
      SELECT id, revoked_at
      FROM api_keys
      WHERE id = ? AND workspace_id = ?
    `
    )
    .get(keyId, workspaceId) as { id: string; revoked_at: string | null } | null;

  if (!key || key.revoked_at) {
    return {
      status: 404,
      body: {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'API key not found' },
      },
    };
  }

  const now = new Date().toISOString();
  const revokeStmt = sqlite.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?');
  revokeStmt.run(now, keyId);

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        id: keyId,
        revoked: true,
      },
    },
  };
}
