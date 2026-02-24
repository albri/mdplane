import { describe, test, expect, beforeEach, afterEach, vi } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  maskKey,
  getApiUrl,
  getAppUrl,
  getApiKey,
  getCapabilityKeys,
  getActiveProfile,
  getRequiredKey,
  saveConfig,
  loadConfig,
  getGlobalConfigDir,
  getRepoLocalConfigDir,
  getOldConfigPath,
  extractKeyFromUrl,
  type CliConfig,
  type Profile,
} from '../../config.js';

describe('config', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.restoreAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-config-test-'));
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

  describe('maskKey', () => {
    test('should return "(not set)" for undefined', () => {
      expect(maskKey(undefined)).toBe('(not set)');
    });

    test('should return "****" for short keys', () => {
      expect(maskKey('abc')).toBe('****');
      expect(maskKey('abcdefghijkl')).toBe('****');
    });

    test('should mask middle of long keys', () => {
      expect(maskKey('abcd1234567890efgh')).toBe('abcd...efgh');
    });

    test('should handle exactly 13 character keys', () => {
      expect(maskKey('1234567890abc')).toBe('1234...0abc');
    });
  });

  describe('extractKeyFromUrl', () => {
    test('should extract read key from URL', () => {
      expect(extractKeyFromUrl('https://mdplane.dev/r/abc123/...')).toBe('abc123');
    });

    test('should extract append key from URL', () => {
      expect(extractKeyFromUrl('https://mdplane.dev/a/def456/...')).toBe('def456');
    });

    test('should extract write key from URL', () => {
      expect(extractKeyFromUrl('https://mdplane.dev/w/ghi789/...')).toBe('ghi789');
    });

    test('should return undefined for invalid URL', () => {
      expect(extractKeyFromUrl('https://example.com/path')).toBeUndefined();
    });
  });

  describe('config paths', () => {
    test('should use XDG config home on Linux', () => {
      vi.spyOn(os, 'platform').mockReturnValue('linux');
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
      const result = getGlobalConfigDir();
      const expected = '/home/user/.config/mdplane';
      expect(path.posix.normalize(result.replace(/\\/g, '/'))).toBe(expected);
    });

    test('should use AppData on Windows', () => {
      vi.spyOn(os, 'platform').mockReturnValue('win32');
      vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\user');
      process.env.APPDATA = 'C:\\Users\\user\\AppData\\Roaming';
      const result = getGlobalConfigDir();
      const expected = path.win32.join('C:\\Users\\user\\AppData\\Roaming', 'mdplane');
      expect(path.win32.normalize(result.replace(/\//g, '\\'))).toBe(expected);
    });

    test('should use XDG config home on macOS', () => {
      vi.spyOn(os, 'platform').mockReturnValue('darwin');
      vi.spyOn(os, 'homedir').mockReturnValue('/Users/user');
      const result = getGlobalConfigDir();
      const expected = '/Users/user/.config/mdplane';
      expect(path.posix.normalize(result.replace(/\\/g, '/'))).toBe(expected);
    });
  });

  describe('saveConfig and loadConfig', () => {
    test('should save and load config', () => {
      const config: CliConfig = {
        defaultProfile: 'prod',
        profiles: {
          prod: {
            name: 'prod',
            baseUrl: 'https://api.mdplane.dev',
            mode: 'api-key',
            apiKey: 'sk_live_test123',
          },
        },
      };

      saveConfig(config, false);
      const loaded = loadConfig();

      expect(loaded).toEqual(config);
    });

    test('should migrate old config format to new format', () => {
      const oldConfig = {
        workspaceId: 'ws_123',
        workspaceName: 'default',
        readKey: 'read123',
        appendKey: 'append123',
        writeKey: 'write123',
        apiUrl: 'https://api.mdplane.dev',
        claimed: false,
      };

      const configDir = getGlobalConfigDir();
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(getOldConfigPath(), JSON.stringify(oldConfig));

      const loaded = loadConfig();

      expect(loaded?.defaultProfile).toBe('default');
      expect(loaded?.profiles.default?.name).toBe('default');
      expect(loaded?.profiles.default?.mode).toBe('capability');
      expect(loaded?.profiles.default?.capabilityUrls?.read).toBe('read123');
      expect(loaded?.profiles.default?.capabilityUrls?.append).toBe('append123');
      expect(loaded?.profiles.default?.capabilityUrls?.write).toBe('write123');
    });

    test('should migrate old config with API key', () => {
      const oldConfig = {
        workspaceId: 'ws_123',
        workspaceName: 'api-mode',
        apiUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_live_test',
        claimed: false,
      };

      const configDir = getGlobalConfigDir();
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(getOldConfigPath(), JSON.stringify(oldConfig));

      const loaded = loadConfig();

      expect(loaded?.defaultProfile).toBe('api-mode');
      expect(loaded?.profiles['api-mode']?.mode).toBe('api-key');
      expect(loaded?.profiles['api-mode']?.apiKey).toBe('sk_live_test');
    });

    test('should return null when no config exists', () => {
      expect(loadConfig()).toBeNull();
    });
  });

  describe('getActiveProfile', () => {
    test('should return default profile when no name specified', () => {
      const config: CliConfig = {
        defaultProfile: 'prod',
        profiles: {
          prod: {
            name: 'prod',
            baseUrl: 'https://api.mdplane.dev',
            mode: 'api-key',
            apiKey: 'sk_live_test123',
          },
        },
      };

      saveConfig(config, false);
      const profile = getActiveProfile();

      expect(profile?.name).toBe('prod');
      expect(profile?.apiKey).toBe('sk_live_test123');
    });

    test('should return named profile when specified', () => {
      const config: CliConfig = {
        defaultProfile: 'prod',
        profiles: {
          prod: {
            name: 'prod',
            baseUrl: 'https://api.mdplane.dev',
            mode: 'api-key',
            apiKey: 'sk_live_test123',
          },
          dev: {
            name: 'dev',
            baseUrl: 'https://dev.api.mdplane.dev',
            mode: 'api-key',
            apiKey: 'sk_test_test456',
          },
        },
      };

      saveConfig(config, false);
      const profile = getActiveProfile('dev');

      expect(profile?.name).toBe('dev');
      expect(profile?.apiKey).toBe('sk_test_test456');
    });

    test('should return null when no config exists', () => {
      expect(getActiveProfile()).toBeNull();
    });

    test('should return null when profile not found', () => {
      const config: CliConfig = {
        defaultProfile: 'prod',
        profiles: {
          prod: {
            name: 'prod',
            baseUrl: 'https://api.mdplane.dev',
            mode: 'api-key',
            apiKey: 'sk_live_test123',
          },
        },
      };

      saveConfig(config, false);
      const profile = getActiveProfile('nonexistent');

      expect(profile).toBeNull();
    });
  });

  describe('getAppUrl', () => {
    test('should use MDPLANE_APP_URL when set', () => {
      process.env.MDPLANE_APP_URL = 'https://app.override.example/';
      const profile: Profile = {
        name: 'prod',
        baseUrl: 'https://api.mdplane.dev',
        mode: 'api-key',
        apiKey: 'sk_live_test123',
      };

      expect(getAppUrl(profile)).toBe('https://app.override.example');
    });

    test('should derive origin from profile webUrl when available', () => {
      delete process.env.MDPLANE_APP_URL;
      const profile: Profile = {
        name: 'prod',
        baseUrl: 'https://api.mdplane.dev',
        mode: 'capability',
        webUrl: 'https://app.mdplane.dev/r/r_test_key',
      };

      expect(getAppUrl(profile)).toBe('https://app.mdplane.dev');
    });

    test('should default to canonical app domain for non-local API hosts', () => {
      delete process.env.MDPLANE_APP_URL;
      const profile: Profile = {
        name: 'prod',
        baseUrl: 'https://api.prod.mdplane.dev',
        mode: 'api-key',
        apiKey: 'sk_live_test123',
      };

      expect(getAppUrl(profile)).toBe('https://app.mdplane.dev');
    });

    test('should map localhost api port 3001 to app port 3000', () => {
      delete process.env.MDPLANE_APP_URL;
      const profile: Profile = {
        name: 'dev',
        baseUrl: 'http://localhost:3001',
        mode: 'api-key',
        apiKey: 'sk_test_123',
      };

      expect(getAppUrl(profile)).toBe('http://localhost:3000');
    });
  });

  describe('precedence: flags > env > repo-local > global', () => {
    beforeEach(() => {
      vi.spyOn(os, 'homedir').mockReturnValue(tempDir);
      vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

      const globalConfig: CliConfig = {
        defaultProfile: 'prod',
        profiles: {
          prod: {
            name: 'prod',
            baseUrl: 'https://global.api.com',
            mode: 'api-key',
            apiKey: 'sk_global_key',
          },
        },
      };

      saveConfig(globalConfig, false);

      const repoLocalConfig: CliConfig = {
        defaultProfile: 'prod',
        profiles: {
          prod: {
            name: 'prod',
            baseUrl: 'https://local.api.com',
            mode: 'api-key',
            apiKey: 'sk_local_key',
          },
        },
      };

      saveConfig(repoLocalConfig, true);
    });

    test('global config should be loaded when repo-local does not exist', () => {
      fs.rmSync(getRepoLocalConfigDir(), { recursive: true });
      const profile = getActiveProfile('prod');
      expect(profile?.baseUrl).toBe('https://global.api.com');
      expect(profile?.apiKey).toBe('sk_global_key');
    });

    test('repo-local should override global config', () => {
      const profile = getActiveProfile('prod');
      expect(profile?.baseUrl).toBe('https://local.api.com');
      expect(profile?.apiKey).toBe('sk_local_key');
    });

    test('env vars should override repo-local config', () => {
      process.env.MDPLANE_API_URL = 'https://env.api.com';
      process.env.MDPLANE_API_KEY = 'sk_env_key';

      const profile = getActiveProfile('prod');
      expect(getApiUrl(profile)).toBe('https://env.api.com');
      expect(getApiKey(profile)).toBe('sk_env_key');
    });

    test('flags should override env vars', () => {
      process.env.MDPLANE_API_URL = 'https://env.api.com';
      process.env.MDPLANE_API_KEY = 'sk_env_key';

      const profile = getActiveProfile('prod');

      expect(getApiKey(profile, 'sk_flag_key')).toBe('sk_flag_key');
    });

    test('flags should override env vars for capability keys', () => {
      const config: CliConfig = {
        defaultProfile: 'cap',
        profiles: {
          cap: {
            name: 'cap',
            baseUrl: 'https://api.mdplane.dev',
            mode: 'capability',
            capabilityUrls: {
              read: 'read_global',
              append: 'append_global',
              write: 'write_global',
            },
          },
        },
      };

      saveConfig(config, true);

      process.env.MDPLANE_READ_KEY = 'read_env';
      process.env.MDPLANE_APPEND_KEY = 'append_env';
      process.env.MDPLANE_WRITE_KEY = 'write_env';

      const profile = getActiveProfile('cap');

      const keys = getCapabilityKeys(profile, {
        readKey: 'read_flag',
        appendKey: 'append_flag',
        writeKey: 'write_flag',
      });

      expect(keys.readKey).toBe('read_flag');
      expect(keys.appendKey).toBe('append_flag');
      expect(keys.writeKey).toBe('write_flag');
    });

    test('env vars should override repo-local for capability keys', () => {
      const config: CliConfig = {
        defaultProfile: 'cap',
        profiles: {
          cap: {
            name: 'cap',
            baseUrl: 'https://api.mdplane.dev',
            mode: 'capability',
            capabilityUrls: {
              read: 'read_local',
              append: 'append_local',
              write: 'write_local',
            },
          },
        },
      };

      saveConfig(config, true);

      process.env.MDPLANE_READ_KEY = 'read_env';
      process.env.MDPLANE_APPEND_KEY = 'append_env';
      process.env.MDPLANE_WRITE_KEY = 'write_env';

      const profile = getActiveProfile('cap');

      const keys = getCapabilityKeys(profile);

      expect(keys.readKey).toBe('read_env');
      expect(keys.appendKey).toBe('append_env');
      expect(keys.writeKey).toBe('write_env');
    });

    test('repo-local should override global for capability keys', () => {
      const globalConfig: CliConfig = {
        defaultProfile: 'cap',
        profiles: {
          cap: {
            name: 'cap',
            baseUrl: 'https://api.mdplane.dev',
            mode: 'capability',
            capabilityUrls: {
              read: 'read_global',
              append: 'append_global',
              write: 'write_global',
            },
          },
        },
      };

      saveConfig(globalConfig, false);

      const repoLocalConfig: CliConfig = {
        defaultProfile: 'cap',
        profiles: {
          cap: {
            name: 'cap',
            baseUrl: 'https://api.mdplane.dev',
            mode: 'capability',
            capabilityUrls: {
              read: 'read_local',
              append: 'append_local',
              write: 'write_local',
            },
          },
        },
      };

      saveConfig(repoLocalConfig, true);

      const profile = getActiveProfile('cap');
      const keys = getCapabilityKeys(profile);

      expect(keys.readKey).toBe('read_local');
      expect(keys.appendKey).toBe('append_local');
      expect(keys.writeKey).toBe('write_local');
    });
  });

  describe('getCapabilityKeys', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should return undefined keys when no profile', () => {
      const keys = getCapabilityKeys(null);
      expect(keys.readKey).toBeUndefined();
      expect(keys.appendKey).toBeUndefined();
      expect(keys.writeKey).toBeUndefined();
    });

    test('should return profile keys when set', () => {
      delete process.env.MDPLANE_READ_KEY;
      delete process.env.MDPLANE_APPEND_KEY;
      delete process.env.MDPLANE_WRITE_KEY;

      const profile: Profile = {
        name: 'cap',
        baseUrl: 'https://api.mdplane.dev',
        mode: 'capability',
        capabilityUrls: {
          read: 'read123',
          append: 'append456',
          write: 'write789',
        },
      };

      const keys = getCapabilityKeys(profile);
      expect(keys.readKey).toBe('read123');
      expect(keys.appendKey).toBe('append456');
      expect(keys.writeKey).toBe('write789');
    });

    test('should prefer flags over profile and env', () => {
      process.env.MDPLANE_READ_KEY = 'envRead';
      process.env.MDPLANE_APPEND_KEY = 'envAppend';
      process.env.MDPLANE_WRITE_KEY = 'envWrite';

      const profile: Profile = {
        name: 'cap',
        baseUrl: 'https://api.mdplane.dev',
        mode: 'capability',
        capabilityUrls: {
          read: 'profileRead',
          append: 'profileAppend',
          write: 'profileWrite',
        },
      };

      const keys = getCapabilityKeys(profile, {
        readKey: 'flagRead',
        appendKey: 'flagAppend',
        writeKey: 'flagWrite',
      });

      expect(keys.readKey).toBe('flagRead');
      expect(keys.appendKey).toBe('flagAppend');
      expect(keys.writeKey).toBe('flagWrite');
    });
  });

  describe('getRequiredKey', () => {
    test('should extract write key from capability URL', () => {
      const profile: Profile = {
        name: 'cap',
        baseUrl: 'https://api.mdplane.dev',
        mode: 'capability',
      };

      const key = getRequiredKey(
        {
          profile,
          apiUrl: 'https://api.mdplane.dev',
          apiKey: undefined,
          keys: {
            readKey: undefined,
            appendKey: undefined,
            writeKey: 'https://api.mdplane.dev/w/testWriteKey123',
          },
        },
        'write'
      );

      expect(key).toBe('testWriteKey123');
    });

    test('should extract read key from capability URL', () => {
      const profile: Profile = {
        name: 'cap',
        baseUrl: 'https://api.mdplane.dev',
        mode: 'capability',
      };

      const key = getRequiredKey(
        {
          profile,
          apiUrl: 'https://api.mdplane.dev',
          apiKey: undefined,
          keys: {
            readKey: 'https://api.mdplane.dev/r/testReadKey456',
            appendKey: undefined,
            writeKey: undefined,
          },
        },
        'read'
      );

      expect(key).toBe('testReadKey456');
    });

    test('should prefer API key in api-key mode', () => {
      const profile: Profile = {
        name: 'prod',
        baseUrl: 'https://api.mdplane.dev',
        mode: 'api-key',
        apiKey: 'sk_live_123',
      };

      const key = getRequiredKey(
        {
          profile,
          apiUrl: 'https://api.mdplane.dev',
          apiKey: 'sk_live_123',
          keys: {
            readKey: 'https://api.mdplane.dev/r/ignored',
            appendKey: 'https://api.mdplane.dev/a/ignored',
            writeKey: 'https://api.mdplane.dev/w/ignored',
          },
        },
        'write'
      );

      expect(key).toBe('sk_live_123');
    });
  });
});
