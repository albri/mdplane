import { describe, test, expect, vi } from 'bun:test';
import { ApiClient } from '../../api.js';

describe('files/ls command', () => {
  describe('ApiClient.listFolder', () => {
    test('should list root folder contents', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            path: '/',
            items: [
              { name: 'README.md', type: 'file', size: 1234, updatedAt: '2024-01-15T10:00:00Z' },
              { name: 'projects', type: 'folder' },
            ],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.listFolder('read-key-123');

      expect(capturedUrl).toBe('https://api.mdplane.dev/r/read-key-123/folders');
      expect(result.path).toBe('/');
      const files = result.items.filter(i => i.type === 'file');
      const folders = result.items.filter(i => i.type === 'folder');
      expect(files.length).toBe(1);
      expect(files[0]?.name).toBe('README.md');
      expect(folders.length).toBe(1);
      expect(folders[0]?.name).toBe('projects');
    });

    test('should list specific folder contents', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            path: '/projects',
            items: [
              { name: 'backlog.md', type: 'file', size: 2345, updatedAt: '2024-01-15T10:00:00Z' },
              { name: 'alpha', type: 'folder' },
              { name: 'beta', type: 'folder' },
            ],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.listFolder('read-key-123', 'projects');

      expect(capturedUrl).toBe('https://api.mdplane.dev/r/read-key-123/folders/projects');
      expect(result.path).toBe('/projects');
      const files = result.items.filter(i => i.type === 'file');
      const folders = result.items.filter(i => i.type === 'folder');
      expect(files.length).toBe(1);
      expect(folders.length).toBe(2);
    });

    test('should URL-encode folder path', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            path: '/my folder/docs',
            items: [],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.listFolder('read-key-123', 'my folder/docs');

      expect(capturedUrl).toBe('https://api.mdplane.dev/r/read-key-123/folders/my%20folder%2Fdocs');
    });

    test('should handle empty folder', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            path: '/empty',
            items: [],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.listFolder('read-key-123', 'empty');

      expect(result.path).toBe('/empty');
      const files = result.items.filter(i => i.type === 'file');
      const folders = result.items.filter(i => i.type === 'folder');
      expect(files.length).toBe(0);
      expect(folders.length).toBe(0);
    });

    test('should handle nested folder with slashes in path', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            path: '/projects/alpha/docs',
            items: [],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.listFolder('read-key-123', 'projects/alpha/docs');

      expect(capturedUrl).toBe('https://api.mdplane.dev/r/read-key-123/folders/projects%2Falpha%2Fdocs');
    });

    test('should return file metadata', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            path: '/',
            items: [
              { name: 'test.md', type: 'file', size: 5678, updatedAt: '2024-03-20T15:30:00Z' },
            ],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.listFolder('read-key-123');

      const files = result.items.filter(i => i.type === 'file');
      expect(files[0]?.name).toBe('test.md');
      expect(files[0]?.size).toBe(5678);
      expect(files[0]?.updatedAt).toBe('2024-03-20T15:30:00Z');
    });

    test('should handle server error response', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Folder not found',
          },
        }, { status: 404 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.listFolder('read-key-123', 'nonexistent');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });
});
