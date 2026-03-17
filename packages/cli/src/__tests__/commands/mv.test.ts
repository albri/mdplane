import { describe, test, expect, vi, beforeEach, afterEach } from 'bun:test';
import { ApiClient } from '../../api.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCliWithCwd } from '../helpers/run-cli.js';

describe('mv command', () => {
  describe('ApiClient.moveFile', () => {
    test('should send correct request for file move', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            id: 'file1',
            previousPath: '/notes/old.md',
            newPath: '/archive/old.md',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.moveFile({ writeKey: 'test-write-key', source: '/notes/old.md', destination: '/archive/' });

      expect(capturedUrl).toBe('https://api.mdplane.dev/w/test-write-key/move');
      expect(capturedOptions?.method).toBe('POST');
      const body = JSON.parse(capturedOptions?.body as string) as { source: string; destination: string };
      expect(body.source).toBe('/notes/old.md');
      expect(body.destination).toBe('/archive/');
      expect(result.newPath).toBe('/archive/old.md');
    });

    test('should move file to root folder', async () => {
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            id: 'file1',
            previousPath: '/notes/file.md',
            newPath: '/file.md',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.moveFile({ writeKey: 'test-write-key', source: '/notes/file.md', destination: '/' });

      const body = JSON.parse(capturedOptions?.body as string) as { destination: string };
      expect(body.destination).toBe('/');
      expect(result.newPath).toBe('/file.md');
    });

    test('should handle server error response', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found at /notes/missing.md',
          },
        }, { status: 404 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.moveFile({ writeKey: 'test-write-key', source: '/notes/missing.md', destination: '/archive/' });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should handle destination folder not found', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'FOLDER_NOT_FOUND',
            message: 'Destination folder not found',
          },
        }, { status: 404 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.moveFile({ writeKey: 'test-write-key', source: '/notes/file.md', destination: '/nonexistent/' });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should handle file already exists at destination', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'FILE_ALREADY_EXISTS',
            message: 'File already exists at destination',
          },
        }, { status: 409 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.moveFile({ writeKey: 'test-write-key', source: '/notes/file.md', destination: '/archive/' });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should URL-encode paths with special characters', async () => {
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            id: 'file_abc123',
            previousPath: '/path with spaces/file.md',
            newPath: '/new folder/file.md',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.moveFile({ writeKey: 'test-write-key', source: '/path with spaces/file.md', destination: '/new folder/' });

      const body = JSON.parse(capturedOptions?.body as string) as { source: string; destination: string };
      expect(body.source).toBe('/path with spaces/file.md');
      expect(body.destination).toBe('/new folder/');
    });

    test('should return id, previousPath, and newPath in response', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            id: 'file_def456',
            previousPath: '/a/b.md',
            newPath: '/c/b.md',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.moveFile({ writeKey: 'test-write-key', source: '/a/b.md', destination: '/c/' });

      expect(result.id).toBe('file_def456');
      expect(result.previousPath).toBe('/a/b.md');
      expect(result.newPath).toBe('/c/b.md');
    });
  });

  describe('command execution (real CLI)', () => {
    let tempDir: string;
    let mdplaneDir: string;
    let server: ReturnType<typeof Bun.serve> | null = null;
    let capturedPaths: string[] = [];

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-mv-cli-test-'));
      mdplaneDir = path.join(tempDir, '.mdplane');
      fs.mkdirSync(mdplaneDir);
      capturedPaths = [];
    });

    afterEach(async () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (server != null) {
        await server.stop();
        server = null;
      }
    });

    test('uses extracted write key from capability URL profile', async () => {
      server = Bun.serve({
        port: 0,
        fetch(req) {
          const url = new URL(req.url);
          capturedPaths.push(url.pathname);
          return Response.json({
            ok: true,
            data: {
              id: 'file_1',
              previousPath: '/notes/old.md',
              newPath: '/archive/old.md',
            },
          });
        },
      });

      const port = String(server.port);
      const writeKey = 'writeKeyForMvCli';
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

      const { exitCode } = await runCliWithCwd('mv /notes/old.md /archive/ --json', tempDir);
      expect(exitCode).toBe(0);
      expect(capturedPaths).toContain(`/w/${writeKey}/move`);
    });
  });
});
