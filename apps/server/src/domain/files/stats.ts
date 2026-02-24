import { eq, and } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { files, appends } from '../../db/schema';
import type { Append, AppendType } from '@mdplane/shared';
import type { ErrorCode } from '../../core/errors';

export type GetFileStatsInput = {
  workspaceId: string;
  scopeType?: string;
  scopePath?: string | null;
  fileId: string;
};

export type FileStatsData = {
  appendCount: number;
  taskStats: {
    pending: number;
    claimed: number;
    completed: number;
    activeClaims: number;
  };
};

export type GetFileStatsResult =
  | { ok: true; data: FileStatsData }
  | { ok: false; status: number; error: { code: ErrorCode; message: string } };

export async function getFileStats(input: GetFileStatsInput): Promise<GetFileStatsResult> {
  const { fileId } = input;
  const now = new Date().toISOString();

  const appendCountResult = sqlite.query(
    `SELECT COUNT(*) as count FROM appends WHERE file_id = ?`
  ).get(fileId) as { count: number };
  const appendCount = appendCountResult?.count ?? 0;

  const taskStatsResult = sqlite.query(`
    WITH tasks AS (
      SELECT append_id FROM appends
      WHERE file_id = ? AND type = 'task'
    ),
    active_claims AS (
      SELECT DISTINCT ref FROM appends
      WHERE file_id = ? AND type = 'claim' AND status = 'active' AND expires_at > ?
    ),
    completed_tasks AS (
      SELECT DISTINCT ref FROM appends
      WHERE file_id = ? AND type = 'response'
    ),
    active_claim_count AS (
      SELECT COUNT(*) as count FROM appends
      WHERE file_id = ? AND type = 'claim' AND status = 'active' AND expires_at > ?
    )
    SELECT
      (SELECT COUNT(*) FROM tasks WHERE append_id NOT IN (SELECT ref FROM active_claims) AND append_id NOT IN (SELECT ref FROM completed_tasks)) as pending,
      (SELECT COUNT(*) FROM tasks WHERE append_id IN (SELECT ref FROM active_claims) AND append_id NOT IN (SELECT ref FROM completed_tasks)) as claimed,
      (SELECT COUNT(*) FROM tasks WHERE append_id IN (SELECT ref FROM completed_tasks)) as completed,
      (SELECT count FROM active_claim_count) as activeClaims
  `).get(fileId, fileId, now, fileId, fileId, now) as {
    pending: number;
    claimed: number;
    completed: number;
    activeClaims: number;
  };

  return {
    ok: true,
    data: {
      appendCount,
      taskStats: {
        pending: taskStatsResult?.pending ?? 0,
        claimed: taskStatsResult?.claimed ?? 0,
        completed: taskStatsResult?.completed ?? 0,
        activeClaims: taskStatsResult?.activeClaims ?? 0,
      },
    },
  };
}

export type GetAppendByIdInput = {
  workspaceId: string;
  scopeType?: string;
  scopePath?: string | null;
  appendId: string;
};

export type GetAppendByIdResult =
  | { ok: true; data: Append }
  | { ok: false; status: number; error: { code: ErrorCode; message: string }; deletedAt?: string };

export async function getAppendById(input: GetAppendByIdInput): Promise<GetAppendByIdResult> {
  const { workspaceId, scopeType, scopePath, appendId } = input;

  let append;
  let fileDeletedAt: string | null = null;

  if (scopeType === 'file' && scopePath) {
    const file = await db.query.files.findFirst({
      where: and(eq(files.workspaceId, workspaceId), eq(files.path, scopePath)),
    });
    if (file) {
      if (file.deletedAt) {
        return { ok: false, status: 410, error: { code: 'FILE_DELETED', message: 'File is soft-deleted' }, deletedAt: file.deletedAt };
      }
      append = await db.query.appends.findFirst({
        where: and(eq(appends.fileId, file.id), eq(appends.appendId, appendId)),
      });
    }
  } else {
    const result = sqlite.query(`
      SELECT a.id, a.file_id as fileId, a.append_id as appendId, a.author, a.type, a.status,
        a.priority, a.labels, a.ref, a.content_preview as contentPreview, a.created_at as createdAt,
        a.expires_at as expiresAt, a.due_at as dueAt, f.deleted_at as fileDeletedAt
      FROM appends a JOIN files f ON a.file_id = f.id
      WHERE f.workspace_id = ? AND a.append_id = ? LIMIT 1
    `).get(workspaceId, appendId) as (typeof appends.$inferSelect & { fileDeletedAt: string | null }) | null;

    if (result) {
      if (result.fileDeletedAt) {
        return { ok: false, status: 410, error: { code: 'FILE_DELETED', message: 'File is soft-deleted' }, deletedAt: result.fileDeletedAt };
      }
      append = result;
    }
  }

  if (!append) {
    return { ok: false, status: 404, error: { code: 'APPEND_NOT_FOUND', message: 'Append not found' } };
  }

  const appendData: Append = {
    id: append.appendId,
    author: append.author,
    ts: append.createdAt,
    type: append.type as AppendType,
    ...(append.contentPreview && { content: append.contentPreview }),
    ...(append.status && { status: append.status as Append['status'] }),
    ...(append.priority && { priority: append.priority as Append['priority'] }),
    ...(append.labels && { labels: JSON.parse(append.labels) as string[] }),
    ...(append.ref && { ref: append.ref }),
    ...(append.expiresAt && { expiresAt: append.expiresAt }),
    ...(append.dueAt && { dueAt: append.dueAt }),
  };

  return { ok: true, data: appendData };
}

