import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, type TestContext } from './test-setup';

describe('Concurrent Access - Race Conditions', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  describe('Concurrent Appends', () => {
    test('5 agents append simultaneously - all succeed', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        ctx.app.handle(
          new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author: `agent${i}`, type: 'comment', content: `Comment ${i}` }),
          })
        )
      );

      const results = await Promise.all(promises);
      const statuses = results.map(r => r.status);
      expect(statuses.every(s => s === 201)).toBe(true);
    });

    test('concurrent appends produce unique sequential IDs', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        ctx.app.handle(
          new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author: `agent${i}`, type: 'comment', content: `Comment ${i}` }),
          })
        )
      );

      const responses = await Promise.all(promises);
      const payloads = await Promise.all(responses.map((response) => response.json()));
      const ids = payloads
        .map((payload) => parseInt(payload.data.id.replace('a', ''), 10))
        .sort((a, b) => a - b);

      expect(ids).toEqual([1, 2, 3, 4, 5]);
    });

    test('sequential appends also produce sequential IDs', async () => {
      const ids: number[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await ctx.app.handle(
          new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author: `agent${i}`, type: 'comment', content: `Comment ${i}` }),
          })
        );
        const data = await res.json();
        ids.push(parseInt(data.data.id.replace('a', ''), 10));
      }

      expect(ids).toEqual([1, 2, 3, 4, 5]);
    });

    test('10 rapid appends from same agent - all succeed', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        ctx.app.handle(
          new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author: 'agent1', type: 'comment', content: `Comment ${i}` }),
          })
        )
      );

      const results = await Promise.all(promises);
      const statuses = results.map(r => r.status);
      expect(statuses.every(s => s === 201)).toBe(true);
    });

    test('concurrent claims on same task - exactly one wins', async () => {
      const taskRes = await ctx.app.handle(
        new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: 'user1', type: 'task', content: 'Task' }),
        })
      );
      const task = await taskRes.json();

      const claimPromises = Array.from({ length: 3 }, (_, i) =>
        ctx.app.handle(
          new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author: `agent${i}`, type: 'claim', ref: task.data.id }),
          })
        )
      );

      const results = await Promise.all(claimPromises);
      const statuses = results.map(r => r.status);

      const successCount = statuses.filter(s => s === 201).length;
      const conflictCount = statuses.filter(s => s === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(2);
    });

    test('concurrent appends with same idempotency key return same result', async () => {
      const idempotencyKey = `idem-${Date.now()}`;

      const requests = Array.from({ length: 5 }, () =>
        ctx.app.handle(
          new Request(`http://localhost/a/${ctx.appendKey}/test.md`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({ author: 'agent1', type: 'comment', content: 'Same content' }),
          })
        )
      );

      const responses = await Promise.all(requests);
      const payloads = await Promise.all(responses.map((response) => response.json()));

      expect(responses.every((response) => response.status === 201)).toBe(true);

      const ids = payloads.map((payload) => payload.data.id);
      expect(new Set(ids).size).toBe(1);
    });
  });
});
