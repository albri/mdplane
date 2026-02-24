import { z } from 'zod';

/**
 * Query parameters for GET /r/{key}
 * @operationId readFile
 */
export const zReadFileQuery = z.object({
  // Response format
  format: z.enum(['raw', 'parsed', 'structure']).optional(),
  // Return items modified after this timestamp (ISO 8601)
  since: z.string().optional(),
  // Number of recent appends to include
  appends: z.coerce.number().int().gte(0).lte(1000).optional(),
  // Include additional data (e.g., stats)
  include: z.enum(['stats']).optional()
});

export type ReadFileQuery = z.infer<typeof zReadFileQuery>;

/**
 * Query parameters for GET /w/{key}
 * @operationId readFileViaWriteKey
 */
export const zReadFileViaWriteKeyQuery = z.object({
  // Response format
  format: z.enum(['raw', 'parsed', 'structure']).optional(),
  // Return items modified after this timestamp (ISO 8601)
  since: z.string().optional(),
  // Number of recent appends to include
  appends: z.coerce.number().int().gte(0).lte(1000).optional(),
  // Include additional data (e.g., stats)
  include: z.enum(['stats']).optional()
});

export type ReadFileViaWriteKeyQuery = z.infer<typeof zReadFileViaWriteKeyQuery>;

/**
 * Query parameters for DELETE /w/{key}
 * @operationId deleteFile
 */
export const zDeleteFileQuery = z.object({
  // Hard delete (irreversible)
  permanent: z.enum(['true', 'false']).optional().default("false")
});

export type DeleteFileQuery = z.infer<typeof zDeleteFileQuery>;

/**
 * Query parameters for GET /r/{key}/tail
 * @operationId readFileTail
 */
export const zReadFileTailQuery = z.object({
  // Last N bytes to return (default 10000, max 100000)
  bytes: z.coerce.number().int().lte(100000).optional().default(10000),
  // Last N lines to return (approximate)
  lines: z.coerce.number().int().lte(1000).optional()
});

export type ReadFileTailQuery = z.infer<typeof zReadFileTailQuery>;

/**
 * Query parameters for POST /w/{key}/recover
 * @operationId recoverFile
 */
export const zRecoverFileQuery = z.object({
  // Generate new capability URLs (invalidates old ones)
  rotateUrls: z.enum(['true', 'false']).optional().default("false")
});

export type RecoverFileQuery = z.infer<typeof zRecoverFileQuery>;

/**
 * Query parameters for GET /r/{key}/folders/{path}
 * @operationId listFolderContents
 */
export const zListFolderContentsQuery = z.object({
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional(),
  // Special action to perform. When set to `export`, returns folder contents as a downloadable archive instead of JSON listing.
  action: z.enum(['export']).optional(),
  // Archive format (only used when action=export)
  format: z.enum(['zip', 'tar.gz']).optional().default("zip"),
  // Include all nested contents recursively
  recursive: z.enum(['true', 'false']).optional().default("false"),
  // Sort field
  sort: z.enum(['name', 'modified', 'size']).optional().default("name"),
  // Sort order
  order: z.enum(['asc', 'desc']).optional().default("asc"),
  // Include append history in export metadata (only used when action=export)
  includeAppends: z.enum(['true', 'false']).optional().default("false")
});

export type ListFolderContentsQuery = z.infer<typeof zListFolderContentsQuery>;

/**
 * Query parameters for GET /a/{key}/folders/{path}
 * @operationId listFolderContentsViaAppendKey
 */
export const zListFolderContentsViaAppendKeyQuery = z.object({
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional(),
  // Include all nested contents recursively
  recursive: z.enum(['true', 'false']).optional().default("false"),
  // Sort field
  sort: z.enum(['name', 'modified', 'size']).optional().default("name"),
  // Sort order
  order: z.enum(['asc', 'desc']).optional().default("asc")
});

export type ListFolderContentsViaAppendKeyQuery = z.infer<typeof zListFolderContentsViaAppendKeyQuery>;

