import Elysia from 'elysia';
import {
  zFolderSearchResponse,
  zTaskQueryResponse,
  zFolderStatsResponse,
  zSearchResponse,
  zError,
  zSearchWorkspaceQuery,
  zSearchInFileViaReadKeyQuery,
  zGetFolderStatsQuery,
  zSearchInFolderQuery,
  zQueryFolderTasksQuery,
} from '@mdplane/shared';
import { handleFolderSearch, handleTaskQuery, handleFolderStats } from './handlers';
import { handleWorkspaceSearch } from './workspace-search';
import { handleScopedSearch } from './scoped-search';

function normalizeQueryRecord(query: unknown): Record<string, string> {
  const source = query && typeof query === 'object' ? query as Record<string, unknown> : {};
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      normalized[key] = value.map((item) => String(item)).join(',');
      continue;
    }
    normalized[key] = String(value);
  }

  return normalized;
}

export const searchRoute = new Elysia({ name: 'search' })
  .onError(({ error, set, code }) => {
    if (code === 'PARSE' || (error instanceof Error && error.message?.includes('JSON'))) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON in request body' } };
    }
    if (code === 'VALIDATION') {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Request validation failed' } };
    }
    throw error;
  })
  // Path traversal protection: /r/:key/folders/../etc/X normalizes to /r/:key/etc/X
  .get('/r/:key/etc/*', ({ set }) => {
    set.status = 400;
    return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
  })
  .get('/r/:key/etc', ({ set }) => {
    set.status = 400;
    return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
  })

  .get('/r/:key/ops/folders/search', async ({ params, query, set, request }) => {
    const normalizedQuery = normalizeQueryRecord(query);
    if (normalizedQuery.status === '') {
      delete normalizedQuery.status;
    }
    if (normalizedQuery.type === '') {
      delete normalizedQuery.type;
    }

    const parsed = zSearchInFolderQuery.safeParse(normalizedQuery);
    if (!parsed.success) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid query parameters' } };
    }

    const folderPath = parsed.data.path ?? '';
    if (folderPath.includes('..')) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
    }

    return handleFolderSearch({
      readKey: params.key,
      folderPath,
      query: parsed.data,
      set,
      rawUrl: request.url,
    });
  }, {
    response: {
      200: zFolderSearchResponse,
      400: zError,
      401: zError,
      403: zError,
    },
  })

  .get('/r/:key/ops/folders/tasks', async ({ params, query, set }) => {
    const normalizedQuery = normalizeQueryRecord(query);
    if (normalizedQuery.status === '') {
      delete normalizedQuery.status;
    }
    if (normalizedQuery.claimable === '') {
      delete normalizedQuery.claimable;
    }

    const parsed = zQueryFolderTasksQuery.safeParse(normalizedQuery);
    if (!parsed.success) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid query parameters' } };
    }

    const folderPath = parsed.data.path ?? '';
    if (folderPath.includes('..')) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
    }

    return handleTaskQuery({
      readKey: params.key,
      folderPath,
      query: parsed.data,
      set,
    });
  }, {
    response: {
      200: zTaskQueryResponse,
      400: zError,
      401: zError,
      403: zError,
    },
  })

  .get('/r/:key/ops/folders/stats', async ({ params, query, set, request }) => {
    const parsed = zGetFolderStatsQuery.safeParse(normalizeQueryRecord(query));
    if (!parsed.success) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid query parameters' } };
    }

    const folderPath = parsed.data.path ?? '';
    if (folderPath.includes('..')) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
    }

    return handleFolderStats({
      readKey: params.key,
      folderPath,
      set,
      rawUrl: request.url,
    });
  }, {
    query: zGetFolderStatsQuery,
    response: {
      200: zFolderStatsResponse,
      400: zError,
      401: zError,
      403: zError,
      404: zError,
    },
  })

  .get('/api/v1/search', async ({ query, set, request }) => {
    return handleWorkspaceSearch({ query, set, request });
  }, {
    query: zSearchWorkspaceQuery,
    response: {
      200: zSearchResponse,
      400: zError,
      401: zError,
      403: zError,
      404: zError,
    },
  })

  .get('/r/:key/search', async ({ params, query, set }) => {
    return handleScopedSearch({ key: params.key, query, set });
  }, {
    query: zSearchInFileViaReadKeyQuery,
    response: {
      200: zSearchResponse,
      400: zError,
      401: zError,
      403: zError,
    },
  });
