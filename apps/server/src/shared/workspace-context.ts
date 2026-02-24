import { eq } from 'drizzle-orm';
import { db, sqlite } from '../db';
import { workspaces } from '../db/schema';
import { readServerEnv } from '../config/env';

// Default quota: 100MB per workspace
const DEFAULT_MAX_WORKSPACE_STORAGE_BYTES = 100 * 1024 * 1024;

export type WorkspaceQuotaError = {
  code: string;
  message: string;
  details: {
    quotaBytes: number;
    usedBytes: number;
    requestedBytes: number;
  };
};

export async function getWorkspaceStorageUsage(workspaceId: string): Promise<number> {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    columns: { storageUsedBytes: true },
  });
  return workspace?.storageUsedBytes ?? 0;
}

export function updateWorkspaceStorage(workspaceId: string, delta: number): void {
  if (delta === 0) return;

  sqlite.query(`
    UPDATE workspaces
    SET storage_used_bytes = MAX(0, storage_used_bytes + (?))
    WHERE id = ?
  `).run(delta, workspaceId);
}

type CheckWorkspaceQuotaInput = {
  workspaceId: string
  newContentSize: number
  existingContentSize?: number
}

export async function checkWorkspaceQuota(
  { workspaceId, newContentSize, existingContentSize = 0 }: CheckWorkspaceQuotaInput
): Promise<WorkspaceQuotaError | null> {
  const maxBytes = readServerEnv().maxWorkspaceStorageBytes || DEFAULT_MAX_WORKSPACE_STORAGE_BYTES;

  const currentUsage = await getWorkspaceStorageUsage(workspaceId);
  const netChange = newContentSize - existingContentSize;
  const projectedUsage = currentUsage + netChange;

  if (projectedUsage > maxBytes) {
    return {
      code: 'QUOTA_EXCEEDED',
      message: `Workspace storage quota exceeded. Quota: ${maxBytes} bytes, Used: ${currentUsage} bytes, Requested: ${newContentSize} bytes`,
      details: {
        quotaBytes: maxBytes,
        usedBytes: currentUsage,
        requestedBytes: newContentSize,
      },
    };
  }

  return null;
}

export async function getWorkspaceContext(
  workspaceId: string
): Promise<{ id: string; name?: string; claimed: boolean } | null> {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    columns: { id: true, name: true, claimedAt: true },
  });

  if (!workspace) return null;

  return {
    id: workspace.id,
    ...(workspace.name && { name: workspace.name }),
    claimed: workspace.claimedAt !== null,
  };
}
