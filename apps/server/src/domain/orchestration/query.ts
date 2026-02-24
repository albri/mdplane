import { sqlite } from '../../db';
import type {
  OrchestrationBoard,
  OrchestrationQueryFilters,
  OrchestrationSummary,
  OrchestrationClaim,
  OrchestrationAgent,
  AgentWorkload,
  ExtendedAgentStatus,
} from './types';
import type { OrchestrationTask } from '@mdplane/shared';

// Re-export types for convenience
export type { OrchestrationQueryFilters } from './types';

// Valid priority values from OpenAPI spec
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
type ValidPriority = typeof VALID_PRIORITIES[number];
const VALID_STATUSES = ['pending', 'claimed', 'stalled', 'completed', 'cancelled'] as const;
type ValidStatus = typeof VALID_STATUSES[number];

// Stale threshold: 5 minutes
const STALE_THRESHOLD_SECONDS = 300;

export function queryOrchestrationBoard(
  workspaceId: string,
  filters: OrchestrationQueryFilters,
  isAdmin = false
): OrchestrationBoard {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const limit = Math.min(filters.limit || 50, 1000);

  // Parse and validate priority filter (SECURITY: no string interpolation)
  const priorityList = parsePriorityFilter(filters.priority);
  const statusList = parseStatusFilter(filters.status);

  // Build task query with parameterized filters
  const { query: tasksQuery, params: taskParams } = buildTasksQuery(
    workspaceId,
    filters,
    priorityList,
    statusList,
    nowIso,
    limit
  );

  const rawTasks = sqlite.query(tasksQuery).all(...taskParams) as RawTaskRow[];

  const hasMore = rawTasks.length > limit;
  const taskResults = hasMore ? rawTasks.slice(0, limit) : rawTasks;
  const lastCursor = taskResults.length > 0
    ? encodeCursor(taskResults[taskResults.length - 1])
    : undefined;

  // Flatten tasks with explicit status.
  const tasks = buildFlatTasks(taskResults);

  const summary = summarizeTasks(tasks);

  // Get active claims
  const claims = queryClaims(workspaceId, nowIso, filters.agent, isAdmin);

  // Get agent status
  const agents = queryAgents(workspaceId, filters.agent);

  // Get workload
  const workload = queryWorkload(workspaceId, nowIso, todayStart);

  return {
    summary,
    tasks,
    claims,
    agents,
    workload,
    pagination: { cursor: lastCursor, hasMore },
  };
}

interface RawTaskRow {
  id: string;
  append_id: string;
  author: string;
  priority: string | null;
  labels: string | null;
  created_at: string;
  due_at: string | null;
  content_preview: string | null;
  file_id: string;
  file_path: string;
  claim_id: string | null;
  claim_author: string | null;
  claim_expires: string | null;
  claim_status: string | null;
  blocked_status: string | null;
  block_reason: string | null;
  is_stalled: number;
  is_completed: number;
  is_cancelled: number;
}

function parsePriorityFilter(priority?: string): ValidPriority[] {
  if (!priority) return [];

  return priority
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter((p): p is ValidPriority => VALID_PRIORITIES.includes(p as ValidPriority));
}

function parseStatusFilter(status?: string): ValidStatus[] {
  if (!status) return [];

  return status
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is ValidStatus => VALID_STATUSES.includes(value as ValidStatus));
}

