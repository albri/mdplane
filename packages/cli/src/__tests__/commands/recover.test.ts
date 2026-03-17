import { describe, test, expect, vi, beforeEach, afterEach } from 'bun:test';
import { ApiClient } from '../../api.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCliWithCwd } from '../helpers/run-cli.js';

describe('recover command', () => {
  describe('ApiClient.recoverFile', () => {
    test('should send correct request for file recovery', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            id: 'file_abc123',
            recovered: true,
            path: '/notes/deleted.md',
            urls: {
              read: 'https://api.mdplane.dev/r/read-key',
              append: 'https://api.mdplane.dev/a/append-key',
              write: 'https://api.mdplane.dev/w/write-key',
            },
            webUrl: 'https://app.mdplane.dev/w/write-key',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.recoverFile('test-write-key');

      expect(capturedUrl).toBe('https://api.mdplane.dev/w/test-write-key/recover');
      expect(capturedOptions?.method).toBe('POST');
      expect(result.recovered).toBe(true);
      expect(result.path).toBe('/notes/deleted.md');
    });

    test('should send rotateUrls=true when requested', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            id: 'file_abc123',
            recovered: true,
            path: '/notes/deleted.md',
            urls: {
              read: 'https://api.mdplane.dev/r/new-read-key',
              append: 'https://api.mdplane.dev/a/new-append-key',
              write: 'https://api.mdplane.dev/w/new-write-key',
            },
            webUrl: 'https://app.mdplane.dev/w/new-write-key',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.recoverFile('test-write-key', true);

      expect(capturedUrl).toBe('https://api.mdplane.dev/w/test-write-key/recover?rotateUrls=true');
    });

    test('should not include rotateUrls param when false', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            id: 'file_abc123',
            recovered: true,
            path: '/notes/deleted.md',
            urls: { read: '', append: '', write: '' },
            webUrl: '',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.recoverFile('test-write-key', false);

      expect(capturedUrl).toBe('https://api.mdplane.dev/w/test-write-key/recover');
    });

    test('should handle file not found error', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found or not deleted',
          },
        }, { status: 404 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.recoverFile('test-write-key');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should handle recovery window expired error', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'RECOVERY_EXPIRED',
            message: 'File recovery window has expired',
          },
        }, { status: 410 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.recoverFile('test-write-key');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    test('should return all expected fields in response', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            id: 'file_xyz789',
            recovered: true,
            path: '/archive/old.md',
            urls: {
              read: 'https://api.mdplane.dev/r/r-key',
              append: 'https://api.mdplane.dev/a/a-key',
              write: 'https://api.mdplane.dev/w/w-key',
            },
            webUrl: 'https://app.mdplane.dev/w/w-key',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.recoverFile('test-write-key');

      expect(result.id).toBe('file_xyz789');
      expect(result.recovered).toBe(true);
      expect(result.path).toBe('/archive/old.md');
      expect(result.urls.read).toBe('https://api.mdplane.dev/r/r-key');
      expect(result.urls.append).toBe('https://api.mdplane.dev/a/a-key');
      expect(result.urls.write).toBe('https://api.mdplane.dev/w/w-key');
      expect(result.webUrl).toBe('https://app.mdplane.dev/w/w-key');
    });
  });

  describe('command execution (real CLI)', () => {
    let tempDir: string;
    let mdplaneDir: string;
    let server: ReturnType<typeof Bun.serve> | null = null;
    let capturedPaths: string[] = [];

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-recover-cli-test-'));
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
              recovered: true,
              path: '/notes/deleted.md',
              urls: {
                read: 'https://api.mdplane.dev/r/new-read',
                append: 'https://api.mdplane.dev/a/new-append',
                write: 'https://api.mdplane.dev/w/new-write',
              },
              webUrl: 'https://app.mdplane.dev/w/new-write',
            },
          });
        },
      });

      const port = String(server.port);
      const writeKey = 'writeKeyForRecoverCli';
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

      const { exitCode } = await runCliWithCwd('recover /notes/deleted.md --json', tempDir);
      expect(exitCode).toBe(0);
      expect(capturedPaths).toContain(`/w/${writeKey}/recover`);
    });
  });
});
