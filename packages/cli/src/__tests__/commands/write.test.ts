import { describe, test, expect, beforeEach, afterEach, vi } from 'bun:test';
import { ApiClient } from '../../api.js';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runCliWithCwd } from '../helpers/run-cli.js';

describe('write command ETag handling', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-write-test-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tempDir);
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    originalEnv = process.env;
    process.env = { ...originalEnv, APPDATA: tempDir };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    process.env = originalEnv;
  });

  describe('API key mode', () => {
    test('should fetch ETag and send If-Match header when not forcing', async () => {
      const readETag = 'abc123';
      const writeETag = 'def456';

      let requestCount = 0;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        requestCount++;

        if (requestCount === 1) {
          expect(_url).toContain('/api/v1/files/test.md');
          expect(options.method).toBe('GET');

          return Response.json(
            {
              ok: true,
              data: {
                id: 'file1',
                filename: 'test.md',
                content: 'old content',
                etag: readETag,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                appendCount: 0,
                size: 11,
              },
            },
            {
              headers: { 'ETag': readETag },
            }
          );
        }

        if (requestCount === 2) {
          expect(_url).toContain('/api/v1/files/test.md');
          expect(options.method).toBe('PUT');
          expect(options.headers).toHaveProperty('If-Match', readETag);

          return Response.json(
            {
              ok: true,
              data: {
                id: 'file1',
                etag: writeETag,
                updatedAt: '2024-01-01T01:00:00Z',
                size: 10,
              },
            },
            {
              headers: { 'ETag': writeETag },
            }
          );
        }

        throw new Error('Unexpected request');
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.readFileByPath('test.md');
      expect(result.etag).toBe(readETag);

      const writeResult = await client.writeFileByPath({ path: 'test.md', content: 'new content', etag: readETag });
      expect(writeResult.etag).toBe(writeETag);
      expect(requestCount).toBe(2);
    });

    test('should fail with 412 when ETag mismatches', async () => {
      let requestCount = 0;
      const staleETag = 'abc123';

      global.fetch = vi.fn(() => {
        requestCount++;

        if (requestCount === 1) {
          return Response.json({
            ok: true,
            data: {
              id: 'file1',
              path: 'test.md',
              filename: 'test.md',
              content: 'old content',
              etag: 'xyz789',
              created: '2024-01-01T00:00:00Z',
              modified: '2024-01-01T00:00:00Z',
              appendCount: 0,
              size: 11,
            },
          });
        }

        if (requestCount === 2) {
          return Response.json(
            {
              ok: false,
              error: {
                code: 'ETAG_MISMATCH',
                message: 'File was modified since last read',
              },
            },
            { status: 412 }
          );
        }

        throw new Error('Unexpected request');
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      await client.readFileByPath('test.md');

      let threw = false;
      try {
        await client.writeFileByPath({ path: 'test.md', content: 'new content', etag: staleETag });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
      expect(requestCount).toBe(2);
    });

    test('should succeed without If-Match when forcing', async () => {
      const writeETag = 'def456';

      let requestCount = 0;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        requestCount++;

        expect(_url).toContain('/api/v1/files/test.md');
        expect(options.method).toBe('PUT');

        const headers = options.headers as Record<string, string>;
        expect(headers['If-Match']).toBeUndefined();

        return Response.json(
          {
            ok: true,
            data: {
              id: 'file1',
              path: 'test.md',
              etag: writeETag,
              modified: '2024-01-01T01:00:00Z',
              size: 10,
            },
          },
          {
            headers: { 'ETag': writeETag },
          }
        );
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      const result = await client.writeFileByPath({ path: 'test.md', content: 'new content' });
      expect(result.etag).toBe(writeETag);
      expect(requestCount).toBe(1);
    });
  });

  describe('capability mode', () => {
    test('should write without pre-read or If-Match when not forcing', async () => {
      const writeETag = 'def456';

      let requestCount = 0;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        requestCount++;

        expect(_url).toContain('/w/write123/notes/test.md');
        expect(options.method).toBe('PUT');
        const headers = options.headers as Record<string, string>;
        expect(headers['If-Match']).toBeUndefined();

        return Response.json(
          {
            ok: true,
            data: {
              id: 'file1',
              path: 'test.md',
              etag: writeETag,
              modified: '2024-01-01T01:00:00Z',
              size: 10,
            },
          },
          {
            headers: { 'ETag': writeETag },
          }
        );
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
      });

      const writeResult = await client.updateFile({
        writeKey: 'write123',
        path: '/notes/test.md',
        content: 'new content',
      });
      expect(writeResult.etag).toBe(writeETag);
      expect(requestCount).toBe(1);
    });

    test('should fail with 412 when ETag mismatches', async () => {
      let requestCount = 0;
      const staleETag = 'abc123';

      global.fetch = vi.fn(() => {
        requestCount++;

        if (requestCount === 1) {
          return Response.json({
            ok: true,
            data: {
              id: 'file1',
              filename: 'test.md',
              content: 'old content',
              etag: 'xyz789',
              created: '2024-01-01T00:00:00Z',
              modified: '2024-01-01T00:00:00Z',
              appendCount: 0,
              size: 11,
            },
          });
        }

        if (requestCount === 2) {
          return Response.json(
            {
              ok: false,
              error: {
                code: 'ETAG_MISMATCH',
                message: 'File was modified since last read',
              },
            },
            { status: 412 }
          );
        }

        throw new Error('Unexpected request');
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
      });

      await client.getFile('read123', '/notes/test.md');

      let threw = false;
      try {
        await client.updateFile({
          writeKey: 'write123',
          path: '/notes/test.md',
          content: 'new content',
          etag: staleETag,
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
      expect(requestCount).toBe(2);
    });

    test('should succeed without If-Match when forcing', async () => {
      const writeETag = 'def456';

      let requestCount = 0;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        requestCount++;

        expect(_url).toContain('/w/write123/notes/test.md');
        expect(options.method).toBe('PUT');

        const headers = options.headers as Record<string, string>;
        expect(headers['If-Match']).toBeUndefined();

        return Response.json(
          {
            ok: true,
            data: {
              id: 'file1',
              path: 'test.md',
              etag: writeETag,
              modified: '2024-01-01T01:00:00Z',
              size: 10,
            },
          },
          {
            headers: { 'ETag': writeETag },
          }
        );
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
      });

      const result = await client.updateFile({
        writeKey: 'write123',
        path: '/notes/test.md',
        content: 'new content',
      });
      expect(result.etag).toBe(writeETag);
      expect(requestCount).toBe(1);
    });
  });

  describe('command execution (real CLI)', () => {
    let commandTempDir: string;
    let mdplaneDir: string;
    let server: ReturnType<typeof Bun.serve> | null = null;
    let capturedPaths: string[] = [];
    let capturedMethods: string[] = [];

    beforeEach(() => {
      commandTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-write-cli-test-'));
      mdplaneDir = path.join(commandTempDir, '.mdplane');
      fs.mkdirSync(mdplaneDir);
      capturedPaths = [];
      capturedMethods = [];
    });

    afterEach(async () => {
      fs.rmSync(commandTempDir, { recursive: true, force: true });
      if (server != null) {
        await server.stop();
        server = null;
      }
    });

    test('uses extracted capability keys from profile URLs', async () => {
      server = Bun.serve({
        port: 0,
        fetch(req) {
          const url = new URL(req.url);
          capturedPaths.push(url.pathname);
          capturedMethods.push(req.method);

          if (req.method === 'GET') {
            return Response.json({
              ok: true,
              data: {
                id: 'file1',
                filename: 'test.md',
                content: 'old',
                etag: 'etag-123',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                appendCount: 0,
                size: 3,
              },
            });
          }

          return Response.json({
            ok: true,
            data: {
              id: 'file1',
              etag: 'etag-456',
              updatedAt: '2024-01-01T01:00:00Z',
              size: 11,
            },
          });
        },
      });

      const port = String(server.port);
      const readKey = 'readKeyForWriteCli';
      const writeKey = 'writeKeyForWriteCli';

      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: `http://localhost:${port}`,
            mode: 'capability',
            capabilityUrls: {
              read: `http://localhost:${port}/r/${readKey}`,
              write: `http://localhost:${port}/w/${writeKey}`,
            },
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      const { exitCode } = await runCliWithCwd('write /notes/test.md "new content" --json', commandTempDir);
      expect(exitCode).toBe(0);

      expect(capturedMethods).toContain('PUT');
      expect(capturedPaths).toContain(`/w/${writeKey}/notes/test.md`);
    });
  });
});