// SECURITY: Uses placeholders for all user-provided values
function buildTasksQuery(
  workspaceId: string,
  filters: OrchestrationQueryFilters,
  priorityList: ValidPriority[],
  statusList: ValidStatus[],
  nowIso: string,
  limit: number
): { query: string; params: (string | number)[] } {
  let conditions = `a.type = 'task' AND f.workspace_id = ? AND f.deleted_at IS NULL`;
  const params: (string | number)[] = [workspaceId];

  // Priority filter with parameterized placeholders (SECURITY: no string interpolation)
  if (priorityList.length > 0) {
    const placeholders = priorityList.map(() => '?').join(',');
    conditions += ` AND a.priority IN (${placeholders})`;
    params.push(...priorityList);
  }

  if (filters.file) {
    conditions += ` AND f.path LIKE ?`;
    params.push(`%${filters.file}%`);
  }

  if (filters.folder) {
    const folderPath = normalizeFolderFilter(filters.folder);
    if (folderPath !== '/') {
      conditions += ` AND (f.path = ? OR f.path LIKE ?)`;
      params.push(folderPath, `${folderPath}/%`);
    }
  }

  if (filters.since) {
    conditions += ` AND a.created_at >= ?`;
    params.push(filters.since);
  }

  if (filters.agent) {
    conditions += ` AND c.author = ?`;
    params.push(filters.agent);
  }

  if (statusList.length > 0) {
    const statusConditions: string[] = [];

    for (const status of statusList) {
      if (status === 'pending') {
        statusConditions.push(`(
          rr_task.id IS NULL
          AND rr_claim.id IS NULL
          AND cr_task.id IS NULL
          AND cr_claim.id IS NULL
          AND c.id IS NULL
        )`);
      } else if (status === 'claimed') {
        statusConditions.push(`(
          rr_task.id IS NULL
          AND rr_claim.id IS NULL
          AND cr_task.id IS NULL
          AND cr_claim.id IS NULL
          AND c.id IS NOT NULL
          AND c.expires_at > ?
        )`);
        params.push(nowIso);
      } else if (status === 'stalled') {
        statusConditions.push(`(
          rr_task.id IS NULL
          AND rr_claim.id IS NULL
          AND cr_task.id IS NULL
          AND cr_claim.id IS NULL
          AND c.id IS NOT NULL
          AND c.expires_at <= ?
        )`);
        params.push(nowIso);
      } else if (status === 'completed') {
        statusConditions.push(`(rr_task.id IS NOT NULL OR rr_claim.id IS NOT NULL)`);
      } else if (status === 'cancelled') {
        statusConditions.push(`(cr_task.id IS NOT NULL OR cr_claim.id IS NOT NULL)`);
      }
    }

    if (statusConditions.length > 0) {
      conditions += ` AND (${statusConditions.join(' OR ')})`;
    }
  }

  const decodedCursor = decodeCursor(filters.cursor);
  if (decodedCursor) {
    conditions += ` AND (a.created_at > ? OR (a.created_at = ? AND a.id > ?))`;
    params.push(decodedCursor.createdAt, decodedCursor.createdAt, decodedCursor.rowId);
  }

  const query = `
    WITH response_refs AS (
      SELECT file_id, ref, MIN(id) as id
      FROM appends
      WHERE type = 'response'
      GROUP BY file_id, ref
    ),
    cancel_refs AS (
      SELECT file_id, ref, MIN(id) as id
      FROM appends
      WHERE type = 'cancel'
      GROUP BY file_id, ref
    )
    SELECT
      a.id, a.append_id, a.author, a.priority, a.labels, a.created_at, a.due_at, a.content_preview,
      f.id as file_id, f.path as file_path,
      c.append_id as claim_id, c.author as claim_author, c.expires_at as claim_expires, c.status as claim_status,
      b.status as blocked_status, b.content_preview as block_reason,
      CASE WHEN c.id IS NOT NULL AND c.expires_at <= ? THEN 1 ELSE 0 END as is_stalled,
      CASE WHEN rr_task.id IS NOT NULL OR rr_claim.id IS NOT NULL THEN 1 ELSE 0 END as is_completed,
      CASE WHEN cr_task.id IS NOT NULL OR cr_claim.id IS NOT NULL THEN 1 ELSE 0 END as is_cancelled
    FROM appends a
    JOIN files f ON a.file_id = f.id
    LEFT JOIN appends c ON c.ref = a.append_id AND c.type = 'claim' AND c.file_id = a.file_id
      AND c.status = 'active'
    LEFT JOIN appends b ON b.ref = a.append_id AND b.type = 'blocked' AND b.file_id = a.file_id
    LEFT JOIN response_refs rr_task ON rr_task.file_id = a.file_id AND rr_task.ref = a.append_id
    LEFT JOIN response_refs rr_claim ON rr_claim.file_id = a.file_id AND rr_claim.ref = c.append_id
    LEFT JOIN cancel_refs cr_task ON cr_task.file_id = a.file_id AND cr_task.ref = a.append_id
    LEFT JOIN cancel_refs cr_claim ON cr_claim.file_id = a.file_id AND cr_claim.ref = c.append_id
    WHERE ${conditions}
    ORDER BY a.created_at ASC, a.id ASC
    LIMIT ?
  `;

  // Add nowIso for stalled check at the beginning, limit at the end
  params.unshift(nowIso);
  params.push(limit + 1);

  return { query, params };
}

