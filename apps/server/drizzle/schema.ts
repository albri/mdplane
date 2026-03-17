import { sqliteTable, AnySQLiteColumn, index, foreignKey, text, integer, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const apiKeys = sqliteTable("api_keys", {
	id: text().primaryKey().notNull(),
	workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
	name: text(),
	keyHash: text("key_hash").notNull(),
	keyPrefix: text("key_prefix").notNull(),
	mode: text().notNull(),
	scopes: text(),
	createdAt: text("created_at").notNull(),
	expiresAt: text("expires_at"),
	lastUsedAt: text("last_used_at"),
	revokedAt: text("revoked_at"),
	rateLimit: text("rate_limit"),
},
(table) => [
	index("idx_api_keys_hash").on(table.keyHash),
]);

export const appends = sqliteTable("appends", {
	id: text().primaryKey().notNull(),
	fileId: text("file_id").notNull().references(() => files.id),
	appendId: text("append_id").notNull(),
	author: text().notNull(),
	type: text(),
	ref: text(),
	status: text(),
	priority: text(),
	labels: text(),
	dueAt: text("due_at"),
	expiresAt: text("expires_at"),
	createdAt: text("created_at").notNull(),
	contentPreview: text("content_preview"),
	contentHash: text("content_hash"),
},
(table) => [
	index("idx_appends_file_ref").on(table.fileId, table.ref),
	index("idx_appends_created_at").on(table.createdAt),
	index("idx_appends_type").on(table.type),
	index("idx_appends_author").on(table.author),
	index("idx_appends_status").on(table.status),
	index("idx_appends_file_id").on(table.fileId),
]);

export const appendCounters = sqliteTable("append_counters", {
	fileId: text("file_id").primaryKey().notNull().references(() => files.id, { onDelete: "cascade" }),
	nextValue: integer("next_value").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
	id: text().primaryKey().notNull(),
	workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
	action: text().notNull(),
	resourceType: text("resource_type").notNull(),
	resourceId: text("resource_id"),
	resourcePath: text("resource_path"),
	actor: text(),
	actorType: text("actor_type"),
	metadata: text(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	createdAt: integer("created_at").notNull(),
});

export const account = sqliteTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at"),
	refreshTokenExpiresAt: integer("refresh_token_expires_at"),
	scope: text(),
	password: text(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsec') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").default(sql`(cast(unixepoch('subsec') * 1000 as integer))`).notNull(),
},
(table) => [
	index("account_userId_idx").on(table.userId),
]);

export const session = sqliteTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: integer("expires_at").notNull(),
	token: text().notNull(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsec') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").default(sql`(cast(unixepoch('subsec') * 1000 as integer))`).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
},
(table) => [
	index("session_userId_idx").on(table.userId),
	uniqueIndex("session_token_unique").on(table.token),
]);

export const user = sqliteTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: integer("email_verified", { mode: 'boolean' }).default(false).notNull(),
	image: text(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsec') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").default(sql`(cast(unixepoch('subsec') * 1000 as integer))`).notNull(),
},
(table) => [
	uniqueIndex("user_email_unique").on(table.email),
]);

export const verification = sqliteTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: integer("expires_at").notNull(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsec') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").default(sql`(cast(unixepoch('subsec') * 1000 as integer))`).notNull(),
},
(table) => [
	index("verification_identifier_idx").on(table.identifier),
]);

export const capabilityKeys = sqliteTable("capability_keys", {
	id: text().primaryKey().notNull(),
	workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
	prefix: text().notNull(),
	keyHash: text("key_hash").notNull(),
	permission: text().notNull(),
	scopeType: text("scope_type").notNull(),
	scopePath: text("scope_path"),
	boundAuthor: text("bound_author"),
	wipLimit: integer("wip_limit"),
	allowedTypes: text("allowed_types"),
	displayName: text("display_name"),
	createdAt: text("created_at").notNull(),
	expiresAt: text("expires_at"),
	lastUsedAt: text("last_used_at"),
	revokedAt: text("revoked_at"),
},
(table) => [
	index("idx_capability_keys_hash").on(table.keyHash),
]);

export const exportJobs = sqliteTable("export_jobs", {
	id: text().primaryKey().notNull(),
	workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
	status: text().notNull(),
	format: text().notNull(),
	include: text(),
	notifyEmail: text("notify_email"),
	folder: text(),
	createdAt: text("created_at").notNull(),
	startedAt: text("started_at"),
	progress: text(),
	downloadUrl: text("download_url"),
	expiresAt: text("expires_at"),
	checksum: text(),
	size: text(),
	position: integer(),
},
(table) => [
	index("idx_export_jobs_status").on(table.status),
	index("idx_export_jobs_workspace").on(table.workspaceId),
]);

