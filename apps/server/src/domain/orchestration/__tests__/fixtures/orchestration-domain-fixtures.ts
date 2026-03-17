import { initializeDatabase, sqlite } from '../../../../db';

type WorkspaceFixtureInput = {
  workspaceId: string;
  workspaceName: string;
  fileId: string;
  filePath: string;
  fileContent: string;
  now?: string;
};

export function resetOrchestrationDomainWorkspace(workspaceId: string): void {
  sqlite.query('DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = ?)').run(workspaceId);
  sqlite.query('DELETE FROM heartbeats WHERE workspace_id = ?').run(workspaceId);
  sqlite.query('DELETE FROM files WHERE workspace_id = ?').run(workspaceId);
  sqlite.query('DELETE FROM capability_keys WHERE workspace_id = ?').run(workspaceId);
  sqlite.query('DELETE FROM webhooks WHERE workspace_id = ?').run(workspaceId);
  sqlite.query('DELETE FROM folders WHERE workspace_id = ?').run(workspaceId);
  sqlite.query('DELETE FROM user_workspaces WHERE workspace_id = ?').run(workspaceId);
  sqlite.query('DELETE FROM api_keys WHERE workspace_id = ?').run(workspaceId);
  sqlite.query('DELETE FROM audit_logs WHERE workspace_id = ?').run(workspaceId);
  sqlite.query('DELETE FROM export_jobs WHERE workspace_id = ?').run(workspaceId);
  sqlite.query('DELETE FROM jobs WHERE workspace_id = ?').run(workspaceId);
  sqlite.query('DELETE FROM workspaces WHERE id = ?').run(workspaceId);
}

export function setupOrchestrationDomainWorkspace(input: WorkspaceFixtureInput): string {
  initializeDatabase();

  const now = input.now ?? new Date().toISOString();
  resetOrchestrationDomainWorkspace(input.workspaceId);

  sqlite.query(`
    INSERT INTO workspaces (id, name, created_at, last_activity_at)
    VALUES (?, ?, ?, ?)
  `).run(input.workspaceId, input.workspaceName, now, now);

  sqlite.query(`
    INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.fileId, input.workspaceId, input.filePath, input.fileContent, now, now);

  return now;
}
