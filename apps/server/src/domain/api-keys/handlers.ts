import { and, eq } from 'drizzle-orm';
import { auth } from '../../core/auth';
import { db, sqlite } from '../../db';
import { userWorkspaces, workspaces } from '../../db/schema';
import {
  createApiKeyRateLimiter,
  parseApiKeyScopes,
  validateApiKeyFromRequestWithLookup,
} from '../../shared';
import type {
  AuthenticateApiKeyRequestResult,
  SessionOwnershipResult,
} from './types';
import { VALID_API_KEY_SCOPES } from './types';

const apiKeyRateLimiter = createApiKeyRateLimiter();

export function resetApiKeyRateLimits(): void {
  apiKeyRateLimiter.reset();
}

export function getApiKeyRateLimiter() {
  return apiKeyRateLimiter;
}

export async function validateSessionAndOwnership(
  request: Request,
  workspaceId: string
): Promise<SessionOwnershipResult> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return { ok: false, status: 401, error: { code: 'UNAUTHORIZED', message: 'Session required' } };
  }

  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) {
    return { ok: false, status: 404, error: { code: 'NOT_FOUND', message: 'Workspace not found' } };
  }

  const membership = await db.query.userWorkspaces.findFirst({
    where: and(eq(userWorkspaces.userId, session.user.id), eq(userWorkspaces.workspaceId, workspaceId)),
  });

  if (!membership) {
    return { ok: false, status: 403, error: { code: 'FORBIDDEN', message: 'Not authorized to access this workspace' } };
  }

  return { ok: true, userId: session.user.id };
}

export async function authenticateApiKeyRequest(
  request: Request
): Promise<AuthenticateApiKeyRequestResult> {
  const keyResult = validateApiKeyFromRequestWithLookup({
    request,
    lookupByHash: (keyHash) => {
      const keyRecord = sqlite
        .query(
          `
        SELECT id, workspace_id, scopes, expires_at, revoked_at
        FROM api_keys
        WHERE key_hash = ?
      `
        )
        .get(keyHash) as {
        id: string;
        workspace_id: string;
        scopes: string | null;
        expires_at: string | null;
        revoked_at: string | null;
      } | null;

      if (!keyRecord) {
        return null;
      }

      return {
        id: keyRecord.id,
        workspaceId: keyRecord.workspace_id,
        scopes: keyRecord.scopes,
        expiresAt: keyRecord.expires_at,
        revokedAt: keyRecord.revoked_at,
      };
    },
    options: { missingHeaderMessage: 'Authorization header required' },
  });

  if (!keyResult.ok) {
    return { ok: false, status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const parsedScopes = parseApiKeyScopes({ rawScopes: keyResult.key.scopes, allowedScopes: VALID_API_KEY_SCOPES });
  if (!parsedScopes.ok) {
    return { ok: false, status: parsedScopes.status, body: { ok: false, error: parsedScopes.error } };
  }

  return {
    ok: true,
    key: {
      id: keyResult.key.id,
      workspaceId: keyResult.key.workspaceId,
      scopes: parsedScopes.scopes,
    },
  };
}
