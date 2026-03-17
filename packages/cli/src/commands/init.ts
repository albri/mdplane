import type { Command } from 'commander';
import { URLS } from '@mdplane/shared';
import { ApiClient } from '../api.js';
import {
  loadConfigFromPath,
  saveConfig,
  getGlobalConfigPath,
  getRepoLocalConfigPath,
  type CliConfig,
  type Profile,
} from '../config.js';
import {
  success,
  error,
  warn,
  info,
  keyValue,
  header,
  output,
  outputError,
  renderAsciiWordmark,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction } from './_runtime/index.js';

interface InitOptions extends OutputOptions {
  profile?: string;
  baseUrl?: string;
  apiKey?: string;
  name?: string;
  force?: boolean;
  global?: boolean;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize mdplane configuration (profile-based)')
    .option('-p, --profile <name>', 'Profile name to create or update')
    .option('-u, --base-url <url>', 'Base API URL for profile')
    .option('-k, --api-key <key>', 'API key for profile (API key mode)')
    .option('-n, --name <name>', 'Name for workspace (capability mode)')
    .option('-f, --force', 'Overwrite existing profile')
    .option('--global', 'Save config to global location (~/.config/mdplane or %APPDATA%/mdplane)')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Initialize with API key (recommended for advanced users):
    $ mdplane init --api-key sk_live_...

  Initialize anonymous workspace with capability URLs:
    $ mdplane init --name "My Workspace"

  Create a named profile:
    $ mdplane init --profile prod --api-key sk_live_...

  Overwrite existing profile:
    $ mdplane init --profile default --api-key sk_live_... --force
  `)
    .action(async (options: InitOptions) => {
      await runCommandAction(options, () => runInit(options));
    });
}

async function runInit(options: InitOptions): Promise<void> {
  const profileName = options.profile ?? 'default';
  const saveRepoLocal = options.global !== true;
  const configPath = saveRepoLocal ? getRepoLocalConfigPath() : getGlobalConfigPath();

  if (options.apiKey != null && (options.name != null || options.baseUrl != null)) {
    throw new Error('Cannot use --api-key with --name or --base-url. Use API key mode or capability mode, not both.');
  }

  if (options.apiKey == null && options.name == null) {
    throw new Error('Must specify either --api-key (API key mode) or --name (capability mode) to initialize.');
  }

  const existingConfig = loadConfigFromPath(configPath);

  if (existingConfig?.profiles[profileName] != null && options.force !== true) {
    if (options.json === true) {
      outputError({
        error: 'Profile already exists',
        profile: profileName,
      }, options);
      process.exit(1);
    }
    error(`Profile "${profileName}" already exists.`);
    info('Use --force to overwrite the existing profile.');
    process.exit(1);
  }

  const config = existingConfig ?? {
    defaultProfile: profileName,
    profiles: {},
  };

  if (options.apiKey != null) {
    initApiKeyMode({ config, profileName, options });
  } else {
    await initCapabilityMode({ config, profileName, options });
  }

  saveConfig(config, saveRepoLocal);

  if (config.defaultProfile === undefined) {
    config.defaultProfile = profileName;
    saveConfig(config, saveRepoLocal);
  }

  const profile = config.profiles[profileName];
  if (profile == null) {
    throw new Error('Profile not found after creation');
  }
  const outputData = {
    profile: profileName,
    baseUrl: profile.baseUrl,
    mode: profile.mode,
    workspaceId: profile.workspaceId,
    workspaceName: profile.workspaceName,
    capabilityUrls: profile.capabilityUrls,
    webUrl: profile.webUrl,
    configPath,
  };

  output({
    data: outputData,
    options,
    formatter: () => {
      console.log(renderAsciiWordmark());
      console.log();
      header('Profile Created');
      keyValue('Profile', profileName);
      keyValue('Mode', profile.mode);
      keyValue('Base URL', profile.baseUrl);
      if (profile.workspaceId !== undefined && profile.workspaceId !== '') {
        keyValue('Workspace ID', profile.workspaceId);
      }
      if (profile.workspaceName !== undefined && profile.workspaceName !== '') {
        keyValue('Workspace Name', profile.workspaceName);
      }
      if (profile.webUrl !== undefined && profile.webUrl !== '') {
        keyValue('Web URL', profile.webUrl);
      }
      if (profile.mode === 'capability') {
        keyValue('Read URL', profile.capabilityUrls?.read ?? '(missing)');
        keyValue('Append URL', profile.capabilityUrls?.append ?? '(missing)');
        keyValue('Write URL', profile.capabilityUrls?.write ?? '(missing)');
      }
      keyValue('Config Path', configPath);
      console.log();
      success(`Configuration saved to ${configPath}`);
      console.log();
      if (profile.mode === 'capability') {
        warn('Your config contains capability URLs - keep them secure.');
        info('Add .mdplane to your .gitignore to prevent accidental commits.');
      } else {
        info('API key mode configured - keep your API key secure.');
      }
      console.log();
      info('Next steps:');
      console.log(`  • Run "mdplane status${profileName !== 'default' ? ` --profile ${profileName}` : ''}" to view your workspace`);
      if (profile.mode === 'capability') {
        console.log('  • Run "mdplane login" to enable recovery options');
        console.log('  • Run "mdplane files" to list files');
      }
    },
  });
}

function initApiKeyMode(opts: {
  config: CliConfig;
  profileName: string;
  options: InitOptions;
}): void {
  const { config, profileName, options } = opts;
  const baseUrl = options.baseUrl ?? URLS.API;

  if (options.apiKey == null) {
    throw new Error('API key is required for API key mode');
  }

  const profile: Profile = {
    name: profileName,
    baseUrl,
    mode: 'api-key',
    apiKey: options.apiKey,
  };

  config.profiles[profileName] = profile;

  if (options.json !== true) {
    info(`Creating profile "${profileName}" in API key mode...`);
  }
}

async function initCapabilityMode(opts: {
  config: CliConfig;
  profileName: string;
  options: InitOptions;
}): Promise<void> {
  const { config, profileName, options } = opts;
  const apiUrl = options.baseUrl ?? URLS.API;
  const client = new ApiClient({ baseUrl: apiUrl });

  if (options.json !== true) {
    info(`Bootstrapping workspace${options.name !== undefined ? ` "${options.name}"` : ''}...`);
  }

  const result = await client.bootstrap(options.name);

  const capabilityUrls = {
    read: result.urls.api.read,
    append: result.urls.api.append,
    write: result.urls.api.write,
  };

  const profile: Profile = {
    name: profileName,
    baseUrl: apiUrl,
    mode: 'capability',
    capabilityUrls,
    workspaceId: result.workspaceId,
    ...(options.name != null ? { workspaceName: options.name } : {}),
    webUrl: result.urls.web.read,
    claimed: false,
  };

  config.profiles[profileName] = profile;
}
