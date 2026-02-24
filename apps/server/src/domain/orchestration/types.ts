import type {
  OrchestrationTask,
  OrchestrationClaim as SharedOrchestrationClaim,
  ControlClaim,
  GetOrchestrationReadOnlyQuery,
} from '@mdplane/shared';

export type OrchestrationQueryFilters = Partial<GetOrchestrationReadOnlyQuery>;

export interface OrchestrationSummary {
  pending: number;
  claimed: number;
  completed: number;
  stalled: number;
  cancelled: number;
}

export type ExtendedAgentStatus = 'alive' | 'idle' | 'busy' | 'error' | 'stale';

export interface OrchestrationAgent {
  author: string;
  status: ExtendedAgentStatus;
  lastSeen: string;
  currentTask?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentWorkload {
  activeClaims: number;
  completedToday: number;
}

export interface OrchestrationClaim extends SharedOrchestrationClaim {
  canForceExpire?: boolean;
}

export type MutationClaimResponse = Pick<
  ControlClaim,
  'id' | 'taskId' | 'path' | 'author' | 'status' | 'expiresAt' | 'expiresInSeconds'
> & {
  file: { id: string; path: string };
  blocked?: boolean;
  blockReason?: string;
};

export interface OrchestrationPagination {
  cursor?: string;
  hasMore: boolean;
}

export interface OrchestrationBoard {
  summary: OrchestrationSummary;
  tasks: OrchestrationTask[];
  claims: OrchestrationClaim[];
  agents: OrchestrationAgent[];
  workload: Record<string, AgentWorkload>;
  pagination: OrchestrationPagination;
}

export interface ClaimMutationContext {
  workspaceId: string;
  claimId: string;
  mutationAuthor?: string;
}

export interface RenewClaimInput extends ClaimMutationContext {
  expiresInSeconds?: number;
}

export interface CompleteClaimInput extends ClaimMutationContext {
  content?: string;
}

export interface CancelClaimInput extends ClaimMutationContext {
  reason?: string;
}

export interface BlockClaimInput extends ClaimMutationContext {
  reason: string;
}

export interface ClaimMutationResult {
  ok: true;
  claim: MutationClaimResponse;
  appendId: string;
}

export interface ClaimMutationError {
  ok: false;
  code: string;
  message: string;
}

export type ClaimMutationResponse = ClaimMutationResult | ClaimMutationError;

