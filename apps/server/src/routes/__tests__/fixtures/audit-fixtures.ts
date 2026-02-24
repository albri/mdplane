import { sqlite } from '../../../db';
import { generateKey, hashKey } from '../../../core/capability-keys';

type AuditCapabilityPermission = 'read' | 'write';

export function setupAuditWorkspaceAndKeys(
  workspaceId: string,
  writeKey: string,
  readKey: string
): void {
  const now = new Date().toISOString();

  sqlite.query(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES (?, ?, ?, ?)
  `).run(workspaceId, 'Test Workspace Audit', now, now);

  upsertCapabilityKey(workspaceId, writeKey, 'write', now);
  upsertCapabilityKey(workspaceId, readKey, 'read', now);
}

function upsertCapabilityKey(
  workspaceId: string,
  keyString: string,
  permission: AuditCapabilityPermission,
  now: string
): void {
  const keyHash = hashKey(keyString);
  const id = `ck_${generateKey(16)}`;
  const prefix = keyString.substring(0, 2);

  sqlite.query(`
    INSERT OR REPLACE INTO capability_keys (
      id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at
    ) VALUES (?, ?, ?, ?, ?, 'workspace', '/', ?)
  `).run(id, workspaceId, prefix, keyHash, permission, now);
}

export function resetAuditLogsForWorkspace(workspaceId: string): void {
  sqlite.query(`DELETE FROM audit_logs WHERE workspace_id = ?`).run(workspaceId);
}
