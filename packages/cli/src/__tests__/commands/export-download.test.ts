import { describe, test, expect, vi } from 'bun:test';
import { ApiClient } from '../../api.js';

describe('export-download command', () => {
  describe('ApiClient.downloadExportJob', () => {
    test('should send correct request for export download', async () => {
      let capturedUrl = '';

      const mockBlob = new Blob(['zip content'], { type: 'application/zip' });
      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'x-checksum': 'sha256-abc123' }),
          blob: () => Promise.resolve(mockBlob),
        } as Response);
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.downloadExportJob('job-123');

      expect(capturedUrl).toBe('https://api.mdplane.dev/api/v1/export/jobs/job-123/download');
      expect(result.blob).toBeDefined();
    });

    test('should return checksum from headers', async () => {
      const mockBlob = new Blob(['zip content'], { type: 'application/zip' });
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'X-Export-Checksum': 'sha256-test-checksum' }),
          blob: () => Promise.resolve(mockBlob),
        } as Response);
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.downloadExportJob('job-123');

      expect(result.checksum).toBe('sha256-test-checksum');
    });

    test('should handle job not ready error', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'JOB_NOT_READY',
            message: 'Export job is not yet complete',
          },
        }, { status: 403 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });

      let threw = false;
      try {
        await client.downloadExportJob('job-123');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
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
        await client.downloadExportJob('nonexistent-job');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should handle expired job error', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'JOB_EXPIRED',
            message: 'Export download link has expired',
          },
        }, { status: 410 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });

      let threw = false;
      try {
        await client.downloadExportJob('expired-job');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe('job ID validation', () => {
    test('should accept valid job ID format', () => {
      const isValidJobId = (id: string): boolean => id.length > 0 && !id.includes('/');
      expect(isValidJobId('job-123')).toBe(true);
      expect(isValidJobId('abc123def456')).toBe(true);
    });

    test('should reject invalid job ID', () => {
      const isValidJobId = (id: string): boolean => id.length > 0 && !id.includes('/');
      expect(isValidJobId('')).toBe(false);
    });
  });
});

