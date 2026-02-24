import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import {
  setupAppendTests,
  APPEND_ID_PATTERN,
  db,
  sqlite,
  files,
  eq,
  and,
  type AppendTestContext,
} from './test-setup';

describe('Append Operations - Input Validation', () => {
  let ctx: AppendTestContext;
  let app: Elysia;
  let VALID_APPEND_KEY: string;

  beforeAll(async () => {
    ctx = await setupAppendTests();
    app = ctx.app;
    VALID_APPEND_KEY = ctx.keys.appendKey;
  });

  beforeEach(async () => {
    const currentTestFile = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, ctx.testWorkspace.workspaceId),
        eq(files.path, '/path/to/file.md')
      ),
    });
    if (currentTestFile) {
      sqlite.exec(`DELETE FROM appends WHERE file_id = '${currentTestFile.id}'`);
    }
  });

  describe('String Input Validation', () => {
    test('should return 201 for empty string content', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: '',
          }),
        })
      );
      expect(response.status).toBe(201);
    });

    test('should return 201 for whitespace-only content', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: '   \n\t   ',
          }),
        })
      );
      expect(response.status).toBe(201);
    });

    test('should handle very long content string (>10000 chars)', async () => {
      const longContent = 'x'.repeat(10001);
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: longContent,
          }),
        })
      );
      expect(response.status).toBe(201);
    });

    test('should handle string with only newlines', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: '\n\n\n',
          }),
        })
      );
      expect(response.status).toBe(201);
    });

    test('should accept content with unicode characters', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'こんにちは 世界 مرحبا',
          }),
        })
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should accept content with emojis', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Testing 🚀 with 🎉 emojis 💯',
          }),
        })
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should accept content with control characters', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Contains \x00 null byte',
          }),
        })
      );
      expect(response.status).toBe(201);
    });
  });

  describe('Author Validation', () => {
    test('should return 400 for empty author', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: '',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for author with only spaces', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: '   ',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_AUTHOR');
    });

    test('should return 400 for author with special characters', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent@domain.com',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_AUTHOR');
    });

    test('should return 400 for very long author (>64 chars)', async () => {
      const longAuthor = 'a'.repeat(65);
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: longAuthor,
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_AUTHOR');
    });

    test('should return 400 for reserved author name "system"', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'system',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_AUTHOR');
    });

    test('should accept "admin" as author (not reserved)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'admin',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(201);
    });

    test('should accept valid author with underscores and hyphens', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent_1-test',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });
  });

  describe('Type Field Validation', () => {
    test('should return 400 for unknown append type', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'unknown_type',
            author: 'agent-1',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for empty type', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: '',
            author: 'agent-1',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for type in wrong case (COMMENT vs comment)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'COMMENT',
            author: 'agent-1',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for type with leading/trailing whitespace', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: ' comment ',
            author: 'agent-1',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });

  describe('JSON Validation', () => {
    test('should return 400 for empty object {}', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should return 400 for null value for required field', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: null,
            author: 'agent-1',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for wrong type (number instead of string for type)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 123,
            author: 'agent-1',
            content: 'Test content',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should ignore extra unexpected fields', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: 'Test content',
            extraField: 'should be ignored',
            anotherExtra: 123,
          }),
        })
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return 400 for deeply nested object in content', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'agent-1',
            content: { nested: { deeply: { value: 'test' } } },
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for array where object expected', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            { type: 'comment', author: 'agent-1', content: 'Test' },
          ]),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });

  describe('Ref Field Validation', () => {
    test('should return 400 for invalid ref format (not aNN)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            author: 'agent-1',
            ref: 'invalid-ref',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 404 for ref with leading zeros (a01 format accepted)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            author: 'agent-1',
            ref: 'a01',
          }),
        })
      );
      expect(response.status).toBe(404);
    });

    test('should return 400 for ref with negative number', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            author: 'agent-1',
            ref: 'a-1',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for empty ref', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            author: 'agent-1',
            ref: '',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });

  describe('Labels Array Validation', () => {
    test('should accept empty labels array', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: 'Task with no labels',
            labels: [],
          }),
        })
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return 400 for labels as string instead of array', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: 'Task content',
            labels: 'bug',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for labels with non-string items', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: 'Task content',
            labels: [123, 'valid', null],
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });

  describe('Vote Value Validation', () => {
    test('should return 400 for vote with invalid value', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'vote',
            author: 'agent-1',
            ref: 'a1',
            value: '0',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for vote with value as number instead of string', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'vote',
            author: 'agent-1',
            ref: 'a1',
            value: 1,
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for vote with value "+2"', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'vote',
            author: 'agent-1',
            ref: 'a1',
            value: '+2',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });

  describe('Priority Field Validation', () => {
    test('should return 400 for invalid priority value', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: 'Task content',
            priority: 'urgent',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for priority in wrong case', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: 'Task content',
            priority: 'HIGH',
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return 400 for priority as number', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'agent-1',
            content: 'Task content',
            priority: 1,
          }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });
});

