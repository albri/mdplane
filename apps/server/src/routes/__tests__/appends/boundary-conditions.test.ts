import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, type TestContext } from './test-setup';
import { LIMITS } from '@mdplane/shared';

describe('Append Boundary Conditions', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  describe('WIP Limit Boundaries', () => {
    test('should block claim when at exactly WIP limit', async () => {
      const wipKey = await ctx.createKeyWithWipLimit(1);

      const task1Res = await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task 1' }),
        })
      );
      const task1 = await task1Res.json();

      const task2Res = await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task 2' }),
        })
      );
      const task2 = await task2Res.json();

      const claim1Res = await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: task1.data.id }),
        })
      );
      expect(claim1Res.status).toBe(201);

      const claim2Res = await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: task2.data.id }),
        })
      );
      expect(claim2Res.status).toBe(429);
    });

    test('should allow non-claim appends when at WIP limit', async () => {
      const wipKey = await ctx.createKeyWithWipLimit(1);

      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const task = await taskRes.json();

      await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: task.data.id }),
        })
      );

      const commentRes = await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'comment', content: 'A comment' }),
        })
      );
      expect(commentRes.status).toBe(201);
    });
  });

  describe('Append Content Size Limits', () => {
    test('should accept append with minimal content (1 character)', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'comment', content: 'x' }),
        })
      );
      expect(res.status).toBe(201);
    });

    test('should accept append with empty content string', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'comment', content: '' }),
        })
      );
      expect(res.status).toBe(201);
    });

    test('should accept append at 100KB', async () => {
      const content = 'x'.repeat(100 * 1024);
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'comment', content }),
        })
      );
      expect(res.status).toBe(201);
    });

    test('should document MAX_APPEND_SIZE is 1MB', () => {
      const expectedMaxAppendSize = 1 * 1024 * 1024;
      expect(expectedMaxAppendSize).toBe(1048576);
      expect(LIMITS.APPEND_MAX_SIZE_BYTES === 1048576).toBe(true);
    });
  });

  describe('First Append to File', () => {
    test('should create first append with id a1 pattern', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'comment', content: 'First' }),
        })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.id).toBe('a1');
    });
  });

  describe('Author Field Limits', () => {
    test('should accept author with single character', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'x', type: 'comment', content: 'Test' }),
        })
      );
      expect(res.status).toBe(201);
    });

    test('should accept author at reasonable length (64 chars)', async () => {
      const author = 'a'.repeat(64);
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author, type: 'comment', content: 'Test' }),
        })
      );
      expect(res.status).toBe(201);
    });
  });

  describe('Ref Field Boundaries', () => {
    test('should handle ref to first append (a1)', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const task = await taskRes.json();
      expect(task.data.id).toBe('a1');

      const claimRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: 'a1' }),
        })
      );
      expect(claimRes.status).toBe(201);
    });

    test('should handle ref with high append number', async () => {
      for (let i = 0; i < 5; i++) {
        await ctx.app.handle(
          new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author: 'user1', type: 'comment', content: `Comment ${i}` }),
          })
        );
      }

      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const task = await taskRes.json();
      expect(task.data.id).toBe('a6');

      const claimRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: 'a6' }),
        })
      );
      expect(claimRes.status).toBe(201);
    });
  });
});

