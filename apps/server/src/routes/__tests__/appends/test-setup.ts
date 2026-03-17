import { Elysia } from 'elysia';
import { createTestApp } from '../../../../tests/helpers/test-app';
import {
  createTestWorkspace,
  createTestFile,
  createExpiredKey,
  createRevokedKey,
  createBoundAuthorKey,
  createWipLimitedKey,
  createFolderScopedKey,
  createFileScopedKey,
  createAllowedTypesKey,
  type TestWorkspace,
  type TestFile,
} from '../../../../tests/fixtures';
import { db, sqlite } from '../../../db';
import { files, appends } from '../../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export { assertValidResponse } from '../../../../tests/helpers/schema-validator';
export {
  mockDateNow,
  restoreDateNow,
  resetTime,
  TIME,
} from '../../../../tests/helpers/time';
export type { TestWorkspace, TestFile };

export const APPEND_ID_PATTERN = /^a\d+$/;
export const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
export const INVALID_KEY = 'short';

export interface AppendTestContext {
  app: Elysia;
  testWorkspace: TestWorkspace;
  testFile: TestFile;
  keys: {
    readKey: string;
    appendKey: string;
    writeKey: string;
    expiredKey: string;
    revokedKey: string;
    boundAuthorKey: string;
    wipLimitedKey: string;
    folderScopedKey?: string;
    fileScopedKey?: string;
    allowedTypesKey?: string;
  };
}

export async function setupAppendTests(): Promise<AppendTestContext> {
  const app = createTestApp();
  const testWorkspace = await createTestWorkspace(app);

  const keys = {
    readKey: testWorkspace.readKey,
    appendKey: testWorkspace.appendKey,
    writeKey: testWorkspace.writeKey,
    expiredKey: createExpiredKey(testWorkspace, 'append'),
    revokedKey: createRevokedKey(testWorkspace, 'append'),
    boundAuthorKey: createBoundAuthorKey(testWorkspace, 'append', 'bound-agent'),
    wipLimitedKey: createWipLimitedKey(testWorkspace, 'append', 2),
  };

  const testFile = await createTestFile(app, testWorkspace, '/path/to/file.md', '# Test File');

  return { app, testWorkspace, testFile, keys };
}

export async function setupBaseAppends(
  testWorkspace: TestWorkspace,
  fileId: string
): Promise<void> {
  const now = new Date().toISOString();

  sqlite.exec(`
    INSERT INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_1_${Date.now()}', '${fileId}', 'a1', 'agent-1', 'task', 'open', '${now}')
  `);

  sqlite.exec(`
    INSERT INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_4_${Date.now()}', '${fileId}', 'a4', 'agent-1', 'task', 'open', '${now}')
  `);

  sqlite.exec(`
    INSERT INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
    VALUES ('append_2_${Date.now()}', '${fileId}', 'a2', 'agent-1', 'claim', 'a4', 'active', '${new Date(Date.now() + 3600000).toISOString()}', '${now}')
  `);

  sqlite.exec(`
    INSERT INTO appends (id, file_id, append_id, author, type, ref, status, created_at)
    VALUES ('append_3_${Date.now()}', '${fileId}', 'a3', 'agent-1', 'blocked', 'a1', 'active', '${now}')
  `);

  sqlite.exec(`
    INSERT INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_wip_task_${Date.now()}', '${fileId}', 'a5', 'agent-1', 'task', 'open', '${now}')
  `);

  sqlite.exec(`
    INSERT INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_wip_task_1_${Date.now()}', '${fileId}', 'a6', 'agent-1', 'task', 'open', '${now}')
  `);

  sqlite.exec(`
    INSERT INTO appends (id, file_id, append_id, author, type, status, created_at)
    VALUES ('append_wip_task_2_${Date.now()}', '${fileId}', 'a7', 'agent-1', 'task', 'open', '${now}')
  `);

  sqlite.exec(`
    INSERT INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
    VALUES ('append_wip_1_${Date.now()}', '${fileId}', 'a10', 'agent-1', 'claim', 'a6', 'active', '${new Date(Date.now() + 3600000).toISOString()}', '${now}')
  `);

  sqlite.exec(`
    INSERT INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
    VALUES ('append_wip_2_${Date.now()}', '${fileId}', 'a11', 'agent-1', 'claim', 'a7', 'active', '${new Date(Date.now() + 3600000).toISOString()}', '${now}')
  `);
}

export async function cleanupAppends(fileId: string): Promise<void> {
  sqlite.exec(`DELETE FROM appends WHERE file_id = '${fileId}'`);
}

export { db, sqlite, files, appends, eq, and, isNull, createTestFile, createFolderScopedKey, createFileScopedKey, createAllowedTypesKey, createWipLimitedKey };

/**
 * Simplified test context for new test files.
 */
export interface TestContext {
  app: Elysia;
  appendKey: string;
  writeKey: string;
  testWorkspace: TestWorkspace;
  createKeyWithWipLimit: (limit: number) => Promise<string>;
}

export async function createTestContext(): Promise<TestContext> {
  const ctx = await setupAppendTests();
  await createTestFile(ctx.app, ctx.testWorkspace, '/test.md', '# Test');

  return {
    app: ctx.app,
    appendKey: ctx.keys.appendKey,
    writeKey: ctx.keys.writeKey,
    testWorkspace: ctx.testWorkspace,
    createKeyWithWipLimit: async (limit: number) => {
      return createWipLimitedKey(ctx.testWorkspace, 'append', limit);
    },
  };
}
