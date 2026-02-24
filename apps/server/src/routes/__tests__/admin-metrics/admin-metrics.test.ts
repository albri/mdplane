import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { adminMetricsRoute } from '../../admin-metrics';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

describe('GET /api/v1/admin/metrics', () => {
  let app: ReturnType<typeof Elysia.prototype.use>;
  const originalAdminSecret = process.env.ADMIN_SECRET;
  const TEST_ADMIN_SECRET = 'test-admin-secret-for-testing-12345';

  beforeAll(() => {
    process.env.ADMIN_SECRET = TEST_ADMIN_SECRET;
    app = new Elysia().use(adminMetricsRoute);
  });

  afterAll(() => {
    if (originalAdminSecret) {
      process.env.ADMIN_SECRET = originalAdminSecret;
    } else {
      delete process.env.ADMIN_SECRET;
    }
  });

  describe('Authentication', () => {
    test('returns 401 when ADMIN_SECRET is not configured', async () => {
      const previousSecret = process.env.ADMIN_SECRET;
      delete process.env.ADMIN_SECRET;
      try {
        const response = await app.handle(
          new Request('http://localhost/api/v1/admin/metrics')
        );

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.ok).toBe(false);
        expect(data.error.code).toBe('UNAUTHORIZED');
      } finally {
        if (previousSecret) {
          process.env.ADMIN_SECRET = previousSecret;
        } else {
          delete process.env.ADMIN_SECRET;
        }
      }
    });

    test('returns 401 without Authorization header', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/admin/metrics')
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    test('returns 401 with empty Authorization header', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/admin/metrics', {
          headers: { Authorization: '' },
        })
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.ok).toBe(false);
    });

    test('returns 401 with invalid Bearer format', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/admin/metrics', {
          headers: { Authorization: 'InvalidFormat' },
        })
      );

      expect(response.status).toBe(401);
    });

    test('returns 403 with wrong admin secret', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/admin/metrics', {
          headers: { Authorization: 'Bearer wrong-secret' },
        })
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    test('returns 200 with correct admin secret', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/admin/metrics', {
          headers: { Authorization: `Bearer ${TEST_ADMIN_SECRET}` },
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Response Structure', () => {
    test('returns storage metrics', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/admin/metrics', {
          headers: { Authorization: `Bearer ${TEST_ADMIN_SECRET}` },
        })
      );

      const data = await response.json();
      expect(data.data.storage).toBeDefined();
      expect(typeof data.data.storage.databaseSizeBytes).toBe('number');
      expect(typeof data.data.storage.databaseSizeMB).toBe('number');
      expect(typeof data.data.storage.usagePercent).toBe('number');
    });

    test('returns entity counts', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/admin/metrics', {
          headers: { Authorization: `Bearer ${TEST_ADMIN_SECRET}` },
        })
      );

      const data = await response.json();
      expect(data.data.counts).toBeDefined();
      expect(typeof data.data.counts.workspaces).toBe('number');
      expect(typeof data.data.counts.files).toBe('number');
      expect(typeof data.data.counts.folders).toBe('number');
      expect(typeof data.data.counts.users).toBe('number');
      expect(typeof data.data.counts.activeSessions).toBe('number');
      expect(typeof data.data.counts.capabilityKeys).toBe('number');
    });

    test('returns quota configuration', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/admin/metrics', {
          headers: { Authorization: `Bearer ${TEST_ADMIN_SECRET}` },
        })
      );

      const data = await response.json();
      expect(data.data.quotas).toBeDefined();
      expect(typeof data.data.quotas.maxWorkspaceStorageBytes).toBe('number');
      expect(typeof data.data.quotas.maxFileSizeBytes).toBe('number');
    });

    test('returns uptime information', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/admin/metrics', {
          headers: { Authorization: `Bearer ${TEST_ADMIN_SECRET}` },
        })
      );

      const data = await response.json();
      expect(data.data.uptime).toBeDefined();
      expect(typeof data.data.uptime.seconds).toBe('number');
      expect(typeof data.data.uptime.formatted).toBe('string');
    });

    test('should match AdminMetricsResponse schema', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/admin/metrics', {
          headers: { Authorization: `Bearer ${TEST_ADMIN_SECRET}` },
        })
      );

      const data = await response.json();
      assertValidResponse(data, 'AdminMetricsResponse');
    });
  });
});

