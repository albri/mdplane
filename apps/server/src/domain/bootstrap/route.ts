import { Elysia } from 'elysia';
import { zBootstrapRequest, zBootstrapResponse, zError } from '@mdplane/shared';
import type { BootstrapRequest } from '@mdplane/shared';
import { handleBootstrap } from './handlers';
import { generateKey } from '../../core/capability-keys';

export const bootstrapRoute = new Elysia()
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
    throw error;
  })
  .post('/bootstrap', async ({ body, set }) => {
    const result = zBootstrapRequest.safeParse(body);
    if (!result.success) {
      const fallbackRequestId = generateKey(24);
      set.status = 400;
      set.headers['X-Request-Id'] = fallbackRequestId;
      return {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: result.error.errors[0]?.message ?? 'Invalid request body',
        },
      };
    }
    const parsedBody: BootstrapRequest = result.data;

    const bootstrapResult = await handleBootstrap(parsedBody);
    set.status = 201;
    set.headers['X-Request-Id'] = bootstrapResult.requestId;
    set.headers['Content-Type'] = 'application/json';
    return bootstrapResult.response;
  }, {
    response: {
      201: zBootstrapResponse,
      400: zError,
    },
  });
