import { describe, test, expect, vi } from 'bun:test';
import { ApiClient } from '../../api.js';

describe('settings command', () => {
  describe('ApiClient.getFileSettings', () => {
    test('should send correct request for getting settings', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            claimDurationSeconds: 600,
            maxAppendSize: 65536,
            wipLimit: 5,
            labels: ['bug', 'feature'],
            allowedAppendTypes: ['task', 'claim', 'response'],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.getFileSettings('test-write-key');

      expect(capturedUrl).toBe('https://api.mdplane.dev/w/test-write-key/settings');
      expect(capturedOptions?.method).toBe('GET');
      expect(result.claimDurationSeconds).toBe(600);
      expect(result.wipLimit).toBe(5);
    });

    test('should return all settings fields', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            claimDurationSeconds: 300,
            maxAppendSize: 32768,
            wipLimit: 3,
            labels: ['urgent', 'low'],
            allowedAppendTypes: ['task', 'comment'],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.getFileSettings('test-write-key');

      expect(result.claimDurationSeconds).toBe(300);
      expect(result.maxAppendSize).toBe(32768);
      expect(result.wipLimit).toBe(3);
      expect(result.labels).toEqual(['urgent', 'low']);
      expect(result.allowedAppendTypes).toEqual(['task', 'comment']);
    });

    test('should handle file not found error', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found',
          },
        }, { status: 404 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.getFileSettings('test-write-key');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe('ApiClient.updateFileSettings', () => {
    test('should send correct request for updating settings', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            claimDurationSeconds: 900,
            maxAppendSize: 65536,
            wipLimit: 10,
            labels: ['bug', 'feature', 'refactor'],
            allowedAppendTypes: ['task', 'claim'],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.updateFileSettings('test-write-key', {
        wipLimit: 10,
        labels: ['bug', 'feature', 'refactor'],
      });

      expect(capturedUrl).toBe('https://api.mdplane.dev/w/test-write-key/settings');
      expect(capturedOptions?.method).toBe('PATCH');
      const body = JSON.parse(capturedOptions?.body as string) as { wipLimit: number; labels: string[] };
      expect(body.wipLimit).toBe(10);
      expect(body.labels).toEqual(['bug', 'feature', 'refactor']);
      expect(result.wipLimit).toBe(10);
    });

    test('should update only specified fields', async () => {
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            claimDurationSeconds: 600,
            wipLimit: 7,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.updateFileSettings('test-write-key', { wipLimit: 7 });

      const body = JSON.parse(capturedOptions?.body as string) as { wipLimit?: number; claimDurationSeconds?: number };
      expect(body.wipLimit).toBe(7);
      expect(body.claimDurationSeconds).toBeUndefined();
    });

    test('should handle validation error', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'wipLimit must be a positive integer',
          },
        }, { status: 400 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.updateFileSettings('test-write-key', { wipLimit: -1 });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should update claimDurationSeconds', async () => {
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: { claimDurationSeconds: 1800 },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.updateFileSettings('test-write-key', { claimDurationSeconds: 1800 });

      const body = JSON.parse(capturedOptions?.body as string) as { claimDurationSeconds: number };
      expect(body.claimDurationSeconds).toBe(1800);
    });
  });
});

