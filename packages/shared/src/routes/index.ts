/**
 * API Route Builders
 *
 * Single source of truth for API routes in the mdplane system.
 * All route paths should be imported from here to prevent drift.
 *
 * Route categories:
 * - CAPABILITY_ROUTES: /r/{key}, /a/{key}, /w/{key} capability URL routes
 * - FOLDER_ROUTES: Folder operations within capability URLs
 * - API_V1_ROUTES: /api/v1/* path-based routes (API key authenticated)
 * - WORKSPACE_ROUTES: /workspaces/{id}/* control routes (session authenticated)
 * - AUTH_ROUTES: /auth/* authentication routes
 * - SYSTEM_ROUTES: /health, /openapi.json, etc.
 * - JOB_ROUTES: /j/{key} async job routes
 *
 * @module routes
 */

/** Capability key type prefix */
export type KeyType = 'r' | 'a' | 'w';

export const CAPABILITY_ROUTES = {
  // Read tier
  read: (key: string) => `/r/${key}` as const,
  readRaw: (key: string) => `/r/${key}/raw` as const,
  readMeta: (key: string) => `/r/${key}/meta` as const,
  readTail: (key: string) => `/r/${key}/tail` as const,
  readStructure: (key: string) => `/r/${key}/structure` as const,
  readSection: (key: string, heading: string) =>
    `/r/${key}/section/${encodeURIComponent(heading)}` as const,
  readAppend: (key: string, appendId: string) =>
    `/r/${key}/ops/file/append/${appendId}` as const,
  readSearch: (key: string) => `/r/${key}/search` as const,
  readStats: (key: string) => `/r/${key}/ops/file/stats` as const,
  readSubscribe: (key: string) => `/r/${key}/ops/subscribe` as const,
  readOrchestration: (key: string) => `/r/${key}/orchestration` as const,
  readAgentLiveness: (key: string) => `/r/${key}/agents/liveness` as const,

  // Append tier
  append: (key: string) => `/a/${key}/append` as const,
  appendHeartbeat: (key: string) => `/a/${key}/heartbeat` as const,
  appendSubscribe: (key: string) => `/a/${key}/ops/subscribe` as const,
  appendStats: (key: string) => `/a/${key}/ops/file/stats` as const,

  // Write/Admin tier
  write: (key: string) => `/w/${key}` as const,
  writeRecover: (key: string) => `/w/${key}/recover` as const,
  writeMove: (key: string) => `/w/${key}/move` as const,
  writeRotate: (key: string) => `/w/${key}/rotate` as const,
  writeWorkspace: (key: string) => `/w/${key}/workspace` as const,
  writeSettings: (key: string) => `/w/${key}/settings` as const,
  writeStats: (key: string) => `/w/${key}/ops/stats` as const,
  writeAudit: (key: string) => `/w/${key}/audit` as const,
  writeClaim: (key: string) => `/w/${key}/claim` as const,
  writeOrchestration: (key: string) => `/w/${key}/orchestration` as const,
  writeSubscribe: (key: string) => `/w/${key}/ops/subscribe` as const,
  writeCapabilitiesCheck: (key: string) =>
    `/w/${key}/capabilities/check` as const,

  // Webhooks (write tier)
  writeWebhooks: (key: string) => `/w/${key}/webhooks` as const,
  writeWebhook: (key: string, webhookId: string) =>
    `/w/${key}/webhooks/${webhookId}` as const,
  writeWebhookLogs: (key: string, webhookId: string) =>
    `/w/${key}/webhooks/${webhookId}/logs` as const,
  writeWebhookTest: (key: string, webhookId: string) =>
    `/w/${key}/webhooks/${webhookId}/test` as const,

  // Keys (write tier)
  writeKeys: (key: string) => `/w/${key}/keys` as const,
  writeKey: (key: string, keyId: string) =>
    `/w/${key}/keys/${keyId}` as const,

  // Dynamic key type builder
  byKeyType: (keyType: KeyType, key: string) =>
    `/${keyType}/${key}` as const,
} as const;

