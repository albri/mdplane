import { eq, and, isNull, like } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { files, appends } from '../../db/schema';
import { validatePath, normalizePath } from '../../core/path-validation';
import { createErrorResponse } from '../../core/errors';
import type {
  SearchInFolderQuery,
  QueryFolderTasksQuery,
  FolderSearchResponse,
  FolderSearchResult,
  FolderSearchMatch,
  TaskQueryResult,
  TaskSummary,
  FileReference,
  FileUrls,
} from '@mdplane/shared';
import type { ElysiaContextSet } from '../../shared';
import {
  validateAndGetKey,
  validateSearchPattern,
  parseTimeout,
  parseCommaSeparated,
  parseLabels,
  hasCommonElements,
} from './validation';
import { serverEnv } from '../../config/env';

const BASE_URL = serverEnv.baseUrl;
const APP_URL = serverEnv.appUrl;

function normalizeTaskStatus(status: string | null | undefined): 'pending' | 'claimed' | 'completed' | 'cancelled' {
  switch (status) {
    case 'claimed':
      return 'claimed';
    case 'completed':
    case 'done':
      return 'completed';
    case 'cancelled':
    case 'expired':
    case 'failed':
      return 'cancelled';
    case 'pending':
    case 'open':
    case 'active':
    default:
      return 'pending';
  }
}

type HandleFolderSearchInput = {
  readKey: string;
  folderPath: string;
  query: SearchInFolderQuery;
  set: ElysiaContextSet;
  rawUrl: string;
};

export async function handleFolderSearch({
  readKey,
  folderPath,
  query,
  set,
  rawUrl,
}: HandleFolderSearchInput) {
  if (rawUrl.includes('..') || rawUrl.includes('%2e%2e') || rawUrl.includes('%2E%2E')) {
    set.status = 400;
    return createErrorResponse('INVALID_PATH', 'Path traversal not allowed');
  }

  const pathError = validatePath(folderPath);
  if (pathError) {
    set.status = 400;
    return { ok: false as const, error: pathError };
  }

  const keyResult = await validateAndGetKey(readKey);
  if (!keyResult.ok) {
    set.status = keyResult.status;
    return { ok: false as const, error: keyResult.error };
  }

  const { q, labels: labelsStr, priority: priorityStr, status, author, since, limit, cursor, timeout } = query;
  const labels = parseCommaSeparated(labelsStr);
  const priorities = parseCommaSeparated(priorityStr);

  if (q && q.length > 500) {
    set.status = 400;
    return createErrorResponse('QUERY_TOO_LONG', 'Search query too long (max 500 characters)');
  }

  if (q) {
    const patternError = validateSearchPattern(q);
    if (patternError) {
      set.status = 400;
      return { ok: false as const, error: patternError };
    }
  }

  if (timeout) {
    const timeoutMs = parseTimeout(timeout);
    if (timeoutMs === null) {
      set.status = 400;
      return createErrorResponse('INVALID_TIMEOUT', 'Invalid timeout format');
    }
    if (timeoutMs > 30000) {
      set.status = 400;
      return createErrorResponse('INVALID_TIMEOUT', 'Timeout exceeds maximum (30s)');
    }
  }

  const normalizedPath = normalizePath(folderPath);
  const startTime = Date.now();
  const timeoutMs = timeout ? parseTimeout(timeout) : 5000;

  const MAX_FILES_PER_SEARCH = 1000;
  const folderFiles = await db.query.files.findMany({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      like(files.path, `${normalizedPath}%`),
      isNull(files.deletedAt)
    ),
    columns: {
      id: true,
      path: true,
      workspaceId: true,
      createdAt: true,
    },
  });

  if (folderFiles.length > MAX_FILES_PER_SEARCH) {
    set.status = 400;
    return createErrorResponse(
      'QUERY_TOO_BROAD',
      `Search scope too large (${folderFiles.length} files). Use a more specific folder path or add filters.`
    );
  }

  const results: FolderSearchResult[] = [];
  let truncated = false;

  for (const file of folderFiles) {
    if (timeoutMs && (Date.now() - startTime) > timeoutMs) {
      truncated = true;
      break;
    }

    const fileAppends = await db.query.appends.findMany({
      where: eq(appends.fileId, file.id),
    });

    const matchingAppends: FolderSearchMatch[] = [];

    for (const append of fileAppends) {
      if (q && !append.contentPreview?.toLowerCase().includes(q.toLowerCase())) continue;
      if (labels.length > 0) {
        const appendLabels = parseLabels(append.labels);
        if (!hasCommonElements(labels, appendLabels)) continue;
      }
      if (priorities.length > 0 && (!append.priority || !priorities.includes(append.priority))) continue;
      const normalizedStatus = normalizeTaskStatus(append.status);
      if (status && normalizedStatus !== status) continue;
      if (author && append.author !== author) continue;
      if (since) {
        const sinceDate = new Date(since);
        const appendDate = new Date(append.createdAt);
        if (appendDate < sinceDate) continue;
      }

      matchingAppends.push({
        appendId: append.appendId,
        type: append.type || 'comment',
        content: append.contentPreview || '',
        priority: append.priority || undefined,
        status: append.status ? normalizedStatus : undefined,
        labels: parseLabels(append.labels),
        author: append.author || undefined,
        createdAt: append.createdAt,
      });
    }

    if (matchingAppends.length > 0 || !q) {
      const fileRef: FileReference = { id: file.id, path: file.path };
      const fileUrls: FileUrls = { read: `${BASE_URL}/r/${readKey}${file.path}` };

      results.push({
        file: fileRef,
        fileUrls,
        matches: matchingAppends,
      });
    }
  }

  const startIndex = cursor ? parseInt(Buffer.from(cursor, 'base64').toString()) || 0 : 0;
  const paginatedResults = results.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < results.length;
  const nextCursor = hasMore ? Buffer.from(String(startIndex + limit)).toString('base64') : undefined;

  set.status = 200;
  const response: FolderSearchResponse = {
    ok: true,
    data: {
      results: paginatedResults,
      truncated,
    },
    pagination: {
      cursor: nextCursor,
      hasMore,
      total: results.length,
    },
  };
  return response;
}

