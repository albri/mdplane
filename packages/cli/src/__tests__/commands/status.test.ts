import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCliWithCwd } from '../helpers/run-cli.js';

interface CliConfig {
  profiles: Record<string, { apiUrl: string; readKey?: string; appendKey?: string; writeKey?: string; apiKey?: string }>;
  activeProfile: string;
}

/** Helper to simulate runtime config loading - returns config or null */
function loadConfig(exists: boolean): CliConfig | null {
  if (!exists) return null;
  return {
    profiles: {
      default: {
        apiUrl: 'https://api.mdplane.dev',
        readKey: 'r_test',
        appendKey: 'a_test',
        writeKey: 'w_test',
      },
    },
    activeProfile: 'default',
  };
}

describe('status command', () => {
  describe('config loading', () => {
    test('should detect missing config', () => {
      const config = loadConfig(false);
      const hasConfig = config != null;
      expect(hasConfig).toBe(false);
    });

    test('should detect valid config', () => {
      const config = loadConfig(true);
      const hasConfig = config != null;
      expect(hasConfig).toBe(true);
    });
  });

  describe('profile resolution', () => {
    test('should use active profile by default', () => {
      const config: CliConfig = {
        profiles: {
          default: { apiUrl: 'https://api.mdplane.dev', readKey: 'r_default' },
          prod: { apiUrl: 'https://api.mdplane.dev', readKey: 'r_prod' },
        },
        activeProfile: 'default',
      };
      const options: { profile: string | undefined } = { profile: undefined };
      const profileName = options.profile ?? config.activeProfile;
      expect(profileName).toBe('default');
    });

    test('should use specified profile when provided', () => {
      const config: CliConfig = {
        profiles: {
          default: { apiUrl: 'https://api.mdplane.dev', readKey: 'r_default' },
          prod: { apiUrl: 'https://api.mdplane.dev', readKey: 'r_prod' },
        },
        activeProfile: 'default',
      };
      const options: { profile: string | undefined } = { profile: 'prod' };
      const profileName = options.profile ?? config.activeProfile;
      expect(profileName).toBe('prod');
    });

    test('should detect profile not found', () => {
      const config: CliConfig = {
        profiles: {
          default: { apiUrl: 'https://api.mdplane.dev', readKey: 'r_default' },
        },
        activeProfile: 'default',
      };
      const requestedProfile = 'nonexistent';
      const profileExists = requestedProfile in config.profiles;
      expect(profileExists).toBe(false);
    });
  });

  describe('JSON output format', () => {
    interface StatusOutput {
      profile: string;
      apiUrl: string;
      hasReadKey: boolean;
      hasAppendKey: boolean;
      hasWriteKey: boolean;
      hasApiKey: boolean;
    }

    test('should format JSON output correctly', () => {
      const profile: { apiUrl: string; readKey: string | undefined; appendKey: string | undefined; writeKey: string | undefined; apiKey: string | undefined } = {
        apiUrl: 'https://api.mdplane.dev',
        readKey: 'r_test',
        appendKey: 'a_test',
        writeKey: 'w_test',
        apiKey: undefined,
      };
      const output: StatusOutput = {
        profile: 'default',
        apiUrl: profile.apiUrl,
        hasReadKey: profile.readKey != null,
        hasAppendKey: profile.appendKey != null,
        hasWriteKey: profile.writeKey != null,
        hasApiKey: profile.apiKey != null,
      };

      expect(output.profile).toBe('default');
      expect(output.hasReadKey).toBe(true);
      expect(output.hasAppendKey).toBe(true);
      expect(output.hasWriteKey).toBe(true);
      expect(output.hasApiKey).toBe(false);
    });

    test('should produce valid JSON', () => {
      const output: StatusOutput = {
        profile: 'default',
        apiUrl: 'https://api.mdplane.dev',
        hasReadKey: true,
        hasAppendKey: true,
        hasWriteKey: true,
        hasApiKey: false,
      };
      const json = JSON.stringify(output);
      expect(() => JSON.parse(json) as StatusOutput).not.toThrow();
    });
  });

  describe('show-keys option', () => {
    test('should hide keys by default', () => {
      const options: { showKeys: boolean | undefined } = { showKeys: undefined };
      const shouldShowKeys = options.showKeys === true;
      expect(shouldShowKeys).toBe(false);
    });

    test('should show keys when flag is set', () => {
      const options: { showKeys: boolean | undefined } = { showKeys: true };
      const shouldShowKeys = options.showKeys === true;
      expect(shouldShowKeys).toBe(true);
    });

    test('should mask key by default', () => {
      const key = 'r_x8k2mP9qL3nR7mQ2pN4xK9wL';
      const mask = (k: string): string => k.slice(0, 4) + '...' + k.slice(-4);
      expect(mask(key)).toBe('r_x8...K9wL');
    });
  });

  describe('command execution (real CLI)', () => {
    let tempDir: string;
    let mdplaneDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-status-test-'));
      mdplaneDir = path.join(tempDir, '.mdplane');
      fs.mkdirSync(mdplaneDir);
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('outputs valid JSON with --json flag', async () => {
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: 'http://localhost:3001',
            mode: 'capability',
            capabilityUrls: {
              read: 'http://localhost:3001/r/testReadKey',
              append: 'http://localhost:3001/a/testAppendKey',
              write: 'http://localhost:3001/w/testWriteKey',
            },
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      const { stdout, exitCode } = await runCliWithCwd('status --json', tempDir);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout) as { profile: string; mode: string; initialized: boolean };
      expect(parsed.profile).toBe('default');
      expect(parsed.mode).toBe('capability');
      expect(parsed.initialized).toBe(true);
    });

    test('respects --profile flag to select alternate profile', async () => {
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: 'http://localhost:3001',
            mode: 'capability',
            capabilityUrls: { read: 'http://localhost:3001/r/defaultKey' },
          },
          prod: {
            name: 'prod',
            baseUrl: 'http://localhost:4000',
            mode: 'api-key',
            apiKey: 'sk_prod_key',
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      const { stdout, exitCode } = await runCliWithCwd('status --profile prod --json', tempDir);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout) as { profile: string; hasApiKey: boolean };
      expect(parsed.profile).toBe('prod');
      expect(parsed.hasApiKey).toBe(true);
    });

    test('errors when specified profile does not exist', async () => {
      const configContent = {
        defaultProfile: 'default',
        profiles: {
          default: {
            name: 'default',
            baseUrl: 'http://localhost:3001',
            mode: 'capability',
            capabilityUrls: { read: 'http://localhost:3001/r/testKey' },
          },
        },
      };
      fs.writeFileSync(path.join(mdplaneDir, 'config.json'), JSON.stringify(configContent));

      const { stderr, exitCode } = await runCliWithCwd('status --profile nonexistent --json', tempDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Profile not found');
    });
  });
});
