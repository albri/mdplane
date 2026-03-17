import { eq, and, isNull, like } from 'drizzle-orm';
import { db } from '../../db';
import { files } from '../../db/schema';
import { createErrorResponse, type ErrorResponse } from '../../core/errors';
import type { SearchResponse, SearchInFileViaReadKeyQuery } from '@mdplane/shared';
import type { ElysiaContextSet } from '../../shared';
import { validateAndGetKey } from './validation';
import { executeFtsSearch, executeFallbackSearch, MAX_FILES_PER_SEARCH } from './search-executor';

type HandleScopedSearchInput = {
  key: string;
  query: SearchInFileViaReadKeyQuery;
  set: ElysiaContextSet;
};

export async function handleScopedSearch({
  key,
  query,
  set,
}: HandleScopedSearchInput): Promise<SearchResponse | ErrorResponse> {
  const keyResult = await validateAndGetKey(key);
  if (!keyResult.ok) {
    set.status = keyResult.status;
    return { ok: false as const, error: keyResult.error };
  }

  const { q, type, status, author, limit, cursor } = query;

  if (q && q.length > 500) {
    set.status = 400;
    return createErrorResponse('QUERY_TOO_LONG', 'Search query too long (max 500 characters)');
  }

  const scopeType = keyResult.key.scopeType;
  const scopePath = keyResult.key.scopePath || '/';
  const isFileScope = scopeType === 'file';

  let whereCondition;
  if (isFileScope) {
    whereCondition = and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      eq(files.path, scopePath),
      isNull(files.deletedAt)
    );
  } else {
    whereCondition = and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      like(files.path, `${scopePath}%`),
      isNull(files.deletedAt)
    );
  }

  const scopeFiles = await db.query.files.findMany({
    where: whereCondition,
    columns: { id: true, path: true, workspaceId: true, createdAt: true },
  });

  if (scopeFiles.length > MAX_FILES_PER_SEARCH) {
    set.status = 400;
    return createErrorResponse(
      'QUERY_TOO_BROAD',
      `Search scope too large (${scopeFiles.length} files). Use a more specific folder path or add filters.`
    );
  }

  const qString = typeof q === 'string' ? q.trim() : '';
  const scopeParam = isFileScope ? scopePath : `${scopePath}%`;

  if (qString) {
    return executeFtsSearch({
      workspaceId: keyResult.key.workspaceId,
      qString,
      scopeParam,
      isFileScope,
      type,
      status,
      author,
      limit,
      cursor,
      set,
    });
  }

  return executeFallbackSearch({
    files: scopeFiles,
    q,
    type,
    status,
    author,
    limit,
    cursor,
    set,
  });
}

