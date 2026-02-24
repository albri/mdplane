import { db, sqlite } from '../../../db';
import { appends, files, userWorkspaces, workspaces } from '../../../db/schema';

export const ORCH_VALID_WORKSPACE_ID = 'ws_orch_test123456';
const ORCH_WORKSPACE_PREFIX = 'ws_orch_%';
const ORCH_OWNER_USER_ID = 'usr_orch_owner';

export const ORCH_TEST_FILE_ID = 'orch_file_test';
export const ORCH_TEST_TASK_APPEND_ID = 'ap_task_test';
export const ORCH_TEST_CLAIM_APPEND_ID = 'ap_claim_test';
export const ORCH_TEST_PENDING_TASK_APPEND_ID = 'ap_task_pending_test';

export async function resetWorkspaceOrchestrationFixtures(): Promise<{
  fileId: string;
  taskAppendId: string;
  claimAppendId: string;
}> {
  sqlite.query(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id LIKE ?)`).run(ORCH_WORKSPACE_PREFIX);
  sqlite.query(`DELETE FROM files WHERE workspace_id LIKE ?`).run(ORCH_WORKSPACE_PREFIX);
  sqlite.query(`DELETE FROM capability_keys WHERE workspace_id LIKE ?`).run(ORCH_WORKSPACE_PREFIX);
  sqlite.query(`DELETE FROM webhooks WHERE workspace_id LIKE ?`).run(ORCH_WORKSPACE_PREFIX);
  sqlite.query(`DELETE FROM folders WHERE workspace_id LIKE ?`).run(ORCH_WORKSPACE_PREFIX);
  sqlite.query(`DELETE FROM user_workspaces WHERE workspace_id LIKE ?`).run(ORCH_WORKSPACE_PREFIX);
  sqlite.query(`DELETE FROM api_keys WHERE workspace_id LIKE ?`).run(ORCH_WORKSPACE_PREFIX);
  sqlite.query(`DELETE FROM audit_logs WHERE workspace_id LIKE ?`).run(ORCH_WORKSPACE_PREFIX);
  sqlite.query(`DELETE FROM export_jobs WHERE workspace_id LIKE ?`).run(ORCH_WORKSPACE_PREFIX);
  sqlite.query(`DELETE FROM workspaces WHERE id LIKE ?`).run(ORCH_WORKSPACE_PREFIX);

  const now = new Date().toISOString();
  await db.insert(workspaces).values({
    id: ORCH_VALID_WORKSPACE_ID,
    name: 'Orch Test Workspace',
    createdAt: now,
    lastActivityAt: now,
  });

  await db.insert(userWorkspaces).values({
    id: 'uw_orch_owner',
    userId: ORCH_OWNER_USER_ID,
    workspaceId: ORCH_VALID_WORKSPACE_ID,
    createdAt: now,
  });

  await db.insert(files).values({
    id: ORCH_TEST_FILE_ID,
    workspaceId: ORCH_VALID_WORKSPACE_ID,
    path: '/tasks.md',
    content: '# Tasks',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(appends).values({
    id: `${ORCH_TEST_FILE_ID}_${ORCH_TEST_TASK_APPEND_ID}`,
    fileId: ORCH_TEST_FILE_ID,
    appendId: ORCH_TEST_TASK_APPEND_ID,
    author: 'test-agent',
    type: 'task',
    priority: 'high',
    contentPreview: 'Test task',
    createdAt: now,
  });

  await db.insert(appends).values({
    id: `${ORCH_TEST_FILE_ID}_${ORCH_TEST_PENDING_TASK_APPEND_ID}`,
    fileId: ORCH_TEST_FILE_ID,
    appendId: ORCH_TEST_PENDING_TASK_APPEND_ID,
    author: 'pending-agent',
    type: 'task',
    priority: 'low',
    contentPreview: 'Pending test task',
    createdAt: now,
  });

  const expiresAt = new Date(Date.now() + 300000).toISOString();
  await db.insert(appends).values({
    id: `${ORCH_TEST_FILE_ID}_${ORCH_TEST_CLAIM_APPEND_ID}`,
    fileId: ORCH_TEST_FILE_ID,
    appendId: ORCH_TEST_CLAIM_APPEND_ID,
    author: 'claimer-agent',
    type: 'claim',
    ref: ORCH_TEST_TASK_APPEND_ID,
    status: 'active',
    expiresAt,
    createdAt: now,
  });

  return {
    fileId: ORCH_TEST_FILE_ID,
    taskAppendId: ORCH_TEST_TASK_APPEND_ID,
    claimAppendId: ORCH_TEST_CLAIM_APPEND_ID,
  };
}
