import { eq, and, isNull, like } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { files } from '../../db/schema';
import { normalizePath } from '../../core/path-validation';
import { createErrorResponse, type ErrorResponse } from '../../core/errors';
import type { SearchResponse, SearchWorkspaceQuery } from '@mdplane/shared';
import { parseApiKeyScopes, validateApiKeyFromAuthorizationHeaderWithLookup } from '../../shared';
import type { ElysiaContextSet } from '../../shared';
import { parseCommaSeparated, VALID_API_SEARCH_SCOPES } from './validation';
import { executeFtsSearch, executeFallbackSearch, MAX_FILES_PER_SEARCH } from './search-executor';

type HandleWorkspaceSearchInput = {
  query: SearchWorkspaceQuery;
  set: ElysiaContextSet;
  request: Request;
};

type ApiKeyRecord = {
  id: string;
  workspace_id: string;
  scopes: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export async function handleWorkspaceSearch({
  query,
  set,
  request,
}: HandleWorkspaceSearchInput): Promise<SearchResponse | ErrorResponse> {
  const authHeader = request.headers.get('Authorization');
  const keyResult = validateApiKeyFromAuthorizationHeaderWithLookup({
    authorizationHeader: authHeader,
    lookupByHash: (keyHash) => {
      const keyRecord = sqlite
        .query(`SELECT id, workspace_id, scopes, expires_at, revoked_at FROM api_keys WHERE key_hash = ?`)
        .get(keyHash) as ApiKeyRecord | null;

      if (!keyRecord) return null;

      return {
        id: keyRecord.id,
        workspaceId: keyRecord.workspace_id,
        scopes: keyRecord.scopes,
        expiresAt: keyRecord.expires_at,
        revokedAt: keyRecord.revoked_at,
      };
    },
    options: { missingHeaderMessage: 'API key required', enforceFormat: false },
  });

  if (!keyResult.ok) {
    set.status = keyResult.status;
    return { ok: false as const, error: keyResult.error };
  }

  const parsedScopes = parseApiKeyScopes({
    rawScopes: keyResult.key.scopes,
    allowedScopes: VALID_API_SEARCH_SCOPES,
  });
  if (!parsedScopes.ok) {
    set.status = parsedScopes.status;
    return { ok: false as const, error: parsedScopes.error };
  }

  const scopes = parsedScopes.scopes;
  if (!scopes.includes('search') && !scopes.includes('read') && !scopes.includes('*')) {
    set.status = 404;
    return createErrorResponse('SCOPE_DENIED', 'API key does not have search permission');
  }

  const { q, type, status, author, folder, limit, cursor } = query;

  if (q && q.length > 500) {
    set.status = 400;
    return createErrorResponse('QUERY_TOO_LONG', 'Search query too long (max 500 characters)');
  }

  const frontmatterFilters: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('frontmatter.') && typeof value === 'string') {
      frontmatterFilters[key.substring(12)] = parseCommaSeparated(value);
    }
  }

  const indexedFields = ['status', 'skills', 'tags', 'author', 'priority'];
  const hasCustomFrontmatter = Object.keys(frontmatterFilters).some(f => !indexedFields.includes(f));
  const hasFrontmatterFilters = Object.keys(frontmatterFilters).length > 0;

  const workspaceFiles = await db.query.files.findMany({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      folder ? like(files.path, `${folder}%`) : undefined,
      isNull(files.deletedAt)
    ),
    columns: {
      id: true,
      path: true,
      workspaceId: true,
      createdAt: true,
      content: hasFrontmatterFilters,
    },
  });

  if (workspaceFiles.length > MAX_FILES_PER_SEARCH) {
    set.status = 400;
    return createErrorResponse(
      'QUERY_TOO_BROAD',
      `Search scope too large (${workspaceFiles.length} files). Use a more specific folder path or add filters.`
    );
  }

  const qString = typeof q === 'string' ? q.trim() : '';
  const normalizedFolder = folder ? normalizePath(folder) : '/';
  const folderLike = normalizedFolder === '/' ? '/%' : `${normalizedFolder}%`;

  if (qString && !hasFrontmatterFilters) {
    return executeFtsSearch({
      workspaceId: keyResult.key.workspaceId,
      qString,
      scopeParam: folderLike,
      isFileScope: false,
      type,
      status,
      author,
      limit,
      cursor,
      set,
    });
  }

  return executeFallbackSearch({
    files: workspaceFiles,
    q,
    type,
    status,
    author,
    limit,
    cursor,
    set,
    frontmatterFilters,
    hasCustomFrontmatter,
  });
}

