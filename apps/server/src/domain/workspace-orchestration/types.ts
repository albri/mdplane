import type { ErrorCode } from '../../core/errors';
import type { OrchestrationQueryFilters } from '../orchestration/types';
import type { GetWorkspaceOrchestrationQuery } from '@mdplane/shared';

export type SessionMembershipErrorCode = 'UNAUTHORIZED' | 'NOT_FOUND';

export type SessionMembershipResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      status: number;
      error: { code: SessionMembershipErrorCode; message: string };
    };

export type WorkspaceOrchestrationQueryInput = GetWorkspaceOrchestrationQuery;

export type WorkspaceOrchestrationHandlerError = {
  status: number;
  error: { code: ErrorCode | SessionMembershipErrorCode; message: string };
};

export type WorkspaceOrchestrationHandlerResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; status: number; error: WorkspaceOrchestrationHandlerError['error'] };

export type OrchestrationFiltersResult = {
  filters: OrchestrationQueryFilters;
};
