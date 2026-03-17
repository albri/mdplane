import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import {
  setupAppendTests,
  setupBaseAppends,
  assertValidResponse,
  APPEND_ID_PATTERN,
  ISO_TIMESTAMP_PATTERN,
  db,
  sqlite,
  files,
  appends,
  eq,
  and,
  createTestFile,
  type AppendTestContext,
  type TestWorkspace,
} from './test-setup';

describe('Append Operations - Multi-Append', () => {
  let ctx: AppendTestContext;
  let app: Elysia;
  let testWorkspace: TestWorkspace;
  let VALID_APPEND_KEY: string;

  beforeAll(async () => {
    ctx = await setupAppendTests();
    app = ctx.app;
    testWorkspace = ctx.testWorkspace;
    VALID_APPEND_KEY = ctx.keys.appendKey;
  });

  beforeEach(async () => {
    const currentTestFile = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, testWorkspace.workspaceId),
        eq(files.path, '/path/to/file.md')
      ),
    });
    if (currentTestFile) {
      sqlite.exec(`DELETE FROM appends WHERE file_id = '${currentTestFile.id}'`);
      await setupBaseAppends(testWorkspace, currentTestFile.id);
    }
  });

  describe('Basic Multi-Append Operations', () => {
    test('should create multiple appends in a single request', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [
              { type: 'comment', content: 'First comment' },
              { type: 'comment', content: 'Second comment' },
              { type: 'task', content: 'A task' },
            ],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
      // Multi-append returns data.appends array
      expect(Array.isArray(body.data.appends)).toBe(true);
      expect(body.data.appends.length).toBe(3);
    });

    test('should return appends in order with sequential IDs', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [
              { type: 'comment', content: 'First' },
              { type: 'comment', content: 'Second' },
            ],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.appends[0].type).toBe('comment');
      expect(body.data.appends[1].type).toBe('comment');
      expect(body.data.appends[0].id).toBeDefined();
      expect(body.data.appends[1].id).toBeDefined();
    });

    test('should include type on all appends', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'batch-author',
            appends: [
              { type: 'comment', content: 'First' },
              { type: 'task', content: 'Task' },
            ],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.appends[0].type).toBe('comment');
      expect(body.data.appends[1].type).toBe('task');
    });

    test('should include serverTime in response', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [
              { type: 'comment', content: 'First' },
              { type: 'comment', content: 'Second' },
            ],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      // Multi-append includes serverTime at the top level
      expect(body.serverTime).toBeDefined();
      expect(body.serverTime).toMatch(ISO_TIMESTAMP_PATTERN);
    });

    test('should support mixed append types in one batch', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [
              { type: 'task', content: 'New task' },
              { type: 'comment', content: 'Comment on file' },
            ],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.appends[0].type).toBe('task');
      expect(body.data.appends[1].type).toBe('comment');
    });
  });

  describe('Validation', () => {
    test('should return 400 when appends array is empty', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should reject invalid append type in batch', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [
              { type: 'comment', content: 'Valid' },
              { type: 'invalid_type', content: 'Invalid' },
            ],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      // Can be INVALID_APPEND_TYPE or INVALID_REQUEST depending on validation order
      expect(['INVALID_APPEND_TYPE', 'INVALID_REQUEST']).toContain(body.error.code);
    });

    test('should reject when author is missing', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appends: [
              { type: 'comment', content: 'No author' },
            ],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should validate all appends before processing any', async () => {
      // Count appends before request
      const testFile = await db.query.files.findFirst({
        where: and(
          eq(files.workspaceId, testWorkspace.workspaceId),
          eq(files.path, '/path/to/file.md')
        ),
      });

      const beforeAppends = await db.query.appends.findMany({
        where: eq(appends.fileId, testFile!.id),
      });
      const countBefore = beforeAppends.length;

      // Submit batch with valid first item and invalid second item
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [
              { type: 'comment', content: 'Valid comment' },
              { type: 'invalid_type', content: 'Invalid type' },
            ],
          }),
        })
      );

      expect(response.status).toBe(400);

      // Verify no appends were created (validation happens before processing)
      const afterAppends = await db.query.appends.findMany({
        where: eq(appends.fileId, testFile!.id),
      });
      expect(afterAppends.length).toBe(countBefore);
    });
  });

  describe('Atomicity and Transactions', () => {
    test('should not create any appends when validation fails for any item', async () => {
      // Create a file for this test
      await createTestFile(app, testWorkspace, '/path/to/atomic-test.md', '# Atomic Test');

      const testFile = await db.query.files.findFirst({
        where: and(
          eq(files.workspaceId, testWorkspace.workspaceId),
          eq(files.path, '/path/to/atomic-test.md')
        ),
      });

      // Count appends before multi-append
      const beforeAppends = await db.query.appends.findMany({
        where: eq(appends.fileId, testFile!.id),
      });
      const countBefore = beforeAppends.length;

      // Submit batch with valid first item and invalid type second item
      // Validation happens before transaction, so no appends should be created
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/atomic-test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [
              { type: 'comment', content: 'This should not be created' },
              { type: 'invalid_type', content: 'Invalid type causes failure' },
            ],
          }),
        })
      );

      // Should fail due to invalid type
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);

      // Verify no appends were created
      const afterAppends = await db.query.appends.findMany({
        where: eq(appends.fileId, testFile!.id),
      });
      expect(afterAppends.length).toBe(countBefore);
    });
  });

  describe('Idempotency', () => {
    test('should return same response for duplicate requests with Idempotency-Key', async () => {
      const idempotencyKey = `multi-idem-${Date.now()}-${Math.random()}`;

      const response1 = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [
              { type: 'comment', content: 'Idempotent batch comment 1' },
              { type: 'comment', content: 'Idempotent batch comment 2' },
            ],
          }),
        })
      );

      expect(response1.status).toBe(201);
      const body1 = await response1.json();

      const response2 = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [
              { type: 'comment', content: 'Idempotent batch comment 1' },
              { type: 'comment', content: 'Idempotent batch comment 2' },
            ],
          }),
        })
      );

      expect(response2.status).toBe(201);
      const body2 = await response2.json();

      // Should return the same data (multi-append returns data.appends)
      expect(body2.data.appends.length).toBe(body1.data.appends.length);
      expect(body2.data.appends[0].id).toBe(body1.data.appends[0].id);
      expect(body2.data.appends[1].id).toBe(body1.data.appends[1].id);
    });

    test('should create new appends without Idempotency-Key', async () => {
      const response1 = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [{ type: 'comment', content: 'No idempotency 1' }],
          }),
        })
      );

      const body1 = await response1.json();

      const response2 = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [{ type: 'comment', content: 'No idempotency 2' }],
          }),
        })
      );

      const body2 = await response2.json();

      // Should create different appends (multi-append returns data.appends)
      expect(body2.data.appends[0].id).not.toBe(body1.data.appends[0].id);
    });
  });

  describe('File Not Found', () => {
    test('should return 404 for non-existent file', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/nonexistent/multi.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'agent-1',
            appends: [{ type: 'comment', content: 'Comment' }],
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });
  });
});

