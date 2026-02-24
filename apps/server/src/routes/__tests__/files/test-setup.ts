import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { eq, and, isNull } from 'drizzle-orm';

import { createTestApp } from '../../../../tests/helpers/test-app';
import {
  createTestWorkspace,
  createTestFile,
  createExpiredKey,
  createRevokedKey,
  createFileScopedKey,
  type TestWorkspace,
  type TestFile,
} from '../../../../tests/fixtures';
import { db, sqlite } from '../../../db';
import { files, appends } from '../../../db/schema';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

export {
  describe,
  expect,
  test,
  beforeAll,
  beforeEach,
  Elysia,
  eq,
  and,
  isNull,
  createTestApp,
  createTestWorkspace,
  createTestFile,
  createExpiredKey,
  createRevokedKey,
  createFileScopedKey,
  db,
  sqlite,
  files,
  appends,
  assertValidResponse,
};
export type { TestWorkspace, TestFile };

export const INVALID_KEY = 'short';
export const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export interface FileTestContext {
  app: Elysia;
  testWorkspace: TestWorkspace;
  testFile: TestFile;
  VALID_READ_KEY: string;
  VALID_WRITE_KEY: string;
  VALID_APPEND_KEY: string;
  EXPIRED_KEY: string;
  REVOKED_KEY: string;
  FILE_SCOPED_READ_KEY: string;
}

export async function setupFileTestContext(): Promise<FileTestContext> {
  const app = createTestApp();
  const testWorkspace = await createTestWorkspace(app);

  const VALID_READ_KEY = testWorkspace.readKey;
  const VALID_WRITE_KEY = testWorkspace.writeKey;
  const VALID_APPEND_KEY = testWorkspace.appendKey;
  const EXPIRED_KEY = createExpiredKey(testWorkspace, 'read');
  const REVOKED_KEY = createRevokedKey(testWorkspace, 'read');

  const testFile = await createTestFile(
    app,
    testWorkspace,
    '/path/to/file.md',
    '---\ntitle: Test File\nauthor: Test\n---\n# Test Content'
  );

  const FILE_SCOPED_READ_KEY = createFileScopedKey(testWorkspace, 'read', '/path/to/file.md');

  return {
    app,
    testWorkspace,
    testFile,
    VALID_READ_KEY,
    VALID_WRITE_KEY,
    VALID_APPEND_KEY,
    EXPIRED_KEY,
    REVOKED_KEY,
    FILE_SCOPED_READ_KEY,
  };
}

export async function resetTestFiles(ctx: FileTestContext): Promise<void> {
  const { testWorkspace, app } = ctx;

  // Clean up any files created by previous tests (except test files)
  sqlite.exec(`
    DELETE FROM appends
    WHERE file_id IN (
      SELECT id FROM files
      WHERE workspace_id = '${testWorkspace.workspaceId}'
      AND path NOT IN ('/path/to/file.md', '/existing/file.md', '/file.md')
    )
  `);
  sqlite.exec(`
    DELETE FROM files
    WHERE workspace_id = '${testWorkspace.workspaceId}'
    AND path NOT IN ('/path/to/file.md', '/existing/file.md', '/file.md')
  `);

  // Ensure /file.md exists for path normalization tests
  const rootFile = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, testWorkspace.workspaceId),
      eq(files.path, '/file.md')
    ),
  });
  if (!rootFile) {
    await createTestFile(app, testWorkspace, '/file.md', '# Root File');
  } else if (rootFile.deletedAt) {
    sqlite.exec(`UPDATE files SET deleted_at = NULL WHERE id = '${rootFile.id}'`);
  }

  // Reset test file to ensure consistent state
  const existingFile = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, testWorkspace.workspaceId),
      eq(files.path, '/path/to/file.md')
    ),
  });

  const testContent = '---\ntitle: Test File\nauthor: Test\n---\n# Test Content';
  if (!existingFile) {
    ctx.testFile = await createTestFile(app, testWorkspace, '/path/to/file.md', testContent);
  } else if (existingFile.deletedAt) {
    sqlite.exec(`UPDATE files SET deleted_at = NULL, content = '${testContent.replace(/'/g, "''")}' WHERE id = '${existingFile.id}'`);
  }

  // Ensure test append 'a1' exists
  const currentTestFile = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, testWorkspace.workspaceId),
      eq(files.path, '/path/to/file.md')
    ),
  });
  if (currentTestFile) {
    sqlite.exec(`DELETE FROM appends WHERE file_id = '${currentTestFile.id}' AND append_id = 'a1'`);
    const now = new Date().toISOString();
    sqlite.exec(`
      INSERT INTO appends (id, file_id, append_id, author, type, status, created_at, content_preview)
      VALUES ('${Date.now().toString(36)}', '${currentTestFile.id}', 'a1', 'test-agent', 'task', 'pending', '${now}', 'Test task content')
    `);
  }

  // Ensure /existing/file.md exists
  const existingFileEntry = await db.query.files.findFirst({
    where: and(
      eq(files.workspaceId, testWorkspace.workspaceId),
      eq(files.path, '/existing/file.md')
    ),
  });
  if (!existingFileEntry) {
    await createTestFile(app, testWorkspace, '/existing/file.md', '# Existing File');
  } else if (existingFileEntry.deletedAt) {
    sqlite.exec(`UPDATE files SET deleted_at = NULL WHERE id = '${existingFileEntry.id}'`);
  }
}

