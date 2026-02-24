import { Elysia } from 'elysia';
import { zGetAuditLogsResponse, zError, zGetAuditLogsQuery } from '@mdplane/shared';
import { handleGetAuditLogs } from './handlers';

export const auditRoute = new Elysia()
  .onError(({ error, set, code }) => {
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
  .get('/w/:key/audit', async ({ params, query, set }) => {
    const result = await handleGetAuditLogs({
      key: params.key,
      query,
    });
    set.status = result.status;
    set.headers['Content-Type'] = 'application/json';
    if (result.status === 200) {
      return zGetAuditLogsResponse.parse(result.body);
    }
    return zError.parse(result.body);
  }, {
    query: zGetAuditLogsQuery,
    response: {
      200: zGetAuditLogsResponse,
      400: zError,
      404: zError,
    },
  });
