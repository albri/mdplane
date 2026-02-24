import { Elysia } from 'elysia';
import {
  zFolderListResponse,
  zError,
  zListFolderContentsQuery,
  zListFolderContentsViaAppendKeyQuery,
  zListFolderContentsViaWriteKeyQuery,
  zListFolderClaimsQuery,
} from '@mdplane/shared';
import { folderWebhooksRoute } from '../folder-webhooks/route';
import { createFolderSettingsRoute } from './settings-route';
import { createFolderMutationsRoute } from './mutations-route';
import {
  handleFolderRequest,
  handleCreateFileInFolder,
  handleCopyFileToFolder,
  handleBulkCreateFiles,
  handleCreateFolder,
  handleRenameFolder,
  handleDeleteFolder,
  handleMoveFolder,
  handleGetFolderSettings,
  handleUpdateFolderSettings,
  handleListFolderClaims,
  handleFolderExport,
} from './handlers';

export const foldersRoute = new Elysia()
  // Handle Zod validation errors - convert to 400 with standard error format
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error.message || 'Invalid request parameters',
        },
      };
    }
  })
  // Catch paths that look like traversal results (before other routes)
  // These match URLs like /r/key/etc/passwd which result from /r/key/folders/../etc/passwd
  .get('/r/:key/etc/*', ({ set }) => {
    set.status = 400;
    return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
  })
  .get('/r/:key/etc', ({ set }) => {
    set.status = 400;
    return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
  })
  .get('/a/:key/etc/*', ({ set }) => {
    set.status = 400;
    return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
  })
  .get('/a/:key/etc', ({ set }) => {
    set.status = 400;
    return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
  })
  .get('/w/:key/etc/*', ({ set }) => {
    set.status = 400;
    return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
  })
  .get('/w/:key/etc', ({ set }) => {
    set.status = 400;
    return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
  })
  // Handle empty key patterns - return 404 INVALID_KEY
  .get('/r//folders/*', ({ set }) => {
    set.status = 404;
    return { ok: false, error: { code: 'INVALID_KEY', message: 'Invalid or missing capability key' } };
  })
  .get('/a//folders/*', ({ set }) => {
    set.status = 404;
    return { ok: false, error: { code: 'INVALID_KEY', message: 'Invalid or missing capability key' } };
  })
  .get('/w//folders/*', ({ set }) => {
    set.status = 404;
    return { ok: false, error: { code: 'INVALID_KEY', message: 'Invalid or missing capability key' } };
  })
  // List folder claims - GET /a/:key/folders/claims (root)
  .get('/a/:key/folders/claims', async ({ params, query, set }) => {
    const key = params.key;
    const result = await handleListFolderClaims({
      key,
      folderPathParam: '/',
      author: query.author,
    });

    set.status = result.status;
    set.headers['Content-Type'] = 'application/json';
    return result.body;
  }, {
    query: zListFolderClaimsQuery,
  })
  // List folder claims - GET /a/:key/folders/:path/claims (subfolder)
  // Note: For multi-segment paths, the path must be URL-encoded (e.g., /a/key/folders/a%2Fb%2Fc/claims)
  .get('/a/:key/folders/:path/claims', async ({ params, query, set }) => {
    const key = params.key;
    const folderPath = decodeURIComponent(params.path || '');
    const result = await handleListFolderClaims({
      key,
      folderPathParam: folderPath,
      author: query.author,
    });

    set.status = result.status;
    set.headers['Content-Type'] = 'application/json';
    return result.body;
  }, {
    query: zListFolderClaimsQuery,
  })
  .get('/r/:key/folders/*', async ({ params, query, set, request }) => {
    const key = params.key;
    const fullPath = (params as Record<string, string>)['*'] || '';
    const rawUrl = request.url;

    if (rawUrl.includes('..') || rawUrl.includes('%2e%2e') || rawUrl.includes('%2E%2E') ||
        fullPath.includes('..')) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
    }

    const parseResult = zListFolderContentsQuery.safeParse(query);
    if (!parseResult.success) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Request validation failed' } };
    }

    if (parseResult.data.action === 'export') {
      return handleFolderExport({
        key,
        pathParam: fullPath,
        query: parseResult.data,
        set,
        rawUrl,
      });
    }

    return handleFolderRequest({
      key,
      pathParam: fullPath,
      rawUrl,
      set,
      query: parseResult.data,
    });
  })
  .get('/r/:key/folders', async ({ params, query, set, request }) => {
    const key = params.key;
    const { action, format, recursive, sort, order, includeAppends, limit, cursor } = query;
    const parsedQuery = { action, format, recursive, sort, order, includeAppends, limit, cursor };
    // Check for export action
    if (action === 'export') {
      return handleFolderExport({
        key,
        pathParam: '',
        query: parsedQuery,
        set,
        rawUrl: request.url,
      });
    }
    // Regular folder listing with pagination and sorting support
    return handleFolderRequest({
      key,
      pathParam: '',
      rawUrl: request.url,
      set,
      query: parsedQuery,
    });
  }, {
    // Note: No response schema here because this route can delegate to export handler
    query: zListFolderContentsQuery,
  })
  // Append key folders - GET /a/:key/folders/*
  .get('/a/:key/folders/*', async ({ params, query, set, request }) => {
    const key = params.key;
    const path = (params as Record<string, string>)['*'] || '';
    const { limit, cursor, recursive, sort, order } = query;
    return handleFolderRequest({
      key,
      pathParam: path,
      rawUrl: request.url,
      set,
      query: { limit, cursor, recursive, sort, order },
      requiredPermission: 'append',
    });
  }, {
    query: zListFolderContentsViaAppendKeyQuery,
    response: {
      200: zFolderListResponse,
      400: zError,
      404: zError,
    },
  })
  .get('/a/:key/folders', async ({ params, query, set, request }) => {
    const key = params.key;
    const { limit, cursor, recursive, sort, order } = query;
    return handleFolderRequest({
      key,
      pathParam: '',
      rawUrl: request.url,
      set,
      query: { limit, cursor, recursive, sort, order },
      requiredPermission: 'append',
    });
  }, {
    query: zListFolderContentsViaAppendKeyQuery,
    response: {
      200: zFolderListResponse,
      400: zError,
      404: zError,
    },
  })
  // Write/Admin key folders - GET /w/:key/folders/*
  .get('/w/:key/folders/*', async ({ params, query, set, request }) => {
    const key = params.key;
    const path = (params as Record<string, string>)['*'] || '';
    const { limit, cursor, recursive, sort, order } = query;
    return handleFolderRequest({
      key,
      pathParam: path,
      rawUrl: request.url,
      set,
      query: { limit, cursor, recursive, sort, order },
      requiredPermission: 'write',
    });
  }, {
    query: zListFolderContentsViaWriteKeyQuery,
    response: {
      200: zFolderListResponse,
      400: zError,
      404: zError,
    },
  })
  .get('/w/:key/folders', async ({ params, query, set, request }) => {
    const key = params.key;
    const { limit, cursor, recursive, sort, order } = query;
    return handleFolderRequest({
      key,
      pathParam: '',
      rawUrl: request.url,
      set,
      query: { limit, cursor, recursive, sort, order },
      requiredPermission: 'write',
    });
  }, {
    query: zListFolderContentsViaWriteKeyQuery,
    response: {
      200: zFolderListResponse,
      400: zError,
      404: zError,
    },
  })
  // Create file in folder - POST /a/:key/folders/:path/files
  // Note: For multi-segment paths, the path must be URL-encoded (e.g., /a/key/folders/a%2Fb%2Fc/files)
  .use(createFolderMutationsRoute({
    handleCreateFileInFolder,
    handleCopyFileToFolder,
    handleBulkCreateFiles,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveFolder,
  }))

  .use(createFolderSettingsRoute({ handleGetFolderSettings, handleUpdateFolderSettings }))
  .use(folderWebhooksRoute);