export const FOLDER_ROUTES = {
  // Read tier
  list: (key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/r/${key}/folders/${path}`
      : `/r/${key}/folders`,
  search: (key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/r/${key}/ops/folders/search?path=${encodeURIComponent(path)}`
      : `/r/${key}/ops/folders/search`,
  tasks: (key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/r/${key}/ops/folders/tasks?path=${encodeURIComponent(path)}`
      : `/r/${key}/ops/folders/tasks`,
  stats: (key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/r/${key}/ops/folders/stats?path=${encodeURIComponent(path)}`
      : `/r/${key}/ops/folders/stats`,
  subscribe: (key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/r/${key}/ops/folders/subscribe?path=${encodeURIComponent(path)}`
      : `/r/${key}/ops/folders/subscribe`,
  appendSubscribe: (key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/a/${key}/ops/folders/subscribe?path=${encodeURIComponent(path)}`
      : `/a/${key}/ops/folders/subscribe`,
  writeSubscribe: (key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/w/${key}/ops/folders/subscribe?path=${encodeURIComponent(path)}`
      : `/w/${key}/ops/folders/subscribe`,

  // Append tier
  appendList: (key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/a/${key}/folders/${path}`
      : `/a/${key}/folders`,
  createFile: (key: string, path: string) =>
    `/a/${key}/folders/${path}/files`,
  copyFile: (key: string, path: string) =>
    `/a/${key}/folders/${path}/copy`,
  bulkCreate: (key: string, path: string) =>
    `/a/${key}/folders/${path}/bulk`,
  claims: (key: string, path: string) =>
    `/a/${key}/folders/${path}/claims`,

  // Write tier
  writeList: (key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/w/${key}/folders/${path}`
      : `/w/${key}/folders`,
  create: (key: string) => `/w/${key}/folders`,
  rename: (key: string, path: string) => `/w/${key}/folders/${path}`,
  delete: (key: string, path: string) => `/w/${key}/folders/${path}`,
  move: (key: string, path: string) => `/w/${key}/folders/${path}/move`,
  settings: (key: string, path: string) =>
    `/w/${key}/folders/${path}/settings`,
  webhooks: (key: string, path: string) =>
    `/w/${key}/folders/${path}/webhooks`,
  webhook: (key: string, path: string, webhookId: string) =>
    `/w/${key}/folders/${path}/webhooks/${webhookId}`,

  // Dynamic key type builder
  byKeyType: (keyType: KeyType, key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/${keyType}/${key}/folders/${path}`
      : `/${keyType}/${key}/folders`,
} as const;

export const API_V1_ROUTES = {
  // Bootstrap (canonical route, not prefixed with /api/v1)
  bootstrap: '/bootstrap' as const,

  // Files (path-based, API key authenticated)
  file: (path: string) => `/api/v1/files/${encodeURIComponent(path)}`,
  fileAppend: (path: string) =>
    `/api/v1/files/${encodeURIComponent(path)}/append`,

  // Folders (path-based, API key authenticated)
  folders: (path?: string) =>
    path !== undefined && path !== ''
      ? `/api/v1/folders/${encodeURIComponent(path)}`
      : '/api/v1/folders',

  // Capability-based read access (canonical /r routes)
  read: (key: string) => `/r/${key}` as const,
  readRaw: (key: string) => `/r/${key}/raw` as const,
  readMeta: (key: string) => `/r/${key}/meta` as const,
  readTail: (key: string) => `/r/${key}/tail` as const,
  readStructure: (key: string) => `/r/${key}/structure` as const,
  readSection: (key: string, heading: string) =>
    `/r/${key}/section/${encodeURIComponent(heading)}` as const,
  readAppend: (key: string, appendId: string) =>
    `/r/${key}/ops/file/append/${appendId}` as const,
  readFolders: (key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/r/${key}/folders/${encodeURIComponent(path)}`
      : `/r/${key}/folders`,

  // Append operations (via /api/v1 prefix)
  append: (key: string) => `/api/v1/a/${key}/append` as const,

  // Write operations (via /api/v1 prefix)
  write: (key: string) => `/api/v1/w/${key}` as const,
  writeStats: (key: string) => `/api/v1/w/${key}/ops/stats` as const,
  writeClaim: (key: string) => `/api/v1/w/${key}/claim` as const,

  // Search
  search: '/api/v1/search' as const,

  // Export
  export: '/api/v1/export' as const,
  exportJobs: '/api/v1/export/jobs' as const,
  exportJob: (jobId: string) => `/api/v1/export/jobs/${jobId}`,
  exportJobDownload: (jobId: string) => `/api/v1/export/jobs/${jobId}/download`,
  deleted: '/api/v1/deleted' as const,

  // Agents
  agentLiveness: '/api/v1/agents/liveness' as const,

  // Stats
  stats: '/api/v1/stats' as const,

  // System
  changelog: '/api/v1/changelog' as const,
  status: '/api/v1/status' as const,
} as const;

export const WORKSPACE_ROUTES = {
  workspace: (workspaceId: string) => `/workspaces/${workspaceId}`,
  rename: (workspaceId: string) => `/workspaces/${workspaceId}/name`,
  rotateAll: (workspaceId: string) => `/workspaces/${workspaceId}/rotate-all`,

  // API Keys
  apiKeys: (workspaceId: string) => `/workspaces/${workspaceId}/api-keys`,
  apiKey: (workspaceId: string, keyId: string) =>
    `/workspaces/${workspaceId}/api-keys/${keyId}`,

  // Webhooks
  webhooks: (workspaceId: string) => `/workspaces/${workspaceId}/webhooks`,
  webhook: (workspaceId: string, webhookId: string) =>
    `/workspaces/${workspaceId}/webhooks/${webhookId}`,
  webhookTest: (workspaceId: string, webhookId: string) =>
    `/workspaces/${workspaceId}/webhooks/${webhookId}/test`,

  // Orchestration (control)
  orchestration: (workspaceId: string) =>
    `/workspaces/${workspaceId}/orchestration`,
  orchestrationClaimRenew: (workspaceId: string, claimId: string) =>
    `/workspaces/${workspaceId}/orchestration/claims/${claimId}/renew`,
  orchestrationClaimComplete: (workspaceId: string, claimId: string) =>
    `/workspaces/${workspaceId}/orchestration/claims/${claimId}/complete`,
  orchestrationClaimCancel: (workspaceId: string, claimId: string) =>
    `/workspaces/${workspaceId}/orchestration/claims/${claimId}/cancel`,
  orchestrationClaimBlock: (workspaceId: string, claimId: string) =>
    `/workspaces/${workspaceId}/orchestration/claims/${claimId}/block`,
} as const;

export const AUTH_ROUTES = {
  me: '/auth/me' as const,
  logout: '/auth/logout' as const,
  signInGithub: '/api/auth/signin/github' as const,
  signInGoogle: '/api/auth/signin/google' as const,
} as const;

export const SYSTEM_ROUTES = {
  health: '/health' as const,
  openapi: '/openapi.json' as const,
  docs: '/docs' as const,
  capabilitiesCheck: '/capabilities/check' as const,
} as const;

export const JOB_ROUTES = {
  job: (key: string) => `/j/${key}`,
} as const;

export const ROUTES = {
  capability: CAPABILITY_ROUTES,
  folder: FOLDER_ROUTES,
  apiV1: API_V1_ROUTES,
  workspace: WORKSPACE_ROUTES,
  auth: AUTH_ROUTES,
  system: SYSTEM_ROUTES,
  job: JOB_ROUTES,
} as const;

export {
  CONTROL_FRONTEND_ROUTES,
  AUTH_FRONTEND_ROUTES,
  WORKSPACE_FRONTEND_ROUTES,
  LANDING_ROUTES,
  ROUTE_MATCHERS,
  FRONTEND_ROUTES,
} from './frontend';