type TaskStatus = 'pending' | 'claimed' | 'stalled' | 'completed' | 'cancelled';

function buildFlatTasks(rawTasks: RawTaskRow[]): OrchestrationTask[] {
  const tasks: OrchestrationTask[] = [];

  for (const t of rawTasks) {
    const priority: ValidPriority | undefined = VALID_PRIORITIES.includes(t.priority as ValidPriority)
      ? (t.priority as ValidPriority)
      : undefined;

    let status: TaskStatus;
    if (t.is_completed === 1) {
      status = 'completed';
    } else if (t.is_cancelled === 1) {
      status = 'cancelled';
    } else if (t.claim_id) {
      status = t.is_stalled === 1 ? 'stalled' : 'claimed';
    } else {
      status = 'pending';
    }

    const task: OrchestrationTask = {
      id: t.append_id,
      file: { id: t.file_id, path: t.file_path },
      content: t.content_preview || '',
      author: t.author,
      status,
      priority,
      labels: parseLabels(t.labels),
      createdAt: t.created_at,
      due: t.due_at || undefined,
    };

    if (t.claim_id) {
      task.claim = {
        id: t.claim_id,
        author: t.claim_author!,
        expiresAt: t.claim_expires!,
        blocked: t.blocked_status === 'blocked',
        blockReason: t.block_reason || undefined,
      };
    }

    tasks.push(task);
  }

  return tasks;
}

function summarizeTasks(tasks: OrchestrationTask[]): OrchestrationSummary {
  const summary: OrchestrationSummary = {
    pending: 0,
    claimed: 0,
    completed: 0,
    stalled: 0,
    cancelled: 0,
  };

  for (const task of tasks) {
    summary[task.status] += 1;
  }

  return summary;
}

function parseLabels(labels: string | null): string[] | undefined {
  if (!labels) return undefined;

  try {
    const parsed = JSON.parse(labels);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
  } catch {
    // Ignore malformed labels payloads and continue without labels.
  }

  return undefined;
}