type HandleTaskQueryInput = {
  readKey: string;
  folderPath: string;
  query: QueryFolderTasksQuery;
  set: ElysiaContextSet;
};

export async function handleTaskQuery({
  readKey,
  folderPath,
  query,
  set,
}: HandleTaskQueryInput) {
  const pathError = validatePath(folderPath);
  if (pathError) {
    set.status = 400;
    return { ok: false as const, error: pathError };
  }

  const keyResult = await validateAndGetKey(readKey);
  if (!keyResult.ok) {
    set.status = keyResult.status;
    return { ok: false as const, error: keyResult.error };
  }

  const normalizedPath = normalizePath(folderPath);

  const { status, priority: priorityStr, labels: labelsStr, claimedBy, claimable: claimableStr, limit, cursor } = query;
  const priorities = parseCommaSeparated(priorityStr);
  const labels = parseCommaSeparated(labelsStr);
  const claimable = claimableStr === 'true';

  const MAX_FILES_PER_SEARCH = 1000;
  const folderFiles = await db.query.files.findMany({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      like(files.path, `${normalizedPath}%`),
      isNull(files.deletedAt)
    ),
    columns: {
      id: true,
      path: true,
      workspaceId: true,
      createdAt: true,
    },
  });

  if (folderFiles.length > MAX_FILES_PER_SEARCH) {
    set.status = 400;
    return createErrorResponse(
      'QUERY_TOO_BROAD',
      `Search scope too large (${folderFiles.length} files). Use a more specific folder path or add filters.`
    );
  }

  const tasks: TaskQueryResult[] = [];
  const summary: TaskSummary = { pending: 0, claimed: 0, completed: 0 };

  for (const file of folderFiles) {
    const fileAppends = await db.query.appends.findMany({
      where: and(
        eq(appends.fileId, file.id),
        eq(appends.type, 'task')
      ),
    });

    for (const append of fileAppends) {
      const taskStatus = normalizeTaskStatus(append.status);

      if (taskStatus === 'pending') summary.pending++;
      else if (taskStatus === 'claimed') summary.claimed++;
      else if (taskStatus === 'completed') summary.completed++;

      if (status && taskStatus !== status) continue;
      if (priorities.length > 0 && (!append.priority || !priorities.includes(append.priority))) continue;
      if (labels.length > 0) {
        const appendLabels = parseLabels(append.labels);
        if (!hasCommonElements(labels, appendLabels)) continue;
      }
      if (claimedBy && (taskStatus !== 'claimed' || append.author !== claimedBy)) continue;
      if (claimable && (taskStatus !== 'pending')) continue;

      const fileRef: FileReference = { id: file.id, path: file.path };
      const fileUrls: FileUrls = {
        read: `${BASE_URL}/r/${readKey}${file.path}`,
        append: `${BASE_URL}/a/${readKey}${file.path}`,
      };

      tasks.push({
        id: append.appendId,
        file: fileRef,
        fileUrls,
        content: append.contentPreview || '',
        author: append.author || undefined,
        status: taskStatus,
        priority: (append.priority as 'low' | 'medium' | 'high' | 'critical') || undefined,
        labels: parseLabels(append.labels),
        claimedBy: taskStatus === 'claimed' ? append.author : undefined,
        expiresAt: undefined,
        createdAt: append.createdAt,
      });
    }
  }

  const startIndex = cursor ? parseInt(Buffer.from(cursor, 'base64').toString()) || 0 : 0;
  const paginatedTasks = tasks.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < tasks.length;
  const nextCursor = hasMore ? Buffer.from(String(startIndex + limit)).toString('base64') : undefined;

  set.status = 200;
  const response = {
    ok: true as const,
    data: {
      tasks: paginatedTasks,
      summary,
      webUrl: `${APP_URL}/control/${keyResult.key.workspaceId}/orchestration`,
    },
    pagination: {
      cursor: nextCursor,
      hasMore,
      total: tasks.length,
    },
  };
  return response;
}

