import { Elysia, t } from 'elysia';
import {
  zGetWorkspaceOrchestrationQuery,
  ORCHESTRATION_PRIORITIES,
  ORCHESTRATION_STATUSES,
} from '@mdplane/shared';
import { createErrorResponse } from '../../core/errors';
import { createCommaSeparatedEnumQuerySchema } from '../../shared';
import {
  blockWorkspaceOrchestrationClaim,
  cancelWorkspaceOrchestrationClaim,
  completeWorkspaceOrchestrationClaim,
  getWorkspaceOrchestration,
  renewWorkspaceOrchestrationClaim,
} from './handlers';

const zWorkspaceOrchestrationQuery = zGetWorkspaceOrchestrationQuery.extend({
  status: createCommaSeparatedEnumQuerySchema(ORCHESTRATION_STATUSES, 'status'),
  priority: createCommaSeparatedEnumQuerySchema(ORCHESTRATION_PRIORITIES, 'priority'),
});

export const workspaceOrchestrationRoute = new Elysia()
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      return createErrorResponse('INVALID_REQUEST', error.message);
    }
  })
  .get(
    '/workspaces/:workspaceId/orchestration',
    async ({ params, request, query, set }) => {
      const result = await getWorkspaceOrchestration({
        request,
        workspaceId: params.workspaceId,
        query,
      });
      if (!result.ok) {
        set.status = result.status;
        return createErrorResponse(result.error.code, result.error.message);
      }
      return { ok: true, data: result.data };
    },
    {
      params: t.Object({ workspaceId: t.String() }),
      query: zWorkspaceOrchestrationQuery,
    }
  )
  .post(
    '/workspaces/:workspaceId/orchestration/claims/:claimId/renew',
    async ({ params, request, body, set }) => {
      const result = await renewWorkspaceOrchestrationClaim({
        request,
        workspaceId: params.workspaceId,
        claimId: params.claimId,
        expiresInSeconds: body?.expiresInSeconds,
      });
      if (!result.ok) {
        set.status = result.status;
        return createErrorResponse(result.error.code, result.error.message);
      }
      return { ok: true, data: result.data };
    },
    {
      params: t.Object({ workspaceId: t.String(), claimId: t.String() }),
      body: t.Optional(t.Object({ expiresInSeconds: t.Optional(t.Number()) })),
    }
  )
  .post(
    '/workspaces/:workspaceId/orchestration/claims/:claimId/complete',
    async ({ params, request, body, set }) => {
      const result = await completeWorkspaceOrchestrationClaim({
        request,
        workspaceId: params.workspaceId,
        claimId: params.claimId,
        content: body?.content,
      });
      if (!result.ok) {
        set.status = result.status;
        return createErrorResponse(result.error.code, result.error.message);
      }
      return { ok: true, data: result.data };
    },
    {
      params: t.Object({ workspaceId: t.String(), claimId: t.String() }),
      body: t.Optional(t.Object({ content: t.Optional(t.String()) })),
    }
  )
  .post(
    '/workspaces/:workspaceId/orchestration/claims/:claimId/cancel',
    async ({ params, request, body, set }) => {
      const result = await cancelWorkspaceOrchestrationClaim({
        request,
        workspaceId: params.workspaceId,
        claimId: params.claimId,
        reason: body?.reason,
      });
      if (!result.ok) {
        set.status = result.status;
        return createErrorResponse(result.error.code, result.error.message);
      }
      return { ok: true, data: result.data };
    },
    {
      params: t.Object({ workspaceId: t.String(), claimId: t.String() }),
      body: t.Optional(t.Object({ reason: t.Optional(t.String()) })),
    }
  )
  .post(
    '/workspaces/:workspaceId/orchestration/claims/:claimId/block',
    async ({ params, request, body, set }) => {
      const result = await blockWorkspaceOrchestrationClaim({
        request,
        workspaceId: params.workspaceId,
        claimId: params.claimId,
        reason: body?.reason,
      });
      if (!result.ok) {
        set.status = result.status;
        return createErrorResponse(result.error.code, result.error.message);
      }
      return { ok: true, data: result.data };
    },
    {
      params: t.Object({ workspaceId: t.String(), claimId: t.String() }),
      body: t.Optional(t.Object({ reason: t.Optional(t.String()) })),
    }
  );