/**
 * Query parameters for GET /w/{key}/folders/{path}
 * @operationId listFolderContentsViaWriteKey
 */
export const zListFolderContentsViaWriteKeyQuery = z.object({
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional(),
  // Include all nested contents recursively
  recursive: z.enum(['true', 'false']).optional().default("false"),
  // Sort field
  sort: z.enum(['name', 'modified', 'size']).optional().default("name"),
  // Sort order
  order: z.enum(['asc', 'desc']).optional().default("asc")
});

export type ListFolderContentsViaWriteKeyQuery = z.infer<typeof zListFolderContentsViaWriteKeyQuery>;

/**
 * Query parameters for POST /a/{key}/folders/{path}/bulk
 * @operationId bulkCreateFiles
 */
export const zBulkCreateFilesQuery = z.object({
  // Return immediately with job ID for async processing
  async: z.enum(['true', 'false']).optional().default("false")
});

export type BulkCreateFilesQuery = z.infer<typeof zBulkCreateFilesQuery>;

/**
 * Query parameters for GET /r/{key}/ops/folders/stats
 * @operationId getFolderStats
 */
export const zGetFolderStatsQuery = z.object({
  // URL-encoded folder path (omit for workspace root)
  path: z.string().optional()
});

export type GetFolderStatsQuery = z.infer<typeof zGetFolderStatsQuery>;

/**
 * Query parameters for GET /r/{key}/ops/folders/search
 * @operationId searchInFolder
 */
export const zSearchInFolderQuery = z.object({
  // URL-encoded folder path (omit for workspace root)
  path: z.string().optional(),
  // Full-text search query
  q: z.string().max(500).optional(),
  // Filter by append type
  type: z.enum(['task', 'comment', 'response', 'claim']).optional(),
  // Filter by task status (comma-separated for multiple)
  status: z.enum(['pending', 'claimed', 'completed', 'failed']).optional(),
  // Filter by author identifier
  author: z.string().optional(),
  // Filter by labels (comma-separated, OR matching)
  labels: z.string().optional(),
  // Filter by priority (comma-separated for multiple)
  priority: z.string().optional(),
  // Modified after this date (ISO 8601)
  since: z.string().optional(),
  // Max search duration (default 5s, max 30s)
  timeout: z.string().optional().default("5s"),
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional()
});

export type SearchInFolderQuery = z.infer<typeof zSearchInFolderQuery>;

/**
 * Query parameters for GET /r/{key}/ops/folders/tasks
 * @operationId queryFolderTasks
 */
export const zQueryFolderTasksQuery = z.object({
  // URL-encoded folder path (omit for workspace root)
  path: z.string().optional(),
  // Filter by task status (comma-separated for multiple)
  status: z.enum(['pending', 'claimed', 'completed', 'cancelled']).optional(),
  // Filter by author identifier
  author: z.string().optional(),
  // Filter by priority (comma-separated for multiple)
  priority: z.string().optional(),
  // Filter by labels (comma-separated, OR matching)
  labels: z.string().optional(),
  // Filter by claiming agent identifier
  claimedBy: z.string().optional(),
  // Only return unclaimed tasks when true
  claimable: z.enum(['true', 'false']).optional(),
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional()
});

export type QueryFolderTasksQuery = z.infer<typeof zQueryFolderTasksQuery>;

/**
 * Query parameters for GET /r/{key}/ops/folders/subscribe
 * @operationId subscribeFolderEvents
 */
export const zSubscribeFolderEventsQuery = z.object({
  // URL-encoded folder path (omit for workspace root)
  path: z.string().optional(),
  // Include append events for files in folder
  includeAppends: z.enum(['true', 'false']).optional().default("false"),
  // Include events from nested subfolders
  recursive: z.enum(['true', 'false']).optional().default("false")
});

export type SubscribeFolderEventsQuery = z.infer<typeof zSubscribeFolderEventsQuery>;

/**
 * Query parameters for GET /a/{key}/ops/folders/subscribe
 * @operationId subscribeFolderEventsViaAppendKey
 */
