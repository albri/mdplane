import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createSearchTestApp,
  resetTestSearch,
  assertValidResponse,
  VALID_READ_KEY,
  EXPIRED_KEY,
  INVALID_KEY,
  ISO_TIMESTAMP_PATTERN,
  type TestApp,
} from './test-setup';

describe('Folder Stats', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createSearchTestApp();
  });

  beforeEach(() => {
    resetTestSearch();
  });

  describe('GET /r/:readKey/ops/folders/stats?path=:path* - Folder Stats', () => {
    describe('Basic Stats Retrieval', () => {
      test('should return folder stats for root folder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/stats`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'FolderStatsResponse');
        expect(body.ok).toBe(true);
        expect(body.data).toBeDefined();
        expect(typeof body.data.path).toBe('string');
        expect(typeof body.data.fileCount).toBe('number');
        expect(typeof body.data.folderCount).toBe('number');
        expect(typeof body.data.totalSize).toBe('number');
      });

      test('should return folder stats for subfolder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/stats?path=projects`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'FolderStatsResponse');
        expect(body.ok).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.path).toContain('projects');
        expect(typeof body.data.fileCount).toBe('number');
        expect(typeof body.data.folderCount).toBe('number');
        expect(typeof body.data.totalSize).toBe('number');
      });

      test('should include updatedAt timestamp', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/stats`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        if (body.data.updatedAt !== null) {
          expect(body.data.updatedAt).toMatch(ISO_TIMESTAMP_PATTERN);
        }
      });

      test('should include taskStats', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/stats`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.taskStats).toBeDefined();
        expect(typeof body.data.taskStats.pending).toBe('number');
        expect(typeof body.data.taskStats.claimed).toBe('number');
        expect(typeof body.data.taskStats.completed).toBe('number');
      });
    });

    describe('Error Handling', () => {
      test('should return 404 for non-existent folder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/stats?path=nonexistent/folder`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FOLDER_NOT_FOUND');
      });

      test('should return 404 for invalid capability key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/ops/folders/stats`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 404 for expired capability key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${EXPIRED_KEY}/ops/folders/stats`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should reject path traversal attempt', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/stats?path=../../../etc/passwd`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
      });
    });
  });
});



