import { sqlite } from '../../../db';

type AuthWorkspaceFixtureInput = {
  workspaceId: string;
  userId: string;
  name: string;
  deletedAt?: string;
};

export function createOwnedWorkspaceForUser(input: AuthWorkspaceFixtureInput): void {
  const now = new Date().toISOString();
  const membershipId = `uw_${input.workspaceId}`;

  sqlite.query(`DELETE FROM user_workspaces WHERE workspace_id = ?`).run(input.workspaceId);
  sqlite.query(`DELETE FROM workspaces WHERE id = ?`).run(input.workspaceId);

  sqlite.query(`
    INSERT INTO workspaces (id, name, created_at, last_activity_at, deleted_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(input.workspaceId, input.name, now, now, input.deletedAt ?? null);

  sqlite.query(`
    INSERT INTO user_workspaces (id, user_id, workspace_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(membershipId, input.userId, input.workspaceId, now);
}
