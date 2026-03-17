import { sqlite } from '../../db';
import {
  parseApiKeyScopes,
  validateApiKeyFromRequestWithLookup,
} from '../../shared';
import type { ExportAuthResult, Scope } from './types';
import { VALID_SCOPES } from './types';

export function authenticateExportApiKey(request: Request): ExportAuthResult {
  const keyResult = validateApiKeyFromRequestWithLookup({
    request,
    lookupByHash: (keyHash) => {
      const keyRecord = sqlite
        .query(`SELECT id, workspace_id, scopes, expires_at, revoked_at FROM api_keys WHERE key_hash = ?`)
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
    return keyResult;
  }

  const parsedScopes = parseApiKeyScopes({ rawScopes: keyResult.key.scopes, allowedScopes: VALID_SCOPES });
  if (!parsedScopes.ok) {
    return parsedScopes;
  }

  return {
    ok: true,
    key: {
      id: keyResult.key.id,
      workspaceId: keyResult.key.workspaceId,
      scopes: parsedScopes.scopes as Scope[],
    },
  };
}