export const zSubscribeFolderEventsViaAppendKeyQuery = z.object({
  // URL-encoded folder path (omit for workspace root)
  path: z.string().optional(),
  // Include append events for files in folder
  includeAppends: z.enum(['true', 'false']).optional().default("false"),
  // Include events from nested subfolders
  recursive: z.enum(['true', 'false']).optional().default("false")
});

export type SubscribeFolderEventsViaAppendKeyQuery = z.infer<typeof zSubscribeFolderEventsViaAppendKeyQuery>;

/**
 * Query parameters for GET /w/{key}/ops/folders/subscribe
 * @operationId subscribeFolderEventsViaWriteKey
 */
export const zSubscribeFolderEventsViaWriteKeyQuery = z.object({
  // URL-encoded folder path (omit for workspace root)
  path: z.string().optional(),
  // Include append events for files in folder
  includeAppends: z.enum(['true', 'false']).optional().default("false"),
  // Include events from nested subfolders
  recursive: z.enum(['true', 'false']).optional().default("false")
});

export type SubscribeFolderEventsViaWriteKeyQuery = z.infer<typeof zSubscribeFolderEventsViaWriteKeyQuery>;

/**
 * Query parameters for GET /a/{key}/folders/{path}/claims
 * @operationId listFolderClaims
 */
export const zListFolderClaimsQuery = z.object({
  // Filter by author identifier
  author: z.string().optional()
});

export type ListFolderClaimsQuery = z.infer<typeof zListFolderClaimsQuery>;

/**
 * Query parameters for GET /w/{key}/keys
 * @operationId listScopedKeys
 */
export const zListScopedKeysQuery = z.object({
  // Include revoked keys in the response
  includeRevoked: z.enum(['true', 'false']).optional().default("false")
});

export type ListScopedKeysQuery = z.infer<typeof zListScopedKeysQuery>;

/**
 * Query parameters for GET /w/{key}/webhooks/{webhookId}/logs
 * @operationId getWebhookLogs
 */
export const zGetWebhookLogsQuery = z.object({
  // Maximum number of log entries to return
  limit: z.coerce.number().int().gte(1).lte(200).optional().default(50),
  // Return logs after this timestamp (ISO 8601)
  since: z.string().optional()
});

export type GetWebhookLogsQuery = z.infer<typeof zGetWebhookLogsQuery>;

/**
 * Query parameters for GET /r/{key}/search
 * @operationId searchInFileViaReadKey
 */
export const zSearchInFileViaReadKeyQuery = z.object({
  // Full-text search query
  q: z.string().max(500).optional(),
  // Filter by append type
  type: z.enum(['task', 'claim', 'response', 'blocked', 'answer', 'renew', 'cancel', 'comment', 'vote']).optional(),
  // Filter by task status
  status: z.enum(['pending', 'claimed', 'completed', 'cancelled']).optional(),
  // Filter by author name
  author: z.string().optional(),
  // Filter by labels (comma-separated, OR matching)
  labels: z.string().optional(),
  // Filter by priority levels (comma-separated)
  priority: z.string().optional(),
  // Return results after this timestamp (ISO 8601)
  since: z.string().optional(),
  // Maximum number of results to return
  limit: z.coerce.number().int().gte(1).lte(200).optional().default(50),
  // Pagination cursor from previous response
  cursor: z.string().optional()
});

export type SearchInFileViaReadKeyQuery = z.infer<typeof zSearchInFileViaReadKeyQuery>;

/**
 * Query parameters for GET /api/v1/search
 * @operationId searchWorkspace
 */