export const files = sqliteTable("files", {
	id: text().primaryKey().notNull(),
	workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
	path: text().notNull(),
	content: text().default("").notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
	deletedAt: text("deleted_at"),
	settings: text(),
},
(table) => [
	uniqueIndex("files_workspace_path_unique").on(table.workspaceId, table.path),
	index("idx_files_workspace_deleted").on(table.workspaceId),
	index("idx_files_workspace_path").on(table.workspaceId, table.path),
]);

export const folders = sqliteTable("folders", {
	id: text().primaryKey().notNull(),
	workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
	path: text().notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at"),
	deletedAt: text("deleted_at"),
	settings: text(),
},
(table) => [
	index("folders_workspace_path_idx").on(table.workspaceId, table.path),
]);

export const heartbeats = sqliteTable("heartbeats", {
	workspaceId: text("workspace_id").notNull(),
	author: text().notNull(),
	fileId: text("file_id"),
	status: text().default("alive"),
	currentTask: text("current_task"),
	metadata: text(),
	lastSeen: integer("last_seen").notNull(),
},
(table) => [
	primaryKey({ columns: [table.workspaceId, table.author], name: "heartbeats_workspace_id_author_pk"})
]);

export const idempotencyKeys = sqliteTable("idempotency_keys", {
	key: text().primaryKey().notNull(),
	capabilityKeyId: text("capability_key_id").notNull(),
	responseStatus: integer("response_status").notNull(),
	responseBody: text("response_body").notNull(),
	createdAt: text("created_at").notNull(),
});

export const jobs = sqliteTable("jobs", {
	id: text().primaryKey().notNull(),
	keyHash: text("key_hash").notNull(),
	workspaceId: text("workspace_id").notNull(),
	status: text().notNull(),
	type: text().notNull(),
	progress: text(),
	result: text(),
	error: text(),
	createdAt: text("created_at").notNull(),
	completedAt: text("completed_at"),
	expiresAt: text("expires_at"),
},
(table) => [
	index("idx_jobs_status").on(table.status),
	index("idx_jobs_workspace").on(table.workspaceId),
	index("idx_jobs_key_hash").on(table.keyHash),
	uniqueIndex("jobs_key_hash_unique").on(table.keyHash),
]);

export const rateLimits = sqliteTable("rate_limits", {
	key: text().primaryKey().notNull(),
	count: integer().default(0).notNull(),
	windowStart: integer("window_start").notNull(),
},
(table) => [
	index("idx_rate_limits_window").on(table.windowStart),
]);

export const sessions = sqliteTable("sessions", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.id),
	tokenHash: text("token_hash").notNull(),
	createdAt: text("created_at").notNull(),
	expiresAt: text("expires_at").notNull(),
});

export const userWorkspaces = sqliteTable("user_workspaces", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
	createdAt: text("created_at").notNull(),
},
(table) => [
	uniqueIndex("user_workspaces_workspace_unique").on(table.workspaceId),
	index("idx_user_workspaces_user_workspace").on(table.userId, table.workspaceId),
]);

export const users = sqliteTable("users", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	createdAt: text("created_at").notNull(),
},
(table) => [
	uniqueIndex("users_email_unique").on(table.email),
]);

export const webhooks = sqliteTable("webhooks", {
	id: text().primaryKey().notNull(),
	workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
	scopeType: text("scope_type").notNull(),
	scopePath: text("scope_path"),
	url: text().notNull(),
	events: text().notNull(),
	secretHash: text("secret_hash"),
	recursive: integer().default(1),
	createdAt: text("created_at").notNull(),
	lastTriggeredAt: text("last_triggered_at"),
	failureCount: integer("failure_count").default(0),
	disabledAt: text("disabled_at"),
	deletedAt: text("deleted_at"),
});

export const webhookDeliveries = sqliteTable("webhook_deliveries", {
	id: text().primaryKey().notNull(),
	webhookId: text("webhook_id").notNull().references(() => webhooks.id),
	event: text().notNull(),
	status: text().notNull(),
	responseCode: integer("response_code"),
	durationMs: integer("duration_ms"),
	error: text(),
	createdAt: text("created_at").notNull(),
},
(table) => [
	index("idx_webhook_deliveries_webhook_id").on(table.webhookId),
	index("idx_webhook_deliveries_created_at").on(table.createdAt),
]);

export const workspaces = sqliteTable("workspaces", {
	id: text().primaryKey().notNull(),
	name: text(),
	createdAt: text("created_at").notNull(),
	claimedAt: text("claimed_at"),
	claimedByEmail: text("claimed_by_email"),
	lastActivityAt: text("last_activity_at").notNull(),
	deletedAt: text("deleted_at"),
	storageUsedBytes: integer("storage_used_bytes").default(0).notNull(),
});

