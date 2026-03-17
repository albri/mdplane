import { describe, test, expect, vi } from 'bun:test';
import { ApiClient } from '../../api.js';

describe('bootstrap API', () => {
  test('should call POST /bootstrap (canonical route)', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: unknown = null;

    global.fetch = vi.fn((url: string, options: RequestInit) => {
      capturedUrl = url;
      capturedMethod = options.method ?? 'GET';
      if (options.body != null) {
        capturedBody = JSON.parse(options.body as string);
      }

      return Response.json({
        ok: true,
        data: {
          workspaceId: 'ws_abc123',
          keys: {
            read: 'rk_123',
            append: 'ak_123',
            write: 'wk_123',
          },
          urls: {
            api: {
              read: 'https://api.mdplane.dev/r/rk_123',
              append: 'https://api.mdplane.dev/a/ak_123',
              write: 'https://api.mdplane.dev/w/wk_123',
            },
            web: {
              read: 'https://app.mdplane.dev/r/rk_123',
              claim: 'https://app.mdplane.dev/claim/wk_123',
            },
          },
          createdAt: '2026-02-06T00:00:00Z',
        },
      });
    }) as unknown as typeof fetch;

    const client = new ApiClient({
      baseUrl: 'https://api.mdplane.dev',
    });

    const result = await client.bootstrap();

    expect(capturedUrl).toBe('https://api.mdplane.dev/bootstrap');
    expect(capturedUrl).not.toContain('/api/v1/bootstrap');
    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toBeObject();
    expect(capturedBody).toHaveProperty('workspaceName');
    const workspaceName = (capturedBody as { workspaceName: string }).workspaceName;
    expect(workspaceName.startsWith('workspace-')).toBe(true);
    expect(result.workspaceId).toBe('ws_abc123');
    expect(result.keys.read).toBe('rk_123');
  });

  test('should include workspaceName in body when provided', async () => {
    let capturedBody: unknown = null;

    global.fetch = vi.fn((_url: string, options: RequestInit) => {
      if (options.body != null) {
        capturedBody = JSON.parse(options.body as string);
      }

      return Response.json({
        ok: true,
        data: {
          workspaceId: 'ws_abc123',
          keys: { read: 'rk_123', append: 'ak_123', write: 'wk_123' },
          urls: {
            api: {
              read: 'https://api.mdplane.dev/r/rk_123',
              append: 'https://api.mdplane.dev/a/ak_123',
              write: 'https://api.mdplane.dev/w/wk_123',
            },
            web: {
              read: 'https://app.mdplane.dev/r/rk_123',
              claim: 'https://app.mdplane.dev/claim/wk_123',
            },
          },
          createdAt: '2026-02-06T00:00:00Z',
        },
      });
    }) as unknown as typeof fetch;

    const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
    await client.bootstrap('my-project');

    expect(capturedBody).toEqual({ workspaceName: 'my-project' });
  });
});

describe('checkCapabilities API', () => {
  test('should call POST /capabilities/check with keys array', async () => {
    let requestCount = 0;
    let capturedBody: unknown = null;

    global.fetch = vi.fn((url: string, options: RequestInit) => {
      requestCount++;

      expect(url).toContain('/capabilities/check');
      expect(options.method).toBe('POST');
      capturedBody = JSON.parse(options.body as string);

      return Response.json({
        ok: true,
        data: {
          results: [
            {
              key: 'x8k2mP9q...',
              valid: true,
              permission: 'read',
              scope: 'workspace',
            },
            {
              key: '3kL9mQ2p...',
              valid: false,
              error: 'NOT_FOUND',
            },
          ],
        },
      });
    }) as unknown as typeof fetch;

    const client = new ApiClient({
      baseUrl: 'https://api.mdplane.dev',
    });

    const result = await client.checkCapabilities(['key1', 'key2']);

    expect(capturedBody).toEqual({ keys: ['key1', 'key2'] });
    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.valid).toBe(true);
    expect(result.results[0]?.permission).toBe('read');
    expect(result.results[1]?.valid).toBe(false);
    expect(result.results[1]?.error).toBe('NOT_FOUND');
    expect(requestCount).toBe(1);
  });

  test('should call POST /w/{key}/capabilities/check for workspace-scoped check', async () => {
    let requestCount = 0;
    let capturedUrl = '';

    global.fetch = vi.fn((url: string, options: RequestInit) => {
      requestCount++;
      capturedUrl = url;

      expect(options.method).toBe('POST');

      return Response.json({
        ok: true,
        data: {
          results: [
            {
              key: 'x8k2mP9q...',
              valid: true,
              permission: 'append',
              scope: 'folder',
              scopeId: 'folder_abc123',
            },
          ],
        },
      });
    }) as unknown as typeof fetch;

    const client = new ApiClient({
      baseUrl: 'https://api.mdplane.dev',
    });

    const result = await client.checkCapabilitiesInWorkspace('workspaceKey123', ['key1']);

    expect(capturedUrl).toContain('/w/workspaceKey123/capabilities/check');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.scopeId).toBe('folder_abc123');
    expect(result.results[0]?.scope).toBe('folder');
    expect(requestCount).toBe(1);
  });
});

