import type { Command } from 'commander';
import chalk from 'chalk';
import {
  loadConfig,
  getActiveProfile,
  getApiUrl,
  getApiKey,
  getCapabilityKeys,
  maskKey,
  findConfigPath,
  getGlobalConfigDir,
  getRepoLocalConfigDir,
} from '../config.js';
import {
  error,
  info,
  keyValue,
  header,
  output,
  outputError,
  renderAsciiWordmark,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction } from './_runtime/index.js';

interface StatusOptions extends OutputOptions {
  showKeys?: boolean;
  profile?: string;
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show current workspace status')
    .option('-p, --profile <name>', 'Profile to show status for')
    .option('--show-keys', 'Show full capability keys (use with caution)')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Show workspace status:
    $ mdplane status

  Show status for a specific profile:
    $ mdplane status --profile prod

  Show full capability keys:
    $ mdplane status --show-keys

  Output as JSON:
    $ mdplane status --json
  `)
    .action(async (options: StatusOptions) => {
      await runCommandAction(options, () => {
        runStatus(options);
      });
    });
}

function runStatus(options: StatusOptions): void {
  const config = loadConfig();
  const configPath = findConfigPath();

  if (config == null) {
    if (options.json === true) {
      outputError({ error: 'No configuration found', initialized: false }, options);
      process.exit(1);
    }
    error('No mdplane configuration found.');
    info('Run "mdplane init" to create a new workspace.');
    process.exit(1);
  }

  const profile = getActiveProfile(options.profile);

  if (profile == null) {
    const profileName = options.profile ?? config.defaultProfile ?? '(unknown)';
    if (options.json === true) {
      outputError({ error: 'Profile not found', profile: profileName }, options);
      process.exit(1);
    }
    error(`Profile "${profileName}" not found.`);
    if (Object.keys(config.profiles).length > 0) {
      info(`Available profiles: ${Object.keys(config.profiles).join(', ')}`);
    }
    process.exit(1);
  }

  const apiUrl = getApiUrl(profile);
  const apiKey = getApiKey(profile);
  const keys = getCapabilityKeys(profile);

  const outputData = {
    initialized: true,
    configPath,
    defaultProfile: config.defaultProfile,
    profile: profile.name,
    mode: profile.mode,
    baseUrl: apiUrl,
    workspaceId: profile.workspaceId,
    workspaceName: profile.workspaceName,
    webUrl: profile.webUrl,
    claimed: profile.claimed ?? false,
    hasApiKey: apiKey != null && apiKey !== '',
    keys: {
      read: options.showKeys === true ? keys.readKey : maskKey(keys.readKey),
      append: options.showKeys === true ? keys.appendKey : maskKey(keys.appendKey),
      write: options.showKeys === true ? keys.writeKey : maskKey(keys.writeKey),
    },
  };

  output({
    data: outputData,
    options,
    formatter: () => {
      console.log(renderAsciiWordmark());
      console.log();
      header('Workspace Status');

      keyValue('Config File', configPath ?? '(not found)');
      keyValue('Default Profile', config.defaultProfile ?? '(not set)');
      keyValue('Active Profile', profile.name);
      keyValue('Mode', profile.mode === 'api-key' ? chalk.green('API Key') : chalk.blue('Capability URLs'));

      if (profile.workspaceId != null && profile.workspaceId !== '') {
        keyValue('Workspace ID', profile.workspaceId);
      }

      if (profile.workspaceName != null && profile.workspaceName !== '') {
        keyValue('Workspace Name', profile.workspaceName);
      }

      if (profile.webUrl != null && profile.webUrl !== '') {
        keyValue('Web URL', profile.webUrl);
      }

      keyValue(
        'Claimed',
        profile.claimed === true ? chalk.green('Yes') : chalk.yellow('No (run "mdplane claim")')
      );
      keyValue('Base URL', apiUrl);

      if (profile.mode === 'api-key') {
        console.log();
        header('API Key');
        keyValue('API Key', apiKey !== undefined && apiKey !== '' ? maskKey(apiKey) : '(not set)');
      } else {
        console.log();
        header('Capability Keys');

        const displayKey = (key: string | undefined): string => {
          if (options.showKeys === true) {
            return key ?? '(not set)';
          }
          return maskKey(key);
        };

        keyValue('Read Key', displayKey(keys.readKey));
        keyValue('Append Key', displayKey(keys.appendKey));
        keyValue('Write Key', displayKey(keys.writeKey));

        if (options.showKeys !== true && ((keys.readKey != null && keys.readKey !== '') || (keys.appendKey != null && keys.appendKey !== '') || (keys.writeKey != null && keys.writeKey !== ''))) {
          console.log();
          info('Use --show-keys to display full keys (handle with care)');
        }
      }

      console.log();
      header('Configuration Locations');
      keyValue('Global Config', getGlobalConfigDir());
      keyValue('Repo-Local Config', getRepoLocalConfigDir());
    },
  });
}
