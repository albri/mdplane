import type {
  GetAgentLivenessData,
  GetScopedAgentLivenessData,
  HeartbeatRequest,
  HeartbeatStatus as ContractHeartbeatStatus,
} from '@mdplane/shared';
import type { KeyValidationResult } from '../../shared';

export const VALID_STATUSES = ['alive', 'idle', 'busy'] as const;
export type HeartbeatStatus = (typeof VALID_STATUSES)[number];

export const DEFAULT_STALE_THRESHOLD = 300;
export const MAX_AUTHOR_LENGTH = 64;
export const MAX_METADATA_SIZE = 10000;

export type HeartbeatRouteResult<T = unknown> = {
  status: number;
  body: T;
};

export type HeartbeatRequestBody = {
  author?: HeartbeatRequest['author'];
  status?: ContractHeartbeatStatus;
  currentTask?: HeartbeatRequest['currentTask'];
  metadata?: HeartbeatRequest['metadata'];
} | null;

export type ScopedFilter = {
  type: string;
  path: string | null;
};

export type GetAgentsInput = {
  workspaceId: string;
  staleThreshold: number;
  scopeFilter?: ScopedFilter;
};

export type ApiLivenessQuery = NonNullable<GetAgentLivenessData['query']>;

export type ScopedLivenessQuery = NonNullable<GetScopedAgentLivenessData['query']>;

export type CapabilityKeyValidationResult = KeyValidationResult;