function normalizeFolderFilter(folder: string): string {
  if (!folder.trim() || folder === '/') return '/';
  const withLeadingSlash = folder.startsWith('/') ? folder : `/${folder}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

function encodeCursor(task: RawTaskRow): string {
  return `${task.created_at}::${task.id}`;
}

function decodeCursor(cursor?: string): { createdAt: string; rowId: string } | undefined {
  if (!cursor) return undefined;
  const delimiterIndex = cursor.lastIndexOf('::');
  if (delimiterIndex <= 0 || delimiterIndex === cursor.length - 2) {
    return undefined;
  }

  return {
    createdAt: cursor.slice(0, delimiterIndex),
    rowId: cursor.slice(delimiterIndex + 2),
  };
}

function queryClaims(
  workspaceId: string,
  nowIso: string,
  agentFilter?: string,
  isAdmin = false
): OrchestrationClaim[] {
  let conditions = `
    a.type = 'claim'
    AND f.workspace_id = ?
    AND f.deleted_at IS NULL
    AND a.expires_at > ?
    AND NOT EXISTS (
      SELECT 1
      FROM appends t
      WHERE t.file_id = a.file_id
        AND t.type IN ('response', 'cancel')
        AND (t.ref = a.append_id OR t.ref = a.ref)
    )
  `;
  const params: string[] = [workspaceId, nowIso];

  if (agentFilter) {
    conditions += ` AND a.author = ?`;
    params.push(agentFilter);
  }

  const claimsQuery = `
    SELECT
      a.id, a.append_id, a.ref, a.author, a.expires_at, a.status,
      f.id as file_id, f.path as file_path,
      b.content_preview as block_reason
    FROM appends a
    JOIN files f ON a.file_id = f.id
    LEFT JOIN appends b ON b.ref = a.append_id AND b.type = 'blocked' AND b.file_id = a.file_id
    WHERE ${conditions}
    ORDER BY a.created_at DESC
    LIMIT 50
  `;

  const rawClaims = sqlite.query(claimsQuery).all(...params) as Array<{
    id: string; append_id: string; ref: string; author: string; expires_at: string; status: string | null;
    file_id: string; file_path: string; block_reason: string | null;
  }>;

  const now = new Date();
  return rawClaims.map(c => {
    const expiresAt = new Date(c.expires_at);
    const expiresInSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    const isBlocked = c.block_reason !== null;

    const claim: OrchestrationClaim = {
      id: c.append_id,
      taskId: c.ref,
      file: { id: c.file_id, path: c.file_path },
      author: c.author,
      expiresAt: c.expires_at,
      expiresInSeconds,
      status: isBlocked ? 'blocked' : 'active',
      blocked: isBlocked || undefined,
      blockReason: c.block_reason || undefined,
    };

    if (isAdmin) {
      claim.canForceExpire = true;
    }

    return claim;
  });
}

function queryAgents(workspaceId: string, agentFilter?: string): OrchestrationAgent[] {
  const agentsQuery = `
    SELECT author, status, last_seen, current_task
    FROM heartbeats
    WHERE workspace_id = ?
    ORDER BY last_seen DESC
  `;

  const rawAgents = sqlite.query(agentsQuery).all(workspaceId) as Array<{
    author: string; status: string; last_seen: number; current_task: string | null;
  }>;

  const staleThreshold = Math.floor(Date.now() / 1000) - STALE_THRESHOLD_SECONDS;

  const agents: OrchestrationAgent[] = rawAgents.map(a => ({
    author: a.author,
    status: (a.last_seen < staleThreshold ? 'stale' : a.status) as ExtendedAgentStatus,
    lastSeen: new Date(a.last_seen * 1000).toISOString(),
    currentTask: a.current_task || undefined,
  }));

  return agentFilter ? agents.filter(a => a.author === agentFilter) : agents;
}

function queryWorkload(
  workspaceId: string,
  nowIso: string,
  todayStart: string
): Record<string, AgentWorkload> {
  const workloadQuery = `
    SELECT
      a.author,
      SUM(CASE WHEN a.type = 'claim' AND a.expires_at > ?
        AND NOT EXISTS (
          SELECT 1
          FROM appends t
          WHERE t.file_id = a.file_id
            AND t.type IN ('response', 'cancel')
            AND (t.ref = a.append_id OR t.ref = a.ref)
        )
      THEN 1 ELSE 0 END) as active_claims,
      SUM(CASE WHEN a.type = 'response' AND a.created_at >= ? THEN 1 ELSE 0 END) as completed_today
    FROM appends a
    JOIN files f ON a.file_id = f.id
    WHERE f.workspace_id = ? AND f.deleted_at IS NULL AND a.type IN ('claim', 'response')
    GROUP BY a.author
  `;

  const rawWorkload = sqlite.query(workloadQuery).all(nowIso, todayStart, workspaceId) as Array<{
    author: string; active_claims: number; completed_today: number;
  }>;

  const workload: Record<string, AgentWorkload> = {};
  for (const w of rawWorkload) {
    workload[w.author] = {
      activeClaims: w.active_claims,
      completedToday: w.completed_today,
    };
  }

  return workload;
}
