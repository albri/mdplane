/**
 * Orchestration Endpoint Tests
 *
 * @see packages/shared/openapi/paths/orchestration.yaml
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

// Import the route under test
import { orchestrationRoute } from '../../../routes/orchestration';
// Import test fixtures
import { resetOrchestrationTestData } from '../../../../tests/helpers/orchestration-fixtures';

// Test capability keys (valid format, for testing purposes)
const VALID_READ_KEY = 'orchR8k2mP9qL3nR7mQ2pN4';
const VALID_APPEND_KEY = 'orchA8k2mP9qL3nR7mQ2pN4';
const VALID_WRITE_KEY = 'orchW8k2mP9qL3nR7mQ2pN4';
const EXPIRED_KEY = 'orchExpired0P9qL3nR7mQ2';
const REVOKED_KEY = 'orchRevoked0P9qL3nR7mQ2';
const INVALID_KEY = 'short';

// Patterns
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

describe('Orchestration', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(() => {
    // Create test app with orchestration route
    app = new Elysia().use(orchestrationRoute);
  });

  beforeEach(() => {
    // Reset test data to ensure consistent state before each test
    resetOrchestrationTestData();
  });

  describe('GET /w/:key/orchestration - Admin View', () => {
    describe('Authentication', () => {
      test('should return 404 for invalid key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${INVALID_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 404 for read key (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_READ_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
        expect(body.error.message).toBe('Insufficient permissions for this operation');
      });

      test('should return 404 for append key (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_APPEND_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
        expect(body.error.message).toBe('Insufficient permissions for this operation');
      });

      test('should return 200 for valid write key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        assertValidResponse(body, 'GetOrchestrationAdminResponse');
      });
    });

    describe('Admin Features', () => {
      test('should include canForceExpire: true on claims', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        const claims = body.data.claims || [];

        // All claims in admin view should have canForceExpire: true
        for (const claim of claims) {
          expect(claim.canForceExpire).toBe(true);
        }
      });

      test('should return same structure as read-only view', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/orchestration`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.summary).toBeDefined();
        expect(body.data.tasks).toBeDefined();
        expect(body.data.claims).toBeDefined();
        expect(body.data.agents).toBeDefined();
        expect(body.data.workload).toBeDefined();
      });

      test('should support same filtering as read-only view', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/orchestration?status=pending&priority=high`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return 400 for invalid admin status filter values', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/orchestration?status=invalid`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should support pagination', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/orchestration?limit=10`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });
  });
});

