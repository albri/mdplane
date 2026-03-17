import { describe, test, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCli, runCliWithCwd } from '../helpers/run-cli.js';

function createCapabilityConfig(tempDir: string): void {
  const mdplaneDir = path.join(tempDir, '.mdplane');
  fs.mkdirSync(mdplaneDir, { recursive: true });
  const configContent = {
    defaultProfile: 'default',
    profiles: {
      default: {
        name: 'default',
        baseUrl: 'http://localhost:3001',
        mode: 'capability',
        capabilityUrls: { read: 'test_read_key' },
      },
    },
  };
  fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent, null, 2));
}

function isolatedCliEnv(tempDir: string): Record<string, string> {
  return {
    APPDATA: tempDir,
    HOME: tempDir,
    USERPROFILE: tempDir,
    XDG_CONFIG_HOME: path.join(tempDir, '.config'),
  };
}

describe('CLI login command', () => {
  test('should output help text with examples', async () => {
    const { stdout, exitCode } = await runCli('login --help');

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Authenticate via GitHub or Google OAuth');
    expect(stdout).toContain('Examples:');
    expect(stdout).toContain('--provider github');
    expect(stdout).toContain('--provider google');
  });

  test('should output JSON error when no config exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-login-test-'));

    try {
      const { stderr, exitCode } = await runCliWithCwd('login --json --no-browser', tempDir, isolatedCliEnv(tempDir));

      expect(exitCode).not.toBe(0);

      const errorOutput = JSON.parse(stderr) as { error: string };
      expect(typeof errorOutput.error).toBe('string');
      expect(errorOutput.error).toContain('No mdplane configuration found');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should output JSON error when profile not found', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-login-test-'));
    createCapabilityConfig(tempDir);

    try {
      const { stderr, exitCode } = await runCliWithCwd(
        'login --profile nonexistent --json --no-browser',
        tempDir,
        isolatedCliEnv(tempDir)
      );

      expect(exitCode).not.toBe(0);

      const errorOutput = JSON.parse(stderr) as { error: string };
      expect(typeof errorOutput.error).toBe('string');
      expect(errorOutput.error).toContain('Profile "nonexistent" not found');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should generate correct auth URL for github provider', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-login-test-'));
    createCapabilityConfig(tempDir);

    try {
      const { stdout, exitCode } = await runCliWithCwd(
        'login --provider github --json --no-browser',
        tempDir,
        isolatedCliEnv(tempDir)
      );

      expect(exitCode).toBe(0);

      const output = JSON.parse(stdout) as { status: string; provider: string; url: string };
      expect(output.status).toBe('auth_url_generated');
      expect(output.provider).toBe('github');
      expect(output.url).toBe(
        'http://localhost:3000/login?next=%2Fcontrol'
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should generate correct auth URL for google provider', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-login-test-'));
    createCapabilityConfig(tempDir);

    try {
      const { stdout, exitCode } = await runCliWithCwd(
        'login --provider google --json --no-browser',
        tempDir,
        isolatedCliEnv(tempDir)
      );

      expect(exitCode).toBe(0);

      const output = JSON.parse(stdout) as { status: string; provider: string; url: string };
      expect(output.status).toBe('auth_url_generated');
      expect(output.provider).toBe('google');
      expect(output.url).toBe(
        'http://localhost:3000/login?next=%2Fcontrol'
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should be listed in main help output', async () => {
    const { stdout, exitCode } = await runCli('--help');

    expect(exitCode).toBe(0);
    expect(stdout).toContain('login');
  });
});
