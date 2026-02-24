import { Elysia } from 'elysia';
import {
  zError,
  zFileReadResponse,
  zGetFileStatsViaReadKeyResponse,
  zReadAppendResponse,
  zReadFileQuery,
  zReadFileViaWriteKeyQuery,
} from '@mdplane/shared';
import type { FileReadResponse } from '@mdplane/shared';
import { createFileDeletedResponse } from '../../shared';
import { createErrorResponse } from '../../core/errors';
import { filesReadRoute } from '../files-read/route';
import {
  handleGetAppendByKey,
  handleGetFileStatsByKey,
  handleReadFileByKey,
} from './handlers';
import { filesMutationsRoute } from './mutations-route';

export const filesRoute = new Elysia()
  .onError(({ error, set, code }) => {
    if (code === 'PARSE' || (error instanceof Error && error.message?.includes('JSON'))) {
      set.status = 400;
      return {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid JSON in request body',
        },
      };
    }
    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
        },
      };
    }
    throw error;
  })
  .get('/r//*', ({ set }) => {
    set.status = 404;
    return { ok: false, error: { code: 'INVALID_KEY', message: 'Invalid or missing capability key' } };
  }, {
    response: {
      404: zError,
    },
  })
  .put('/w//*', ({ set }) => {
    set.status = 404;
    return { ok: false, error: { code: 'INVALID_KEY', message: 'Invalid or missing capability key' } };
  }, {
    response: {
      404: zError,
    },
  })
  .delete('/w//*', ({ set }) => {
    set.status = 404;
    return { ok: false, error: { code: 'INVALID_KEY', message: 'Invalid or missing capability key' } };
  }, {
    response: {
      404: zError,
    },
  })
  .use(filesReadRoute)
  .get('/r/:key/ops/file/stats', async ({ params, set, request }) => {
    const result = await handleGetFileStatsByKey({ key: params.key, rawUrl: request.url });
    if (!result.ok) {
      if (result.status === 410 && result.deletedAt) {
        return createFileDeletedResponse(result.deletedAt, set);
      }
      set.status = result.status;
      return { ok: false, error: result.error };
    }

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    return { ok: true, data: result.data };
  }, {
    response: { 200: zGetFileStatsViaReadKeyResponse, 400: zError, 404: zError, 410: zError },
  })
  .get('/r/:key/ops/file/append/:appendId', async ({ params, set }) => {
    const result = await handleGetAppendByKey({ key: params.key, appendId: params.appendId });

    if (!result.ok) {
      if (result.status === 410 && result.deletedAt) {
        return createFileDeletedResponse(result.deletedAt, set);
      }
      set.status = result.status;
      return createErrorResponse(result.error.code, result.error.message);
    }

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    return { ok: true as const, data: result.data };
  }, {
    response: { 200: zReadAppendResponse, 400: zError, 404: zError, 410: zError },
  })
  .get('/r/:key/*', async ({ params, set, request, query }) => {
    const path = (params as Record<string, string>)['*'] || '';
    const result = await handleReadFileByKey({
      key: params.key,
      path,
      rawUrl: request.url,
      keyPrefix: 'r',
      query: {
        appends: query.appends,
        format: query.format,
        include: query.include,
        since: query.since,
      },
    });

    if (!result.ok) {
      if (result.status === 410 && result.deletedAt) {
        return createFileDeletedResponse(result.deletedAt, set);
      }
      set.status = result.status;
      return createErrorResponse(result.error.code, result.error.message);
    }

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    set.headers['ETag'] = result.etag;
    return { ok: true as const, data: result.data } satisfies FileReadResponse;
  }, {
    query: zReadFileViaWriteKeyQuery,
    response: {
      200: zFileReadResponse,
      400: zError,
      404: zError,
      410: zError,
    },
  })
  .get('/w/:key/*', async ({ params, set, request, query }) => {
    const path = (params as Record<string, string>)['*'] || '';
    const result = await handleReadFileByKey({
      key: params.key,
      path,
      rawUrl: request.url,
      keyPrefix: 'w',
      requiredPermission: 'write',
      query: {
        appends: query.appends,
        format: query.format,
        include: query.include,
        since: query.since,
      },
    });

    if (!result.ok) {
      if (result.status === 410 && result.deletedAt) {
        return createFileDeletedResponse(result.deletedAt, set);
      }
      set.status = result.status;
      return createErrorResponse(result.error.code, result.error.message);
    }

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    set.headers['ETag'] = result.etag;
    return { ok: true as const, data: result.data };
  }, {
    query: zReadFileQuery,
    response: {
      200: zFileReadResponse,
      400: zError,
      404: zError,
      410: zError,
    },
  })
  .use(filesMutationsRoute);