export const zSearchWorkspaceQuery = z.object({
  // Full-text search query
  q: z.string().max(500).optional(),
  // Filter by append type
  type: z.enum(['task', 'claim', 'response', 'blocked', 'answer', 'renew', 'cancel', 'comment', 'vote']).optional(),
  // Limit search to a specific folder path
  folder: z.string().optional(),
  // Filter by task status
  status: z.enum(['pending', 'claimed', 'completed', 'cancelled']).optional(),
  // Filter by author name
  author: z.string().optional(),
  // Filter by labels (comma-separated, OR matching)
  labels: z.string().optional(),
  // Filter by priority levels (comma-separated)
  priority: z.string().optional(),
  // Return results after this timestamp (ISO 8601)
  since: z.string().optional(),
  // Maximum number of results to return
  limit: z.coerce.number().int().gte(1).lte(200).optional().default(50),
  // Pagination cursor from previous response
  cursor: z.string().optional()
});

export type SearchWorkspaceQuery = z.infer<typeof zSearchWorkspaceQuery>;

/**
 * Query parameters for GET /api/v1/export
 * @operationId exportWorkspace
 */
export const zExportWorkspaceQuery = z.object({
  // Archive format
  format: z.enum(['zip', 'tar.gz']).optional().default("zip"),
  // Include append history in metadata
  includeAppends: z.enum(['true', 'false']).optional().default("false"),
  // Include soft-deleted files
  includeDeleted: z.enum(['true', 'false']).optional().default("false"),
  // Comma-separated folder paths to export (exports all if omitted)
  paths: z.string().optional()
});

export type ExportWorkspaceQuery = z.infer<typeof zExportWorkspaceQuery>;

/**
 * Query parameters for GET /api/v1/deleted
 * @operationId listDeletedFiles
 */
export const zListDeletedFilesQuery = z.object({
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional()
});

export type ListDeletedFilesQuery = z.infer<typeof zListDeletedFilesQuery>;

/**
 * Query parameters for GET /api/v1/agents/liveness
 * @operationId getAgentLiveness
 */
export const zGetAgentLivenessQuery = z.object({
  // Seconds before an agent is considered stale (default 300 = 5 minutes)
  staleThresholdSeconds: z.coerce.number().int().gte(60).lte(3600).optional().default(300),
  // Limit to agents active in a specific folder
  folder: z.string().optional()
});

export type GetAgentLivenessQuery = z.infer<typeof zGetAgentLivenessQuery>;

/**
 * Query parameters for GET /r/{key}/agents/liveness
 * @operationId getScopedAgentLiveness
 */
export const zGetScopedAgentLivenessQuery = z.object({
  // Seconds before an agent is considered stale (default 300 = 5 minutes)
  staleThresholdSeconds: z.coerce.number().int().gte(60).lte(3600).optional().default(300)
});

export type GetScopedAgentLivenessQuery = z.infer<typeof zGetScopedAgentLivenessQuery>;

/**
 * Query parameters for GET /r/{key}/orchestration
 * @operationId getOrchestrationReadOnly
 */
export const zGetOrchestrationReadOnlyQuery = z.object({
  // Filter by task status (comma-separated; pending, claimed, stalled, completed, cancelled)
  status: z.string().optional(),
  // Filter by claiming agent
  agent: z.string().optional(),
  // Filter by filename (partial match)
  file: z.string().optional(),
  // Filter by folder path
  folder: z.string().optional(),
  // Filter by priority (comma-separated; low, medium, high, critical)
  priority: z.string().optional(),
  // Return items modified after this timestamp (ISO 8601)
  since: z.string().optional(),
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional()
});

export type GetOrchestrationReadOnlyQuery = z.infer<typeof zGetOrchestrationReadOnlyQuery>;

/**
 * Query parameters for GET /w/{key}/orchestration
 * @operationId getOrchestrationAdmin
 */
export const zGetOrchestrationAdminQuery = z.object({
  // Filter by task status (comma-separated; pending, claimed, stalled, completed, cancelled)
  status: z.string().optional(),
  // Filter by claiming agent
  agent: z.string().optional(),
  // Filter by filename (partial match)
  file: z.string().optional(),
  // Filter by folder path
  folder: z.string().optional(),
  // Filter by priority (comma-separated; low, medium, high, critical)
  priority: z.string().optional(),
  // Return items modified after this timestamp (ISO 8601)
  since: z.string().optional(),
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional()
});

