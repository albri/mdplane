import { describe, test, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCliWithCwd } from '../helpers/run-cli.js';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-claim-test-'));
}

function writeConfig(tempDir: string, config: unknown): void {
  const mdplaneDir = path.join(tempDir, '.mdplane');
  fs.mkdirSync(mdplaneDir, { recursive: true });
  fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(config, null, 2));
}

function isolatedCliEnv(tempDir: string): Record<string, string> {
  return {
    APPDATA: tempDir,
    HOME: tempDir,
    USERPROFILE: tempDir,
    XDG_CONFIG_HOME: path.join(tempDir, '.config'),
  };
}

describe('CLI claim command', () => {
  test('fails when no config exists', async () => {
    const tempDir = createTempDir();
    try {
      const { stderr, exitCode } = await runCliWithCwd('claim --json --no-browser', tempDir, isolatedCliEnv(tempDir));
      expect(exitCode).not.toBe(0);
      const errorOutput = JSON.parse(stderr) as { error: string };
      expect(errorOutput.error).toContain('No mdplane configuration found');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('fails when profile has no write key', async () => {
    const tempDir = createTempDir();
    writeConfig(tempDir, {
      defaultProfile: 'default',
      profiles: {
        default: {
          name: 'default',
          baseUrl: 'https://api.mdplane.dev',
          mode: 'capability',
          capabilityUrls: {
            read: 'https://api.mdplane.dev/r/r_test',
            append: 'https://api.mdplane.dev/a/a_test',
          },
        },
      },
    });

    try {
      const { stderr, exitCode } = await runCliWithCwd('claim --json --no-browser', tempDir, isolatedCliEnv(tempDir));
      expect(exitCode).not.toBe(0);
      const errorOutput = JSON.parse(stderr) as { error: string };
      expect(errorOutput.error).toContain('Write key is required to claim a workspace');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('fails in api-key mode', async () => {
    const tempDir = createTempDir();
    writeConfig(tempDir, {
      defaultProfile: 'default',
      profiles: {
        default: {
          name: 'default',
          baseUrl: 'https://api.mdplane.dev',
          mode: 'api-key',
          apiKey: 'sk_test_123',
        },
      },
    });

    try {
      const { stderr, exitCode } = await runCliWithCwd('claim --json --no-browser', tempDir, isolatedCliEnv(tempDir));
      expect(exitCode).not.toBe(0);
      const errorOutput = JSON.parse(stderr) as { error: string };
      expect(errorOutput.error).toContain('requires capability URL mode');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('fails with invalid provider', async () => {
    const tempDir = createTempDir();
    writeConfig(tempDir, {
      defaultProfile: 'default',
      profiles: {
        default: {
          name: 'default',
          baseUrl: 'https://api.mdplane.dev',
          mode: 'capability',
          capabilityUrls: {
            write: 'w_validkey123',
          },
        },
      },
    });

    try {
      const { stderr, exitCode } = await runCliWithCwd(
        'claim --provider facebook --json --no-browser',
        tempDir,
        isolatedCliEnv(tempDir)
      );
      expect(exitCode).not.toBe(0);
      const errorOutput = JSON.parse(stderr) as { error: string };
      expect(errorOutput.error).toContain('Invalid provider');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('outputs claim URL for default provider without opening browser', async () => {
    const tempDir = createTempDir();
    writeConfig(tempDir, {
      defaultProfile: 'default',
      profiles: {
        default: {
          name: 'default',
          baseUrl: 'https://api.mdplane.dev',
          mode: 'capability',
          capabilityUrls: {
            write: 'w_validkey123',
          },
        },
      },
    });

    try {
      const { stdout, exitCode } = await runCliWithCwd('claim --json --no-browser', tempDir, isolatedCliEnv(tempDir));
      expect(exitCode).toBe(0);
      const output = JSON.parse(stdout) as {
        status: string;
        provider: string;
        url: string;
        message: string;
      };
      expect(output.status).toBe('opening_browser');
      expect(output.provider).toBe('github');
      expect(output.url).toBe('https://app.mdplane.dev/claim/w_validkey123');
      expect(output.message).toContain('Complete OAuth login');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('supports provider and profile selection', async () => {
    const tempDir = createTempDir();
    writeConfig(tempDir, {
      defaultProfile: 'default',
      profiles: {
        default: {
          name: 'default',
          baseUrl: 'https://api.mdplane.dev',
          mode: 'capability',
          capabilityUrls: {
            write: 'w_default',
          },
        },
        prod: {
          name: 'prod',
          baseUrl: 'https://api.prod.mdplane.dev',
          mode: 'capability',
          capabilityUrls: {
            write: 'w_prod',
          },
        },
      },
    });

    try {
      const { stdout, exitCode } = await runCliWithCwd(
        'claim --profile prod --provider google --json --no-browser',
        tempDir,
        isolatedCliEnv(tempDir)
      );
      expect(exitCode).toBe(0);
      const output = JSON.parse(stdout) as { provider: string; url: string };
      expect(output.provider).toBe('google');
      expect(output.url).toBe('https://app.mdplane.dev/claim/w_prod');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('extracts key from capability URL before building redirect URL', async () => {
    const tempDir = createTempDir();
    writeConfig(tempDir, {
      defaultProfile: 'default',
      profiles: {
        default: {
          name: 'default',
          baseUrl: 'https://api.mdplane.dev',
          mode: 'capability',
          capabilityUrls: {
            write: 'https://api.mdplane.dev/w/w_url_key_123',
          },
        },
      },
    });

    try {
      const { stdout, exitCode } = await runCliWithCwd('claim --json --no-browser', tempDir, isolatedCliEnv(tempDir));
      expect(exitCode).toBe(0);
      const output = JSON.parse(stdout) as { url: string };
      expect(output.url).toBe('https://app.mdplane.dev/claim/w_url_key_123');
      expect(output.url).not.toContain('/claim/https://');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
