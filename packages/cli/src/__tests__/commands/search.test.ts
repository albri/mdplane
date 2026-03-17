import { describe, test, expect, vi, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ApiClient } from '../../api.js';
import { runCliWithCwd } from '../helpers/run-cli.js';

interface MockServerState {
  server: ReturnType<typeof Bun.serve>;
  port: number;
  capturedPaths: string[];
}

function createMockServer(): MockServerState {
  const capturedPaths: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      capturedPaths.push(url.pathname);
      return Response.json({
        ok: true,
        data: { results: [], total: 0 },
        pagination: { hasMore: false },
      });
    },
  });
  const port = server.port;
  if (port === undefined) throw new Error('Mock server failed to get port');
  return { server, port, capturedPaths };
}

describe('search command', () => {
  describe('auth mode selection (command-level)', () => {
    let tempDir: string;
    let mdplaneDir: string;
    let mockServer: MockServerState | null = null;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-search-test-'));
      mdplaneDir = path.join(tempDir, '.mdplane');
      fs.mkdirSync(mdplaneDir);
    });

    afterEach(async () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (mockServer) {
        await mockServer.server.stop();
        mockServer = null;
      }
    });

    test('fails when neither API key nor read key is available', async () => {
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: 'http://localhost:3001',
            mode: 'capability',
            capabilityUrls: {},
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      const { stderr, exitCode } = await runCliWithCwd(`search "test" --json`, tempDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('API key or read key is required');
    });

    test('uses API key mode and calls /api/v1/search endpoint', async () => {
      mockServer = createMockServer();
      const port = String(mockServer.port);
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: `http://localhost:${port}`,
            mode: 'api-key',
            apiKey: 'test-api-key',
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      await runCliWithCwd(`search "test"`, tempDir);

      expect(mockServer.capturedPaths).toContain('/api/v1/search');
      expect(mockServer.capturedPaths.some((p) => p.startsWith('/r/'))).toBe(false);
    });

    test('falls back to read key mode and calls /r/{key}/search endpoint', async () => {
      mockServer = createMockServer();
      const port = String(mockServer.port);
      const readKey = 'testReadKey123';
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: `http://localhost:${port}`,
            mode: 'capability',
            capabilityUrls: {
              read: `http://localhost:${port}/r/${readKey}`,
            },
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      await runCliWithCwd(`search "test"`, tempDir);

      expect(mockServer.capturedPaths).toContain(`/r/${readKey}/search`);
      expect(mockServer.capturedPaths).not.toContain('/api/v1/search');
    });
  });

  describe('ApiClient.searchWorkspace', () => {
    test('should send correct request for basic search', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            results: [
              {
                type: 'file',
                id: 'file_1',
                file: { id: 'file_1', path: '/notes/test.md' },
                content: 'Test content with search term',
                score: 0.85,
                highlights: [{ start: 18, end: 24 }],
              },
            ],
            total: 1,
          },
          pagination: { hasMore: false },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });
      const result = await client.searchWorkspace('search');

      expect(capturedUrl).toBe('https://api.mdplane.dev/api/v1/search?q=search');
      expect(capturedOptions?.method).toBe('GET');
      expect(result.results.length).toBe(1);
      expect(result.results[0]?.type).toBe('file');
      expect(result.total).toBe(1);
    });

    test('should include all filter parameters in request', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: { results: [], total: 0 },
          pagination: { hasMore: false },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });
      await client.searchWorkspace('bug', {
        type: 'task',
        folder: '/projects/alpha',
        status: 'pending',
        author: 'agent-1',
        labels: 'security,backend',
        priority: 'high',
        since: '2024-01-01T00:00:00Z',
        limit: 10,
      });

      expect(capturedUrl).toContain('q=bug');
      expect(capturedUrl).toContain('type=task');
      expect(capturedUrl).toContain('folder=%2Fprojects%2Falpha');
      expect(capturedUrl).toContain('status=pending');
      expect(capturedUrl).toContain('author=agent-1');
      expect(capturedUrl).toContain('labels=security%2Cbackend');
      expect(capturedUrl).toContain('priority=high');
      expect(capturedUrl).toContain('since=2024-01-01T00%3A00%3A00Z');
      expect(capturedUrl).toContain('limit=10');
    });

    test('should include Authorization header with API key', async () => {
      let capturedHeaders: Record<string, string> | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedHeaders = options.headers as Record<string, string> | undefined;
        return Response.json({
          ok: true,
          data: { results: [], total: 0 },
          pagination: { hasMore: false },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'my-api-key' });
      await client.searchWorkspace('test');

      expect(capturedHeaders?.Authorization).toBe('Bearer my-api-key');
    });

    test('should handle empty results', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: { results: [], total: 0 },
          pagination: { hasMore: false },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });
      const result = await client.searchWorkspace('nonexistent');

      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
    });

    test('should handle pagination cursor', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: { results: [], total: 0 },
          pagination: { hasMore: false },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });
      await client.searchWorkspace('test', { cursor: 'abc123' });

      expect(capturedUrl).toContain('cursor=abc123');
    });

    test('should handle server error response', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Query is too long',
          },
        }, { status: 400 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });

      let threw = false;
      try {
        await client.searchWorkspace('a'.repeat(1000));
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should URL-encode query with special characters', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: { results: [], total: 0 },
          pagination: { hasMore: false },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });
      await client.searchWorkspace('hello world');

      expect(capturedUrl).toContain('q=hello+world');
    });
  });

  describe('ApiClient.searchViaCapability', () => {
    test('should call /r/{key}/search endpoint with capability key', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            results: [
              {
                type: 'file',
                id: 'file_1',
                file: { id: 'file_1', path: '/notes/test.md' },
                content: 'Test content with search term',
                score: 0.85,
                highlights: [{ start: 18, end: 24 }],
              },
            ],
            total: 1,
          },
          pagination: { hasMore: false },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.searchViaCapability('readKey123', 'search');

      expect(capturedUrl).toBe('https://api.mdplane.dev/r/readKey123/search?q=search');
      expect(result.results.length).toBe(1);
      expect(result.total).toBe(1);
    });

    test('should include filter parameters in capability search request', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: { results: [], total: 0 },
          pagination: { hasMore: false },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.searchViaCapability('readKey123', 'bug', {
        type: 'task',
        status: 'pending',
        author: 'agent-1',
        labels: 'security,backend',
        priority: 'high',
        since: '2024-01-01T00:00:00Z',
        limit: 10,
      });

      expect(capturedUrl).toContain('/r/readKey123/search');
      expect(capturedUrl).toContain('q=bug');
      expect(capturedUrl).toContain('type=task');
      expect(capturedUrl).toContain('status=pending');
      expect(capturedUrl).toContain('author=agent-1');
      expect(capturedUrl).toContain('labels=security%2Cbackend');
      expect(capturedUrl).toContain('priority=high');
      expect(capturedUrl).toContain('since=2024-01-01T00%3A00%3A00Z');
      expect(capturedUrl).toContain('limit=10');
    });

    test('should not include Authorization header in capability search', async () => {
      let capturedHeaders: Record<string, string> | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedHeaders = options.headers as Record<string, string> | undefined;
        return Response.json({
          ok: true,
          data: { results: [], total: 0 },
          pagination: { hasMore: false },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.searchViaCapability('readKey123', 'test');

      expect(capturedHeaders?.Authorization).toBeUndefined();
    });
  });
});