describe('search and export API', () => {
  describe('searchWorkspace', () => {
    test('should call /api/v1/search with query parameter', async () => {
      let requestCount = 0;

      global.fetch = vi.fn((url: string) => {
        requestCount++;

        expect(url).toContain('/api/v1/search');
        expect(url).toContain('q=test');

        return Response.json({
          ok: true,
          data: {
            results: [
              {
                type: 'file',
                id: 'file1',
                file: {
                  id: 'file1',
                  path: '/test.md',
                },
                content: 'test content',
                highlights: [
                  { start: 0, end: 4 },
                ],
                score: 0.95,
              },
            ],
            total: 1,
            pagination: {
              cursor: 'abc123',
              hasMore: false,
            },
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.searchWorkspace('test');

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.content).toBe('test content');
      expect(result.total).toBe(1);
      expect(requestCount).toBe(1);
    });

    test('should include optional query parameters', async () => {
      let requestCount = 0;

      global.fetch = vi.fn((url: string) => {
        requestCount++;

        expect(url).toContain('/api/v1/search');
        expect(url).toContain('q=test');
        expect(url).toContain('type=task');
        expect(url).toContain('folder=%2Fprojects');
        expect(url).toContain('status=pending');
        expect(url).toContain('author=user1');
        expect(url).toContain('labels=bug%2Cfeature');
        expect(url).toContain('priority=high');
        expect(url).toContain('since=2024-01-01T00%3A00%3A00Z');
        expect(url).toContain('limit=100');

        return Response.json({
          ok: true,
          data: {
            results: [],
            total: 0,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      await client.searchWorkspace('test', {
        type: 'task',
        folder: '/projects',
        status: 'pending',
        author: 'user1',
        labels: 'bug,feature',
        priority: 'high',
        since: '2024-01-01T00:00:00Z',
        limit: 100,
      });

      expect(requestCount).toBe(1);
    });
  });

  describe('exportWorkspace', () => {
    test('should call /api/v1/export and return blob', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const blob = new Blob([testData], { type: 'application/zip' });

      global.fetch = vi.fn((url: string) => {
        expect(url).toContain('/api/v1/export');
        expect(url).toContain('format=zip');

        return new Response(blob, {
          headers: {
            'X-Export-Checksum': 'sha256:abc123',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.exportWorkspace({ format: 'zip' });

      expect(result.checksum).toBe('sha256:abc123');
      expect(result.blob.size).toBe(5);

      const buffer = await result.blob.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      expect(uint8Array).toEqual(testData);
    });

    test('should include optional query parameters', async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/zip' });

      global.fetch = vi.fn((url: string) => {
        expect(url).toContain('/api/v1/export');
        expect(url).toContain('format=tar.gz');
        expect(url).toContain('includeAppends=true');
        expect(url).toContain('includeDeleted=true');
        expect(url).toContain('paths=%2Fprojects%2C%2Fdocs');

        return new Response(blob);
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      await client.exportWorkspace({
        format: 'tar.gz',
        includeAppends: true,
        includeDeleted: true,
        paths: '/projects,/docs',
      });
    });
  });

  describe('createExportJob', () => {
    test('should call POST /api/v1/export/jobs', async () => {
      let requestCount = 0;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        requestCount++;

        expect(_url).toContain('/api/v1/export/jobs');
        expect(options.method).toBe('POST');

        return Response.json({
          ok: true,
          data: {
            jobId: 'exp_abc123',
            status: 'queued',
            statusUrl: '/api/v1/export/jobs/exp_abc123',
            estimatedSize: '2.3GB',
            position: 3,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.createExportJob({
        format: 'zip',
        includeAppends: true,
        paths: ['/projects'],
        notifyEmail: 'user@example.com',
      });

      expect(result.jobId).toBe('exp_abc123');
      expect(result.status).toBe('queued');
      expect(result.estimatedSize).toBe('2.3GB');
      expect(result.position).toBe(3);
      expect(requestCount).toBe(1);
    });
  });

  describe('getExportJobStatus', () => {
    test('should call GET /api/v1/export/jobs/{jobId}', async () => {
      let requestCount = 0;

      global.fetch = vi.fn((url: string) => {
        requestCount++;

        expect(url).toContain('/api/v1/export/jobs/exp_abc123');

        return Response.json({
          ok: true,
          data: {
            id: 'exp_abc123',
            status: 'ready',
            downloadUrl: '/api/v1/export/jobs/exp_abc123/download',
            expiresAt: '2026-01-12T14:30:00Z',
            checksum: 'sha256:abc123',
            size: '2.4GB',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.getExportJobStatus('exp_abc123');

      expect(result.id).toBe('exp_abc123');
      expect(result.status).toBe('ready');
      expect(result.downloadUrl).toBe('/api/v1/export/jobs/exp_abc123/download');
      expect(result.checksum).toBe('sha256:abc123');
      expect(requestCount).toBe(1);
    });

    test('should return failed status with error details', async () => {
      global.fetch = vi.fn((url: string) => {
        expect(url).toContain('/api/v1/export/jobs/exp_abc123');

        return Response.json({
          ok: true,
          data: {
            id: 'exp_abc123',
            status: 'failed',
            error: {
              code: 'DISK_FULL',
              message: 'Insufficient disk space',
            },
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.getExportJobStatus('exp_abc123');

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('DISK_FULL');
      expect(result.error?.message).toBe('Insufficient disk space');
    });
  });

  describe('downloadExportJob', () => {
    test('should call GET /api/v1/export/jobs/{jobId}/download', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const blob = new Blob([testData], { type: 'application/zip' });

      global.fetch = vi.fn((url: string) => {
        expect(url).toContain('/api/v1/export/jobs/exp_abc123/download');

        return new Response(blob, {
          headers: {
            'X-Export-Checksum': 'sha256:def456',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.downloadExportJob('exp_abc123');

      expect(result.checksum).toBe('sha256:def456');
      expect(result.blob.size).toBe(5);

      const buffer = await result.blob.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      expect(uint8Array).toEqual(testData);
    });

    test('should handle 403 error when job not ready', () => {
      global.fetch = vi.fn((url: string) => {
        expect(url).toContain('/api/v1/export/jobs/exp_abc123/download');

        return Response.json(
          {
            ok: false,
            error: {
              code: 'JOB_NOT_READY',
              message: 'Export job is not ready for download yet',
            },
          },
          { status: 403 }
        );
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      expect(client.downloadExportJob('exp_abc123')).rejects.toThrow(
        'Export job is not ready for download yet'
      );
    });
  });
});

describe('API v1 file operations', () => {
  describe('readFileByPath', () => {
    test('should call GET /api/v1/files/{path} with encoded path', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((url: string, options: RequestInit) => {
        capturedUrl = url;
        expect(options.method).toBe('GET');

        return Response.json({
          ok: true,
          data: {
            id: 'file_123',
            filename: 'notes.md',
            content: '# Hello',
            etag: '"abc123"',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            appendCount: 0,
            size: 7,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.readFileByPath('/projects/alpha/notes.md');

      expect(capturedUrl).toContain('/api/v1/files/');
      expect(capturedUrl).toContain(encodeURIComponent('/projects/alpha/notes.md'));
      expect(result.content).toBe('# Hello');
      expect(result.etag).toBe('"abc123"');
    });

    test('should handle 410 Gone for soft-deleted files', async () => {
      global.fetch = vi.fn(() => {
        return Response.json(
          {
            ok: false,
            error: { code: 'GONE', message: 'File has been deleted' },
          },
          { status: 410 }
        );
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      let threw = false;
      try {
        await client.readFileByPath('/deleted-file.md');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe('writeFileByPath', () => {
    test('should call PUT /api/v1/files/{path} with content', async () => {
      let capturedUrl = '';
      let capturedBody: unknown = null;
      let capturedHeaders: Record<string, string> | undefined;

      global.fetch = vi.fn((url: string, options: RequestInit) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body as string);
        capturedHeaders = options.headers as Record<string, string> | undefined;
        expect(options.method).toBe('PUT');

        return Response.json({
          ok: true,
          data: {
            id: 'file_123',
            etag: '"new123"',
            updatedAt: '2025-01-01T01:00:00Z',
            size: 15,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.writeFileByPath({ path: '/projects/alpha/notes.md', content: '# Updated', etag: '"abc123"' });

      expect(capturedUrl).toContain('/api/v1/files/');
      expect(capturedBody).toEqual({ content: '# Updated' });
      expect(capturedHeaders?.['If-Match']).toBe('"abc123"');
      expect(result.etag).toBe('"new123"');
    });
  });

  describe('deleteFileByPath', () => {
    test('should call DELETE /api/v1/files/{path} for soft delete', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((url: string, options: RequestInit) => {
        capturedUrl = url;
        expect(options.method).toBe('DELETE');

        return Response.json({
          ok: true,
          data: {
            id: 'file_123',
            deleted: true,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.deleteFileByPath('/old-file.md');

      expect(capturedUrl).toContain('/api/v1/files/');
      expect(capturedUrl).not.toContain('permanent=true');
      expect(result.deleted).toBe(true);
    });

    test('should call DELETE /api/v1/files/{path}?permanent=true for permanent delete', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((url: string, options: RequestInit) => {
        capturedUrl = url;
        expect(options.method).toBe('DELETE');

        return Response.json({
          ok: true,
          data: {
            id: 'file_123',
            deleted: true,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.deleteFileByPath('/old-file.md', true);

      expect(capturedUrl).toContain('permanent=true');
      expect(result.deleted).toBe(true);
    });
  });

  describe('appendToFileByPath', () => {
    test('should call POST /api/v1/files/{path}/append with content', async () => {
      let capturedUrl = '';
      let capturedBody: unknown = null;

      global.fetch = vi.fn((url: string, options: RequestInit) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body as string);
        expect(options.method).toBe('POST');

        return Response.json({
          ok: true,
          data: {
            id: 'a1',
            author: 'api-key',
            type: 'comment',
            createdAt: '2025-01-01T00:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.appendToFileByPath('/projects/alpha/notes.md', {
        content: '- New task',
        type: 'task',
        author: 'user@example.com',
      });

      expect(capturedUrl).toContain('/api/v1/files/');
      expect(capturedUrl).toContain('/append');
      expect(capturedBody).toEqual({
        content: '- New task',
        type: 'task',
        author: 'user@example.com',
      });
      expect(result.id).toBe('a1');
    });
  });

  describe('listFolderByPath', () => {
    test('should call GET /api/v1/folders for root', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((url: string) => {
        capturedUrl = url;
        return Response.json({
          ok: true,
          data: {
            path: '/',
            items: [{ name: 'projects', type: 'folder' }],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'http://localhost:3001', apiKey: 'sk_live_test123' });
      const result = await client.listFolderByPath();
      expect(capturedUrl).toBe('http://localhost:3001/api/v1/folders');
      expect(result.path).toBe('/');
      expect(result.items.filter(i => i.type === 'folder')).toHaveLength(1);
    });

    test('should call GET /api/v1/folders/{path} for nested folder', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((url: string) => {
        capturedUrl = url;
        return Response.json({
          ok: true,
          data: {
            path: '/projects/alpha',
            items: [{ name: 'notes.md', type: 'file', size: 100, updatedAt: '2024-01-15T10:00:00Z' }],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'http://localhost:3001', apiKey: 'sk_live_test123' });
      const result = await client.listFolderByPath('projects/alpha');
      expect(capturedUrl).toBe('http://localhost:3001/api/v1/folders/projects%2Falpha');
      expect(result.path).toBe('/projects/alpha');
      expect(result.items.filter(i => i.type === 'file')).toHaveLength(1);
    });
  });

  describe('createFolder', () => {
    test('should call POST /api/v1/folders for root folder creation', async () => {
      let capturedUrl = '';
      let capturedBody: Record<string, unknown> = {};

      global.fetch = vi.fn((url: string, options: RequestInit) => {
        capturedUrl = url;
        if (options.body != null) {
          capturedBody = JSON.parse(options.body as string) as Record<string, unknown>;
        }
        return Response.json({
          ok: true,
          data: { path: '/new-folder', createdAt: '2024-01-15T10:00:00Z' },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'http://localhost:3001', apiKey: 'sk_live_test123' });
      const result = await client.createFolder(undefined, 'new-folder');
      expect(capturedUrl).toBe('http://localhost:3001/api/v1/folders');
      expect(capturedBody.name).toBe('new-folder');
      expect(result.path).toBe('/new-folder');
    });

    test('should call POST /api/v1/folders/{path} for nested folder creation', async () => {
      let capturedUrl = '';
      let capturedBody: Record<string, unknown> = {};

      global.fetch = vi.fn((url: string, options: RequestInit) => {
        capturedUrl = url;
        if (options.body != null) {
          capturedBody = JSON.parse(options.body as string) as Record<string, unknown>;
        }
        return Response.json({
          ok: true,
          data: { path: '/projects/alpha/subfolder', createdAt: '2024-01-15T10:00:00Z' },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'http://localhost:3001', apiKey: 'sk_live_test123' });
      const result = await client.createFolder('projects/alpha', 'subfolder');
      expect(capturedUrl).toBe('http://localhost:3001/api/v1/folders/projects%2Falpha');
      expect(capturedBody.name).toBe('subfolder');
      expect(result.path).toBe('/projects/alpha/subfolder');
    });

    test('should throw error when folder name is empty', async () => {
      const client = new ApiClient({ baseUrl: 'http://localhost:3001', apiKey: 'sk_live_test123' });
      let error: Error | undefined;
      try {
        await client.createFolder(undefined, '');
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeDefined();
      expect(error?.message).toBe('Folder name is required');
    });
  });

  describe('deleteFolderByPath', () => {
    test('should call DELETE /api/v1/folders/{path}', async () => {
      let capturedUrl = '';
      let capturedMethod = '';

      global.fetch = vi.fn((url: string, options: RequestInit) => {
        capturedUrl = url;
        capturedMethod = options.method ?? 'GET';
        return Response.json({
          ok: true,
          data: { deleted: true, path: '/old-folder' },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'http://localhost:3001', apiKey: 'sk_live_test123' });
      const result = await client.deleteFolderByPath('old-folder');
      expect(capturedUrl).toBe('http://localhost:3001/api/v1/folders/old-folder');
      expect(capturedMethod).toBe('DELETE');
      expect(result.deleted).toBe(true);
      expect(result.path).toBe('/old-folder');
    });

    test('should URL-encode nested folder paths', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((url: string) => {
        capturedUrl = url;
        return Response.json({
          ok: true,
          data: { deleted: true, path: '/projects/alpha/old-folder' },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'http://localhost:3001', apiKey: 'sk_live_test123' });
      await client.deleteFolderByPath('projects/alpha/old-folder');
      expect(capturedUrl).toBe('http://localhost:3001/api/v1/folders/projects%2Falpha%2Fold-folder');
    });
  });
});
