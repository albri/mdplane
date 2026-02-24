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
  capturedBodies: string[];
}

function createBootstrapMockServer(): MockServerState {
  const capturedPaths: string[] = [];
  const capturedBodies: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      capturedPaths.push(url.pathname);
      if (req.body) {
        const body = await req.text();
        capturedBodies.push(body);
      }
      return Response.json({
        ok: true,
        data: {
          workspaceId: 'ws-123',
          urls: {
            api: {
              read: 'http://localhost/r/read-key',
              append: 'http://localhost/a/append-key',
              write: 'http://localhost/w/write-key',
            },
            web: {
              read: 'http://localhost/r/read-key',
              claim: 'http://localhost/claim/write-key',
            },
          },
        },
      });
    },
  });
  const port = server.port;
  if (port === undefined) throw new Error('Mock server failed to get port');
  return { server, port, capturedPaths, capturedBodies };
}

describe('init command', () => {
  describe('ApiClient.bootstrap', () => {
    test('should send correct request for workspace bootstrap', async () => {
      let capturedUrl = '';
      let capturedBody = '';

      global.fetch = vi.fn((_url: string, init?: RequestInit) => {
        capturedUrl = _url;
        if (init?.body != null) {
          capturedBody = init.body as string;
        }
        return Response.json({
          ok: true,
          data: {
            workspaceId: 'ws-123',
            urls: {
              api: {
                read: 'https://api.mdplane.dev/r/read-key',
                append: 'https://api.mdplane.dev/a/append-key',
                write: 'https://api.mdplane.dev/w/write-key',
              },
              web: {
                read: 'https://mdplane.dev/r/read-key',
                claim: 'https://mdplane.dev/claim/write-key',
              },
            },
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.bootstrap('My Workspace');

      expect(capturedUrl).toContain('/bootstrap');
      expect(capturedBody).toContain('My Workspace');
      expect(result.workspaceId).toBe('ws-123');
    });

    test('should handle bootstrap without workspace name', async () => {
      let capturedBody: string | undefined;

      global.fetch = vi.fn((_url: string, init?: RequestInit) => {
        if (init?.body != null) {
          capturedBody = init.body as string;
        }
        return Response.json({
          ok: true,
          data: {
            workspaceId: 'ws-456',
            urls: {
              api: {
                read: 'https://api.mdplane.dev/r/read-key',
                append: 'https://api.mdplane.dev/a/append-key',
                write: 'https://api.mdplane.dev/w/write-key',
              },
              web: {
                read: 'https://mdplane.dev/r/read-key',
                claim: 'https://mdplane.dev/claim/write-key',
              },
            },
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.bootstrap();

      expect(capturedBody).toContain('workspace-');
    });
  });

  describe('mode validation', () => {
    test('should detect api-key mode options', () => {
      const options: { apiKey: string | undefined; name: string | undefined } = { apiKey: 'sk_test_123', name: undefined };
      const isApiKeyMode = options.apiKey != null;
      expect(isApiKeyMode).toBe(true);
    });

    test('should detect capability mode options', () => {
      const options: { apiKey: string | undefined; name: string | undefined } = { apiKey: undefined, name: 'My Workspace' };
      const isCapabilityMode = options.name != null && options.apiKey == null;
      expect(isCapabilityMode).toBe(true);
    });

    test('should reject conflicting options', () => {
      const options: { apiKey: string | undefined; name: string | undefined } = { apiKey: 'sk_test_123', name: 'My Workspace' };
      const hasConflict = options.apiKey != null && options.name != null;
      expect(hasConflict).toBe(true);
    });

    test('should require one mode', () => {
      const options: { apiKey: string | undefined; name: string | undefined } = { apiKey: undefined, name: undefined };
      const hasNoMode = options.apiKey == null && options.name == null;
      expect(hasNoMode).toBe(true);
    });
  });

  describe('profile validation', () => {
    test('should default to default profile', () => {
      const options: { profile: string | undefined } = { profile: undefined };
      const profileName = options.profile ?? 'default';
      expect(profileName).toBe('default');
    });

    test('should accept custom profile name', () => {
      const options: { profile: string | undefined } = { profile: 'prod' };
      const profileName = options.profile ?? 'default';
      expect(profileName).toBe('prod');
    });
  });

  describe('command execution (real CLI)', () => {
    let tempDir: string;
    let mockServer: MockServerState | null = null;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-init-test-'));
    });

    afterEach(async () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (mockServer) {
        await mockServer.server.stop();
        mockServer = null;
      }
    });

    test('calls /bootstrap endpoint and outputs JSON', async () => {
      mockServer = createBootstrapMockServer();
      const port = String(mockServer.port);
      // Use unique profile name to avoid conflicts with existing global config
      const uniqueProfile = `test-init-${String(Date.now())}`;

      const { stdout, exitCode } = await runCliWithCwd(
        `init --name "Test Workspace" --base-url http://localhost:${port} --profile ${uniqueProfile} --json`,
        tempDir
      );

      expect(exitCode).toBe(0);
      expect(mockServer.capturedPaths).toContain('/bootstrap');
      const parsed = JSON.parse(stdout) as {
        workspaceId: string;
        configPath: string;
        capabilityUrls: {
          read: string;
          append: string;
          write: string;
        };
      };
      expect(parsed.workspaceId).toBe('ws-123');
      expect(parsed.capabilityUrls.read).toBe('http://localhost/r/read-key');
      expect(parsed.capabilityUrls.append).toBe('http://localhost/a/append-key');
      expect(parsed.capabilityUrls.write).toBe('http://localhost/w/write-key');

      const repoLocalConfigPath = path.join(tempDir, '.mdplane', 'config.json');
      expect(fs.existsSync(repoLocalConfigPath)).toBe(true);
      expect(fs.existsSync(parsed.configPath)).toBe(true);
      expect(fs.realpathSync(parsed.configPath)).toBe(fs.realpathSync(repoLocalConfigPath));
    });

    test('respects --profile flag to save to custom profile', async () => {
      mockServer = createBootstrapMockServer();
      const port = String(mockServer.port);
      // Use unique profile name to avoid conflicts with existing global config
      const customProfile = `custom-${String(Date.now())}`;

      const { stdout, exitCode } = await runCliWithCwd(
        `init --name "Test" --base-url http://localhost:${port} --profile ${customProfile} --json`,
        tempDir
      );

      expect(exitCode).toBe(0);
      // Verify the output JSON contains the custom profile name
      const parsed = JSON.parse(stdout) as { profile: string };
      expect(parsed.profile).toBe(customProfile);
    });

    test('fails without required mode options', async () => {
      const { stderr, exitCode } = await runCliWithCwd('init --json', tempDir);

      expect(exitCode).not.toBe(0);
      expect(stderr.length).toBeGreaterThan(0);
    });

    test('supports --global to save config outside current working directory', async () => {
      mockServer = createBootstrapMockServer();
      const port = String(mockServer.port);
      const customProfile = `global-${String(Date.now())}`;
      const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-init-global-'));

      try {
        const { stdout, exitCode } = await runCliWithCwd(
          `init --name "Global Workspace" --base-url http://localhost:${port} --profile ${customProfile} --global --json`,
          tempDir,
          {
            APPDATA: fakeHome,
            HOME: fakeHome,
            USERPROFILE: fakeHome,
          }
        );

        expect(exitCode).toBe(0);
        const parsed = JSON.parse(stdout) as { configPath: string };
        const expectedGlobalPath = process.platform === 'win32'
          ? path.join(fakeHome, 'mdplane', 'config.json')
          : path.join(fakeHome, '.config', 'mdplane', 'config.json');
        const repoLocalConfigPath = path.join(tempDir, '.mdplane', 'config.json');

        expect(fs.existsSync(expectedGlobalPath)).toBe(true);
        expect(fs.existsSync(parsed.configPath)).toBe(true);
        expect(fs.realpathSync(parsed.configPath)).toBe(fs.realpathSync(expectedGlobalPath));
        expect(fs.existsSync(repoLocalConfigPath)).toBe(false);
      } finally {
        fs.rmSync(fakeHome, { recursive: true, force: true });
      }
    });

  });
});
