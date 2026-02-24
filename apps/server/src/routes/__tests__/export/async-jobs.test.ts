/**
 * Export - Async Export Jobs Tests
 * POST /api/v1/export/jobs - Create Async Export Job
 * GET /api/v1/export/jobs/:jobId - Get Export Job Status
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { exportRoute } from '../../export';
import {
  setupTestFixtures,
  assertValidResponse,
  VALID_EXPORT_KEY,
  VALID_READ_ONLY_KEY,
  OTHER_WORKSPACE_KEY,
  JOB_ID_PATTERN,
  type TestApp,
} from './test-setup';

describe('Export - Async Jobs', () => {
  let app: TestApp;

  beforeAll(() => {
    app = new Elysia().use(exportRoute);
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  describe('POST /api/v1/export/jobs - Create Async Export Job', () => {
    test('should return 401 without Bearer token', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: 'zip' }),
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 403 when API key missing export scope', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_READ_ONLY_KEY}`,
          },
          body: JSON.stringify({ format: 'zip' }),
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should return 202 with job data on success', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({ format: 'zip' }),
        })
      );

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      assertValidResponse(body, 'CreateExportJobResponse');
    });

    test('should return jobId matching expected pattern', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.data.jobId).toMatch(JOB_ID_PATTERN);
    });

    test('should return status as queued initially', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.data.status).toBe('queued');
    });

    test('should return statusUrl for polling', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.data.statusUrl).toMatch(/^\/api\/v1\/export\/jobs\/exp_/);
    });

    test('should return estimatedSize', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.data.estimatedSize).toBeDefined();
      expect(typeof body.data.estimatedSize).toBe('string');
    });

    test('should return position in queue', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.data.position).toBeDefined();
      expect(typeof body.data.position).toBe('number');
    });

    test('should return 400 for invalid format in body', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({ format: 'invalid_format' }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should accept tar.gz format', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({ format: 'tar.gz' }),
        })
      );

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });
  });

  describe('GET /api/v1/export/jobs/:jobId - Get Export Job Status', () => {
    test('should return 401 without Bearer token', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs/exp_test123', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 403 when API key missing export scope', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs/exp_test123', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_READ_ONLY_KEY}`,
          },
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should return 404 for non-existent job', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export/jobs/exp_nonexistent', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('JOB_NOT_FOUND');
    });

    test('should return 200 with job status for existing job', async () => {
      // First create a job
      const createResponse = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      const createBody = await createResponse.json();
      const jobId = createBody.data.jobId;

      // Then check status
      const statusResponse = await app.handle(
        new Request(`http://localhost/api/v1/export/jobs/${jobId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(statusResponse.status).toBe(200);
      const statusBody = await statusResponse.json();
      expect(statusBody.ok).toBe(true);
      // OpenAPI spec uses 'id' for GET status response (not 'jobId' like POST create)
      expect(statusBody.data.id).toBe(jobId);
      assertValidResponse(statusBody, 'GetExportJobStatusResponse');
    });

    test('should return job status field', async () => {
      // Create a job
      const createResponse = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      const createBody = await createResponse.json();
      const jobId = createBody.data.jobId;

      // Check status
      const statusResponse = await app.handle(
        new Request(`http://localhost/api/v1/export/jobs/${jobId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      const statusBody = await statusResponse.json();
      expect(statusBody.data.status).toBeDefined();
      expect(['queued', 'processing', 'ready', 'failed', 'expired']).toContain(statusBody.data.status);
    });

    test('should return 404 for job belonging to different workspace (no info leak)', async () => {
      // Create a job with main workspace key
      const createResponse = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      const createBody = await createResponse.json();
      const jobId = createBody.data.jobId;

      // Try to access with other workspace key - should get 404 (not 403 to avoid info leak)
      const statusResponse = await app.handle(
        new Request(`http://localhost/api/v1/export/jobs/${jobId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${OTHER_WORKSPACE_KEY}`,
          },
        })
      );

      expect(statusResponse.status).toBe(404);
      const statusBody = await statusResponse.json();
      expect(statusBody.ok).toBe(false);
      expect(statusBody.error.code).toBe('JOB_NOT_FOUND');
    });

    test('should generate unique job IDs', async () => {
      const response1 = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      const response2 = await app.handle(
        new Request('http://localhost/api/v1/export/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
          body: JSON.stringify({}),
        })
      );

      const body1 = await response1.json();
      const body2 = await response2.json();

      expect(body1.data.jobId).not.toBe(body2.data.jobId);
    });
  });
});

