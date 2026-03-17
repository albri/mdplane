/**
 * Audit Service
 *
 * Provides audit logging functionality for compliance and debugging.
 *
 * @module services/audit
 */

import { eq, and, gte, lte, lt, desc, sql, or } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs } from '../db/schema';
import { generateKey } from '../core/capability-keys';
import { serverEnv } from '../config/env';

export type AuditAction =
  | 'file.create'
  | 'file.update'
  | 'file.delete'
  | 'file.hard_delete'
  | 'file.move'
  | 'file.recover'
  | 'file.rename'
  | 'file.rotate_urls'
  | 'file.settings_update'
  | 'folder.create'
  | 'folder.rename'
  | 'folder.delete'
  | 'folder.move'
  | 'folder.update_settings'
  | 'append'
  | 'claim'
  | 'key.create'
  | 'key.revoke'
  | 'webhook.create'
  | 'webhook.update'
  | 'webhook.delete'
  | 'workspace.claim'
  | 'export.sync'
  | 'export.job_created'
  | 'export.download';

export type ResourceType = 'file' | 'folder' | 'key' | 'webhook' | 'workspace' | 'export';

export type ActorType = 'capability_url' | 'api_key' | 'session';

export interface LogActionParams {
  workspaceId: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  resourcePath?: string;
  actor?: string;
  actorType?: ActorType;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  action?: AuditAction;
  resourceType?: ResourceType;
  actor?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  cursor?: string;
}

