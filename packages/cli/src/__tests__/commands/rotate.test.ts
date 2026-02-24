import { describe, test, expect, vi, beforeEach, afterEach } from 'bun:test';
import { ApiClient } from '../../api.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCliWithCwd } from '../helpers/run-cli.js';

describe('rotate command', () => {
  describe('ApiClient.rotateUrls', () => {
    test('should send correct request for URL rotation', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            id: 'file_abc123',
            urls: {
              read: 'https://api.mdplane.dev/r/new-read-key',
              append: 'https://api.mdplane.dev/a/new-append-key',
              write: 'https://api.mdplane.dev/w/new-write-key',
            },
            previousUrlsInvalidated: true,
            webUrl: 'https://app.mdplane.dev/w/new-write-key',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.rotateUrls('test-write-key');

      expect(capturedUrl).toBe('https://api.mdplane.dev/w/test-write-key/rotate');
      expect(capturedOptions?.method).toBe('POST');
      expect(result.previousUrlsInvalidated).toBe(true);
    });

    test('should return new URLs after rotation', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            id: 'file_xyz789',
            urls: {
              read: 'https://api.mdplane.dev/r/rotated-read',
              append: 'https://api.mdplane.dev/a/rotated-append',
              write: 'https://api.mdplane.dev/w/rotated-write',
            },
            previousUrlsInvalidated: true,
            webUrl: 'https://app.mdplane.dev/w/rotated-write',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.rotateUrls('test-write-key');

      expect(result.id).toBe('file_xyz789');
      expect(result.urls.read).toBe('https://api.mdplane.dev/r/rotated-read');
      expect(result.urls.append).toBe('https://api.mdplane.dev/a/rotated-append');
      expect(result.urls.write).toBe('https://api.mdplane.dev/w/rotated-write');
      expect(result.webUrl).toBe('https://app.mdplane.dev/w/rotated-write');
    });

    test('should handle invalid key error', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'INVALID_KEY',
            message: 'Invalid capability key',
          },
        }, { status: 404 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.rotateUrls('invalid-key');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should handle file deleted error', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'FILE_DELETED',
            message: 'Cannot rotate URLs for deleted file',
          },
        }, { status: 410 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.rotateUrls('test-write-key');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should handle permission denied for read key', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Write key required for URL rotation',
          },
        }, { status: 403 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.rotateUrls('read-only-key');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should confirm previousUrlsInvalidated is true', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            id: 'file_abc',
            urls: { read: '', append: '', write: '' },
            previousUrlsInvalidated: true,
            webUrl: '',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.rotateUrls('test-write-key');

      expect(result.previousUrlsInvalidated).toBe(true);
    });
  });

  describe('command execution (real CLI)', () => {
    let tempDir: string;
    let mdplaneDir: string;
    let server: ReturnType<typeof Bun.serve> | null = null;
    let capturedPaths: string[] = [];

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-rotate-cli-test-'));
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
              urls: {
                read: 'https://api.mdplane.dev/r/new-read',
                append: 'https://api.mdplane.dev/a/new-append',
                write: 'https://api.mdplane.dev/w/new-write',
              },
              previousUrlsInvalidated: true,
              webUrl: 'https://app.mdplane.dev/w/new-write',
            },
          });
        },
      });

      const port = String(server.port);
      const writeKey = 'writeKeyForRotateCli';
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

      const { exitCode } = await runCliWithCwd('rotate --json', tempDir);
      expect(exitCode).toBe(0);
      expect(capturedPaths).toContain(`/w/${writeKey}/rotate`);
    });
  });
});
