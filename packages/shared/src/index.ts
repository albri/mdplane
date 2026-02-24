// Clean, flat type exports - use these for all API contracts
// Example: import type { Append, AppendType, CapabilityUrls } from '@mdplane/shared';
export type * from './generated/client/types.gen';

// Also export the nested structure for advanced use cases (paths, operations)
// Example: import type { paths, operations } from '@mdplane/shared';
export type { components, operations, paths } from './generated/api.types';

// Re-export all generated Zod schemas for runtime validation
// Example: import { zAppendRequest, zAppendType } from '@mdplane/shared';
export * from './generated/client/zod.gen';

// Runtime-accessible arrays for iteration, validation messages, CLI help text.
// These are derived from Zod schemas so they stay in sync with OpenAPI.
// Example: import { USER_APPEND_TYPES, PRIORITIES } from '@mdplane/shared';
import {
  zUserAppendType,
  zSystemAppendType,
  zAppendStatus,
  zPriority,
  zKeyPermission,
  zHeartbeatStatus,
  zJobStatus,
  zOrchestrationSummary,
} from './generated/client/zod.gen';

// User-facing append types (can be created via API/CLI)
export const USER_APPEND_TYPES = zUserAppendType.options;
// System-only append types (heartbeat, etc.) - not user-creatable
export const SYSTEM_APPEND_TYPES = zSystemAppendType.options;
// All append types (user + system) - for backward compatibility
export const APPEND_TYPES = [...USER_APPEND_TYPES, ...SYSTEM_APPEND_TYPES] as const;
export const APPEND_STATUSES = zAppendStatus.options;
export const PRIORITIES = zPriority.options;
export const ORCHESTRATION_STATUSES = Object.keys(
  zOrchestrationSummary.shape
) as (keyof typeof zOrchestrationSummary.shape)[];
export const ORCHESTRATION_PRIORITIES = PRIORITIES;
export const KEY_PERMISSIONS = zKeyPermission.options;
export const HEARTBEAT_STATUSES = zHeartbeatStatus.options;
export const JOB_STATUSES = zJobStatus.options;

// These validate capability key formats and are NOT auto-generated.
// Example: import { rootCapabilityKeySchema, scopedKeySchema, apiKeySchema } from '@mdplane/shared';
export {
  rootCapabilityKeySchema,
  scopedKeySchema,
  apiKeySchema,
} from './schemas';

// Auto-generated from OpenAPI spec with proper coercion for HTTP query params.
// Uses z.coerce.number() instead of z.number(), z.enum(['true', 'false']) for booleans.
// Regenerate: pnpm --filter @mdplane/shared generate:query-schemas
// Example: import { zExportWorkspaceQuery } from '@mdplane/shared';
export * from './generated/query-schemas.gen';

// Short aliases for routes that use abbreviated names (zAgentLivenessQuery vs zGetAgentLivenessQuery).
// Plus 3 schemas not in OpenAPI yet: zFolderStatsQuery, zFolderClaimsQuery, zDeletedFilesQuery.
export * from './schemas/query-schemas';

// Global limits, rate limits, and timing constants.
// Example: import { LIMITS, KEY_PATTERNS } from '@mdplane/shared';
export {
  API_VERSION,
  LIMITS,
  KEY_PATTERNS,
  DELETED_FILE_RETENTION_DAYS,
  EXPORT_LINK_EXPIRY_HOURS,
  // Compatibility exports
  DEFAULT_RATE_LIMIT,
  MAX_FILE_SIZE,
  MAX_APPEND_SIZE,
  MAX_APPENDS_PER_FILE,
  // URL constants
  URLS,
  DEV_URLS,
  getApiUrl,
  isDevelopment,
  // Branding constants
  APP_NAME,
  ASCII_WORDMARK,
  BRAND_ACCENT_HEX,
  HERO_DESCRIPTION,
  splitWordmarkLines,
  TAGLINE,
  WORDMARK_MD_SPLIT_COL,
  // Demo workspace constants (read key only - append/write are server-side only)
  DEMO_WORKSPACE_ID,
  DEMO_READ_KEY,
  DEMO_WORKSPACE_NAME,
} from './constants';

// Centralized route path builders to prevent drift from OpenAPI spec.
// Example: import { CAPABILITY_ROUTES, WORKSPACE_ROUTES } from '@mdplane/shared';
export {
  // API routes (server-side)
  CAPABILITY_ROUTES,
  FOLDER_ROUTES,
  API_V1_ROUTES,
  WORKSPACE_ROUTES,
  AUTH_ROUTES,
  SYSTEM_ROUTES,
  JOB_ROUTES,
  ROUTES,
  // Frontend routes (client-side)
  CONTROL_FRONTEND_ROUTES,
  AUTH_FRONTEND_ROUTES,
  WORKSPACE_FRONTEND_ROUTES,
  LANDING_ROUTES,
  ROUTE_MATCHERS,
  FRONTEND_ROUTES,
} from './routes';

export type { KeyType } from './routes';

// Utility types for extracting inner data from response envelopes.
// Example: import type { ExtractData, SearchResponse } from '@mdplane/shared';
//          type SearchData = ExtractData<SearchResponse>;
export type { ExtractData, ExtractPagination } from './types';
