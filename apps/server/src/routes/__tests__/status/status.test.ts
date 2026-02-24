/**
 * Status Endpoint Tests
 *
 * Tests for GET /api/v1/status - System status for status page.
 *
 * This endpoint is publicly accessible (no auth required).
 *
 * Response shape is defined by OpenAPI spec in packages/shared/openapi/paths/system.yaml
 *
 * @see apps/server/src/routes/status.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { statusRoute } from '../../status';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

// Valid status values per OpenAPI spec
const VALID_SYSTEM_STATUSES = ['operational', 'degraded', 'partial_outage', 'major_outage'];
const VALID_COMPONENT_STATUSES = ['operational', 'degraded', 'down'];

describe('Status Endpoint', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(() => {
    // Create test app with status route
    app = new Elysia().use(statusRoute);
  });

  describe('GET /api/v1/status - Basic Response', () => {
    test('should return 200 with JSON response', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      expect(response.status).toBe(200);
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });

    test('should return ok: true', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return status field with valid value', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      expect(body.data.status).toBeDefined();
      expect(VALID_SYSTEM_STATUSES).toContain(body.data.status);
      expect(typeof body.data.timestamp).toBe('string');
      expect(typeof body.data.environment).toBe('string');
    });

    test('should be publicly accessible (no auth required)', async () => {
      // No Authorization header
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      // Should succeed without auth
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });
  });

  describe('GET /api/v1/status - Uptime and Version', () => {
    test('should return uptimeSeconds as a number', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      expect(body.data.uptimeSeconds).toBeDefined();
      expect(typeof body.data.uptimeSeconds).toBe('number');
      expect(body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    test('should return version as a string', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      expect(body.data.version).toBeDefined();
      expect(typeof body.data.version).toBe('string');
    });
  });

  describe('GET /api/v1/status - Database Status', () => {
    test('should return database object with status', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      expect(body.data.database).toBeDefined();
      expect(typeof body.data.database).toBe('object');
      expect(body.data.database.status).toBeDefined();
      expect(VALID_COMPONENT_STATUSES).toContain(body.data.database.status);
    });

    test('should include optional latencyMs in database', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      // latencyMs is optional per spec, but if present should be a number
      if (body.data.database.latencyMs !== undefined) {
        expect(typeof body.data.database.latencyMs).toBe('number');
      }
    });
  });

  describe('GET /api/v1/status - Storage Status', () => {
    test('should return storage object with status', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      expect(body.data.storage).toBeDefined();
      expect(typeof body.data.storage).toBe('object');
      expect(body.data.storage.status).toBeDefined();
      expect(VALID_COMPONENT_STATUSES).toContain(body.data.storage.status);
    });

    test('should include optional latencyMs in storage', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      if (body.data.storage.latencyMs !== undefined) {
        expect(typeof body.data.storage.latencyMs).toBe('number');
      }
    });
  });

  describe('GET /api/v1/status - WebSocket Status', () => {
    test('should return websocket object with status', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      expect(body.data.websocket).toBeDefined();
      expect(typeof body.data.websocket).toBe('object');
      expect(body.data.websocket.status).toBeDefined();
      expect(VALID_COMPONENT_STATUSES).toContain(body.data.websocket.status);
    });

    test('should include optional websocket metrics with valid types', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      if (body.data.websocket.latencyMs !== undefined) {
        expect(typeof body.data.websocket.latencyMs).toBe('number');
      }
      if (body.data.websocket.activeConnections !== undefined) {
        expect(typeof body.data.websocket.activeConnections).toBe('number');
        expect(body.data.websocket.activeConnections).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('GET /api/v1/status - Regions', () => {
    test('should return regions array', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      expect(body.data.regions).toBeDefined();
      expect(Array.isArray(body.data.regions)).toBe(true);
    });

    test('each region should have name and status', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      for (const region of body.data.regions) {
        expect(region.name).toBeDefined();
        expect(typeof region.name).toBe('string');
        expect(region.status).toBeDefined();
        expect(VALID_COMPONENT_STATUSES).toContain(region.status);
      }
    });
  });

  describe('GET /api/v1/status - Response Structure', () => {
    test('should match OpenAPI response schema', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();

      // Top level
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();

      // Required data fields per OpenAPI spec
      expect(body.data.status).toBeDefined();
      expect(body.data.uptimeSeconds).toBeDefined();
      expect(body.data.version).toBeDefined();
      expect(body.data.timestamp).toBeDefined();
      expect(body.data.environment).toBeDefined();
      expect(body.data.database).toBeDefined();
      expect(body.data.storage).toBeDefined();
      expect(body.data.websocket).toBeDefined();
      expect(body.data.regions).toBeDefined();

      // Database structure
      expect(body.data.database.status).toBeDefined();

      // Storage structure
      expect(body.data.storage.status).toBeDefined();

      // WebSocket structure
      expect(body.data.websocket.status).toBeDefined();

      // Regions structure
      expect(Array.isArray(body.data.regions)).toBe(true);
    });

    test('should return coherent overall status for component states', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      const componentStates = [
        body.data.database.status,
        body.data.storage.status,
        body.data.websocket.status,
      ];
      const hasDown = componentStates.includes('down');
      const degradedCount = componentStates.filter((state: string) => state === 'degraded').length;

      if (hasDown) {
        expect(body.data.status).toBe('major_outage');
      } else if (degradedCount >= 2) {
        expect(body.data.status).toBe('partial_outage');
      } else if (degradedCount === 1) {
        expect(body.data.status).toBe('degraded');
      } else {
        expect(body.data.status).toBe('operational');
      }
    });

    test('should match GetServiceStatusResponse schema', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/status')
      );

      const body = await response.json();
      assertValidResponse(body, 'GetServiceStatusResponse');
    });
  });
});