type HandleFolderStatsInput = {
  readKey: string;
  folderPath: string;
  set: ElysiaContextSet;
  rawUrl: string;
};

export async function handleFolderStats({
  readKey,
  folderPath,
  set,
  rawUrl,
}: HandleFolderStatsInput) {
  if (rawUrl.includes('..') || rawUrl.includes('%2e%2e') || rawUrl.includes('%2E%2E')) {
    set.status = 400;
    return createErrorResponse('INVALID_PATH', 'Path traversal not allowed');
  }

  const pathError = validatePath(folderPath);
  if (pathError) {
    set.status = 400;
    return { ok: false as const, error: pathError };
  }

  const keyResult = await validateAndGetKey(readKey);
  if (!keyResult.ok) {
    set.status = keyResult.status;
    return { ok: false as const, error: keyResult.error };
  }

  const normalizedPath = normalizePath(folderPath);

  const folderFiles = await db.query.files.findMany({
    where: and(
      eq(files.workspaceId, keyResult.key.workspaceId),
      like(files.path, `${normalizedPath}%`),
      isNull(files.deletedAt)
    ),
    columns: {
      id: true,
      path: true,
      content: true,
      updatedAt: true,
    },
  });

  if (folderFiles.length === 0) {
    set.status = 404;
    return createErrorResponse('FOLDER_NOT_FOUND', 'Folder not found');
  }

  const subfolders = new Set<string>();
  let totalFileCount = 0;
  let totalSize = 0;
  let updatedAt: string | null = null;

  for (const file of folderFiles) {
    totalFileCount++;
    totalSize += new TextEncoder().encode(file.content || '').length;

    if (!updatedAt || file.updatedAt > updatedAt) {
      updatedAt = file.updatedAt;
    }

    let relativePath = file.path.substring(normalizedPath.length);
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.substring(1);
    }
    const slashIndex = relativePath.indexOf('/');
    if (slashIndex !== -1) {
      const subfolderName = relativePath.substring(0, slashIndex);
      if (subfolderName) {
        subfolders.add(subfolderName);
      }
    }
  }

  const fileIds = folderFiles.map(f => f.id);
  let taskStats = { pending: 0, claimed: 0, completed: 0, activeClaims: 0 };

  if (fileIds.length > 0) {
    const now = new Date().toISOString();
    const placeholders = fileIds.map(() => '?').join(', ');

    const taskStatsResult = sqlite.query(`
      WITH tasks AS (
        SELECT id, file_id, append_id FROM appends
        WHERE file_id IN (${placeholders}) AND type = 'task'
      ),
      active_claims AS (
        SELECT DISTINCT ref, file_id FROM appends
        WHERE file_id IN (${placeholders}) AND type = 'claim' AND status = 'active' AND expires_at > ?
      ),
      completed_tasks AS (
        SELECT DISTINCT ref, file_id FROM appends
        WHERE file_id IN (${placeholders}) AND type = 'response'
      ),
      active_claim_count AS (
        SELECT COUNT(*) as count FROM appends
        WHERE file_id IN (${placeholders}) AND type = 'claim' AND status = 'active' AND expires_at > ?
      )
      SELECT
        (SELECT COUNT(*) FROM tasks t WHERE NOT EXISTS (SELECT 1 FROM active_claims ac WHERE ac.ref = t.append_id AND ac.file_id = t.file_id) AND NOT EXISTS (SELECT 1 FROM completed_tasks ct WHERE ct.ref = t.append_id AND ct.file_id = t.file_id)) as pending,
        (SELECT COUNT(*) FROM tasks t WHERE EXISTS (SELECT 1 FROM active_claims ac WHERE ac.ref = t.append_id AND ac.file_id = t.file_id) AND NOT EXISTS (SELECT 1 FROM completed_tasks ct WHERE ct.ref = t.append_id AND ct.file_id = t.file_id)) as claimed,
        (SELECT COUNT(*) FROM tasks t WHERE EXISTS (SELECT 1 FROM completed_tasks ct WHERE ct.ref = t.append_id AND ct.file_id = t.file_id)) as completed,
        (SELECT count FROM active_claim_count) as activeClaims
    `).get(
      ...fileIds,
      ...fileIds, now,
      ...fileIds,
      ...fileIds, now
    ) as { pending: number; claimed: number; completed: number; activeClaims: number } | null;

    if (taskStatsResult) {
      taskStats = {
        pending: taskStatsResult.pending ?? 0,
        claimed: taskStatsResult.claimed ?? 0,
        completed: taskStatsResult.completed ?? 0,
        activeClaims: taskStatsResult.activeClaims ?? 0,
      };
    }
  }

  set.status = 200;
  return {
    ok: true as const,
    data: {
      path: normalizedPath || '/',
      fileCount: totalFileCount,
      folderCount: subfolders.size,
      totalSize,
      updatedAt: updatedAt ?? undefined,
      taskStats,
    },
  };
}
