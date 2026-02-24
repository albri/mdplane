import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { workspaces, userWorkspaces } from '../../db/schema';
import { auth } from '../../core/auth';
import {
  blockClaim,
  cancelClaim,
  completeClaim,
  type MutationClaimResponse,
  type OrchestrationQueryFilters,
  queryOrchestrationBoard,
  renewClaim,
} from '../orchestration';
import type { ErrorCode } from '../../core/errors';
import type {
  OrchestrationFiltersResult,
  SessionMembershipResult,
  WorkspaceOrchestrationHandlerResult,
  WorkspaceOrchestrationQueryInput,
} from './types';

type ValidateSessionAndMembershipInput = {
  request: Request;
  workspaceId: string;
};

async function validateSessionAndMembership({
  request,
  workspaceId,
}: ValidateSessionAndMembershipInput): Promise<SessionMembershipResult> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: { code: 'UNAUTHORIZED', message: 'No valid session' },
    };
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });
  if (!workspace || workspace.deletedAt) {
    return {
      ok: false,
      status: 404,
      error: { code: 'NOT_FOUND', message: 'Workspace not found' },
    };
  }

  const membership = await db.query.userWorkspaces.findFirst({
    where: and(
      eq(userWorkspaces.userId, session.user.id),
      eq(userWorkspaces.workspaceId, workspaceId)
    ),
  });
  if (!membership) {
    return {
      ok: false,
      status: 404,
      error: { code: 'NOT_FOUND', message: 'Workspace not found' },
    };
  }

  return { ok: true, userId: session.user.id };
}

function toFilters({
  query,
}: {
  query: WorkspaceOrchestrationQueryInput;
}): OrchestrationFiltersResult {
  const filters: OrchestrationQueryFilters = {};
  if (query.status) {
    filters.status = query.status;
  }
  if (query.priority) {
    filters.priority = query.priority;
  }
  if (query.agent) {
    filters.agent = query.agent;
  }
  if (query.file) {
    filters.file = query.file;
  }
  if (query.folder) {
    filters.folder = query.folder;
  }
  if (typeof query.limit === 'number') {
    filters.limit = query.limit;
  }
  if (query.cursor) {
    filters.cursor = query.cursor;
  }
  return { filters };
}

export async function getWorkspaceOrchestration({
  request,
  workspaceId,
  query,
}: {
  request: Request;
  workspaceId: string;
  query: WorkspaceOrchestrationQueryInput;
}): Promise<WorkspaceOrchestrationHandlerResult<ReturnType<typeof queryOrchestrationBoard>>> {
  const authResult = await validateSessionAndMembership({ request, workspaceId });
  if (!authResult.ok) {
    return authResult;
  }

  const { filters } = toFilters({ query });
  const board = queryOrchestrationBoard(workspaceId, filters);
  return { ok: true, data: board };
}

function toMutationStatus(code: string): number {
  return code === 'APPEND_NOT_FOUND' ? 404 : 400;
}

type MutationResultData = { claim: MutationClaimResponse; appendId: string };
type MutationFunctionResult = {
  ok: boolean;
  claim?: MutationClaimResponse;
  appendId?: string;
  code?: string;
  message?: string;
};

function toMutationResponse({
  result,
}: {
  result: MutationFunctionResult;
}): WorkspaceOrchestrationHandlerResult<MutationResultData> {
  if (!result.ok) {
    return {
      ok: false,
      status: toMutationStatus(result.code ?? 'INVALID_REQUEST'),
      error: {
        code: (result.code ?? 'INVALID_REQUEST') as ErrorCode,
        message: result.message ?? 'Request failed',
      },
    };
  }

  return {
    ok: true,
    data: {
      claim: result.claim as MutationClaimResponse,
      appendId: result.appendId ?? '',
    },
  };
}

export async function renewWorkspaceOrchestrationClaim({
  request,
  workspaceId,
  claimId,
  expiresInSeconds,
}: {
  request: Request;
  workspaceId: string;
  claimId: string;
  expiresInSeconds?: number;
}): Promise<WorkspaceOrchestrationHandlerResult<MutationResultData>> {
  const authResult = await validateSessionAndMembership({ request, workspaceId });
  if (!authResult.ok) {
    return authResult;
  }

  const result = await renewClaim({ workspaceId, claimId, expiresInSeconds });
  return toMutationResponse({ result });
}

export async function completeWorkspaceOrchestrationClaim({
  request,
  workspaceId,
  claimId,
  content,
}: {
  request: Request;
  workspaceId: string;
  claimId: string;
  content?: string;
}): Promise<WorkspaceOrchestrationHandlerResult<MutationResultData>> {
  const authResult = await validateSessionAndMembership({ request, workspaceId });
  if (!authResult.ok) {
    return authResult;
  }

  const result = await completeClaim({ workspaceId, claimId, content });
  return toMutationResponse({ result });
}

export async function cancelWorkspaceOrchestrationClaim({
  request,
  workspaceId,
  claimId,
  reason,
}: {
  request: Request;
  workspaceId: string;
  claimId: string;
  reason?: string;
}): Promise<WorkspaceOrchestrationHandlerResult<MutationResultData>> {
  const authResult = await validateSessionAndMembership({ request, workspaceId });
  if (!authResult.ok) {
    return authResult;
  }

  const result = await cancelClaim({ workspaceId, claimId, reason });
  return toMutationResponse({ result });
}

export async function blockWorkspaceOrchestrationClaim({
  request,
  workspaceId,
  claimId,
  reason,
}: {
  request: Request;
  workspaceId: string;
  claimId: string;
  reason?: string;
}): Promise<WorkspaceOrchestrationHandlerResult<MutationResultData>> {
  const authResult = await validateSessionAndMembership({ request, workspaceId });
  if (!authResult.ok) {
    return authResult;
  }

  if (!reason) {
    return {
      ok: false,
      status: 400,
      error: {
        code: 'INVALID_REQUEST',
        message: 'reason is required for block',
      },
    };
  }

  const result = await blockClaim({ workspaceId, claimId, reason });
  return toMutationResponse({ result });
}
