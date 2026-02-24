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
}

function createMockServer(): MockServerState {
  const capturedPaths: string[] = [];
  const capturedMethods: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      capturedPaths.push(url.pathname);
      capturedMethods.push(req.method);
      return Response.json({
        ok: true,
        data: { id: 'file-123', deleted: true, recoverable: true },
      });
    },
  });
  const port = server.port;
  if (port === undefined) throw new Error('Mock server failed to get port');
  return { server, port, capturedPaths, capturedMethods };
}

describe('rm command', () => {
  describe('ApiClient.deleteFile', () => {
    test('should send correct request for soft delete', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            id: 'file-123',
            deleted: true,
            recoverable: true,
            expiresAt: '2024-01-22T10:00:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.deleteFile('write-key-123', false, '/notes/old.md');

      expect(capturedUrl).toContain('/w/write-key-123/notes/old.md');
      expect(result.deleted).toBe(true);
      expect(result.recoverable).toBe(true);
    });

    test('should send permanent delete request', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            id: 'file-123',
            deleted: true,
            recoverable: false,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.deleteFile('write-key-123', true, '/notes/old.md');

      expect(capturedUrl).toContain('permanent=true');
      expect(capturedUrl).toContain('/w/write-key-123/notes/old.md');
      expect(result.recoverable).toBe(false);
    });
  });

  describe('ApiClient.deleteFileByPath', () => {
    test('should delete file by path using API key', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            id: 'file-123',
            deleted: true,
            recoverable: true,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      await client.deleteFileByPath('/notes/old.md');

      expect(capturedUrl).toContain('/api/v1/files/');
    });
  });

  describe('ApiClient.deleteFolderByPath', () => {
    test('should delete folder by path', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            path: '/old-folder',
            deleted: true,
            recoverable: true,
            filesDeleted: 5,
            foldersDeleted: 2,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.deleteFolderByPath('/old-folder/');

      expect(capturedUrl).toContain('/api/v1/folders/');
      expect(result.filesDeleted).toBe(5);
      expect(result.foldersDeleted).toBe(2);
    });
  });

  describe('ApiClient.deleteFolderViaCapability', () => {
    test('should normalize leading and trailing slashes in folder path', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            path: '/notes',
            deleted: true,
            recoverable: true,
            filesDeleted: 1,
            foldersDeleted: 0,
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.deleteFolderViaCapability('write-key-123', '/notes/');

      expect(capturedUrl).toBe('https://api.mdplane.dev/w/write-key-123/folders/notes');
    });
  });

  describe('path type detection', () => {
    test('should detect folder path by trailing slash', () => {
      const isFolder = (path: string): boolean => path.endsWith('/');
      expect(isFolder('/notes/')).toBe(true);
      expect(isFolder('/notes/file.md')).toBe(false);
    });

    test('should detect file path without trailing slash', () => {
      const isFile = (path: string): boolean => !path.endsWith('/');
      expect(isFile('/notes/file.md')).toBe(true);
      expect(isFile('/notes/')).toBe(false);
    });
  });

  describe('write key validation', () => {
    test('should detect missing write key', () => {
      const keys: { readKey: string; appendKey: string; writeKey: string | null } = { readKey: 'r_test', appendKey: 'a_test', writeKey: null };
      const hasWriteKey = keys.writeKey != null && keys.writeKey !== '';
      expect(hasWriteKey).toBe(false);
    });

    test('should accept valid write key', () => {
      const keys: { readKey: string; appendKey: string; writeKey: string | null } = { readKey: 'r_test', appendKey: 'a_test', writeKey: 'w_valid' };
      const hasWriteKey = keys.writeKey != null && keys.writeKey !== '';
      expect(hasWriteKey).toBe(true);
    });
  });

  describe('command execution (real CLI)', () => {
    let tempDir: string;
    let mdplaneDir: string;
    let mockServer: MockServerState | null = null;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-rm-test-'));
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

    test('uses API key mode and calls /api/v1/files endpoint', async () => {
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

      await runCliWithCwd('rm /notes/test.md --json', tempDir);

      expect(mockServer.capturedMethods).toContain('DELETE');
      expect(mockServer.capturedPaths.some((p) => p.includes('/api/v1/files/'))).toBe(true);
    });

    test('uses capability mode and calls /w/{key}/{path} endpoint', async () => {
      mockServer = createMockServer();
      const port = String(mockServer.port);
      const writeKey = 'testWriteKey123';
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

      await runCliWithCwd('rm /notes/test.md --json', tempDir);

      expect(mockServer.capturedMethods).toContain('DELETE');
      expect(mockServer.capturedPaths.some((p) => p.includes(`/w/${writeKey}/notes/test.md`))).toBe(true);
    });

    test('uses capability mode folder delete endpoint without double slash', async () => {
      mockServer = createMockServer();
      const port = String(mockServer.port);
      const writeKey = 'testWriteKeyFolderDelete';
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

      await runCliWithCwd('rm /notes/ --json', tempDir);

      expect(mockServer.capturedMethods).toContain('DELETE');
      expect(mockServer.capturedPaths).toContain(`/w/${writeKey}/folders/notes`);
      expect(mockServer.capturedPaths.some((p) => p.includes('//notes'))).toBe(false);
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

      const { stderr, exitCode } = await runCliWithCwd('rm /notes/test.md --json', tempDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Write key is required');
    });
  });
});
