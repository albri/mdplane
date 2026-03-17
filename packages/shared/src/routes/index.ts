export type KeyType = 'r' | 'a' | 'w';

// Capability URL routes used by agents and watchers at runtime.
export const CAPABILITY_ROUTES = {
  // Read tier.
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
  // Append tier.
  append: (key: string) => `/a/${key}/append` as const,
  appendHeartbeat: (key: string) => `/a/${key}/heartbeat` as const,
  appendSubscribe: (key: string) => `/a/${key}/ops/subscribe` as const,
  appendStats: (key: string) => `/a/${key}/ops/file/stats` as const,
  // Write tier.
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
  // Webhooks.
  writeWebhooks: (key: string) => `/w/${key}/webhooks` as const,
  writeWebhook: (key: string, webhookId: string) =>
    `/w/${key}/webhooks/${webhookId}` as const,
  writeWebhookLogs: (key: string, webhookId: string) =>
    `/w/${key}/webhooks/${webhookId}/logs` as const,
  writeWebhookTest: (key: string, webhookId: string) =>
    `/w/${key}/webhooks/${webhookId}/test` as const,
  // Scoped capability keys.
  writeKeys: (key: string) => `/w/${key}/keys` as const,
  writeKey: (key: string, keyId: string) =>
    `/w/${key}/keys/${keyId}` as const,
  byKeyType: (keyType: KeyType, key: string) =>
    `/${keyType}/${key}` as const,
} as const;

// Folder-scoped capability routes.
export const FOLDER_ROUTES = {
  // Read tier.
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
  // Append tier.
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
  // Write tier.
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
  byKeyType: (keyType: KeyType, key: string, path?: string) =>
    path !== undefined && path !== ''
      ? `/${keyType}/${key}/folders/${path}`
      : `/${keyType}/${key}/folders`,
} as const;

// API-key-authenticated routes under /api/v1.
export const API_V1_ROUTES = {
  bootstrap: '/bootstrap' as const,
  file: (path: string) => `/api/v1/files/${encodeURIComponent(path)}`,
  fileAppend: (path: string) =>
    `/api/v1/files/${encodeURIComponent(path)}/append`,
  folders: (path?: string) =>
    path !== undefined && path !== ''
      ? `/api/v1/folders/${encodeURIComponent(path)}`
      : '/api/v1/folders',
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
  append: (key: string) => `/api/v1/a/${key}/append` as const,
  write: (key: string) => `/api/v1/w/${key}` as const,
  writeStats: (key: string) => `/api/v1/w/${key}/ops/stats` as const,
  writeClaim: (key: string) => `/api/v1/w/${key}/claim` as const,
  search: '/api/v1/search' as const,
  export: '/api/v1/export' as const,
  exportJobs: '/api/v1/export/jobs' as const,
  exportJob: (jobId: string) => `/api/v1/export/jobs/${jobId}`,
  exportJobDownload: (jobId: string) => `/api/v1/export/jobs/${jobId}/download`,
  deleted: '/api/v1/deleted' as const,
  agentLiveness: '/api/v1/agents/liveness' as const,
  stats: '/api/v1/stats' as const,
  changelog: '/api/v1/changelog' as const,
  status: '/api/v1/status' as const,
} as const;

// Claimed-workspace governance routes.
export const WORKSPACE_ROUTES = {
  workspace: (workspaceId: string) => `/workspaces/${workspaceId}`,
  rename: (workspaceId: string) => `/workspaces/${workspaceId}/name`,
  rotateAll: (workspaceId: string) => `/workspaces/${workspaceId}/rotate-all`,
  apiKeys: (workspaceId: string) => `/workspaces/${workspaceId}/api-keys`,
  apiKey: (workspaceId: string, keyId: string) =>
    `/workspaces/${workspaceId}/api-keys/${keyId}`,
  webhooks: (workspaceId: string) => `/workspaces/${workspaceId}/webhooks`,
  webhook: (workspaceId: string, webhookId: string) =>
    `/workspaces/${workspaceId}/webhooks/${webhookId}`,
  webhookTest: (workspaceId: string, webhookId: string) =>
    `/workspaces/${workspaceId}/webhooks/${webhookId}/test`,
  // Control-plane orchestration actions.
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

// Session-authenticated auth routes.
export const AUTH_ROUTES = {
  me: '/auth/me' as const,
  logout: '/auth/logout' as const,
  signInGithub: '/api/auth/signin/github' as const,
  signInGoogle: '/api/auth/signin/google' as const,
} as const;

// Non-auth or system-level routes.
export const SYSTEM_ROUTES = {
  health: '/health' as const,
  openapi: '/openapi.json' as const,
  docs: '/docs' as const,
  capabilitiesCheck: '/capabilities/check' as const,
} as const;

// Async export/download job routes.
export const JOB_ROUTES = {
  job: (key: string) => `/j/${key}`,
} as const;

// Top-level route namespace export.
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
