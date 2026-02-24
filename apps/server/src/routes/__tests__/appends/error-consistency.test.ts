import { describe, test, expect, beforeEach } from 'bun:test';
import {
  setupAppendTests,
  type AppendTestContext,
  createTestFile,
} from './test-setup';

describe('Error Response Consistency', () => {
  let ctx: AppendTestContext;

  beforeEach(async () => {
    ctx = await setupAppendTests();
    await createTestFile(ctx.app, ctx.testWorkspace, '/test.md', '# Test');
  });

  describe('Error Structure Consistency', () => {
    test('400 errors should have standard structure', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'comment', content: 'Missing author' }),
        })
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBeDefined();
      expect(data.error.message).toBeDefined();
    });

    test('404 errors for expired keys should have standard structure', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.expiredKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'comment', content: 'Test' }),
        })
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBeDefined();
    });

    test('404 errors should have standard structure', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.appendKey}/nonexistent.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'comment', content: 'Test' }),
        })
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBeDefined();
    });

    test('429 errors should have standard structure with details', async () => {
      const wipKey = ctx.keys.wipLimitedKey;

      // Create task and claim to hit WIP limit
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task 1' }),
        })
      );
      const task1 = await taskRes.json();

      const task2Res = await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task 2' }),
        })
      );
      const task2 = await task2Res.json();

      const task3Res = await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task 3' }),
        })
      );
      const task3 = await task3Res.json();

      // Claim first two tasks (WIP limit is 2)
      await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: task1.data.id }),
        })
      );
      await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: task2.data.id }),
        })
      );

      // Third claim should hit WIP limit
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${wipKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: task3.data.id }),
        })
      );
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('WIP_LIMIT_EXCEEDED');
    });
  });

  describe('Error Code Consistency', () => {
    test('should use KEY_EXPIRED for expired keys (with 404)', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.expiredKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'comment', content: 'Test' }),
        })
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error.code).toBe('KEY_EXPIRED');
    });

    test('should use KEY_REVOKED for revoked keys (with 404)', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.revokedKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'comment', content: 'Test' }),
        })
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error.code).toBe('KEY_REVOKED');
    });

    test('should use ALREADY_CLAIMED for duplicate claims', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const task = await taskRes.json();

      await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: task.data.id }),
        })
      );

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user2', type: 'claim', ref: task.data.id }),
        })
      );
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error.code).toBe('ALREADY_CLAIMED');
    });
  });

  describe('HTTP Status Code Consistency', () => {
    test('400 should be used for validation/bad request errors', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: '', type: 'comment', content: 'Test' }),
        })
      );
      expect(res.status).toBe(400);
    });

    test('404 should be used for authentication issues (capability URL security)', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.expiredKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'comment', content: 'Test' }),
        })
      );
      expect(res.status).toBe(404);
    });
  });

  describe('Error Message Quality', () => {
    test('error messages should be human-readable', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'comment', content: 'Missing author' }),
        })
      );
      const data = await res.json();
      expect(data.error.message.length).toBeGreaterThan(5);
      expect(data.error.message).not.toMatch(/undefined|null|NaN/i);
    });

    test('error messages should not expose internal details', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.keys.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'comment', content: 'Missing author' }),
        })
      );
      const data = await res.json();
      expect(data.error.message).not.toMatch(/stack|trace|sql|query|database/i);
    });
  });
});

