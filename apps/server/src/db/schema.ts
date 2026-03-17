import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, primaryKey, uniqueIndex, check } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name'),
  createdAt: text('created_at').notNull(),
  claimedAt: text('claimed_at'),
  claimedByEmail: text('claimed_by_email'),
  lastActivityAt: text('last_activity_at').notNull(),
  deletedAt: text('deleted_at'),
  /** Denormalized storage usage in bytes for O(1) quota checks */
  storageUsedBytes: integer('storage_used_bytes').notNull().default(0),
});

export const capabilityKeys = sqliteTable('capability_keys', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  permission: text('permission', { enum: ['read', 'append', 'write'] }).notNull(),
  scopeType: text('scope_type', { enum: ['workspace', 'folder', 'file'] }).notNull(),
  scopePath: text('scope_path'),
  boundAuthor: text('bound_author'),
  wipLimit: integer('wip_limit'),
  allowedTypes: text('allowed_types'),
  displayName: text('display_name'),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  revokedAt: text('revoked_at'),
}, (table) => [
  index('idx_capability_keys_hash').on(table.keyHash),
  check(
    'capability_keys_scope_integrity',
    sql`${table.scopeType} = 'workspace' OR (${table.scopePath} IS NOT NULL AND length(trim(${table.scopePath})) > 0)`
  ),
]);

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  path: text('path').notNull(),
  content: text('content').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  /** File-specific settings (JSON) - claim duration, max append size, allowed types, WIP limit, labels */
  settings: text('settings', { mode: 'json' }),
}, (table) => [
  index('idx_files_workspace_path').on(table.workspaceId, table.path),
  index('idx_files_workspace_deleted').on(table.workspaceId),
  uniqueIndex('files_workspace_path_unique').on(table.workspaceId, table.path),
]);

export const appends = sqliteTable('appends', {
  id: text('id').primaryKey(),
  fileId: text('file_id').notNull().references(() => files.id),
  appendId: text('append_id').notNull(),
  author: text('author').notNull(),
  type: text('type'),
  ref: text('ref'),
  status: text('status', { enum: ['pending', 'open', 'claimed', 'completed', 'done', 'expired', 'cancelled', 'active'] }),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'critical'] }),
  labels: text('labels'),
  dueAt: text('due_at'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull(),
  contentPreview: text('content_preview'),
  /** Hash of file content when append was created - used to detect stale appends after file PUT */
  contentHash: text('content_hash'),
}, (table) => [
  index('idx_appends_file_id').on(table.fileId),
  index('idx_appends_status').on(table.status),
  index('idx_appends_author').on(table.author),
  index('idx_appends_type').on(table.type),
  index('idx_appends_created_at').on(table.createdAt),
  index('idx_appends_file_ref').on(table.fileId, table.ref),
]);

export const appendCounters = sqliteTable('append_counters', {
  fileId: text('file_id').primaryKey().references(() => files.id, { onDelete: 'cascade' }),
  nextValue: integer('next_value').notNull(),
});

export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  scopeType: text('scope_type').notNull(),
  scopePath: text('scope_path'),
  url: text('url').notNull(),
  events: text('events').notNull(), // JSON array
  secretHash: text('secret_hash'),
  recursive: integer('recursive').default(1), // 1=true (default), 0=false; for folder scope matching
  createdAt: text('created_at').notNull(),
  lastTriggeredAt: text('last_triggered_at'),
  failureCount: integer('failure_count').default(0),
  disabledAt: text('disabled_at'),
  deletedAt: text('deleted_at'),
});

