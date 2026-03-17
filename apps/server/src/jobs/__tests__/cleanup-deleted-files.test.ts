import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { cleanupDeletedFiles } from '../cleanup-deleted-files';
import { runMigrations } from '../../db/migrate';
import * as schema from '../../db/schema';
import { files, workspaces } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

describe('cleanupDeletedFiles', () => {
  const testWorkspaceId = 'test-ws-cleanup';
  let sqlite: Database;
  let testDb: BunSQLiteDatabase<typeof schema>;

  beforeEach(async () => {
    sqlite = runMigrations(':memory:');
    testDb = drizzle(sqlite, { schema });

    const now = new Date();

    await testDb.insert(workspaces).values({
      id: testWorkspaceId,
      name: 'Test Cleanup Workspace',
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
    });
  });

  afterEach(() => {
    sqlite.close();
  });

  test('should purge files deleted more than 7 days ago', async () => {
    const now = new Date();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const fileId = 'file-old-deleted';

    await testDb.insert(files).values({
      id: fileId,
      workspaceId: testWorkspaceId,
      path: '/old-deleted.md',
      content: 'Old deleted content',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: eightDaysAgo,
    });

    await cleanupDeletedFiles(testDb);

    const result = await testDb.query.files.findFirst({
      where: eq(files.id, fileId),
    });
    expect(result).toBeUndefined();
  });

  test('should NOT purge files deleted less than 7 days ago', async () => {
    const now = new Date();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fileId = 'file-recent-deleted';

    await testDb.insert(files).values({
      id: fileId,
      workspaceId: testWorkspaceId,
      path: '/recent-deleted.md',
      content: 'Recently deleted content',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: threeDaysAgo,
    });

    await cleanupDeletedFiles(testDb);

    const result = await testDb.query.files.findFirst({
      where: eq(files.id, fileId),
    });
    expect(result).toBeDefined();
    expect(result?.deletedAt).toBe(threeDaysAgo);
  });

  test('should NOT touch non-deleted files', async () => {
    const now = new Date();
    const fileId = 'file-active';

    await testDb.insert(files).values({
      id: fileId,
      workspaceId: testWorkspaceId,
      path: '/active.md',
      content: 'Active file content',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: null,
    });

    await cleanupDeletedFiles(testDb);

    const result = await testDb.query.files.findFirst({
      where: eq(files.id, fileId),
    });
    expect(result).toBeDefined();
    expect(result?.deletedAt).toBeNull();
  });

  test('should purge multiple old files in one run', async () => {
    const now = new Date();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    await testDb.insert(files).values([
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

    await cleanupDeletedFiles(testDb);

    const result1 = await testDb.query.files.findFirst({ where: eq(files.id, 'file-old-1') });
    const result2 = await testDb.query.files.findFirst({ where: eq(files.id, 'file-old-2') });

    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();
  });
});
