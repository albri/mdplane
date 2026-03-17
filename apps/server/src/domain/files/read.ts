import { eq, and } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { files } from '../../db/schema';
import { isPathWithinScope } from '../../core/path-validation';
import { generateVersionedETag, parseFrontmatterFromMarkdown } from '../../shared/file-response-utils';
import { getWorkspaceContext } from '../../shared/workspace-context';
import type { Append, AppendType, FileReadResponse } from '@mdplane/shared';
import type { ErrorCode } from '../../core/errors';
import { serverEnv } from '../../config/env';

const APP_URL = serverEnv.appUrl;

type FileReadData = FileReadResponse['data'];

export type FileReadInput = {
  workspaceId: string;
  scopeType?: string;
  scopePath?: string | null;
  normalizedPath: string;
  key: string;
  keyPrefix?: string;
  appendsLimit?: number;
  format?: string;
  include?: string;
  since?: string;
};

export type FileReadResult =
  | { ok: true; etag: string; data: FileReadData }
  | { ok: false; status: number; error: { code: ErrorCode; message: string }; deletedAt?: string };

async function getAppendCount(fileId: string): Promise<number> {
  const result = sqlite.query('SELECT COUNT(*) as count FROM appends WHERE file_id = ?').get(fileId) as { count: number };
  return result?.count ?? 0;
}

async function fetchAppends(input: { fileId: string; limit?: number; since?: string }): Promise<Append[]> {
  const { fileId, limit, since } = input;
  const sinceNum = since ? parseInt(since, 10) : undefined;
  let query = `SELECT id, append_id, author, type, ref, status, priority, labels, due_at, expires_at, created_at, content_preview FROM appends WHERE file_id = ?`;
  const params: (string | number)[] = [fileId];

  if (sinceNum !== undefined && !isNaN(sinceNum)) {
    query += ` AND rowid > ?`;
    params.push(sinceNum);
  }

  query += ` ORDER BY created_at ASC`;

  if (limit !== undefined && limit > 0) {
    query = `SELECT * FROM (
      SELECT id, append_id, author, type, ref, status, priority, labels, due_at, expires_at, created_at, content_preview
      FROM appends WHERE file_id = ? ${sinceNum !== undefined && !isNaN(sinceNum) ? 'AND rowid > ?' : ''} ORDER BY created_at DESC LIMIT ?
    ) ORDER BY created_at ASC`;
    params.push(limit);
  }

  const rows = sqlite.query(query).all(...params) as Array<{
    id: string; append_id: string; author: string; type: string | null;
    ref: string | null; status: string | null; priority: string | null;
    labels: string | null; due_at: string | null; expires_at: string | null;
    created_at: string; content_preview: string | null;
  }>;

  return rows.filter(a => a.type !== null).map(a => ({
    id: a.append_id,
    author: a.author,
    ts: a.created_at,
    type: a.type as AppendType,
    ...(a.status && { status: a.status as Append['status'] }),
    ...(a.content_preview && { content: a.content_preview }),
    ...(a.priority && { priority: a.priority as Append['priority'] }),
    ...(a.labels && { labels: JSON.parse(a.labels) as string[] }),
    ...(a.ref && { ref: a.ref }),
    ...(a.expires_at && { expiresAt: a.expires_at }),
    ...(a.due_at && { dueAt: a.due_at }),
  }));
}

async function getTaskStats(fileId: string): Promise<{ pending: number; claimed: number; completed: number; activeClaims: number }> {
  const result = sqlite.query(`
    SELECT
      SUM(CASE WHEN type = 'task' AND (status IS NULL OR status = 'pending') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN type = 'task' AND status = 'claimed' THEN 1 ELSE 0 END) as claimed,
      SUM(CASE WHEN type = 'task' AND status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN type = 'claim' AND status != 'expired' AND status != 'completed' THEN 1 ELSE 0 END) as activeClaims
    FROM appends WHERE file_id = ?
  `).get(fileId) as { pending: number; claimed: number; completed: number; activeClaims: number };
  return { pending: result?.pending ?? 0, claimed: result?.claimed ?? 0, completed: result?.completed ?? 0, activeClaims: result?.activeClaims ?? 0 };
}

export async function readFile(input: FileReadInput): Promise<FileReadResult> {
  const { workspaceId, scopeType, scopePath, normalizedPath, key, keyPrefix = 'r', appendsLimit, format, include, since } = input;

  // Check folder scope restriction
  if (scopeType === 'folder' && scopePath) {
    if (!isPathWithinScope(normalizedPath, scopePath)) {
      return { ok: false, status: 404, error: { code: 'PERMISSION_DENIED', message: 'Path outside of key scope' } };
    }
  }

  const file = await db.query.files.findFirst({
    where: and(eq(files.workspaceId, workspaceId), eq(files.path, normalizedPath)),
  });

  if (!file) return { ok: false, status: 404, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } };
  if (file.deletedAt) return { ok: false, status: 410, error: { code: 'FILE_DELETED', message: 'File is soft-deleted' }, deletedAt: file.deletedAt };

  const workspaceContext = await getWorkspaceContext(workspaceId);
  const appendCount = await getAppendCount(file.id);
  const size = Buffer.byteLength(file.content, 'utf-8');
  const etag = generateVersionedETag(file.content, file.updatedAt);
  const filename = normalizedPath.split('/').pop() || normalizedPath;

  const baseData = {
    id: file.id, filename, content: file.content, etag,
    createdAt: file.createdAt, updatedAt: file.updatedAt,
    appendCount, size, webUrl: `${APP_URL}/${keyPrefix}/${key}`,
    ...(workspaceContext && { workspace: workspaceContext }),
  };

  if (format === 'parsed') {
    const frontmatter = parseFrontmatterFromMarkdown(file.content);
    const parsedAppends = await fetchAppends({ fileId: file.id, limit: appendsLimit, since });
    const data = { ...baseData, frontmatter: { ...frontmatter, createdAt: file.createdAt, id: file.id }, appends: parsedAppends };
    if (include === 'stats') {
      const taskStats = await getTaskStats(file.id);
      return { ok: true, etag, data: { ...data, stats: { appendCount, taskStats } } };
    }
    return { ok: true, etag, data };
  }

  if (include === 'stats') {
    const taskStats = await getTaskStats(file.id);
    return { ok: true, etag, data: { ...baseData, stats: { appendCount, taskStats } } };
  }

  return { ok: true, etag, data: baseData };
}
