import { sqlite } from '../../db';
import { hasRequiredScope, insufficientScopeResponse, updateApiKeyLastUsed } from '../../shared';

type Scope = 'read' | 'append' | 'write' | 'export';

type AuthenticateApiKeyRequestResult =
  | { ok: true; key: { id: string; workspaceId: string; scopes: Scope[] } }
  | { ok: false; status: number; body: { ok: false; error: { code: string; message: string } } };

export async function handleGetApiKeyStats(input: {
  request: Request;
  authenticateApiKeyRequest: (request: Request) => Promise<AuthenticateApiKeyRequestResult>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const keyResult = await input.authenticateApiKeyRequest(input.request);
  if (!keyResult.ok) {
    return {
      status: keyResult.status,
      body: keyResult.body,
    };
  }

  if (!hasRequiredScope(keyResult.key.scopes, 'read')) {
    return {
      status: 403,
      body: insufficientScopeResponse(),
    };
  }

  updateApiKeyLastUsed(keyResult.key.id);

  const workspaceId = keyResult.key.workspaceId;
  const workspace = sqlite
    .query(`SELECT id, storage_used_bytes FROM workspaces WHERE id = ?`)
    .get(workspaceId) as { id: string; storage_used_bytes: number } | null;
  if (!workspace) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } },
    };
  }

  const fileStats = sqlite
    .query(
      `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted
        FROM files
        WHERE workspace_id = ?
      `
    )
    .get(workspaceId) as { total: number; active: number; deleted: number };

  const allFilePaths = sqlite
    .query(`SELECT path FROM files WHERE workspace_id = ? AND deleted_at IS NULL`)
    .all(workspaceId) as Array<{ path: string }>;

  const folderPaths = new Set<string>();
  for (const f of allFilePaths) {
    const parts = f.path.split('/').filter((p) => p);
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i += 1) {
      currentPath += '/' + parts[i];
      folderPaths.add(currentPath);
    }
  }

  const explicitFolders = sqlite
    .query(`SELECT path FROM folders WHERE workspace_id = ? AND deleted_at IS NULL`)
    .all(workspaceId) as Array<{ path: string }>;
  for (const f of explicitFolders) {
    const parts = f.path.split('/').filter((p) => p);
    let currentPath = '';
    for (const part of parts) {
      currentPath += '/' + part;
      folderPaths.add(currentPath);
    }
  }

  const appendStats = sqlite
    .query(
      `
          SELECT
            COUNT(*) as total
          FROM appends a
          JOIN files f ON a.file_id = f.id
          WHERE f.workspace_id = ? AND f.deleted_at IS NULL
        `
    )
    .get(workspaceId) as { total: number } | undefined;

  const totalAppends = appendStats?.total ?? 0;
  const nowIso = new Date().toISOString();
  const taskStats = sqlite
    .query(
      `
        SELECT
          SUM(CASE WHEN a.type = 'task' AND (a.status IS NULL OR a.status = 'pending') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN a.type = 'task' AND a.status = 'claimed' THEN 1 ELSE 0 END) as claimed,
          SUM(CASE WHEN a.type = 'task' AND a.status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN a.type = 'claim' AND a.status = 'active' AND a.expires_at > ? THEN 1 ELSE 0 END) as activeClaims
        FROM appends a
        JOIN files f ON a.file_id = f.id
        WHERE f.workspace_id = ? AND f.deleted_at IS NULL
      `
    )
    .get(nowIso, workspaceId) as { pending: number; claimed: number; completed: number; activeClaims: number };

  const usedBytes = workspace.storage_used_bytes ?? 0;
  const limitBytes = 1073741824;

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        fileCount: fileStats.active,
        folderCount: folderPaths.size,
        totalSize: usedBytes,
        appendCount: totalAppends,
        taskStats: {
          pending: taskStats?.pending ?? 0,
          claimed: taskStats?.claimed ?? 0,
          completed: taskStats?.completed ?? 0,
          activeClaims: taskStats?.activeClaims ?? 0,
        },
        storageUsed: usedBytes,
        storageLimit: limitBytes,
      },
    },
  };
}
