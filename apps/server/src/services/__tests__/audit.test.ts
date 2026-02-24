import { describe, expect, test, beforeEach } from 'bun:test';
import { sqlite } from '../../db';
import { logAction, getAuditLogs, forceFlushAuditQueue, clearAuditQueue } from '../audit';

const TEST_WORKSPACE_ID = 'ws_test_audit';

function ensureAuditWorkspace(workspaceId: string): void {
  const now = new Date().toISOString();

  sqlite.query(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, last_activity_at)
    VALUES (?, ?, ?, ?)
  `).run(workspaceId, 'Test Workspace Audit', now, now);
}

function resetAuditLogsForWorkspace(workspaceId: string): void {
  sqlite.query(`DELETE FROM audit_logs WHERE workspace_id = ?`).run(workspaceId);
}

describe('Audit Service', () => {
  beforeEach(() => {
    clearAuditQueue();
    ensureAuditWorkspace(TEST_WORKSPACE_ID);
    resetAuditLogsForWorkspace(TEST_WORKSPACE_ID);
  });

  describe('logAction', () => {
    test('should create an audit log entry', async () => {
      const id = logAction({
        workspaceId: TEST_WORKSPACE_ID,
        action: 'file.create',
        resourceType: 'file',
        resourceId: 'file_123',
        resourcePath: '/path/to/file.md',
        actor: 'agent-1',
        actorType: 'capability_url',
      });

      expect(id).toBeDefined();
      expect(id).toMatch(/^audit_/);
    });

    test('should store metadata as JSON', async () => {
      const metadata = { oldContent: 'old', newContent: 'new' };
      logAction({
        workspaceId: TEST_WORKSPACE_ID,
        action: 'file.update',
        resourceType: 'file',
        metadata,
      });
      await forceFlushAuditQueue();

      const result = await getAuditLogs(TEST_WORKSPACE_ID);
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].metadata).toEqual(metadata);
    });

    test('should store IP address and user agent', async () => {
      logAction({
        workspaceId: TEST_WORKSPACE_ID,
        action: 'file.delete',
        resourceType: 'file',
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      });
      await forceFlushAuditQueue();

      const result = await getAuditLogs(TEST_WORKSPACE_ID);
      expect(result.logs[0].ipAddress).toBe('192.168.1.1');
      expect(result.logs[0].userAgent).toBe('TestAgent/1.0');
    });
  });

  describe('getAuditLogs', () => {
    test('should return logs ordered by createdAt descending', async () => {
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
      await forceFlushAuditQueue();
      await new Promise((resolve) => setTimeout(resolve, 50));
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.update', resourceType: 'file' });
      await forceFlushAuditQueue();

      const result = await getAuditLogs(TEST_WORKSPACE_ID);
      expect(result.logs.length).toBe(2);
      const actions = result.logs.map((log) => log.action);
      expect(actions).toContain('file.create');
      expect(actions).toContain('file.update');
      expect(result.logs[0].createdAt.getTime()).toBeGreaterThanOrEqual(result.logs[1].createdAt.getTime());
    });

    test('should filter by action', async () => {
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.update', resourceType: 'file' });
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.delete', resourceType: 'file' });
      await forceFlushAuditQueue();

      const result = await getAuditLogs(TEST_WORKSPACE_ID, { action: 'file.update' });
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].action).toBe('file.update');
    });

    test('should return total count matching filter', async () => {
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.update', resourceType: 'file' });
      await forceFlushAuditQueue();

      const result = await getAuditLogs(TEST_WORKSPACE_ID, { action: 'file.create' });
      expect(result.logs.length).toBe(2);
      expect(result.pagination.total).toBe(2);
    });

    test('should filter by resourceType', async () => {
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'key.create', resourceType: 'key' });
      await forceFlushAuditQueue();

      const result = await getAuditLogs(TEST_WORKSPACE_ID, { resourceType: 'key' });
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].resourceType).toBe('key');
    });

    test('should filter by actor', async () => {
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file', actor: 'agent-1' });
      logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.update', resourceType: 'file', actor: 'agent-2' });
      await forceFlushAuditQueue();

      const result = await getAuditLogs(TEST_WORKSPACE_ID, { actor: 'agent-1' });
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].actor).toBe('agent-1');
    });

    test('should support cursor-based pagination', async () => {
      for (let i = 0; i < 5; i++) {
        logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
        await forceFlushAuditQueue();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const page1 = await getAuditLogs(TEST_WORKSPACE_ID, { limit: 2 });
      expect(page1.logs.length).toBe(2);
      expect(page1.pagination.limit).toBe(2);
      expect(page1.pagination.hasMore).toBe(true);
      expect(page1.pagination.cursor).toBeDefined();

      const page2 = await getAuditLogs(TEST_WORKSPACE_ID, { limit: 2, cursor: page1.pagination.cursor! });
      expect(page2.logs.length).toBe(2);
      expect(page2.pagination.hasMore).toBe(true);

      const page1Ids = page1.logs.map((log) => log.id);
      const page2Ids = page2.logs.map((log) => log.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }

      const page3 = await getAuditLogs(TEST_WORKSPACE_ID, { limit: 2, cursor: page2.pagination.cursor! });
      expect(page3.logs.length).toBe(1);
      expect(page3.pagination.hasMore).toBe(false);
      expect(page3.pagination.cursor).toBeNull();
    });

    test('should return total count and pagination info', async () => {
      for (let i = 0; i < 3; i++) {
        logAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
      }
      await forceFlushAuditQueue();

      const result = await getAuditLogs(TEST_WORKSPACE_ID, { limit: 1 });
      expect(result.pagination.total).toBe(3);
      expect(result.logs.length).toBe(1);
      expect(result.pagination.hasMore).toBe(true);
    });
  });
});