export type GetOrchestrationAdminQuery = z.infer<typeof zGetOrchestrationAdminQuery>;

/**
 * Query parameters for GET /workspaces/{workspaceId}/orchestration
 * @operationId getWorkspaceOrchestration
 */
export const zGetWorkspaceOrchestrationQuery = z.object({
  // Filter by task status (comma-separated; pending, claimed, stalled, completed, cancelled)
  status: z.string().optional(),
  // Filter by claiming agent
  agent: z.string().optional(),
  // Filter by filename (partial match)
  file: z.string().optional(),
  // Filter by folder path
  folder: z.string().optional(),
  // Filter by priority (comma-separated; low, medium, high, critical)
  priority: z.string().optional(),
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional()
});

export type GetWorkspaceOrchestrationQuery = z.infer<typeof zGetWorkspaceOrchestrationQuery>;

/**
 * Query parameters for GET /api/v1/files/{path}
 * @operationId apiReadFileByPath
 */
export const zApiReadFileByPathQuery = z.object({
  // Response format
  format: z.enum(['raw', 'parsed', 'structure']).optional()
});

export type ApiReadFileByPathQuery = z.infer<typeof zApiReadFileByPathQuery>;

/**
 * Query parameters for DELETE /api/v1/files/{path}
 * @operationId apiDeleteFileByPath
 */
export const zApiDeleteFileByPathQuery = z.object({
  // Hard delete (irreversible)
  permanent: z.enum(['true', 'false']).optional().default("false")
});

export type ApiDeleteFileByPathQuery = z.infer<typeof zApiDeleteFileByPathQuery>;

/**
 * Query parameters for GET /api/v1/folders
 * @operationId apiListRootFolder
 */
export const zApiListRootFolderQuery = z.object({
  // Include all nested contents recursively
  recursive: z.enum(['true', 'false']).optional().default("false"),
  // Return nested tree structure up to N levels deep (default 1, max 5)
  depth: z.coerce.number().int().gte(1).lte(5).optional().default(1),
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional()
});

export type ApiListRootFolderQuery = z.infer<typeof zApiListRootFolderQuery>;

/**
 * Query parameters for GET /api/v1/folders/{path}
 * @operationId apiListFolderByPath
 */
export const zApiListFolderByPathQuery = z.object({
  // Include all nested contents recursively
  recursive: z.enum(['true', 'false']).optional().default("false"),
  // Return nested tree structure up to N levels deep (default 1, max 5)
  depth: z.coerce.number().int().gte(1).lte(5).optional().default(1),
  // Maximum number of items to return
  limit: z.coerce.number().int().gte(1).lte(1000).optional().default(50),
  // Pagination cursor for fetching next page
  cursor: z.string().optional()
});

export type ApiListFolderByPathQuery = z.infer<typeof zApiListFolderByPathQuery>;

/**
 * Query parameters for GET /w/{key}/audit
 * @operationId getAuditLogs
 */
export const zGetAuditLogsQuery = z.object({
  // Filter by action type
  action: z.enum(['file.create', 'file.update', 'file.delete', 'append', 'claim', 'key.create', 'key.revoke', 'webhook.create', 'webhook.update', 'webhook.delete', 'workspace.claim']).optional(),
  // Filter by resource type
  resourceType: z.enum(['file', 'folder', 'key', 'webhook', 'workspace']).optional(),
  // Filter by actor (key prefix or identifier)
  actor: z.string().optional(),
  // Filter logs from this date (ISO 8601 format)
  since: z.string().optional(),
  // Filter logs until this date (ISO 8601 format)
  until: z.string().optional(),
  // Maximum number of logs to return (default 50, max 100)
  limit: z.coerce.number().int().gte(1).lte(100).optional().default(50),
  // Cursor for pagination (opaque)
  cursor: z.string().optional()
});

export type GetAuditLogsQuery = z.infer<typeof zGetAuditLogsQuery>;

