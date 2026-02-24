import { Elysia } from 'elysia';
import {
  zGetOrchestrationAdminQuery as zAdminOrchestrationQueryBase,
  zGetOrchestrationReadOnlyQuery as zReadOnlyOrchestrationQueryBase,
  ORCHESTRATION_PRIORITIES,
  ORCHESTRATION_STATUSES,
} from '@mdplane/shared';
import { createCommaSeparatedEnumQuerySchema } from '../../shared';
import { getOrchestrationBoardForKey } from './handlers';

const zReadOnlyOrchestrationQuery = zReadOnlyOrchestrationQueryBase.extend({
  status: createCommaSeparatedEnumQuerySchema(ORCHESTRATION_STATUSES, 'status'),
  priority: createCommaSeparatedEnumQuerySchema(ORCHESTRATION_PRIORITIES, 'priority'),
});

const zAdminOrchestrationQuery = zAdminOrchestrationQueryBase.extend({
  status: createCommaSeparatedEnumQuerySchema(ORCHESTRATION_STATUSES, 'status'),
  priority: createCommaSeparatedEnumQuerySchema(ORCHESTRATION_PRIORITIES, 'priority'),
});

export const orchestrationRoute = new Elysia()
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error.message,
        },
      };
    }
  })
  .get('/r/:key/orchestration', async ({ params, query, set }) => {
    const result = await getOrchestrationBoardForKey({
      keyString: params.key,
      query,
      includeAdminFields: false,
    });
    if (!result.ok) {
      set.status = result.status;
      return { ok: false as const, error: result.error };
    }

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    return { ok: true as const, data: result.data, webUrl: result.webUrl };
  }, {
    query: zReadOnlyOrchestrationQuery,
  })
  .get('/w/:key/orchestration', async ({ params, query, set }) => {
    const result = await getOrchestrationBoardForKey({
      keyString: params.key,
      query,
      requiredPermission: 'write',
      includeAdminFields: true,
    });
    if (!result.ok) {
      set.status = result.status;
      return { ok: false as const, error: result.error };
    }

    set.status = 200;
    set.headers['Content-Type'] = 'application/json';
    return { ok: true as const, data: result.data, webUrl: result.webUrl };
  }, {
    query: zAdminOrchestrationQuery,
  });
