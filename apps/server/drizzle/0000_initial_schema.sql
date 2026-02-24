-- Baseline migration generated from fully migrated schema for OSS launch.
-- Includes tables, indexes, virtual tables, and triggers required by production behavior.
-- Do not edit manually unless you also verify clean bootstrap and migration tests.

CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`mode` text NOT NULL,
	`scopes` text,
	`created_at` text NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`revoked_at` text,
	`rate_limit` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE "append_counters" (
	`file_id` text PRIMARY KEY NOT NULL,
	`next_value` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `appends` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`append_id` text NOT NULL,
	`author` text NOT NULL,
	`type` text,
	`ref` text,
	`status` text,
	`priority` text,
	`labels` text,
	`due_at` text,
	`expires_at` text,
	`created_at` text NOT NULL,
	`content_preview` text,
	`content_hash` text,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE VIRTUAL TABLE appends_fts USING fts5(
  content_preview,
  content='appends',
  content_rowid='rowid',
  tokenize='unicode61'
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`resource_path` text,
	`actor` text,
	`actor_type` text,
	`metadata` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `capability_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`permission` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_path` text,
	`bound_author` text,
	`wip_limit` integer,
	`allowed_types` text,
	`display_name` text,
	`created_at` text NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `export_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`status` text NOT NULL,
	`format` text NOT NULL,
	`include` text,
	`notify_email` text,
	`folder` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`progress` text,
	`download_url` text,
	`expires_at` text,
	`checksum` text,
	`size` text,
	`position` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`path` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`settings` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE VIRTUAL TABLE files_fts USING fts5(
  content,
  path,
  content='files',
  content_rowid='rowid',
  tokenize='unicode61'
);
--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`path` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`deleted_at` text,
	`settings` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `heartbeats` (
	`workspace_id` text NOT NULL,
	`author` text NOT NULL,
	`file_id` text,
	`status` text DEFAULT 'alive',
	`current_task` text,
	`metadata` text,
	`last_seen` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `author`)
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`capability_key_id` text NOT NULL,
	`response_status` integer NOT NULL,
	`response_body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`workspace_id` text NOT NULL,
	`status` text NOT NULL,
	`type` text NOT NULL,
	`progress` text,
	`result` text,
	`error` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	`expires_at` text
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_workspaces" (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  webhook_id TEXT NOT NULL REFERENCES webhooks(id),
  event TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'failed', 'timeout', 'error')),
  response_code INTEGER,
  duration_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_path` text,
	`url` text NOT NULL,
	`events` text NOT NULL,
	`secret_hash` text,
	`recursive` integer DEFAULT 1,
	`created_at` text NOT NULL,
	`last_triggered_at` text,
	`failure_count` integer DEFAULT 0,
	`disabled_at` text,
	`deleted_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`created_at` text NOT NULL,
	`claimed_at` text,
	`claimed_by_email` text,
	`last_activity_at` text NOT NULL,
	`deleted_at` text,
	`storage_used_bytes` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_workspace_path_unique` ON `files` (`workspace_id`, `path`);
--> statement-breakpoint
CREATE INDEX `folders_workspace_path_idx` ON `folders` (`workspace_id`,`path`);
--> statement-breakpoint
CREATE INDEX `idx_api_keys_hash` ON `api_keys` (`key_hash`);
--> statement-breakpoint
CREATE INDEX `idx_appends_author` ON `appends` (`author`);
--> statement-breakpoint
CREATE INDEX `idx_appends_created_at` ON `appends` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_appends_file_id` ON `appends` (`file_id`);
--> statement-breakpoint
CREATE INDEX `idx_appends_file_ref` ON `appends` (`file_id`, `ref`);
--> statement-breakpoint
CREATE INDEX `idx_appends_status` ON `appends` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_appends_type` ON `appends` (`type`);
--> statement-breakpoint
CREATE INDEX `idx_capability_keys_hash` ON `capability_keys` (`key_hash`);
--> statement-breakpoint
CREATE INDEX `idx_export_jobs_status` ON `export_jobs` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_export_jobs_workspace` ON `export_jobs` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_files_workspace_deleted` ON `files` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_files_workspace_path` ON `files` (`workspace_id`,`path`);
--> statement-breakpoint
CREATE INDEX `idx_jobs_key_hash` ON `jobs` (`key_hash`);
--> statement-breakpoint
CREATE INDEX `idx_jobs_status` ON `jobs` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_jobs_workspace` ON `jobs` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_window` ON `rate_limits` (`window_start`);
--> statement-breakpoint
CREATE INDEX `idx_user_workspaces_user_workspace` ON `user_workspaces` (`user_id`,`workspace_id`);
--> statement-breakpoint
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
--> statement-breakpoint
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_key_hash_unique` ON `jobs` (`key_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_workspaces_workspace_unique` ON `user_workspaces` (`workspace_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
--> statement-breakpoint
CREATE TRIGGER appends_fts_ad AFTER DELETE ON appends BEGIN
  INSERT INTO appends_fts(appends_fts, rowid, content_preview)
  VALUES('delete', old.rowid, coalesce(old.content_preview, ''));
END;
--> statement-breakpoint
CREATE TRIGGER appends_fts_ai AFTER INSERT ON appends BEGIN
  INSERT INTO appends_fts(rowid, content_preview)
  VALUES(new.rowid, coalesce(new.content_preview, ''));
END;
--> statement-breakpoint
CREATE TRIGGER appends_fts_au AFTER UPDATE ON appends BEGIN
  INSERT INTO appends_fts(appends_fts, rowid, content_preview)
  VALUES('delete', old.rowid, coalesce(old.content_preview, ''));
  INSERT INTO appends_fts(rowid, content_preview)
  VALUES(new.rowid, coalesce(new.content_preview, ''));
END;
--> statement-breakpoint
CREATE TRIGGER files_fts_ad AFTER DELETE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, content, path)
  VALUES('delete', old.rowid, old.content, old.path);
END;
--> statement-breakpoint
CREATE TRIGGER files_fts_ai AFTER INSERT ON files BEGIN
  -- Only index non-deleted files
  INSERT INTO files_fts(rowid, content, path)
  SELECT new.rowid, new.content, new.path
  WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER files_fts_au AFTER UPDATE ON files BEGIN
  -- If the old row was indexed, remove it
  INSERT INTO files_fts(files_fts, rowid, content, path)
  SELECT 'delete', old.rowid, old.content, old.path
  WHERE old.deleted_at IS NULL;

  -- If the new row should be indexed, add it
  INSERT INTO files_fts(rowid, content, path)
  SELECT new.rowid, new.content, new.path
  WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER trg_capability_keys_scope_integrity_insert
BEFORE INSERT ON capability_keys
FOR EACH ROW
WHEN NEW.scope_type IN ('file', 'folder')
  AND (NEW.scope_path IS NULL OR trim(NEW.scope_path) = '')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_SCOPE_PATH');
END;
--> statement-breakpoint
CREATE TRIGGER trg_capability_keys_scope_integrity_update
BEFORE UPDATE ON capability_keys
FOR EACH ROW
WHEN NEW.scope_type IN ('file', 'folder')
  AND (NEW.scope_path IS NULL OR trim(NEW.scope_path) = '')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_SCOPE_PATH');
END;