export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id').notNull().references(() => webhooks.id),
  event: text('event').notNull(),
  status: text('status', { enum: ['ok', 'failed', 'timeout', 'error'] }).notNull(),
  responseCode: integer('response_code'),
  durationMs: integer('duration_ms'),
  error: text('error'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_webhook_deliveries_webhook_id').on(table.webhookId),
  index('idx_webhook_deliveries_created_at').on(table.createdAt),
]);

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  key: text('key').primaryKey(),
  capabilityKeyId: text('capability_key_id').notNull(),
  responseStatus: integer('response_status').notNull(),
  responseBody: text('response_body').notNull(),
  createdAt: text('created_at').notNull(),
});

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  path: text('path').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
  deletedAt: text('deleted_at'),
  /** Folder-level settings (JSON) - inheritSettings, defaultLabels, allowedTypes */
  settings: text('settings', { mode: 'json' }),
}, (table) => [index('folders_workspace_path_idx').on(table.workspaceId, table.path)]);

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: text('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
});

export const userWorkspaces = sqliteTable('user_workspaces', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // References authUser.id but FK added after authUser is defined
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('user_workspaces_workspace_unique').on(table.workspaceId),
  index('idx_user_workspaces_user_workspace').on(table.userId, table.workspaceId),
]);

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name'),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  mode: text('mode', { enum: ['live', 'test'] }).notNull(),
  scopes: text('scopes'),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  revokedAt: text('revoked_at'),
  /** Custom rate limit overrides (JSON object with operation: limit pairs) */
  rateLimit: text('rate_limit'),
}, (table) => [
  index('idx_api_keys_hash').on(table.keyHash),
]);

export const heartbeats = sqliteTable('heartbeats', {
  workspaceId: text('workspace_id').notNull(),
  author: text('author').notNull(),
  fileId: text('file_id'),
  status: text('status', { enum: ['alive', 'idle', 'busy', 'error'] }).default('alive'),
  currentTask: text('current_task'),
  metadata: text('metadata'),
  lastSeen: integer('last_seen').notNull(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.author] }),
]);

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  resourcePath: text('resource_path'),
  actor: text('actor'),
  actorType: text('actor_type'),
  metadata: text('metadata', { mode: 'json' }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const authUser = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
    .notNull(),
});

export const authSession = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
    .notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
}, (table) => [index('session_userId_idx').on(table.userId)]);

export const authAccount = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
    .notNull(),
}, (table) => [index('account_userId_idx').on(table.userId)]);

export const authVerification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
    .notNull(),
}, (table) => [index('verification_identifier_idx').on(table.identifier)]);

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(), // Format: '{operation}:{identifier}'
  count: integer('count').notNull().default(0),
  windowStart: integer('window_start').notNull(), // Unix timestamp in ms
}, (table) => [
  index('idx_rate_limits_window').on(table.windowStart),
]);

export const exportJobs = sqliteTable('export_jobs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  status: text('status', { enum: ['queued', 'processing', 'ready', 'failed', 'expired'] }).notNull(),
  format: text('format', { enum: ['zip', 'tar.gz'] }).notNull(),
  include: text('include'), // JSON array
  notifyEmail: text('notify_email'),
  folder: text('folder'),
  createdAt: text('created_at').notNull(),
  startedAt: text('started_at'),
  progress: text('progress'), // JSON object: { filesProcessed, totalFiles, bytesWritten }
  downloadUrl: text('download_url'),
  expiresAt: text('expires_at'),
  checksum: text('checksum'),
  size: text('size'),
  position: integer('position'),
}, (table) => [
  index('idx_export_jobs_workspace').on(table.workspaceId),
  index('idx_export_jobs_status').on(table.status),
]);

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  keyHash: text('key_hash').notNull().unique(),
  workspaceId: text('workspace_id').notNull(),
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).notNull(),
  type: text('type').notNull(),
  progress: text('progress'), // JSON object: { current, total, message }
  result: text('result'), // JSON object for job result
  error: text('error'), // JSON object: { code, message }
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
  expiresAt: text('expires_at'),
}, (table) => [
  index('idx_jobs_key_hash').on(table.keyHash),
  index('idx_jobs_workspace').on(table.workspaceId),
  index('idx_jobs_status').on(table.status),
]);

