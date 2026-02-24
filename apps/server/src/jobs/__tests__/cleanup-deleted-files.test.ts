import { describe, test, expect, beforeEach } from 'bun:test';
import { cleanupDeletedFiles } from '../cleanup-deleted-files';
import { db } from '../../db';
import { files, workspaces } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('cleanupDeletedFiles', () => {
  const testWorkspaceId = 'test-ws-cleanup';
  const now = new Date();

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(files).where(eq(files.workspaceId, testWorkspaceId));
    await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));

    // Create test workspace
    await db.insert(workspaces).values({
      id: testWorkspaceId,
      name: 'Test Cleanup Workspace',
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
    });
  });

  test('should purge files deleted more than 7 days ago', async () => {
    // Create file with deletedAt 8 days ago
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const fileId = 'file-old-deleted';

    await db.insert(files).values({
      id: fileId,
      workspaceId: testWorkspaceId,
      path: '/old-deleted.md',
      content: 'Old deleted content',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: eightDaysAgo,
    });

    // Run cleanup
    await cleanupDeletedFiles();

    // Verify file is gone
    const result = await db.query.files.findFirst({
      where: eq(files.id, fileId),
    });
    expect(result).toBeUndefined();
  });

  test('should NOT purge files deleted less than 7 days ago', async () => {
    // Create file with deletedAt 3 days ago
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fileId = 'file-recent-deleted';

    await db.insert(files).values({
      id: fileId,
      workspaceId: testWorkspaceId,
      path: '/recent-deleted.md',
      content: 'Recently deleted content',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: threeDaysAgo,
    });

    // Run cleanup
    await cleanupDeletedFiles();

    // Verify file still exists
    const result = await db.query.files.findFirst({
      where: eq(files.id, fileId),
    });
    expect(result).toBeDefined();
    expect(result?.deletedAt).toBe(threeDaysAgo);
  });

  test('should NOT touch non-deleted files', async () => {
    // Create file with no deletedAt
    const fileId = 'file-active';

    await db.insert(files).values({
      id: fileId,
      workspaceId: testWorkspaceId,
      path: '/active.md',
      content: 'Active file content',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: null,
    });

    // Run cleanup
    await cleanupDeletedFiles();

    // Verify file still exists
    const result = await db.query.files.findFirst({
      where: eq(files.id, fileId),
    });
    expect(result).toBeDefined();
    expect(result?.deletedAt).toBeNull();
  });

  test('should purge multiple old files in one run', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    // Create multiple old deleted files
    await db.insert(files).values([
      {
        id: 'file-old-1',
        workspaceId: testWorkspaceId,
        path: '/old1.md',
        content: 'Old 1',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        deletedAt: eightDaysAgo,
      },
      {
        id: 'file-old-2',
        workspaceId: testWorkspaceId,
        path: '/old2.md',
        content: 'Old 2',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        deletedAt: tenDaysAgo,
      },
    ]);

    // Run cleanup
    await cleanupDeletedFiles();

    // Verify both files are gone
    const result1 = await db.query.files.findFirst({ where: eq(files.id, 'file-old-1') });
    const result2 = await db.query.files.findFirst({ where: eq(files.id, 'file-old-2') });

    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();
  });
});

