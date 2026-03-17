import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { exportRoute } from '../../export';
import { sqlite } from '../../../db';
import {
  setupTestFixtures,
  VALID_EXPORT_KEY,
  VALID_READ_ONLY_KEY,
  TEST_WORKSPACE_ID,
  OTHER_WORKSPACE_ID,
  type TestApp,
} from './test-setup';

describe('GET /api/v1/export/jobs/:jobId/download - Download Export Archive', () => {
  let app: TestApp;

  beforeAll(() => {
    app = new Elysia().use(exportRoute);
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  // Helper to create a ready export job
  function createReadyJob(
    jobId: string,
    format: string = 'zip',
    workspaceId: string = TEST_WORKSPACE_ID
  ): void {
    const now = new Date().toISOString();
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

    sqlite.exec(`
      INSERT INTO export_jobs (
        id, workspace_id, status, format, include, notify_email, folder,
        created_at, started_at, progress, download_url, expires_at, checksum, size, position
      ) VALUES (
        '${jobId}',
        '${workspaceId}',
        'ready',
        '${format}',
        '[]',
        NULL,
        NULL,
        '${now}',
        '${now}',
        '{"filesProcessed":2,"totalFiles":2,"bytesWritten":"256"}',
        '/api/v1/export/jobs/${jobId}/download',
        '${futureDate}',
        'sha256:abc123def456...',
        '2.4GB',
        0
      )
    `);
  }

  // Helper to create a non-ready export job
  function createProcessingJob(
    jobId: string,
    workspaceId: string = TEST_WORKSPACE_ID
  ): void {
    const now = new Date().toISOString();

    sqlite.exec(`
      INSERT INTO export_jobs (
        id, workspace_id, status, format, include, notify_email, folder,
        created_at, started_at, progress, download_url, expires_at, checksum, size, position
      ) VALUES (
        '${jobId}',
        '${workspaceId}',
        'processing',
        'zip',
        '[]',
        NULL,
        NULL,
        '${now}',
        '${now}',
        '{"filesProcessed":1,"totalFiles":2,"bytesWritten":"128"}',
        NULL,
        NULL,
        NULL,
        NULL,
        0
      )
    `);
  }

  test('should return 401 without Bearer token', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export/jobs/exp_test123/download', {
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
      new Request('http://localhost/api/v1/export/jobs/exp_test123/download', {
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
      new Request('http://localhost/api/v1/export/jobs/exp_nonexistent/download', {
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

  test('should return 403 when job is not ready (processing status)', async () => {
    createProcessingJob('exp_processing_job');

    const response = await app.handle(
      new Request('http://localhost/api/v1/export/jobs/exp_processing_job/download', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('JOB_NOT_READY');
    expect(body.error.message).toBe('Export job is not ready for download yet');
    expect(body.error.details).toBeDefined();
    expect(body.error.details.status).toBe('processing');
  });

  test('should return 404 for job belonging to different workspace (no info leak)', async () => {
    createReadyJob('exp_ready_job', 'zip', OTHER_WORKSPACE_ID);

    const response = await app.handle(
      new Request('http://localhost/api/v1/export/jobs/exp_ready_job/download', {
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

  test('should return 200 with binary content when job is ready', async () => {
    createReadyJob('exp_ready_download');

    const response = await app.handle(
      new Request('http://localhost/api/v1/export/jobs/exp_ready_download/download', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  test('should return Content-Type based on format', async () => {
    createReadyJob('exp_ready_zip', 'zip');

    const response = await app.handle(
      new Request('http://localhost/api/v1/export/jobs/exp_ready_zip/download', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
  });

  test('should return Content-Disposition header with filename', async () => {
    createReadyJob('exp_ready_file');

    const response = await app.handle(
      new Request('http://localhost/api/v1/export/jobs/exp_ready_file/download', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const disposition = response.headers.get('Content-Disposition');
    expect(disposition).toMatch(/^attachment; filename="workspace-export-\d{4}-\d{2}-\d{2}\.zip"$/);
  });

  test('should return X-Export-Checksum header', async () => {
    createReadyJob('exp_ready_checksum');

    const response = await app.handle(
      new Request('http://localhost/api/v1/export/jobs/exp_ready_checksum/download', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const checksum = response.headers.get('X-Export-Checksum');
    expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('should support tar.gz format', async () => {
    createReadyJob('exp_ready_tar', 'tar.gz');

    const response = await app.handle(
      new Request('http://localhost/api/v1/export/jobs/exp_ready_tar/download', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/gzip');
    const disposition = response.headers.get('Content-Disposition');
    expect(disposition).toContain('.tar.gz');
  });
});

