import { Elysia } from 'elysia';
import {
  zError,
  zGetAgentLivenessQuery,
  zGetAgentLivenessResponse,
  zGetScopedAgentLivenessQuery,
  zGetScopedAgentLivenessResponse,
  zRecordHeartbeatResponse,
} from '@mdplane/shared';
import {
  getApiAgentsLiveness,
  getScopedAgentsLiveness,
  recordHeartbeat,
} from './handlers';
import type { HeartbeatRequestBody } from './types';

export const heartbeatRoute = new Elysia()
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
  .post(
    '/a/:key/heartbeat',
    async ({ params, body, set }) => {
      const result = recordHeartbeat({
        keyString: params.key,
        body: body as HeartbeatRequestBody,
      });
      set.status = result.status;
      return result.body as never;
    },
    {
      response: {
        201: zRecordHeartbeatResponse,
        400: zError,
        404: zError,
      },
    }
  )
  .get(
    '/api/v1/agents/liveness',
    async ({ request, query, set }) => {
      const result = getApiAgentsLiveness({ request, query });
      set.status = result.status;
      return result.body as never;
    },
    {
      query: zGetAgentLivenessQuery,
      response: {
        200: zGetAgentLivenessResponse,
        400: zError,
        401: zError,
      },
    }
  )
  .get(
    '/r/:key/agents/liveness',
    async ({ params, query, set }) => {
      const result = getScopedAgentsLiveness({ keyString: params.key, query });
      set.status = result.status;
      return result.body as never;
    },
    {
      query: zGetScopedAgentLivenessQuery,
      response: {
        200: zGetScopedAgentLivenessResponse,
        400: zError,
        404: zError,
      },
    }
  );
