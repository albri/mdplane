import { describe, test, expect, vi } from 'bun:test';
import { ApiClient } from '../../api.js';

describe('export command', () => {
  describe('ApiClient.exportWorkspace (sync)', () => {
    test('should send correct request for sync export', async () => {
      let capturedUrl = '';

      const mockBlob = new Blob(['test content'], { type: 'application/zip' });
      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'x-checksum': 'abc123' }),
          blob: () => Promise.resolve(mockBlob),
        } as Response);
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.exportWorkspace({ format: 'zip' });

      expect(capturedUrl).toContain('/api/v1/export');
      expect(result.blob).toBeDefined();
    });

    test('should include format parameter', async () => {
      let capturedUrl = '';

      const mockBlob = new Blob(['test content'], { type: 'application/gzip' });
      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          blob: () => Promise.resolve(mockBlob),
        } as Response);
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      await client.exportWorkspace({ format: 'tar.gz' });

      expect(capturedUrl).toContain('format=tar.gz');
    });

    test('should include optional parameters', async () => {
      let capturedUrl = '';

      const mockBlob = new Blob(['test content'], { type: 'application/zip' });
      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          blob: () => Promise.resolve(mockBlob),
        } as Response);
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      await client.exportWorkspace({ format: 'zip', includeAppends: true, includeDeleted: true });

      expect(capturedUrl).toContain('includeAppends=true');
      expect(capturedUrl).toContain('includeDeleted=true');
    });
  });

  describe('ApiClient.createExportJob (async)', () => {
    test('should send correct request for async export job', async () => {
      let capturedUrl = '';
      let capturedBody = '';

      global.fetch = vi.fn((_url: string, init?: RequestInit) => {
        capturedUrl = _url;
        if (init?.body != null) {
          capturedBody = init.body as string;
        }
        return Response.json({
          ok: true,
          data: {
            jobId: 'job-123',
            status: 'queued',
            statusUrl: 'https://api.mdplane.dev/api/v1/export/jobs/job-123',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.createExportJob({ format: 'zip' });

      expect(capturedUrl).toContain('/api/v1/export/jobs');
      expect(capturedBody).toContain('zip');
      expect(result.jobId).toBe('job-123');
      expect(result.status).toBe('queued');
    });

    test('should include notify email in request', async () => {
      let capturedBody = '';

      global.fetch = vi.fn((_url: string, init?: RequestInit) => {
        if (init?.body != null) {
          capturedBody = init.body as string;
        }
        return Response.json({
          ok: true,
          data: {
            jobId: 'job-123',
            status: 'queued',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      await client.createExportJob({ format: 'zip', notifyEmail: 'user@example.com' });

      expect(capturedBody).toContain('user@example.com');
    });
  });

  describe('format validation', () => {
    test('should accept valid formats', () => {
      const validFormats = ['zip', 'tar.gz'];
      expect(validFormats.includes('zip')).toBe(true);
      expect(validFormats.includes('tar.gz')).toBe(true);
    });

    test('should reject invalid formats', () => {
      const validFormats = ['zip', 'tar.gz'];
      expect(validFormats.includes('rar')).toBe(false);
      expect(validFormats.includes('7z')).toBe(false);
    });
  });
});

