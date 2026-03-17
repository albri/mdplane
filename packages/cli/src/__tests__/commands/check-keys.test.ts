import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCliWithCwd } from '../helpers/run-cli.js';

describe('check-keys command', () => {
  let tempDir: string;
  let mdplaneDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-check-keys-test-'));
    mdplaneDir = path.join(tempDir, '.mdplane');
    fs.mkdirSync(mdplaneDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('displays help when --help flag is provided', async () => {
    const { stdout, exitCode } = await runCliWithCwd('check-keys --help', tempDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('check-keys');
  });

  test('fails when no keys are configured', async () => {
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

    const { stdout, stderr, exitCode } = await runCliWithCwd('check-keys --json', tempDir);
    const output = stdout || stderr;

    expect(exitCode).not.toBe(0);
    expect(output).toContain('No keys to check');
  });

  test('validates keys from config file', async () => {
    let receivedKeys: string[] = [];
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === '/capabilities/check') {
          const body = await req.json() as { keys?: string[] };
          receivedKeys = body.keys ?? [];
          return Response.json({
            ok: true,
            data: {
              results: [
                { key: 'testKey...', valid: true, permission: 'read', scope: 'workspace' },
              ],
            },
          });
        }
        return new Response('Not Found', { status: 404 });
      },
    });

    try {
      const port = String(server.port);
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: `http://localhost:${port}`,
            mode: 'capability',
            capabilityUrls: {
              read: `http://localhost:${port}/r/testKey123`,
            },
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      const { stdout, exitCode } = await runCliWithCwd('check-keys --json', tempDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('valid');
      expect(receivedKeys).toEqual(['testKey123']);
    } finally {
      await server.stop();
    }
  });

  test('reports invalid keys', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === '/capabilities/check') {
          return Response.json({
            ok: true,
            data: {
              results: [
                { key: 'badKey...', valid: false, error: 'NOT_FOUND' },
              ],
            },
          });
        }
        return new Response('Not Found', { status: 404 });
      },
    });

    try {
      const port = String(server.port);
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: `http://localhost:${port}`,
            mode: 'capability',
            capabilityUrls: {
              read: `http://localhost:${port}/r/badKey123`,
            },
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      const { stdout, exitCode } = await runCliWithCwd('check-keys --json', tempDir);

      expect(exitCode).not.toBe(0);
      expect(stdout).toContain('NOT_FOUND');
    } finally {
      await server.stop();
    }
  });
});
