import { and, eq, isNull } from 'drizzle-orm';
import { db, sqlite } from '../db';
import { files } from '../db/schema';

type ScopeType = 'workspace' | 'folder' | 'file';

type ScopeCounts = {
  files: number;
  appends: number;
  tasks: number;
  claims: number;
  agents: number;
};

type ScopeActivity = {
  lastAppendAt: string | null;
  appendsToday: number;
  appendsThisWeek: number;
};

export type FileScopeStats = {
  scope: {
    type: ScopeType;
    id: string;
  };
  counts: ScopeCounts;
  activity: ScopeActivity;
};

type GetScopedFileStatsInput = {
  workspaceId: string;
  scopeType?: string | null;
  scopePath?: string | null;
  now?: Date;
};

function resolveScopeType(scopeType?: string | null): ScopeType {
  if (scopeType === 'folder' || scopeType === 'file') {
    return scopeType;
  }
  return 'workspace';
}

export async function getScopedFileStats({
  workspaceId,
  scopeType,
  scopePath,
  now = new Date(),
}: GetScopedFileStatsInput): Promise<FileScopeStats> {
  const resolvedScopeType = resolveScopeType(scopeType);
  const resolvedScopePath = scopePath ?? '/';

  let scopeId = workspaceId;
  if (resolvedScopeType === 'file') {
    const file = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, workspaceId),
        eq(files.path, resolvedScopePath),
        isNull(files.deletedAt)
      ),
    });
    scopeId = file?.id ?? resolvedScopePath;
  } else if (resolvedScopeType === 'folder') {
    scopeId = resolvedScopePath || '/';
  }

  let fileCount = 0;
  if (resolvedScopeType === 'workspace') {
    const result = sqlite.query(
      'SELECT COUNT(*) as count FROM files WHERE workspace_id = ? AND deleted_at IS NULL'
    ).get(workspaceId) as { count: number };
    fileCount = result?.count ?? 0;
  } else if (resolvedScopeType === 'folder') {
    const folderPrefix = resolvedScopePath === '/' ? '/' : resolvedScopePath;
    const result = sqlite.query(
      'SELECT COUNT(*) as count FROM files WHERE workspace_id = ? AND deleted_at IS NULL AND (path = ? OR path LIKE ?)'
    ).get(workspaceId, folderPrefix, folderPrefix + '/%') as { count: number };
    fileCount = result?.count ?? 0;
  } else {
    const result = sqlite.query(
      'SELECT COUNT(*) as count FROM files WHERE workspace_id = ? AND path = ? AND deleted_at IS NULL'
    ).get(workspaceId, resolvedScopePath) as { count: number };
    fileCount = result?.count ?? 0;
  }

  let fileIdsQuery: string;
  let fileIdsParams: string[];
  if (resolvedScopeType === 'workspace') {
    fileIdsQuery = 'SELECT id FROM files WHERE workspace_id = ? AND deleted_at IS NULL';
    fileIdsParams = [workspaceId];
  } else if (resolvedScopeType === 'folder') {
    const folderPrefix = resolvedScopePath === '/' ? '/' : resolvedScopePath;
    fileIdsQuery =
      'SELECT id FROM files WHERE workspace_id = ? AND deleted_at IS NULL AND (path = ? OR path LIKE ?)';
    fileIdsParams = [workspaceId, folderPrefix, folderPrefix + '/%'];
  } else {
    fileIdsQuery = 'SELECT id FROM files WHERE workspace_id = ? AND path = ? AND deleted_at IS NULL';
    fileIdsParams = [workspaceId, resolvedScopePath];
  }

  const fileIds = (sqlite.query(fileIdsQuery).all(...fileIdsParams) as Array<{ id: string }>).map(
    (entry) => entry.id
  );
  const placeholder = fileIds.length > 0 ? fileIds.map(() => '?').join(',') : "'__none__'";

  let appendsCount = 0;
  let tasksCount = 0;
  let claimsCount = 0;
  let agentsCount = 0;
  let lastAppendAt: string | null = null;
  let appendsToday = 0;
  let appendsThisWeek = 0;

  if (fileIds.length > 0) {
    const appendResult = sqlite.query(
      `SELECT COUNT(*) as count FROM appends WHERE file_id IN (${placeholder})`
    ).get(...fileIds) as { count: number };
    appendsCount = appendResult?.count ?? 0;

    const tasksResult = sqlite.query(
      `SELECT COUNT(*) as count FROM appends WHERE file_id IN (${placeholder}) AND type = 'task'`
    ).get(...fileIds) as { count: number };
    tasksCount = tasksResult?.count ?? 0;

    const claimsResult = sqlite.query(
      `SELECT COUNT(*) as count FROM appends WHERE file_id IN (${placeholder}) AND type = 'claim'`
    ).get(...fileIds) as { count: number };
    claimsCount = claimsResult?.count ?? 0;

    const agentsResult = sqlite.query(
      `SELECT COUNT(DISTINCT author) as count FROM appends WHERE file_id IN (${placeholder})`
    ).get(...fileIds) as { count: number };
    agentsCount = agentsResult?.count ?? 0;

    const lastAppendResult = sqlite.query(
      `SELECT created_at FROM appends WHERE file_id IN (${placeholder}) ORDER BY created_at DESC LIMIT 1`
    ).get(...fileIds) as { created_at: string } | null;
    lastAppendAt = lastAppendResult?.created_at ?? null;

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const appendsTodayResult = sqlite.query(
      `SELECT COUNT(*) as count FROM appends WHERE file_id IN (${placeholder}) AND created_at >= ?`
    ).get(...fileIds, todayIso) as { count: number };
    appendsToday = appendsTodayResult?.count ?? 0;

    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoIso = weekAgo.toISOString();
    const appendsWeekResult = sqlite.query(
      `SELECT COUNT(*) as count FROM appends WHERE file_id IN (${placeholder}) AND created_at >= ?`
    ).get(...fileIds, weekAgoIso) as { count: number };
    appendsThisWeek = appendsWeekResult?.count ?? 0;
  }

  return {
    scope: {
      type: resolvedScopeType,
      id: scopeId,
    },
    counts: {
      files: fileCount,
      appends: appendsCount,
      tasks: tasksCount,
      claims: claimsCount,
      agents: agentsCount,
    },
    activity: {
      lastAppendAt,
      appendsToday,
      appendsThisWeek,
    },
  };
}
