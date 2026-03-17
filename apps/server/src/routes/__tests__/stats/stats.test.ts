/**
 * Stats Endpoint Tests
 *
 * TDD Tests for stats endpoints:
 * - GET /w/:key/ops/stats - Write key statistics endpoint
 * - GET /a/:key/ops/file/stats - Append key statistics endpoint
 *
 * @see packages/shared/openapi/paths/stats.yaml
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

// Import the routes under test
import { filesRoute } from '../../files';
import { appendsRoute } from '../../appends';
import {
  resetTestFiles,
  TEST_APPEND_KEY,
  TEST_EXPIRED_KEY,
  TEST_READ_KEY,
  TEST_REVOKED_KEY,
  TEST_WRITE_KEY,
} from '../fixtures/files-fixtures';

// Import test fixtures
import { resetAppendsTestData } from '../../../../tests/helpers/appends-fixtures';

// Constants for testing - must match files.ts test fixtures
const VALID_READ_KEY = TEST_READ_KEY;
const VALID_WRITE_KEY = TEST_WRITE_KEY;
const VALID_APPEND_KEY = TEST_APPEND_KEY;
const EXPIRED_KEY = TEST_EXPIRED_KEY;
const REVOKED_KEY = TEST_REVOKED_KEY;
const INVALID_KEY = 'short';

// Constants for appends route testing - must match appends.ts test fixtures
const APPENDS_READ_KEY = 'appR8k2mP9qL3nR7mQ2pN4';
const APPENDS_WRITE_KEY = 'appW8k2mP9qL3nR7mQ2pN4';
const APPENDS_APPEND_KEY = 'appA8k2mP9qL3nR7mQ2pN4';
const APPENDS_EXPIRED_KEY = 'appExpired0P9qL3nR7mQ2';
const APPENDS_REVOKED_KEY = 'appRevoked0P9qL3nR7mQ2';

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

describe('Stats Endpoints', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(() => {
    // Create test app with files route and appends route
    app = new Elysia().use(filesRoute).use(appendsRoute);
  });

  beforeEach(() => {
    // Reset test files to ensure consistent state before each test
    resetTestFiles();
    resetAppendsTestData();
  });

  describe('GET /w/:key/ops/stats', () => {
    test('should return 404 for invalid key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${INVALID_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 for read key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_READ_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should return 404 for append key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_APPEND_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should return 200 for write key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      assertValidResponse(body, 'GetStatsViaWriteKeyResponse');
    });

    test('should return scope info', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.scope).toBeDefined();
      expect(body.data.scope.type).toBeDefined();
      expect(['file', 'folder', 'workspace']).toContain(body.data.scope.type);
      expect(body.data.scope.id).toBeDefined();
    });

    test('should return counts object', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.counts).toBeDefined();
      expect(typeof body.data.counts.files).toBe('number');
      expect(typeof body.data.counts.appends).toBe('number');
      expect(typeof body.data.counts.tasks).toBe('number');
      expect(typeof body.data.counts.claims).toBe('number');
      expect(typeof body.data.counts.agents).toBe('number');
    });

    test('should return activity object', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.activity).toBeDefined();
      // lastAppendAt can be null if no appends
      expect('lastAppendAt' in body.data.activity).toBe(true);
      expect(typeof body.data.activity.appendsToday).toBe('number');
      expect(typeof body.data.activity.appendsThisWeek).toBe('number');
    });

    test('should return 404 for expired key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${EXPIRED_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_EXPIRED');
    });

    test('should return 404 for revoked key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${REVOKED_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_REVOKED');
    });

    test('should count files correctly', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.counts.files).toBeGreaterThanOrEqual(0);
    });

    test('should count appends correctly', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.counts.appends).toBeGreaterThanOrEqual(0);
    });

    test('should count tasks correctly', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.counts.tasks).toBeGreaterThanOrEqual(0);
    });

    test('should return valid activity timestamps', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/ops/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      // lastAppendAt should be null or a valid ISO timestamp
      if (body.data.activity.lastAppendAt !== null) {
        expect(body.data.activity.lastAppendAt).toMatch(ISO_TIMESTAMP_PATTERN);
      }
      expect(body.data.activity.appendsToday).toBeGreaterThanOrEqual(0);
      expect(body.data.activity.appendsThisWeek).toBeGreaterThanOrEqual(body.data.activity.appendsToday);
    });
  });

  describe('GET /a/:key/ops/file/stats', () => {
    test('should return 404 for invalid key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${INVALID_KEY}/ops/file/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 for read key (permission denied)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${APPENDS_READ_KEY}/ops/file/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should return 200 for append key', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${APPENDS_APPEND_KEY}/ops/file/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      assertValidResponse(body, 'GetFileStatsResponse');
    });

    test('should return 200 for write key (write can access append endpoints)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${APPENDS_WRITE_KEY}/ops/file/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return appendCount', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${APPENDS_APPEND_KEY}/ops/file/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.appendCount).toBeDefined();
      expect(typeof body.data.appendCount).toBe('number');
      expect(body.data.appendCount).toBeGreaterThanOrEqual(0);
    });

    test('should return taskStats object', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${APPENDS_APPEND_KEY}/ops/file/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.taskStats).toBeDefined();
      expect(typeof body.data.taskStats.pending).toBe('number');
      expect(typeof body.data.taskStats.claimed).toBe('number');
      expect(typeof body.data.taskStats.completed).toBe('number');
      expect(typeof body.data.taskStats.activeClaims).toBe('number');
    });

    test('should return 404 for expired key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${APPENDS_EXPIRED_KEY}/ops/file/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_EXPIRED');
    });

    test('should return 404 for revoked key (capability URL security)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${APPENDS_REVOKED_KEY}/ops/file/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_REVOKED');
    });

    test('should return non-negative task stats', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${APPENDS_APPEND_KEY}/ops/file/stats`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.taskStats.pending).toBeGreaterThanOrEqual(0);
      expect(body.data.taskStats.claimed).toBeGreaterThanOrEqual(0);
      expect(body.data.taskStats.completed).toBeGreaterThanOrEqual(0);
      expect(body.data.taskStats.activeClaims).toBeGreaterThanOrEqual(0);
    });
  });
});
