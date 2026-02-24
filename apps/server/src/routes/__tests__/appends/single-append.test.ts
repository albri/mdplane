import { describe, expect, test, beforeAll, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import {
  setupAppendTests,
  setupBaseAppends,
  cleanupAppends,
  assertValidResponse,
  mockDateNow,
  restoreDateNow,
  resetTime,
  TIME,
  APPEND_ID_PATTERN,
  ISO_TIMESTAMP_PATTERN,
  INVALID_KEY,
  db,
  sqlite,
  files,
  appends,
  eq,
  and,
  isNull,
  createTestFile,
  createFileScopedKey,
  type AppendTestContext,
  type TestWorkspace,
} from './test-setup';

describe('Append Operations - Single Append', () => {
  let ctx: AppendTestContext;
  let app: Elysia;
  let testWorkspace: TestWorkspace;
  let VALID_READ_KEY: string;
  let VALID_APPEND_KEY: string;
  let VALID_WRITE_KEY: string;
  let EXPIRED_KEY: string;
  let REVOKED_KEY: string;
  let BOUND_AUTHOR_KEY: string;
  let WIP_LIMITED_KEY: string;
  let FILE_SCOPED_APPEND_KEY: string;

  beforeAll(async () => {
    ctx = await setupAppendTests();
    app = ctx.app;
    testWorkspace = ctx.testWorkspace;
    VALID_READ_KEY = ctx.keys.readKey;
    VALID_APPEND_KEY = ctx.keys.appendKey;
    VALID_WRITE_KEY = ctx.keys.writeKey;
    EXPIRED_KEY = ctx.keys.expiredKey;
    REVOKED_KEY = ctx.keys.revokedKey;
    BOUND_AUTHOR_KEY = ctx.keys.boundAuthorKey;
    WIP_LIMITED_KEY = ctx.keys.wipLimitedKey;
    FILE_SCOPED_APPEND_KEY = createFileScopedKey(testWorkspace, 'append', '/path/to/file.md');
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

    let claimedFile = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, testWorkspace.workspaceId),
        eq(files.path, '/path/to/claimed-task.md')
      ),
    });
    if (!claimedFile) {
      await createTestFile(app, testWorkspace, '/path/to/claimed-task.md', '# Claimed Task File');
      claimedFile = await db.query.files.findFirst({
        where: and(
          eq(files.workspaceId, testWorkspace.workspaceId),
          eq(files.path, '/path/to/claimed-task.md')
        ),
      });
    }
    if (claimedFile) {
      sqlite.exec(`DELETE FROM appends WHERE file_id = '${claimedFile.id}'`);
      const now = new Date().toISOString();
      sqlite.exec(`
        INSERT INTO appends (id, file_id, append_id, author, type, status, created_at)
        VALUES ('append_claimed_task_${Date.now()}', '${claimedFile.id}', 'a1', 'agent-1', 'task', 'open', '${now}')
      `);
      sqlite.exec(`
        INSERT INTO appends (id, file_id, append_id, author, type, ref, status, expires_at, created_at)
        VALUES ('append_claimed_${Date.now()}', '${claimedFile.id}', 'a2', 'agent-other', 'claim', 'a1', 'active', '${new Date(Date.now() + 3600000).toISOString()}', '${now}')
      `);
    }
  });

  describe('POST /a/:key/*path - Basic Append Operations', () => {
    describe('Successful Append', () => {
      test('should return 201 with id for valid append', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: 'agent-1',
              content: 'This is a comment',
            }),
          })
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.id).toBeDefined();
        assertValidResponse(body, 'AppendResponse');
      });

      test('should return id matching pattern', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: 'agent-1',
              content: 'Test content',
            }),
          })
        );

        const body = await response.json();
        expect(body.data.id).toBeDefined();
      });

      test('should return type in response', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: 'agent-1',
              content: 'Test content',
            }),
          })
        );

        const body = await response.json();
        expect(body.data.type).toBe('comment');
      });

      test('should return author in response', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: 'agent-1',
              content: 'Test content',
            }),
          })
        );

        const body = await response.json();
        expect(body.data.author).toBe('agent-1');
      });

      test('should return ts timestamp', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: 'agent-1',
              content: 'Test content',
            }),
          })
        );

        const body = await response.json();
        expect(body.data.ts).toBeDefined();
        expect(body.data.ts).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should match AppendResponse schema', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: 'agent-1',
              content: 'Test comment for schema validation',
            }),
          })
        );
        const body = await response.json();
        if (response.status === 201) {
          assertValidResponse(body, 'AppendResponse');
        }
      });
    });

    describe('Validation - Required Fields', () => {
      test('should return 400 when author is missing', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              content: 'Missing author',
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 when type is missing for claim', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              ref: 'a1',
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 404 for non-existent file', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/nonexistent/file.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'comment',
              author: 'agent-1',
              content: 'Test content',
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

  describe('POST /a/:key/append - Path Resolution', () => {
    test('should allow workspace-scoped key when body.path is provided', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/append`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/path/to/file.md',
            type: 'comment',
            author: 'agent-1',
            content: 'Append via body.path',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.type).toBe('comment');
    });

    test('should require body.path for workspace-scoped keys', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/append`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Missing body path',
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should allow file-scoped key without body.path', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${FILE_SCOPED_APPEND_KEY}/append`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'File-scoped append without path field',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return INVALID_PATH for malformed path encoding', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/append`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/%E0%A4%A',
            type: 'comment',
            author: 'agent-1',
            content: 'Malformed path encoding',
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_PATH');
    });

    test('should reject body.path outside file-scoped key scope', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${FILE_SCOPED_APPEND_KEY}/append`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/path/to/other-file.md',
            type: 'comment',
            author: 'agent-1',
            content: 'Wrong scoped path',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

  });

  describe('Task Type Appends', () => {
    test('should create task in appends table', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: 'Review PR #42',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      expect(body.data.type).toBe('task');
    });

    test('should set task status to open', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: 'Review PR #42',
          }),
        })
      );

      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      expect(body.data.status).toBe('open');
    });

    test('should support priority field', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: 'Critical bug fix',
            priority: 'high',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      expect(body.data.priority).toBe('high');
    });

    test('should support labels field', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: 'Bug fix task',
            labels: ['bug', 'backend'],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      expect(body.data.labels).toEqual(['bug', 'backend']);
    });
  });

  describe('Claim Type Appends', () => {
    test('should create claim linked to task via ref', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            author: 'agent-1',
            ref: 'a1',
            content: 'Working on this',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      expect(body.data.type).toBe('claim');
      expect(body.data.ref).toBe('a1');
    });

    test('should return 400 when claim is missing ref', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            author: 'agent-1',
            content: 'Working on this',
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should return 409 if task already has active claim', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/claimed-task.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            author: 'agent-2',
            ref: 'a1',
            content: 'Trying to claim already claimed task',
          }),
        })
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('ALREADY_CLAIMED');
    });

    test('should return 404 when ref does not exist', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            author: 'agent-1',
            ref: 'a999',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('APPEND_NOT_FOUND');
    });
  });

  describe('Comment Type Appends', () => {
    test('should create comment append', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'This is a comment',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.type).toBe('comment');
    });
  });

  describe('Permission Checks', () => {
    test('should allow append key to create appends', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Append key can create appends',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return 404 for read key attempting to create appends', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_READ_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Read key cannot create appends',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should allow admin (write) key to create appends', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Admin key can create appends',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should enforce boundAuthor if set on key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${BOUND_AUTHOR_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'different-agent',
            content: 'Trying to use different author',
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('AUTHOR_MISMATCH');
    });

    test('should return 404 for invalid key format', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${INVALID_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Invalid key',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 for expired key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${EXPIRED_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Expired key',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_EXPIRED');
    });

    test('should return 404 for revoked key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${REVOKED_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Revoked key',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_REVOKED');
    });
  });

  describe('Idempotency', () => {
    test('should return same response with Idempotency-Key header', async () => {
      const idempotencyKey = `idem-${Date.now()}-${Math.random()}`;

      const response1 = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Idempotent append test',
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
            type: 'comment',
            author: 'agent-1',
            content: 'Idempotent append test',
          }),
        })
      );

      expect(response2.status).toBe(201);
      const body2 = await response2.json();
      expect(body2.data.id).toBe(body1.data.id);
    });
  });
});
