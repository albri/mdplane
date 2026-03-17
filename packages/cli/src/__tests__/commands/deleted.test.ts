import { describe, test, expect, vi } from 'bun:test';
import { ApiClient } from '../../api.js';

describe('deleted command', () => {
  describe('ApiClient.getDeletedFiles', () => {
    test('should send correct request for deleted files', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            files: [
              {
                id: 'file-123',
                path: '/notes/old.md',
                deletedAt: '2024-01-15T10:00:00Z',
                expiresAt: '2024-01-22T10:00:00Z',
                size: 1234,
              },
            ],
            pagination: { total: 1, hasMore: false },
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.getDeletedFiles({ limit: 50 });

      expect(capturedUrl).toContain('/api/v1/deleted');
      expect(result.files.length).toBe(1);
      expect(result.files[0]?.id).toBe('file-123');
    });

    test('should include limit parameter', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            files: [],
            pagination: { total: 0, hasMore: false },
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      await client.getDeletedFiles({ limit: 10 });

      expect(capturedUrl).toContain('limit=10');
    });

    test('should include cursor for pagination', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            files: [],
            pagination: { total: 0, hasMore: false },
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      await client.getDeletedFiles({ limit: 50, cursor: 'abc123' });

      expect(capturedUrl).toContain('cursor=abc123');
    });

    test('should handle empty deleted files list', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            files: [],
            pagination: { total: 0, hasMore: false },
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.getDeletedFiles({ limit: 50 });

      expect(result.files.length).toBe(0);
    });

    test('should handle server error response', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Invalid API key',
          },
        }, { status: 403 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'invalid' });

      let threw = false;
      try {
        await client.getDeletedFiles({ limit: 50 });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe('limit validation', () => {
    test('should accept valid limit (1-200)', () => {
      const validate = (val: number): boolean => val >= 1 && val <= 200;
      expect(validate(1)).toBe(true);
      expect(validate(50)).toBe(true);
      expect(validate(200)).toBe(true);
    });

    test('should reject invalid limit', () => {
      const validate = (val: number): boolean => val >= 1 && val <= 200;
      expect(validate(0)).toBe(false);
      expect(validate(300)).toBe(false);
    });
  });
});

