import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createSearchTestApp,
  resetTestSearch,
  assertValidResponse,
  VALID_READ_KEY,
  ISO_TIMESTAMP_PATTERN,
  type TestApp,
} from './test-setup';

describe('Task Query', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createSearchTestApp();
  });

  beforeEach(() => {
    resetTestSearch();
  });

  describe('GET /r/:readKey/ops/folders/tasks?path=:path* - Task Query', () => {
    describe('Basic Task Aggregation', () => {
      test('should aggregate tasks from all files in folder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/tasks?path=projects`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'TaskQueryResponse');
        expect(body.ok).toBe(true);
        expect(body.data.tasks).toBeDefined();
        expect(Array.isArray(body.data.tasks)).toBe(true);
      });

      test('should return summary with counts', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/tasks?path=projects`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        assertValidResponse(body, 'TaskQueryResponse');
        expect(body.data.summary).toBeDefined();
        expect(typeof body.data.summary.pending).toBe('number');
        expect(typeof body.data.summary.claimed).toBe('number');
        expect(typeof body.data.summary.completed).toBe('number');
      });

      test('should include file URLs in task results', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/tasks?path=projects`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        if (body.data.tasks.length > 0) {
          const task = body.data.tasks[0];
          expect(task.file).toBeDefined();
          expect(task.fileUrls).toBeDefined();
          expect(task.fileUrls.read).toBeDefined();
        }
      });

      test('should return task properties', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/tasks?path=projects`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        if (body.data.tasks.length > 0) {
          const task = body.data.tasks[0];
          expect(task.id).toBeDefined();
          expect(task.content).toBeDefined();
          expect(task.status).toBeDefined();
          expect(task.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
        }
      });
    });

    describe('Task Filters', () => {
      test('should filter by status (?status=pending)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/tasks?path=projects&status=pending`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.tasks.forEach((task: { status: string }) => {
          expect(task.status).toBe('pending');
        });
      });

      test('should filter by priority (?priority=high,critical)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/tasks?path=projects&priority=high,critical`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.tasks.forEach((task: { priority?: string }) => {
          if (task.priority) {
            expect(['high', 'critical']).toContain(task.priority);
          }
        });
      });

      test('should filter by labels (?labels=bug)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/tasks?path=projects&labels=bug`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.tasks.forEach((task: { labels?: string[] }) => {
          if (task.labels) {
            expect(task.labels).toContain('bug');
          }
        });
      });

      test('should filter by claimedBy (?claimedBy=jordan)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/tasks?path=projects&claimedBy=jordan`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.tasks.forEach((task: { claimedBy?: string }) => {
          expect(task.claimedBy).toBe('jordan');
        });
      });

      test('should filter claimable tasks (?claimable=true)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/tasks?path=projects&claimable=true`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.tasks.forEach((task: { status: string; claimedBy?: string }) => {
          expect(task.status).toBe('pending');
          expect(task.claimedBy).toBeUndefined();
        });
      });
    });

    describe('Pagination', () => {
      test('should support pagination in tasks endpoint', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/tasks?path=projects&limit=10`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.pagination).toBeDefined();
      });
    });
  });
});