export interface AuditLogEntry {
  id: string;
  workspaceId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  resourcePath: string | null;
  actor: string | null;
  actorType: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditPagination {
  total: number;
  limit: number;
  cursor: string | null;
  hasMore: boolean;
}

export interface GetAuditLogsResult {
  logs: AuditLogEntry[];
  pagination: AuditPagination;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_RETENTION_DAYS = 90;

/**
 * Generate a unique audit log ID.
 */
function generateAuditLogId(): string {
  return `audit_${generateKey(16)}`;
}

/**
 * Cursor encoding: { createdAt: ISO string, id: string } -> base64url
 */
interface CursorPayload {
  createdAt: string;
  id: string;
}

function encodeCursor(createdAt: Date, id: string): string {
  const payload: CursorPayload = { createdAt: createdAt.toISOString(), id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const payload = JSON.parse(json) as CursorPayload;
    if (typeof payload.createdAt === 'string' && typeof payload.id === 'string') {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

interface QueuedAuditLog {
  id: string;
  params: LogActionParams;
  createdAt: Date;
}

// In-memory queue for async audit logging
const auditQueue: QueuedAuditLog[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL_MS = 100; // Flush every 100ms
const MAX_BATCH_SIZE = 50; // Max logs per batch

/**
 * Flush the audit queue to the database.
 * Called automatically by timer or when queue is full.
 */
async function flushAuditQueue(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (auditQueue.length === 0) return;

  // Take all items from queue
  const items = auditQueue.splice(0, auditQueue.length);

  const isTestEnv = serverEnv.isTest;
  const isSqliteBusy = (err: unknown): boolean => {
    if (!err || typeof err !== 'object') return false;
    const e = err as { code?: unknown; errno?: unknown; message?: unknown };
    const code = typeof e.code === 'string' ? e.code : '';
    const errno = typeof e.errno === 'number' ? e.errno : undefined;
    const message = typeof e.message === 'string' ? e.message : '';
    return code === 'SQLITE_BUSY' || errno === 5 || message.includes('database is locked');
  };
  const isForeignKeyConstraintError = (err: unknown): boolean => {
    if (!err || typeof err !== 'object') return false;
    const e = err as { code?: unknown; errno?: unknown; message?: unknown };
    const code = typeof e.code === 'string' ? e.code : '';
    const errno = typeof e.errno === 'number' ? e.errno : undefined;
    const message = typeof e.message === 'string' ? e.message : '';
    return (
      code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
      errno === 787 ||
      message.includes('FOREIGN KEY constraint failed')
    );
  };

  // Batch insert using Drizzle
  const values = items.map(item => ({
    id: item.id,
    workspaceId: item.params.workspaceId,
    action: item.params.action,
    resourceType: item.params.resourceType,
    resourceId: item.params.resourceId ?? null,
    resourcePath: item.params.resourcePath ?? null,
    actor: item.params.actor ?? null,
    actorType: item.params.actorType ?? null,
    metadata: item.params.metadata ?? null,
    ipAddress: item.params.ipAddress ?? null,
    userAgent: item.params.userAgent ?? null,
    createdAt: item.createdAt,
  }));

  try {
    await db.insert(auditLogs).values(values);
  } catch (error) {
    // Tests often delete workspaces while there are pending async audit entries.
    // In that case, we silently drop the audit batch instead of spamming stderr.
    if (isTestEnv && isForeignKeyConstraintError(error)) {
      return;
    }

    // Under heavy parallel test traffic SQLite can briefly report BUSY.
    // Retry a few times in test/integration mode; if still locked, drop the audit batch.
    if (isTestEnv && isSqliteBusy(error)) {
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 25));
        try {
          await db.insert(auditLogs).values(values);
          return;
        } catch (retryErr) {
          if (!isSqliteBusy(retryErr)) {
            break;
          }
        }
      }

      return;
    }

    console.error('Failed to flush audit queue:', error);
    // Best-effort: logs are lost on failure
  }
}

/**
 * Queue an audit log entry for async insertion.
 * Returns immediately without blocking.
 *
 * DURABILITY: Best-effort. Logs may be lost on server crash.
 * For guaranteed durability, use logActionSync().
 */
export function logAction(params: LogActionParams): string {
  const id = generateAuditLogId();
  const now = new Date();

  auditQueue.push({ id, params, createdAt: now });

  // Schedule flush if not already scheduled
  if (!flushTimer) {
    flushTimer = setTimeout(flushAuditQueue, FLUSH_INTERVAL_MS);
  }

  // Flush immediately if queue is large (fire-and-forget with error handling)
  if (auditQueue.length >= MAX_BATCH_SIZE) {
    flushAuditQueue().catch((err) => {
      console.error('Audit queue flush failed:', err);
    });
  }

  return id;
}

/**
 * Synchronous audit logging for critical operations.
 * Blocks until the log is persisted.
 */
export async function logActionSync(params: LogActionParams): Promise<string> {
  const id = generateAuditLogId();
  const now = new Date();

  await db.insert(auditLogs).values({
    id,
    workspaceId: params.workspaceId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId ?? null,
    resourcePath: params.resourcePath ?? null,
    actor: params.actor ?? null,
    actorType: params.actorType ?? null,
    metadata: params.metadata ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    createdAt: now,
  });

  return id;
}

/**
 * Force flush the audit queue (for testing/shutdown).
 */
export async function forceFlushAuditQueue(): Promise<void> {
  await flushAuditQueue();
}

/**
 * Clear the audit queue without persisting (for testing).
 */
export function clearAuditQueue(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  auditQueue.splice(0, auditQueue.length);
}

/**
 * Get the current audit queue size (for testing).
 */
export function getAuditQueueSize(): number {
  return auditQueue.length;
}

/**
 * Get audit logs for a workspace with optional filters and cursor-based pagination.
 */
export async function getAuditLogs(
  workspaceId: string,
  filters: AuditLogFilters = {}
): Promise<GetAuditLogsResult> {
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  // Build where conditions
  const conditions: ReturnType<typeof eq>[] = [eq(auditLogs.workspaceId, workspaceId)];

  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }

  if (filters.resourceType) {
    conditions.push(eq(auditLogs.resourceType, filters.resourceType));
  }

  if (filters.actor) {
    conditions.push(eq(auditLogs.actor, filters.actor));
  }

  if (filters.since) {
    conditions.push(gte(auditLogs.createdAt, filters.since));
  }

  if (filters.until) {
    conditions.push(lte(auditLogs.createdAt, filters.until));
  }

  // Apply cursor-based pagination (newest-first: createdAt DESC, id DESC)
  if (filters.cursor) {
    const cursorPayload = decodeCursor(filters.cursor);
    if (cursorPayload) {
      const cursorDate = new Date(cursorPayload.createdAt);
      // Next page: (createdAt < cursorCreatedAt) OR (createdAt == cursorCreatedAt AND id < cursorId)
      conditions.push(
        or(
          lt(auditLogs.createdAt, cursorDate),
          and(eq(auditLogs.createdAt, cursorDate), lt(auditLogs.id, cursorPayload.id))
        )!
      );
    }
  }

  // Query logs (fetch limit + 1 to determine hasMore)
  const logs = await db.query.auditLogs.findMany({
    where: and(...conditions),
    orderBy: [desc(auditLogs.createdAt), desc(auditLogs.id)],
    limit: limit + 1,
  });

  // Determine if there are more results
  const hasMore = logs.length > limit;
  const resultLogs = hasMore ? logs.slice(0, limit) : logs;

  // Build count query with same filters (excluding cursor pagination)
  const countConditions: ReturnType<typeof eq>[] = [eq(auditLogs.workspaceId, workspaceId)];

  if (filters.action) {
    countConditions.push(eq(auditLogs.action, filters.action));
  }

  if (filters.resourceType) {
    countConditions.push(eq(auditLogs.resourceType, filters.resourceType));
  }

  if (filters.actor) {
    countConditions.push(eq(auditLogs.actor, filters.actor));
  }

  if (filters.since) {
    countConditions.push(gte(auditLogs.createdAt, filters.since));
  }

  if (filters.until) {
    countConditions.push(lte(auditLogs.createdAt, filters.until));
  }

  // Get total count with filters applied
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(and(...countConditions))
    .then((rows) => rows[0]);

  // Build next cursor from last returned item
  let nextCursor: string | null = null;
  if (hasMore && resultLogs.length > 0) {
    const lastLog = resultLogs[resultLogs.length - 1];
    nextCursor = encodeCursor(lastLog.createdAt, lastLog.id);
  }

  return {
    logs: resultLogs.map((log) => ({
      ...log,
      metadata: log.metadata as Record<string, unknown> | null,
    })),
    pagination: {
      total: countResult?.count ?? 0,
      limit,
      cursor: nextCursor,
      hasMore,
    },
  };
}
