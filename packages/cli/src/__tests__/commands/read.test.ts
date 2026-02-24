import { describe, test, expect, vi } from 'bun:test';
import { ApiClient } from '../../api.js';

describe('read command', () => {
  describe('ApiClient.getFile', () => {
    test('should send correct request for file read', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            id: 'file-123',
            filename: 'README.md',
            content: '# Hello World',
            size: 13,
            appendCount: 5,
            etag: 'abc123',
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T12:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.getFile('read-key-123');

      expect(capturedUrl).toContain('/r/read-key-123');
      expect(result.filename).toBe('README.md');
      expect(result.content).toBe('# Hello World');
    });

    test('should include scoped path for workspace keys', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            id: 'file-456',
            filename: 'docs/README.md',
            content: '# Docs',
            size: 6,
            appendCount: 0,
            etag: 'etag-456',
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T12:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.getFile('read-key-123', '/docs/README.md');

      expect(capturedUrl).toContain('/r/read-key-123/docs/README.md');
    });
  });

  describe('ApiClient.getFileRaw', () => {
    test('should return raw content', async () => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('# Raw Content'),
        } as Response);
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.getFileRaw('read-key-123');

      expect(result).toBe('# Raw Content');
    });
  });

  describe('ApiClient.getFileMeta', () => {
    test('should return file metadata', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            id: 'file-123',
            filename: 'README.md',
            folder: '/',
            size: 1234,
            appendCount: 10,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T12:00:00Z',
            taskStats: { pending: 2, claimed: 1, completed: 5 },
            hasWebhook: false,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.getFileMeta('read-key-123');

      expect(result.filename).toBe('README.md');
      expect(result.taskStats.pending).toBe(2);
    });
  });

  describe('ApiClient.getFileTail', () => {
    test('should return last N bytes', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            content: 'last bytes of file',
            bytesReturned: 18,
            truncated: true,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.getFileTail('read-key-123', { bytes: 1024 });

      expect(result.content).toBe('last bytes of file');
      expect(result.truncated).toBe(true);
    });
  });

  describe('ApiClient.getFileStructure', () => {
    test('should return document headings', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            appendCount: 5,
            hasTaskAppends: true,
            headings: [
              { level: 1, text: 'Title', line: 1 },
              { level: 2, text: 'Section', line: 5 },
            ],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.getFileStructure('read-key-123');

      expect(result.headings.length).toBe(2);
      expect(result.headings[0]?.text).toBe('Title');
    });
  });

  describe('ApiClient.getFileSection', () => {
    test('should return section by heading', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            heading: 'Installation',
            level: 2,
            startLine: 10,
            endLine: 25,
            content: '## Installation\n\nRun npm install...',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.getFileSection('read-key-123', 'Installation');

      expect(result.heading).toBe('Installation');
      expect(result.content).toContain('npm install');
    });
  });

  describe('read key validation', () => {
    test('should detect missing read key', () => {
      const keys: { readKey: string | null; appendKey: string; writeKey: string } = { readKey: null, appendKey: 'a_test', writeKey: 'w_test' };
      const hasReadKey = keys.readKey != null && keys.readKey !== '';
      expect(hasReadKey).toBe(false);
    });

    test('should accept valid read key', () => {
      const keys: { readKey: string | null; appendKey: string; writeKey: string } = { readKey: 'r_validkey123', appendKey: 'a_test', writeKey: 'w_test' };
      const hasReadKey = keys.readKey != null && keys.readKey !== '';
      expect(hasReadKey).toBe(true);
    });
  });
});
