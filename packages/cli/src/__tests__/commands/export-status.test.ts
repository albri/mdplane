import { describe, test, expect, vi } from 'bun:test';
import { ApiClient } from '../../api.js';

describe('export-status command', () => {
  describe('ApiClient.getExportJobStatus', () => {
    test('should send correct request for job status', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            jobId: 'job-123',
            status: 'processing',
            startedAt: '2024-01-15T10:00:00Z',
            progress: {
              filesProcessed: 50,
              totalFiles: 100,
            },
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.getExportJobStatus('job-123');

      expect(capturedUrl).toBe('https://api.mdplane.dev/api/v1/export/jobs/job-123');
      expect(result.status).toBe('processing');
    });

    test('should return queued status', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            id: 'job-123',
            status: 'queued',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.getExportJobStatus('job-123');

      expect(result.status).toBe('queued');
    });

    test('should return ready status with download info', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            jobId: 'job-123',
            status: 'ready',
            size: '1048576',
            checksum: 'sha256-abc123',
            expiresAt: '2024-01-16T10:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.getExportJobStatus('job-123');

      expect(result.status).toBe('ready');
      expect(result.size).toBe('1048576');
      expect(result.checksum).toBe('sha256-abc123');
    });

    test('should return failed status with error', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            jobId: 'job-123',
            status: 'failed',
            error: {
              code: 'EXPORT_FAILED',
              message: 'Failed to export workspace',
            },
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.getExportJobStatus('job-123');

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('EXPORT_FAILED');
    });

    test('should handle job not found error', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Export job not found',
          },
        }, { status: 404 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });

      let threw = false;
      try {
        await client.getExportJobStatus('nonexistent-job');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe('status values', () => {
    test('should recognize all valid status values', () => {
      const validStatuses = ['queued', 'processing', 'ready', 'failed', 'expired'];
      expect(validStatuses.includes('queued')).toBe(true);
      expect(validStatuses.includes('processing')).toBe(true);
      expect(validStatuses.includes('ready')).toBe(true);
      expect(validStatuses.includes('failed')).toBe(true);
      expect(validStatuses.includes('expired')).toBe(true);
    });
  });
});

