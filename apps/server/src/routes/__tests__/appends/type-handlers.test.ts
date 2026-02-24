import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, type TestContext } from './test-setup';

describe('Append Type Handlers', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  describe('Response Type Appends', () => {
    test('should create response linked to task via ref', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Do something' }),
        })
      );
      const taskData = await taskRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'response', ref: taskData.data.id, content: 'Done' }),
        })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.ref).toBe(taskData.data.id);
    });

    test('should release active claim on response', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: taskData.data.id }),
        })
      );

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'response', ref: taskData.data.id, content: 'Done' }),
        })
      );
      expect(res.status).toBe(201);
    });

    test('should return 400 when response is missing ref', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'response', content: 'Done' }),
        })
      );
      expect(res.status).toBe(400);
    });

    test('should return 400 when response is missing content', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'response', ref: taskData.data.id }),
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe('Cancel Type Appends', () => {
    test('should release active claim on cancel', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      const claimRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: taskData.data.id }),
        })
      );
      const claimData = await claimRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'cancel', ref: claimData.data.id }),
        })
      );
      expect(res.status).toBe(201);
    });

    test('should return 400 when canceling another authors claim', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      const claimRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: taskData.data.id }),
        })
      );
      const claimData = await claimRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user2', type: 'cancel', ref: claimData.data.id }),
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe('Blocked Type Appends', () => {
    test('should create blocked append linked to task', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'blocked', ref: taskData.data.id, content: 'Waiting for API' }),
        })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.ref).toBe(taskData.data.id);
    });

    test('should require ref for blocked type', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'blocked', content: 'Waiting' }),
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe('Answer Type Appends', () => {
    test('should create answer linked to blocked append', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      const blockedRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'blocked', ref: taskData.data.id, content: 'Question?' }),
        })
      );
      const blockedData = await blockedRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user2', type: 'answer', ref: blockedData.data.id, content: 'Answer!' }),
        })
      );
      expect(res.status).toBe(201);
    });

    test('should return 400 when answer refs non-blocked append', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user2', type: 'answer', ref: taskData.data.id, content: 'Answer!' }),
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe('Renew Type Appends', () => {
    test('should extend claim expiry on renew', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      const claimRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: taskData.data.id }),
        })
      );
      const claimData = await claimRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'renew', ref: claimData.data.id }),
        })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.expiresAt).toBeDefined();
    });

    test('should return 400 when renewing another authors claim', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      const claimRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'claim', ref: taskData.data.id }),
        })
      );
      const claimData = await claimRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user2', type: 'renew', ref: claimData.data.id }),
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe('Vote Type Appends', () => {
    test('should create vote with +1 value', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'vote', ref: taskData.data.id, value: '+1' }),
        })
      );
      expect(res.status).toBe(201);
    });

    test('should create vote with -1 value', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const taskData = await taskRes.json();

      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'vote', ref: taskData.data.id, value: '-1' }),
        })
      );
      expect(res.status).toBe(201);
    });

    test('should require ref for vote type', async () => {
      const res = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'vote', value: '+1' }),
        })
      );
      expect(res.status).toBe(400);
    });
  });
});

