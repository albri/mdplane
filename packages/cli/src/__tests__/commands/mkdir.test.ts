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
  capturedMethods: string[];
  capturedBodies: string[];
}

function createMockServer(): MockServerState {
  const capturedPaths: string[] = [];
  const capturedMethods: string[] = [];
  const capturedBodies: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      capturedPaths.push(url.pathname);
      capturedMethods.push(req.method);
      if (req.body) {
        capturedBodies.push(await req.text());
      }
      return Response.json({
        ok: true,
        data: { path: '/notes', createdAt: '2024-01-15T10:00:00Z' },
      });
    },
  });
  const port = server.port;
  if (port === undefined) throw new Error('Mock server failed to get port');
  return { server, port, capturedPaths, capturedMethods, capturedBodies };
}

describe('mkdir command', () => {
  describe('ApiClient.createFolder', () => {
    test('should send correct request for folder creation at root', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            path: '/notes',
            createdAt: '2024-01-15T10:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });
      const result = await client.createFolder(undefined, 'notes');

      expect(capturedUrl).toBe('https://api.mdplane.dev/api/v1/folders');
      expect(capturedOptions?.method).toBe('POST');
      const body = JSON.parse(capturedOptions?.body as string) as { name: string };
      expect(body.name).toBe('notes');
      expect(result.path).toBe('/notes');
      expect(result.createdAt).toBe('2024-01-15T10:00:00Z');
    });

    test('should send correct request for nested folder creation', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            path: '/projects/alpha/docs',
            createdAt: '2024-01-15T10:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });
      const result = await client.createFolder('projects/alpha', 'docs');

      expect(capturedUrl).toBe('https://api.mdplane.dev/api/v1/folders/projects%2Falpha');
      expect(capturedOptions?.method).toBe('POST');
      const body = JSON.parse(capturedOptions?.body as string) as { name: string };
      expect(body.name).toBe('docs');
      expect(result.path).toBe('/projects/alpha/docs');
    });

    test('should throw error when folder name is empty', async () => {
      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });

      let error: Error | undefined;
      try {
        await client.createFolder(undefined, '');
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeDefined();
      expect(error?.message).toBe('Folder name is required');
    });

    test('should throw error when folder name is undefined', async () => {
      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });

      let error: Error | undefined;
      try {
        await client.createFolder(undefined, undefined as unknown as string);
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeDefined();
      expect(error?.message).toBe('Folder name is required');
    });

    test('should include Authorization header with API key', async () => {
      let capturedHeaders: Record<string, string> | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedHeaders = options.headers as Record<string, string> | undefined;
        return Response.json({
          ok: true,
          data: {
            path: '/test',
            createdAt: '2024-01-15T10:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'my-api-key' });
      await client.createFolder(undefined, 'test');

      expect(capturedHeaders?.Authorization).toBe('Bearer my-api-key');
    });

    test('should handle server error response', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'FOLDER_ALREADY_EXISTS',
            message: 'Folder already exists at /notes',
          },
        }, { status: 409 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });

      let threw = false;
      try {
        await client.createFolder(undefined, 'notes');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should URL-encode path with special characters', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            path: '/path with spaces/folder',
            createdAt: '2024-01-15T10:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });
      await client.createFolder('path with spaces', 'folder');

      expect(capturedUrl).toBe('https://api.mdplane.dev/api/v1/folders/path%20with%20spaces');
    });

    test('should handle empty path as root folder', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            path: '/notes',
            createdAt: '2024-01-15T10:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'test-key' });
      await client.createFolder('', 'notes');

      expect(capturedUrl).toBe('https://api.mdplane.dev/api/v1/folders');
    });

    test('should send parent path in capability folder create request', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            path: '/projects/alpha/docs',
            createdAt: '2024-01-15T10:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.createFolderViaCapability({ writeKey: 'write-key-123', name: 'docs', parentPath: 'projects/alpha' });

      expect(capturedUrl).toBe('https://api.mdplane.dev/w/write-key-123/folders');
      const body = JSON.parse(capturedOptions?.body as string) as { name: string; path?: string };
      expect(body.name).toBe('docs');
      expect(body.path).toBe('projects/alpha');
    });
  });

  describe('command execution (real CLI)', () => {
    let tempDir: string;
    let mdplaneDir: string;
    let mockServer: MockServerState | null = null;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-mkdir-test-'));
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

    test('uses API key mode and calls /api/v1/folders endpoint', async () => {
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

      await runCliWithCwd('mkdir /notes --json', tempDir);

      expect(mockServer.capturedMethods).toContain('POST');
      expect(mockServer.capturedPaths.some((p) => p.includes('/api/v1/folders'))).toBe(true);
    });

    test('uses capability mode and calls /w/{key}/folders endpoint', async () => {
      mockServer = createMockServer();
      const port = String(mockServer.port);
      const writeKey = 'testWriteKey456';
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: `http://localhost:${port}`,
            mode: 'capability',
            capabilityUrls: {
              write: `http://localhost:${port}/w/${writeKey}`,
            },
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      await runCliWithCwd('mkdir /notes --json', tempDir);

      expect(mockServer.capturedMethods).toContain('POST');
      expect(mockServer.capturedPaths.some((p) => p.includes(`/w/${writeKey}/folders`))).toBe(true);
      const parsedBody = JSON.parse(mockServer.capturedBodies.at(-1) ?? '{}') as { name?: string };
      expect(parsedBody.name).toBe('notes');
    });

    test('uses capability mode nested path with parent path in request body', async () => {
      mockServer = createMockServer();
      const port = String(mockServer.port);
      const writeKey = 'testWriteKeyNested';
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: `http://localhost:${port}`,
            mode: 'capability',
            capabilityUrls: {
              write: `http://localhost:${port}/w/${writeKey}`,
            },
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      await runCliWithCwd('mkdir /projects/alpha/docs --json', tempDir);

      expect(mockServer.capturedMethods).toContain('POST');
      expect(mockServer.capturedPaths.some((p) => p.includes(`/w/${writeKey}/folders`))).toBe(true);
      const parsedBody = JSON.parse(mockServer.capturedBodies.at(-1) ?? '{}') as { name?: string; path?: string };
      expect(parsedBody.name).toBe('docs');
      expect(parsedBody.path).toBe('projects/alpha');
    });

    test('fails when no write key is available', async () => {
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: 'http://localhost:3001',
            mode: 'capability',
            capabilityUrls: { read: 'http://localhost:3001/r/readOnlyKey' },
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      const { stderr, exitCode } = await runCliWithCwd('mkdir /notes --json', tempDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Write key is required');
    });
  });
});
