export type * from './generated/client/types.gen';
export type { components, operations, paths } from './generated/api.types';
export * from './generated/client/zod.gen';
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

export const USER_APPEND_TYPES = zUserAppendType.options;
export const SYSTEM_APPEND_TYPES = zSystemAppendType.options;
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

// Handwritten key validators that are not generated from OpenAPI.
export {
  rootCapabilityKeySchema,
  scopedKeySchema,
  apiKeySchema,
} from './schemas';
export * from './generated/query-schemas.gen';
export * from './schemas/query-schemas';
export {
  API_VERSION,
  LIMITS,
  KEY_PATTERNS,
  DELETED_FILE_RETENTION_DAYS,
  EXPORT_LINK_EXPIRY_HOURS,
  DEFAULT_RATE_LIMIT,
  MAX_FILE_SIZE,
  MAX_APPEND_SIZE,
  MAX_APPENDS_PER_FILE,
  URLS,
  DEV_URLS,
  getApiUrl,
  isDevelopment,
  APP_NAME,
  ASCII_WORDMARK,
  HERO_DESCRIPTION,
  TAGLINE,
  DEMO_WORKSPACE_ID,
  DEMO_READ_KEY,
  DEMO_WORKSPACE_NAME,
} from './constants';
export {
  CAPABILITY_ROUTES,
  FOLDER_ROUTES,
  API_V1_ROUTES,
  WORKSPACE_ROUTES,
  AUTH_ROUTES,
  SYSTEM_ROUTES,
  JOB_ROUTES,
  ROUTES,
  CONTROL_FRONTEND_ROUTES,
  AUTH_FRONTEND_ROUTES,
  WORKSPACE_FRONTEND_ROUTES,
  LANDING_ROUTES,
  ROUTE_MATCHERS,
  FRONTEND_ROUTES,
} from './routes';

export type { KeyType } from './routes';
export type { ExtractData, ExtractPagination } from './types';

export type { MermaidInitializeConfig, MermaidThemeVariables } from './mermaid-theme';
export { getMermaidInitializeConfig } from './mermaid-theme';
